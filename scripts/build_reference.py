"""Build reference lookup tables for the web app:

  1. Average retail electricity price by state & sector (EIA, Electric Power
     Monthly Table 5.6.A — derived from Form EIA-861M) -> $ context per lead
  2. State grid CO2e output emission rates (EPA eGRID)   -> CO2 offset per lead
  3. Location-aware solar specific yield (PVWatts v8 on a 1-degree grid over
     the building stock, NLR developer API)               -> local PV sizing

Writes data/reference/reference.json and copies it to web/public/data/.

PVWatts calls are cached in data/reference/pvwatts_cache.json and resume on
re-run. With the default DEMO_KEY the API allows ~30 calls/hour — the script
stops gracefully at the rate limit; re-run later (or set NLR_API_KEY) to fill
remaining cells. States fall back to building-weighted means of solved cells.

Usage:  python scripts/build_reference.py [--skip-pvwatts]
"""
from __future__ import annotations

import gzip
import io
import json
import os
import re
import sys
import time
import urllib.request
import zipfile
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
REF_DIR = ROOT / "data" / "reference"
OUT_PATHS = [REF_DIR / "reference.json", ROOT / "web" / "public" / "data" / "reference.json"]
CACHE_PATH = REF_DIR / "pvwatts_cache.json"

EPM_URL = "https://www.eia.gov/electricity/monthly/epm_table_grapher.php?t=epmt_5_6_a"
EGRID_URL = "https://www.epa.gov/system/files/documents/2025-06/egrid2023_data_rev2.xlsx"
PVWATTS_URL = "https://developer.nlr.gov/api/pvwatts/v8.json"

NLR_API_KEY = os.environ.get("NLR_API_KEY", "DEMO_KEY")
GRID_RES = 1.0  # degrees
DEFAULT_YIELD = 1300  # kWh/kWp-yr national screening fallback

STATES = set(
    "AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT "
    "NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY".split()
)
STATE_NAMES = {
    "Alabama": "AL", "Alaska": "AK", "Arizona": "AZ", "Arkansas": "AR", "California": "CA",
    "Colorado": "CO", "Connecticut": "CT", "Delaware": "DE", "District of Columbia": "DC",
    "Florida": "FL", "Georgia": "GA", "Hawaii": "HI", "Idaho": "ID", "Illinois": "IL",
    "Indiana": "IN", "Iowa": "IA", "Kansas": "KS", "Kentucky": "KY", "Louisiana": "LA",
    "Maine": "ME", "Maryland": "MD", "Massachusetts": "MA", "Michigan": "MI",
    "Minnesota": "MN", "Mississippi": "MS", "Missouri": "MO", "Montana": "MT",
    "Nebraska": "NE", "Nevada": "NV", "New Hampshire": "NH", "New Jersey": "NJ",
    "New Mexico": "NM", "New York": "NY", "North Carolina": "NC", "North Dakota": "ND",
    "Ohio": "OH", "Oklahoma": "OK", "Oregon": "OR", "Pennsylvania": "PA",
    "Rhode Island": "RI", "South Carolina": "SC", "South Dakota": "SD", "Tennessee": "TN",
    "Texas": "TX", "Utah": "UT", "Vermont": "VT", "Virginia": "VA", "Washington": "WA",
    "West Virginia": "WV", "Wisconsin": "WI", "Wyoming": "WY",
}


def http_get(url: str, timeout: int = 300) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (reference build script)"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


# ---------------------------------------------------------------------------
# 1. State retail rates (EIA EPM 5.6.A: cents/kWh by state x sector)
# ---------------------------------------------------------------------------
def build_rates() -> dict[str, dict[str, float]]:
    print("rates: fetching EIA EPM table 5.6.A ...")
    html = http_get(EPM_URL).decode("utf-8", errors="replace")
    tables = pd.read_html(io.StringIO(html))
    rates: dict[str, dict[str, float]] = {}
    for t in tables:
        # Flatten possible MultiIndex headers
        cols = [" ".join(str(x) for x in c) if isinstance(c, tuple) else str(c) for c in t.columns]
        t.columns = cols
        first = cols[0]
        com_cols = [c for c in cols if re.search(r"commercial", c, re.I)]
        ind_cols = [c for c in cols if re.search(r"industrial", c, re.I)]
        if not com_cols or not ind_cols:
            continue
        for _, row in t.iterrows():
            name = str(row[first]).strip()
            st = STATE_NAMES.get(name)
            if not st:
                continue
            try:
                c = float(row[com_cols[0]])
                i = float(row[ind_cols[0]])
            except (TypeError, ValueError):
                continue
            # cents/kWh -> $/kWh
            rates[st] = {"c": round(c / 100, 4), "i": round(i / 100, 4)}
    if len(rates) < 45:
        raise RuntimeError(f"rates parse produced only {len(rates)} states — check EPM layout")
    print(f"rates: ok ({len(rates)} states, e.g. CA={rates.get('CA')})")
    return rates


# ---------------------------------------------------------------------------
# 2. State CO2e output emission rates (eGRID, lb/MWh)
# ---------------------------------------------------------------------------
def build_co2() -> dict[str, float]:
    print("co2: fetching eGRID (~10 MB) ...")
    blob = http_get(EGRID_URL)
    xls = pd.ExcelFile(io.BytesIO(blob))
    sheet = next((s for s in xls.sheet_names if re.fullmatch(r"ST\d\d", s)), None)
    if not sheet:
        raise RuntimeError(f"no state sheet in eGRID file: {xls.sheet_names}")
    df = pd.read_excel(xls, sheet_name=sheet, header=1)
    if "PSTATABB" not in df.columns:
        df = pd.read_excel(xls, sheet_name=sheet, header=0)
    col = next((c for c in ("STC2ERTA", "STCO2ERTA", "STCO2RTA") if c in df.columns), None)
    if not col or "PSTATABB" not in df.columns:
        raise RuntimeError(f"unexpected eGRID columns: {list(df.columns)[:12]}")
    out = {}
    for _, row in df.iterrows():
        st = str(row["PSTATABB"]).strip()
        v = pd.to_numeric(row[col], errors="coerce")
        if st in STATES and pd.notna(v):
            out[st] = round(float(v), 1)
    print(f"co2: ok ({len(out)} states from {sheet}.{col}, e.g. NY={out.get('NY')})")
    return out


# ---------------------------------------------------------------------------
# 3. PVWatts yield grid over the building stock
# ---------------------------------------------------------------------------
def cell_key(lat: float, lon: float) -> str:
    half = GRID_RES / 2
    clat = (int(lat / GRID_RES)) * GRID_RES + (half if lat >= 0 else -half)
    clon = (int(lon / GRID_RES)) * GRID_RES + (half if lon >= 0 else -half)
    return f"{clat:.2f},{clon:.2f}"


def load_building_cells() -> tuple[Counter, dict[str, Counter]]:
    payload_path = ROOT / "data" / "web" / "buildings.json.gz"
    with gzip.open(payload_path, "rb") as f:
        payload = json.load(f)
    idx = {c: i for i, c in enumerate(payload["columns"])}
    cells: Counter = Counter()
    state_cells: dict[str, Counter] = defaultdict(Counter)
    for r in payload["rows"]:
        lat, lon, st = r[idx["lat"]], r[idx["lon"]], r[idx["state"]]
        if lat is None or lon is None:
            continue
        k = cell_key(float(lat), float(lon))
        cells[k] += 1
        if st:
            state_cells[str(st)][k] += 1
    return cells, state_cells


def pvwatts_yield(lat: float, lon: float) -> float:
    q = (
        f"?api_key={NLR_API_KEY}&lat={lat}&lon={lon}&system_capacity=1"
        "&azimuth=180&tilt=20&array_type=1&module_type=1&losses=14"
    )
    data = json.loads(http_get(PVWATTS_URL + q, timeout=60))
    return float(data["outputs"]["ac_annual"])


def build_yield(skip: bool) -> dict:
    cells, state_cells = load_building_cells()
    cache: dict[str, float] = json.loads(CACHE_PATH.read_text()) if CACHE_PATH.exists() else {}
    todo = [k for k, _ in cells.most_common() if k not in cache]
    print(f"yield: {len(cells)} cells cover the stock; {len(cache)} cached, {len(todo)} to fetch")

    if not skip:
        for n, key in enumerate(todo):
            lat, lon = (float(x) for x in key.split(","))
            try:
                cache[key] = round(pvwatts_yield(lat, lon), 0)
                print(f"  [{n + 1}/{len(todo)}] {key} -> {cache[key]:.0f} kWh/kWp ({cells[key]} bldgs)")
                time.sleep(1.2)
            except Exception as e:
                msg = str(e)
                print(f"  stopping PVWatts fetch at {key}: {msg[:120]}")
                if "429" in msg or "OVER_RATE_LIMIT" in msg:
                    print("  (rate limited — re-run later or set NLR_API_KEY to finish remaining cells)")
                break
        REF_DIR.mkdir(parents=True, exist_ok=True)
        CACHE_PATH.write_text(json.dumps(cache, indent=0))

    # Building-weighted state means from solved cells
    states = {}
    for st, sc in state_cells.items():
        vals = [(cache[k], w) for k, w in sc.items() if k in cache]
        if vals:
            states[st] = round(sum(v * w for v, w in vals) / sum(w for _, w in vals), 0)

    # Programs that publish no coordinates get a representative anchor point
    SEED_STATE_POINTS = {"CO": (39.74, -104.99), "MD": (39.08, -77.15)}  # Denver, Rockville
    for st, (la, lo) in SEED_STATE_POINTS.items():
        if st not in states and not skip:
            try:
                states[st] = round(pvwatts_yield(la, lo), 0)
                print(f"  seeded state mean {st} -> {states[st]:.0f}")
            except Exception as e:
                print(f"  seed for {st} failed: {str(e)[:80]}")
    covered = sum(w for k, w in cells.items() if k in cache)
    print(f"yield: {len(cache)}/{len(cells)} cells solved covering {covered} buildings; state means: { {k: v for k, v in sorted(states.items())} }")
    return {"res": GRID_RES, "cells": cache, "states": states, "default": DEFAULT_YIELD}


if __name__ == "__main__":
    skip_pv = "--skip-pvwatts" in sys.argv
    REF_DIR.mkdir(parents=True, exist_ok=True)

    reference = {
        "generated": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "sources": {
            "rates": "EIA Electric Power Monthly, Table 5.6.A (avg retail price by state & sector)",
            "co2": "EPA eGRID2023 state output emission rates (CO2e, lb/MWh)",
            "yield": "PVWatts v8 (NLR), 1kW fixed roof-mount, tilt 20, az 180, 14% losses",
        },
        "rates": build_rates(),
        "co2_lb_per_mwh": build_co2(),
        "yield": build_yield(skip_pv),
    }

    blob = json.dumps(reference, separators=(",", ":"), allow_nan=False)
    for p in OUT_PATHS:
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(blob, encoding="utf-8")
        print(f"wrote {p} ({len(blob) / 1e3:.0f} kB)")
