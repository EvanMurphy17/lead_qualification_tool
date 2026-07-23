"""Build the web-optimized dataset for the C&I lead qualification app.

Reads the raw benchmarking Excel files in data/, extracts a rich canonical
schema (usage, EUI, coordinates, owner, demand, year built), normalizes units
(electricity -> kWh, gas -> kBtu), dedupes to the latest reported year per
building, and writes:

  data/web/buildings.json.gz   compact columnar payload for the web app
  data/web/stats.json          aggregate stats for the landing page

Usage:
  python scripts/build_web_dataset.py [--out <dir>] [--also-copy <dir>]
"""
from __future__ import annotations

import argparse
import gzip
import json
import math
import re
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"

KBTU_PER_KWH = 3.412142
KBTU_PER_THERM = 100.0

# ---------------------------------------------------------------------------
# Per-program extraction spec.
# Each field maps to either a raw column name ("col"), a literal ("lit"),
# or None (unavailable). Units are declared so values can be normalized.
# ---------------------------------------------------------------------------
PROGRAMS: dict[str, dict] = {
    "Boston": {
        "file": "boston_2025-reported-energy-and-water-metrics.xlsx",
        "sheet": "Data Disclosure",
        "header_row": 1,  # row 0 is group headers
        "source_url": "https://data.boston.gov/dataset/building-emissions-reduction-and-disclosure-ordinance",
        "id": {"col": "BERDO ID"},
        "name": None,  # BERDO publishes owner + address, no building name
        "owner": {"col": "Property Owner Name"},
        "address": {"col": "Building Address"},
        "city": {"col": "Building Address City"},
        "state": {"lit": "MA"},
        "zip": {"col": "Building Address Zip  Code"},
        "lat": None,
        "lon": None,
        "property_type": {"col": "Largest Property Type"},
        "floor_area": {"col": "Reported Gross Floor Area (Sq Ft)"},
        "year_built": None,
        "data_year": {"lit": 2024},  # 2025 reporting cycle = CY2024 usage
        "elec": {"col": "Electricity Usage (kWh)", "unit": "kWh"},
        "gas": {"col": "Natural Gas Usage (kBtu)", "unit": "kBtu"},
        "site_eui": {"col": "Site EUI (Energy Use Intensity kBtu/ft²)"},
        "energy_star": {"col": "Energy Star Score"},
        "peak_kw": None,
    },
    "California": {
        "file": "california_2024_Download_ADA.xlsx",
        "sheet": "2024",
        "header_row": 2,  # rows 0-1 are title/blank
        "source_url": "https://www.energy.ca.gov/data-reports/reports/building-energy-benchmarking-program",
        "id": {"col": "Portfolio Manager Property ID"},
        "name": {"col": "Property Name"},
        "owner": None,
        "address": {"col": "Address 1"},
        "city": {"col": "City"},
        "state": {"lit": "CA"},
        "zip": {"col": "Postal Code"},
        "lat": {"col": "Latitude"},
        "lon": {"col": "Longitude"},
        "property_type": {"col": "Primary Property Type - Portfolio Manager-Calculated"},
        "floor_area": {"col": "Property GFA - Calculated (Buildings) (ft²)"},
        "year_built": {"col": "Year Built"},
        "data_year": {"lit": 2024},
        "elec": {"col": "Electricity Use - Grid Purchase (kBtu)", "unit": "kBtu"},
        "gas": {"col": "Natural Gas Use (kBtu)", "unit": "kBtu"},
        "site_eui": {"col": "Weather Normalized Site EUI (kBtu/ft²)"},
        "energy_star": {"col": "ENERGY STAR Score"},
        "peak_kw": None,
    },
    "Chicago": {
        "file": "chicago_Chicago_Energy_Benchmarking_20250923.xlsx",
        "source_url": "https://data.cityofchicago.org/Environment-Sustainable-Development/Chicago-Energy-Benchmarking/xq83-jr8c",
        "id": {"col": "ID"},
        "name": {"col": "Property Name"},
        "owner": None,
        "address": {"col": "Address"},
        "city": {"lit": "Chicago"},
        "state": {"lit": "IL"},
        "zip": {"col": "ZIP Code"},
        "lat": {"col": "Latitude"},
        "lon": {"col": "Longitude"},
        "property_type": {"col": "Primary Property Type"},
        "floor_area": {"col": "Gross Floor Area - Buildings (sq ft)"},
        "year_built": {"col": "Year Built"},
        "data_year": {"col": "Data Year"},
        "elec": {"col": "Electricity Use (kBtu)", "unit": "kBtu"},
        "gas": {"col": "Natural Gas Use (kBtu)", "unit": "kBtu"},
        "site_eui": {"col": "Site EUI (kBtu/sq ft)"},
        "energy_star": {"col": "ENERGY STAR Score"},
        "peak_kw": None,
    },
    "Denver": {
        "file": "denver_Energize_Denver_2023_Final_Master_Dataset.xlsx",
        "source_url": "https://denvergov.org/Government/Agencies-Departments-Offices/Agencies-Departments-Offices-Directory/Climate-Action-Sustainability-Resiliency/High-Performance-Buildings-and-Homes/Energize-Denver-Hub",
        "id": {"col": "Building_ID"},
        "name": {"col": "Property_Name"},
        "owner": None,
        "address": {"col": "Street"},
        "city": {"lit": "Denver"},
        "state": {"lit": "CO"},
        "zip": {"col": "Zipcode"},
        "lat": None,
        "lon": None,
        "property_type": {"col": "Master_Property_Type"},
        "floor_area": {"col": "Master_Sq_Ft"},
        "year_built": {"col": "Year_Built"},
        "data_year": {"col": "Reporting_Year"},
        "elec": {"col": "Electricity_Use_Grid_Purchase__", "unit": "kWh"},
        "gas": {"col": "Natural_Gas_Use__kBtu_", "unit": "kBtu"},
        "site_eui": {"col": "Site_EUI__kBtu_Sq_Ft_"},
        "energy_star": {"col": "Energy_Star_Score"},
        "peak_kw": None,
    },
    "Montgomery County": {
        "file": "moco_2024_Energy_Benchmarking_All_Sites_20250923.xlsx",
        "source_url": "https://data.montgomerycountymd.gov/Environment/2024-Energy-Benchmarking-All-Sites/g6nn-rgwc",
        "id": {"col": "ESPM Property ID"},
        "name": {"col": "Building Name"},
        "owner": None,
        "address": {"col": "Address"},
        "city": {"col": "City"},
        "state": {"lit": "MD"},
        "zip": {"col": "Zip"},
        "lat": None,
        "lon": None,
        "property_type": {"col": "Primary Property Type Self Selected"},
        "floor_area": {"col": "Reported Property Gross Floor Area"},
        "year_built": {"col": "Year Built"},
        "data_year": {"col": "Reporting Year Start Date", "kind": "date_year"},
        "elec": {"col": "Electricity (kWh)", "unit": "kWh"},
        "gas": {"col": "Natural Gas (therms)", "unit": "therms"},
        "site_eui": {"col": "Site EUI"},
        "energy_star": {"col": "ENERGY STAR Score"},
        "peak_kw": None,
    },
    "New York City": {
        "file": "nyc_NYC_Building_Energy_and_Water_Data_Disclosure_for_Local_Law_84__2022-Present__20250923.xlsx",
        "source_url": "https://data.cityofnewyork.us/Environment/NYC-Building-Energy-and-Water-Data-Disclosure-for-/5zyy-y8am",
        "id": {"col": "Property ID"},
        "name": {"col": "Property Name"},
        "owner": None,
        "address": {"col": "Address 1"},
        "city": {"col": "City"},
        "state": {"lit": "NY"},
        "zip": {"col": "Postal Code"},
        "lat": {"col": "Latitude"},
        "lon": {"col": "Longitude"},
        "property_type": {"col": "Primary Property Type - Portfolio Manager-Calculated"},
        "floor_area": {"col": "Property GFA - Calculated (Buildings) (ft²)"},
        "year_built": {"col": "Year Built"},
        "data_year": {"col": "Calendar Year"},
        "elec": {"col": "Electricity Use - Grid Purchase (kWh)", "unit": "kWh"},
        "gas": {"col": "Natural Gas Use (kBtu)", "unit": "kBtu"},
        "site_eui": {"col": "Site EUI (kBtu/ft²)"},
        "energy_star": {"col": "ENERGY STAR Score"},
        "peak_kw": {"col": "Annual Maximum Demand (kW)"},
    },
    "Philadelphia": {
        "file": "philly_properties_reported_2024.csv",
        "source_url": "https://opendataphilly.org/datasets/large-building-energy-benchmarking-data/",
        "id": {"col": "portfolio_manager_id"},
        "name": {"col": "property_name"},
        "owner": None,
        "address": {"col": "street_address"},
        "city": {"lit": "Philadelphia"},
        "state": {"lit": "PA"},
        "zip": {"col": "postal_code"},
        "lat": {"col": "y_lat"},
        "lon": {"col": "x_lon"},
        "property_type": {"col": "primary_prop_type_epa_calc"},
        "floor_area": {"col": "total_floor_area_bld_pk_ft2"},
        "year_built": {"col": "year_built"},
        "data_year": {"col": "data_year"},
        "elec": {"col": "electric_use_kbtu", "unit": "kBtu"},
        "gas": {"col": "natural_gas_use_kbtu", "unit": "kBtu"},
        "site_eui": {"col": "site_eui_kbtuft2"},
        "energy_star": {"col": "energy_star_score"},
        "peak_kw": None,
    },
    "San Francisco": {
        "file": "sf_existing_buildings_benchmark_reports.csv",
        "source_url": "https://data.sfgov.org/Energy-and-Environment/Existing-Buildings-Benchmark-Reports/4ua7-5sfx",
        "id": {"col": "Parcel Number"},  # unique_identifier is per building-year
        "name": {"col": "Building Name"},
        "owner": None,
        "address": {"col": "Building Address"},
        "city": {"lit": "San Francisco"},
        "state": {"lit": "CA"},
        "zip": {"col": "Postal Code"},
        "lat": {"col": "latitude"},
        "lon": {"col": "longitude"},
        "property_type": {"col": "Property Type - Self Selected"},
        "floor_area": {"col": "Floor Area"},
        "year_built": {"col": "Year Built"},
        "data_year": {"col": "Benchmark Year"},
        "elec": {"col": "Electricity Use - Grid Purchase (kWh)", "unit": "kWh"},
        "gas": {"col": "Natural Gas Use (kBtu)", "unit": "kBtu"},
        "site_eui": {"col": "Site EUI (kBtu/ft2)"},
        "energy_star": {"col": "ENERGY STAR Score"},
        "peak_kw": None,
    },
    "Cambridge": {
        "file": "cambridge_beudo_2015_present.csv",
        "source_url": "https://data.cambridgema.gov/Energy-and-the-Environment/Cambridge-Building-Energy-Use-Disclosure-Ordinance/72g6-j7aq",
        "id": {"col": "Reporting ID"},
        "name": None,  # BEUDO publishes address + owner, no building name
        "owner": {"col": "Owner"},
        "address": {"col": "Address"},
        "city": {"lit": "Cambridge"},
        "state": {"lit": "MA"},
        "zip": None,
        "lat": {"col": "Latitude"},
        "lon": {"col": "Longitude"},
        "property_type": {"col": "Primary Property Type - Self Selected"},
        "floor_area": {"col": "Property GFA - Self Reported (ft2)"},
        "year_built": {"col": "Year Built"},
        "data_year": {"col": "Data Year"},
        "elec": {"col": "Electricity Use - Grid Purchase (kWh)", "unit": "kWh"},
        "gas": {"col": "Natural Gas Use (kBtu)", "unit": "kBtu"},
        "site_eui": {"col": "Site EUI (kBtu/ft2)"},
        "energy_star": {"col": "ENERGY STAR Score"},
        "peak_kw": None,
    },
    "San Jose": {
        "file": "sanjose_cy2024.csv",
        "source_url": "https://data.sanjoseca.gov/dataset/building-performance-ordinance",
        "id": {"col": "SAN JOSE BUILDING ID"},
        "name": None,
        "owner": None,
        "address": {"col": "STREET"},
        "city": {"col": "CITY"},
        "state": {"lit": "CA"},
        "zip": {"col": "ZIP CODE"},
        "lat": None,
        "lon": None,
        "property_type": {"col": "PRIMARY PROPERTY TYPE"},
        "floor_area": {"col": "REPORTED GROSS FLOOR AREA (ft^2)"},
        "year_built": {"col": "YEAR BUILT"},
        "data_year": {"col": "ANNUAL REPORTING YEAR"},
        "elec": {"col": "TOTAL ELECTRICITY USE (kWh)", "unit": "kWh"},
        "gas": {"col": "TOTAL NATURAL GAS USE (therms)", "unit": "therms"},
        "site_eui": {"col": "SITE ENERGY USE INTENSITY (kBTU/ft^2)"},
        "energy_star": {"col": "ENERGY STAR SCORE"},
        "peak_kw": None,
    },
    "Berkeley": {
        "file": "berkeley_beso.csv",
        "source_url": "https://data.cityofberkeley.info/Energy-and-Environment/BESO-Large-Building-Energy-Data-and-Compliance-Sta/5vy5-rwja",
        "id": {"col": "BESO ID"},
        "name": {"col": "Building Name"},
        "owner": None,
        "address": {"col": "Building Address"},
        "city": {"lit": "Berkeley"},
        "state": {"lit": "CA"},
        "zip": None,
        "lat": None,
        "lon": None,
        "property_type": {"col": "BESO Property Type"},
        "floor_area": {"col": "Floor Area"},
        "year_built": None,
        "data_year": {"lit": 2024},  # wide file; using the completed 2024 cycle columns
        "elec": {"col": "2024 Electricity Use Grid Purchase (kWh)", "unit": "kWh"},
        "gas": {"col": "2024 Natural Gas Use (therms)", "unit": "therms"},
        "site_eui": {"col": "2024 Site EUI (kBtu/ft2)"},
        "energy_star": {"col": "2024 ENERGY STAR Score"},
        "peak_kw": None,
    },
    "Portland OR": {
        "file": "portland_or_2024.xlsx",
        "sheet": "2024 Energy Performance Info",
        "source_url": "https://www.portland.gov/bps/energy-reporting/annual-data-and-results",
        "id": {"col": "Building ID"},
        "name": {"col": "Building Name"},
        "owner": None,
        "address": {"col": "Site Address"},
        "city": {"lit": "Portland"},
        "state": {"lit": "OR"},
        "zip": None,
        "lat": None,
        "lon": None,
        "property_type": {"col": "Primary Property Type"},
        "floor_area": {"col": "Floor Area (sf)"},
        "year_built": {"col": "Year Built"},
        "data_year": {"lit": 2024},
        "elec": {"col": "Electricity Use (kWh)", "unit": "kWh"},
        "gas": {"col": "Natural Gas Use (therms)", "unit": "therms"},
        "site_eui": {"col": "Site EUI (kBtu/sf)"},
        "energy_star": {"col": "ENERGY STAR Score"},
        "peak_kw": None,
    },
    "Honolulu": {
        "file": "honolulu_benchmarking.csv",
        "header_row": 1,  # row 0 is a title row
        "source_url": "https://www.resilientoahu.org/benchmarking",
        "id": {"col": "Oʻahu Building ID"},
        "name": {"col": "Building Name"},
        "owner": None,
        "address": {"col": "Building Street"},
        "city": {"col": "Building City"},
        "state": {"lit": "HI"},
        "zip": None,
        "lat": None,
        "lon": None,
        "property_type": {"col": "Primary Use Type"},
        "floor_area": {"col": "Building Gross Floor Area"},
        "year_built": {"col": "Year Built"},
        "data_year": {"col": "Reporting Year"},
        "elec": {"col": "Aggregated Grid Electricity Use (kWh)", "unit": "kWh"},
        "gas": {"col": "Aggregated Natural Gas Use (Therms)", "unit": "therms"},
        "site_eui": {"col": "Energy Use Intensity (Site EUI)"},
        "energy_star": {"col": "ENERGY STAR® score"},
        "peak_kw": None,
    },
    "Seattle": {
        "file": "seattle_Building_Energy_Benchmarking_Data,_2015-Present_20250923.xlsx",
        "source_url": "https://data.seattle.gov/Built-Environment/Building-Energy-Benchmarking-Data-2015-Present/teqw-tu6e",
        "id": {"col": "OSEBuildingID"},
        "name": {"col": "BuildingName"},
        "owner": None,
        "address": {"col": "Address"},
        "city": {"col": "City"},
        "state": {"lit": "WA"},
        "zip": {"col": "ZipCode"},
        "lat": {"col": "Latitude"},
        "lon": {"col": "Longitude"},
        "property_type": {"col": "EPAPropertyType"},
        "floor_area": {"col": "PropertyGFATotal"},
        "year_built": {"col": "YearBuilt"},
        "data_year": {"col": "DataYear"},
        "elec": {"col": "Electricity(kWh)", "unit": "kWh"},
        "gas": {"col": "NaturalGas(kBtu)", "unit": "kBtu"},
        "site_eui": {"col": "SiteEUI(kBtu/sf)"},
        "energy_star": {"col": "ENERGYSTARScore"},
        "peak_kw": None,
    },
    "Washington DC": {
        "file": "dc_Building_Energy_Benchmarking.xlsx",
        "source_url": "https://opendata.dc.gov/datasets/DCGIS%3A%3Abuilding-energy-benchmarking/about",
        "id": {"col": "PID"},
        "name": {"col": "PROPERTYNAME"},
        "owner": {"col": "OWNEROFRECORD"},
        "address": {"col": "REPORTEDADDRESS"},
        "city": {"lit": "Washington"},
        "state": {"lit": "DC"},
        "zip": {"col": "POSTALCODE"},
        "lat": {"col": "LATITUDE"},
        "lon": {"col": "LONGITUDE"},
        "property_type": {"col": "PRIMARYPROPERTYTYPE_SELFSELECT"},
        "floor_area": {"col": "REPORTEDBUILDINGGROSSFLOORAREA"},
        "year_built": {"col": "YEARBUILT"},
        "data_year": {"col": "REPORTINGYEAR"},
        "elec": {"col": "ELECTRICITYUSE_GRID_KWH", "unit": "kWh"},
        "gas": {"col": "NATURALGASUSE_THERMS", "unit": "therms"},
        "site_eui": {"col": "SITEEUI_KBTU_FT"},
        "energy_star": {"col": "ENERGYSTARSCORE"},
        "peak_kw": None,
    },
}

# ---------------------------------------------------------------------------
# Property-type normalization: raw ESPM types -> a small filterable sector set
# ---------------------------------------------------------------------------
SECTOR_RULES: list[tuple[str, list[str]]] = [
    ("Data Center", ["data center"]),
    ("Grocery", ["supermarket", "grocery", "food sales", "wholesale club", "supercenter"]),
    ("Warehouse / Distribution", ["warehouse", "distribution", "self-storage", "self storage"]),
    ("Industrial / Manufacturing", ["manufacturing", "industrial", "energy/power station", "wastewater", "drinking water"]),
    ("Hospital / Healthcare", ["hospital", "medical", "outpatient", "urgent care", "ambulatory", "surgical", "senior living", "residential care", "laboratory"]),
    ("Hotel", ["hotel", "lodging", "residence hall", "dormitory", "barracks"]),
    ("K-12 School", ["k-12", "school", "pre-school", "preschool", "daycare", "education"]),
    ("College / University", ["college", "university"]),
    ("Office", ["office", "bank branch", "courthouse", "financial"]),
    ("Retail", ["retail", "mall", "vehicle dealership", "restaurant", "food service", "movie theater", "casino", "convenience"]),
    ("Multifamily", ["multifamily", "apartment", "residential", "housing"]),
    ("Public Assembly", ["worship", "museum", "performing arts", "convention", "social/meeting", "recreation", "fitness", "stadium", "library", "entertainment", "aquarium", "zoo", "ice/curling", "bowling", "pool", "rink", "race track", "amusement"]),
    ("Parking", ["parking"]),
    ("Public Services", ["police", "fire station", "courthouse", "prison", "mailing", "post office", "transportation", "social services", "government", "municipal"]),
]


def classify_sector(raw: str | None) -> str:
    if not raw or not isinstance(raw, str):
        return "Other / Unknown"
    low = raw.lower()
    for sector, keywords in SECTOR_RULES:
        if any(k in low for k in keywords):
            return sector
    return "Other / Unknown"


def pick_best_sheet(xls: pd.ExcelFile) -> str:
    best, best_cols = None, -1
    for name in xls.sheet_names:
        try:
            df = pd.read_excel(xls, sheet_name=name, nrows=25, dtype="object")
            c = df.dropna(axis=1, how="all").shape[1]
            if c > best_cols:
                best_cols, best = c, name
        except Exception:
            continue
    return best or xls.sheet_names[0]


def to_num(series: pd.Series) -> pd.Series:
    s = series.astype(str).str.replace(",", "", regex=False).str.strip()
    s = s.replace({"": None, "nan": None, "None": None, "Not Available": None, "N/A": None})
    return pd.to_numeric(s, errors="coerce")


def norm_zip(v) -> str | None:
    if v is None:
        return None
    s = re.sub(r"[^0-9]", "", str(v).split("-")[0].split(".")[0])
    if len(s) >= 5:
        return s[:5]
    if 3 <= len(s) < 5:
        return s.zfill(5)
    return None


def clean_str(v) -> str | None:
    if v is None or (isinstance(v, float) and math.isnan(v)):
        return None
    s = re.sub(r"\s+", " ", str(v)).strip()
    if not s or s.lower() in ("nan", "none", "not available", "n/a", "null", "0"):
        return None
    return s


def extract_program(program: str, spec: dict) -> pd.DataFrame:
    path = DATA_DIR / spec["file"]
    if not path.exists():
        print(f"  !! missing file for {program}: {path.name}")
        return pd.DataFrame()

    if spec["file"].endswith(".csv"):
        sheet = "(csv)"
        raw = pd.read_csv(path, dtype="object", low_memory=False, header=spec.get("header_row", 0))
    else:
        xls = pd.ExcelFile(path)
        sheet = spec.get("sheet") or pick_best_sheet(xls)
        raw = pd.read_excel(xls, sheet_name=sheet, dtype="object", header=spec.get("header_row", 0))
    raw = raw.dropna(how="all")

    # tolerant column lookup (case/punctuation-insensitive)
    def norm_key(s: str) -> str:
        return "".join(ch.lower() for ch in str(s) if ch.isalnum())

    lookup = {norm_key(c): c for c in raw.columns}

    def col(field: str) -> pd.Series | None:
        f = spec.get(field)
        if not isinstance(f, dict):
            return None
        if "lit" in f:
            return pd.Series([f["lit"]] * len(raw), index=raw.index)
        name = f.get("col")
        if name in raw.columns:
            return raw[name]
        actual = lookup.get(norm_key(name))
        if actual:
            return raw[actual]
        print(f"  !! {program}: column not found: {name!r}")
        return None

    n = len(raw)
    out = pd.DataFrame(index=raw.index)

    def put(field: str, series: pd.Series | None):
        out[field] = series if series is not None else pd.Series([None] * n, index=raw.index)

    put("src_id", col("id"))
    put("name", col("name"))
    put("owner", col("owner"))
    put("address", col("address"))
    put("city", col("city"))
    put("state", col("state"))
    put("zip", col("zip"))
    put("lat", col("lat"))
    put("lon", col("lon"))
    put("property_type", col("property_type"))
    put("floor_area", col("floor_area"))
    put("year_built", col("year_built"))
    put("data_year", col("data_year"))
    put("elec_raw", col("elec"))
    put("gas_raw", col("gas"))
    put("site_eui", col("site_eui"))
    put("energy_star", col("energy_star"))
    put("peak_kw", col("peak_kw"))

    # --- numeric coercion & unit normalization ---
    for c in ("lat", "lon", "floor_area", "site_eui", "energy_star", "peak_kw", "elec_raw", "gas_raw", "year_built"):
        out[c] = to_num(out[c])

    elec_unit = (spec.get("elec") or {}).get("unit", "kWh")
    out["elec_kwh"] = out["elec_raw"] / KBTU_PER_KWH if elec_unit == "kBtu" else out["elec_raw"]

    gas_unit = (spec.get("gas") or {}).get("unit", "kBtu")
    if gas_unit == "therms":
        out["gas_kbtu"] = out["gas_raw"] * KBTU_PER_THERM
    else:
        out["gas_kbtu"] = out["gas_raw"]

    # --- data year: accept plain years; date-parse the rest; clamp to sane range ---
    dy = out["data_year"]
    num = to_num(dy)
    year_direct = num.where((num >= 1990) & (num <= 2035))
    need_parse = year_direct.isna() & dy.notna()
    if need_parse.any():
        parsed = pd.to_datetime(dy[need_parse].astype(str), errors="coerce").dt.year
        year_direct.loc[need_parse] = parsed
    year_direct[(year_direct < 1990) | (year_direct > 2035)] = None
    out["data_year"] = year_direct

    # --- strings ---
    for c in ("name", "owner", "address", "city", "property_type"):
        out[c] = out[c].map(clean_str)
    out["zip"] = out["zip"].map(norm_zip)
    out["state"] = out["state"].map(clean_str)
    out["src_id"] = out["src_id"].map(lambda v: clean_str(v) or "")

    out["program"] = program
    print(f"  ok {program}: {len(out)} rows from sheet {sheet!r}")
    return out


def fill_geocoded(rows: pd.DataFrame) -> None:
    """Fill missing lat/lon from the Census geocode cache (scripts/geocode_missing.py)."""
    cache_path = DATA_DIR / "reference" / "geocode_cache.json"
    if not cache_path.exists():
        return
    cache = json.loads(cache_path.read_text())

    def key(addr, city, st, zp) -> str:  # must match geocode_missing.norm_geo_key
        a = re.sub(r"[^A-Z0-9 ]", "", str(addr).upper())
        a = re.sub(r"\s+", " ", a).strip()
        return f"{a}|{str(city or '').upper().strip()}|{st or ''}|{zp or ''}"

    missing = rows.index[rows["lat"].isna() & rows["address"].notna()]
    filled = 0
    for i in missing:
        hit = cache.get(key(rows.at[i, "address"], rows.at[i, "city"], rows.at[i, "state"], rows.at[i, "zip"]))
        if hit:
            rows.at[i, "lat"], rows.at[i, "lon"] = hit
            filled += 1
    print(f"geocode cache: filled coordinates for {filled} of {len(missing)} un-mapped rows")


def build() -> tuple[pd.DataFrame, dict]:
    frames = []
    for program, spec in PROGRAMS.items():
        print(f"reading {program} ...")
        df = extract_program(program, spec)
        if len(df):
            frames.append(df)
    all_rows = pd.concat(frames, ignore_index=True)

    # Drop rows without an address AND without a name (unusable as leads)
    all_rows = all_rows[~(all_rows["address"].isna() & all_rows["name"].isna())]

    # Sanity: null out junk coordinates
    bad_coord = (
        all_rows["lat"].isna() | all_rows["lon"].isna()
        | (all_rows["lat"].abs() < 1) | (all_rows["lat"].abs() > 72)
        | (all_rows["lon"] > -60) | (all_rows["lon"] < -180)
    )
    all_rows.loc[bad_coord, ["lat", "lon"]] = None

    # Fill programs that publish no coordinates (Boston/Denver/MoCo) from the
    # Census-geocoded cache, if scripts/geocode_missing.py has been run.
    fill_geocoded(all_rows)

    # Sanity: clamp absurd numerics
    all_rows.loc[all_rows["floor_area"] <= 0, "floor_area"] = None
    all_rows.loc[all_rows["elec_kwh"] < 0, "elec_kwh"] = None
    all_rows.loc[all_rows["gas_kbtu"] < 0, "gas_kbtu"] = None
    all_rows.loc[(all_rows["year_built"] < 1750) | (all_rows["year_built"] > 2026), "year_built"] = None
    all_rows.loc[(all_rows["energy_star"] < 1) | (all_rows["energy_star"] > 100), "energy_star"] = None

    # Physical-plausibility caps: self-reported disclosures contain unit errors
    # (kBtu/Wh entered in kWh fields, etc.). Intensity cap is generous enough
    # for dense data centers; absolute cap catches rows with no floor area.
    intensity = all_rows["elec_kwh"] / all_rows["floor_area"]
    bad_elec = (all_rows["elec_kwh"] > 2e9) | (intensity > 2000)
    all_rows.loc[bad_elec.fillna(False), "elec_kwh"] = None
    all_rows.loc[all_rows["gas_kbtu"] > 1e10, "gas_kbtu"] = None
    all_rows.loc[all_rows["site_eui"] > 20000, "site_eui"] = None
    all_rows.loc[all_rows["peak_kw"] > 500_000, "peak_kw"] = None

    # Dedup: keep the most recent data year per (program, building)
    all_rows["dedup_key"] = all_rows["program"] + "|" + all_rows["src_id"].fillna("")
    no_id = all_rows["src_id"].fillna("") == ""
    fallback = (
        all_rows["program"] + "|"
        + all_rows["address"].fillna("").str.lower().str.replace(r"[^a-z0-9]", "", regex=True)
        + "|" + all_rows["zip"].fillna("")
    )
    all_rows.loc[no_id, "dedup_key"] = fallback[no_id]

    # Rank rows so that, within a building, the latest year with real usage wins
    all_rows["_has_usage"] = all_rows["elec_kwh"].notna().astype(int)
    all_rows = all_rows.sort_values(["dedup_key", "_has_usage", "data_year"], ascending=[True, False, False])
    years_reported = all_rows.groupby("dedup_key")["data_year"].nunique()
    snap = all_rows.drop_duplicates("dedup_key", keep="first").copy()
    snap["years_reported"] = snap["dedup_key"].map(years_reported)

    # Derived metrics
    snap["sector"] = snap["property_type"].map(classify_sector)
    snap["kwh_per_sqft"] = snap["elec_kwh"] / snap["floor_area"]
    snap.loc[(snap["kwh_per_sqft"] > 2000), "kwh_per_sqft"] = None  # junk guard (data centers can legitimately exceed 500)

    print(f"\nsnapshot: {len(snap)} unique buildings (from {len(all_rows)} rows)")
    print(snap.groupby('program').agg(rows=('program','size'), with_coords=('lat', lambda s: s.notna().sum()), with_kwh=('elec_kwh', lambda s: s.notna().sum())).to_string())
    return snap, {}


PAYLOAD_COLS = [
    "program", "name", "owner", "address", "city", "state", "zip",
    "lat", "lon", "sector", "property_type", "floor_area", "year_built",
    "data_year", "elec_kwh", "gas_kbtu", "kwh_per_sqft", "site_eui",
    "energy_star", "peak_kw", "years_reported",
]

PREVIEW_PER_PROGRAM = 150  # top buildings by annual kWh, for the free preview


def payload_rows(df: pd.DataFrame) -> list:
    def r(v, nd=None):
        if v is None or (isinstance(v, float) and (math.isnan(v) or math.isinf(v))):
            return None
        if nd is not None and isinstance(v, (int, float)):
            return round(v, nd) if nd > 0 else int(round(v))
        return v

    # Replace all pandas NaN/NA with None so JSON stays valid (no bare NaN tokens)
    clean = df[PAYLOAD_COLS].astype(object).where(pd.notna(df[PAYLOAD_COLS]), None)

    rows = []
    for t in clean.itertuples(index=False):
        d = t._asdict()
        rows.append([
            d["program"], d["name"], d["owner"], d["address"], d["city"], d["state"], d["zip"],
            r(d["lat"], 5), r(d["lon"], 5), d["sector"], d["property_type"],
            r(d["floor_area"], 0), r(d["year_built"], 0), r(d["data_year"], 0),
            r(d["elec_kwh"], 0), r(d["gas_kbtu"], 0), r(d["kwh_per_sqft"], 2),
            r(d["site_eui"], 1), r(d["energy_star"], 0), r(d["peak_kw"], 0),
            r(d["years_reported"], 0),
        ])
    return rows


def write_gz(payload: dict, path: Path) -> None:
    blob = json.dumps(payload, separators=(",", ":"), ensure_ascii=False, allow_nan=False).encode("utf-8")
    path.parent.mkdir(parents=True, exist_ok=True)
    with gzip.open(path, "wb", compresslevel=9) as f:
        f.write(blob)
    print(f"wrote {path}  raw={len(blob)/1e6:.1f}MB  gz={path.stat().st_size/1e6:.2f}MB")


def emit(snap: pd.DataFrame, out_dir: Path, also_copy: Path | None):
    out_dir.mkdir(parents=True, exist_ok=True)
    generated = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    sources = {p: s["source_url"] for p, s in PROGRAMS.items()}

    payload = {
        "generated": generated,
        "columns": PAYLOAD_COLS,
        "rows": payload_rows(snap),
        "sources": sources,
    }
    gz_path = out_dir / "buildings.json.gz"
    write_gz(payload, gz_path)

    # Free-preview payload: the biggest electricity users per program (the
    # buildings that make the tool look good), mapped ones first.
    preview_parts = []
    for _, g in snap.groupby("program"):
        g = g.sort_values("elec_kwh", ascending=False, na_position="last")
        with_coords = g[g["lat"].notna()].head(PREVIEW_PER_PROGRAM)
        preview_parts.append(with_coords if len(with_coords) else g.head(PREVIEW_PER_PROGRAM))
    preview_df = pd.concat(preview_parts)
    preview = {
        "generated": generated,
        "preview": True,
        "fullCount": int(len(snap)),
        "columns": PAYLOAD_COLS,
        "rows": payload_rows(preview_df),
        "sources": sources,
    }
    preview_path = out_dir / "buildings-preview.json.gz"
    write_gz(preview, preview_path)

    # landing-page stats
    stats = {
        "generated": payload["generated"],
        "buildings": int(len(snap)),
        "with_coords": int(snap["lat"].notna().sum()),
        "total_annual_kwh": float(snap["elec_kwh"].sum(skipna=True)),
        "total_sqft": float(snap["floor_area"].sum(skipna=True)),
        "programs": [
            {
                "program": p,
                "buildings": int(g["dedup_key"].nunique() if "dedup_key" in g else len(g)),
                "latest_year": int(g["data_year"].max()) if g["data_year"].notna().any() else None,
                "with_coords": int(g["lat"].notna().sum()),
                "source": PROGRAMS[p]["source_url"],
            }
            for p, g in snap.groupby("program")
        ],
        "sectors": snap["sector"].value_counts().to_dict(),
        "states": snap["state"].value_counts().to_dict(),
    }
    stats_path = out_dir / "stats.json"
    stats_path.write_text(json.dumps(stats, indent=1), encoding="utf-8")
    print(f"wrote {stats_path}")

    if also_copy:
        # Public: preview payload + aggregate stats. Private (auth-gated via
        # /api/data/buildings): the full payload — NOT under public/.
        public_dir = also_copy
        public_dir.mkdir(parents=True, exist_ok=True)
        (public_dir / "buildings-preview.json.gz").write_bytes(preview_path.read_bytes())
        (public_dir / "stats.json").write_text(json.dumps(stats, indent=1), encoding="utf-8")
        legacy_public = public_dir / "buildings.json.gz"
        if legacy_public.exists():
            legacy_public.unlink()  # must not be publicly fetchable anymore
        private_dir = public_dir.parents[1] / "private-data"
        private_dir.mkdir(parents=True, exist_ok=True)
        (private_dir / "buildings.json.gz").write_bytes(gz_path.read_bytes())
        print(f"copied preview+stats to {public_dir}; full payload to {private_dir}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(DATA_DIR / "web"))
    ap.add_argument("--also-copy", default=str(ROOT / "web" / "public" / "data"))
    args = ap.parse_args()
    snap, _ = build()
    emit(snap, Path(args.out), Path(args.also_copy) if args.also_copy else None)
    print("done")
