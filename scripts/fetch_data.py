"""Download the latest vintage of each benchmarking dataset into data/.

Every URL below was verified against the live portals in July 2026. Sources
marked ACTIVE are downloaded by this script and consumed by
build_web_dataset.py; sources marked MANUAL/TODO document how to expand
coverage (they need a browser pull or a new column mapping first).

Usage:
  python scripts/fetch_data.py            # download all ACTIVE sources
  python scripts/fetch_data.py boston sf  # download a subset

After downloading, rebuild the web payload:
  python scripts/build_web_dataset.py
"""
from __future__ import annotations

import sys
import urllib.request
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parents[1] / "data"

# ---------------------------------------------------------------------------
# ACTIVE sources — downloaded by this script, mapped in build_web_dataset.py.
# key -> (target filename, url)
# ---------------------------------------------------------------------------
ACTIVE: dict[str, tuple[str, str]] = {
    # Boston BERDO — 2025 reporting cycle (CY2024 usage). XLSX only, no API.
    "boston": (
        "boston_2025-reported-energy-and-water-metrics.xlsx",
        "https://data.boston.gov/dataset/b09a8b71-274b-4365-9ce6-49b8b44602ef/resource/911db0b1-437f-43ba-86bb-860cc1cd9319/download/2025-reported-energy-and-water-metrics.xlsx",
    ),
    # California AB 802 — CY2024 file (posted Oct 2025).
    "california": (
        "california_2024_Download_ADA.xlsx",
        "https://www.energy.ca.gov/sites/default/files/2025-10/2024_Download_ADA.xlsx",
    ),
    # Chicago — stale at data year 2023 as of Jul 2026 (last load Feb 2025).
    "chicago": (
        "chicago_Chicago_Energy_Benchmarking.csv",
        "https://data.cityofchicago.org/api/views/xq83-jr8c/rows.csv?accessType=DOWNLOAD",
    ),
    # Montgomery County MD — 2024 All Sites.
    "moco": (
        "moco_2024_Energy_Benchmarking_All_Sites.csv",
        "https://data.montgomerycountymd.gov/api/views/g6nn-rgwc/rows.csv?accessType=DOWNLOAD",
    ),
    # Philadelphia — one dataset per year; 2024 layer.
    "philly": (
        "philly_properties_reported_2024.csv",
        "https://hub.arcgis.com/api/v3/datasets/236455b7f9e94603a1e2466d4e5b82e3_0/downloads/data?format=csv&spatialRefId=3857&where=1%3D1",
    ),
    # San Francisco — Existing Buildings Benchmark Reports (multi-year).
    "sf": (
        "sf_existing_buildings_benchmark_reports.csv",
        "https://data.sfgov.org/api/views/4ua7-5sfx/rows.csv?accessType=DOWNLOAD",
    ),
    # Cambridge MA — BEUDO 2015-present.
    "cambridge": (
        "cambridge_beudo_2015_present.csv",
        "https://data.cambridgema.gov/api/views/72g6-j7aq/rows.csv?accessType=DOWNLOAD",
    ),
    # Seattle — 2015-present (includes CY2024).
    "seattle": (
        "seattle_Building_Energy_Benchmarking.csv",
        "https://data.seattle.gov/api/views/teqw-tu6e/rows.csv?accessType=DOWNLOAD",
    ),
    # NYC LL84 — CY2022-2024, ~103k rows / 217 cols. Large (hundreds of MB).
    "nyc": (
        "nyc_LL84_2022_present.csv",
        "https://data.cityofnewyork.us/api/views/5zyy-y8am/rows.csv?accessType=DOWNLOAD",
    ),
    # San Jose — CY2024 (kWh + therms).
    "sanjose": (
        "sanjose_cy2024.csv",
        "https://data.sanjoseca.gov/dataset/ee0e571c-5007-4330-b3df-01ee5bdc91d3/resource/f7723c73-8ee3-43cd-9a3e-a8761cc29905/download/cy-2024-public-data.csv",
    ),
    # Berkeley BESO — wide file, per-year columns (kWh/therms 2022-2025).
    "berkeley": (
        "berkeley_beso.csv",
        "https://data.cityofberkeley.info/api/views/5vy5-rwja/rows.csv?accessType=DOWNLOAD",
    ),
    # Portland OR — CY2024 XLSX (kWh incl. onsite solar generation).
    "portland": (
        "portland_or_2024.xlsx",
        "https://www.portland.gov/bps/climate-action/energy-reporting/documents/2024-energy-performance-information-individual/download",
    ),
    # Honolulu — Google Sheet CSV export (kWh split grid/renewable; title row).
    "honolulu": (
        "honolulu_benchmarking.csv",
        "https://docs.google.com/spreadsheets/d/19LLr6caOxbbSmRoxcIlkHdswdhkNGQmp/export?format=csv",
    ),
}

# ---------------------------------------------------------------------------
# MANUAL / TODO sources — verified to exist in July 2026, not yet integrated.
# ---------------------------------------------------------------------------
MANUAL_NOTES = """
Not yet integrated (each needs a browser pull or a new column mapping):

  Washington DC   ArcGIS layer 45 incl. MONTHLY electricity/gas; CY2024 adds
                  buildings >=10k sqft. Page through:
                  https://maps2.dcgis.dc.gov/dcgis/rest/services/DCGIS_DATA/Environment_Energy_WebMercator/FeatureServer/45/query?where=1%3D1&outFields=*&f=geojson
  Denver          Data model changed; current-cycle table (no coords, strings):
                  https://hub.arcgis.com/api/v3/datasets/603e2f47ec3d4273ad4343df984e5588_0/downloads/data?format=csv&spatialRefId=4326
                  Latest final Excel (2023): https://www.arcgis.com/sharing/rest/content/items/2da57c7e046b4daa97daf0052d7e7825/data
  NYC monthly     Building-level MONTHLY electric+gas (great for load shape):
                  dataset fvp3-gcb2 on data.cityofnewyork.us
  Massachusetts   Statewide LBER, 33,561 covered properties (July 2026). Public
                  SEED map at largebuildingreporting.mass.gov exposes only
                  ids+coordinates anonymously:
                  /map/inventory_locations/properties/?cycle=3&organization_id=2&page=1&per_page=9999999
                  Attribute/inventory APIs (POST /api/v3/properties/filter/) return
                  403 without an org account. ACTION: request the dataset or portal
                  access from DOER (see mass.gov LBER results page).
  Minnesota       Statewide program, map only so far: https://map.benchmarkingmn.org/
  LA / KC / Orlando  EUI-only (no kWh/gas split) — lower value:
                  LA https://data.lacity.org/api/views/9yda-i4ya/rows.csv?accessType=DOWNLOAD
"""


def fetch(key: str, fname: str, url: str) -> None:
    target = DATA_DIR / fname
    print(f"[{key}] downloading -> {target.name}")
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (data refresh script)"})
    with urllib.request.urlopen(req, timeout=600) as resp, open(target, "wb") as f:
        while chunk := resp.read(1 << 20):
            f.write(chunk)
    print(f"[{key}] done ({target.stat().st_size / 1e6:.1f} MB)")


if __name__ == "__main__":
    keys = [k.lower() for k in sys.argv[1:]] or list(ACTIVE)
    for key in keys:
        if key not in ACTIVE:
            print(f"unknown source {key!r}; choices: {', '.join(ACTIVE)}")
            continue
        fname, url = ACTIVE[key]
        try:
            fetch(key, fname, url)
        except Exception as e:
            print(f"[{key}] FAILED: {e}")
    print(MANUAL_NOTES)
    print("Now run: python scripts/build_web_dataset.py")
    print("NOTE: if a refreshed file has a different name/format than the one in")
    print("build_web_dataset.py PROGRAMS, update that entry before rebuilding.")
