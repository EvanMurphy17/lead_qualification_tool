#!/usr/bin/env python
from __future__ import annotations

import argparse
import difflib
import json
import sys
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import pandas as pd

# --- Project paths ---
HERE = Path(__file__).resolve()
PROJECT_ROOT = HERE.parents[1]
DATA_DIR = PROJECT_ROOT / "data"
COMBINED_DIR = DATA_DIR / "combined"

# Ensure project root is importable when running this script directly
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

# --- Mapping (hard-coded) ---
try:
    from app.utils.canonical_map import CANONICAL_MAP  # your hard-coded dict
except Exception as e:
    raise SystemExit(
        "Could not import CANONICAL_MAP from app.utils.canonical_map.\n"
        "Make sure:\n"
        "  1) app/__init__.py exists (can be empty),\n"
        "  2) app/utils/canonical_map.py exists and defines CANONICAL_MAP = {...}\n"
        f"Original import error: {e}"
    )

# --- Program files & sources (update only if filenames change) ---
PROGRAM_FILES: Dict[str, str] = {
    "Boston":               str(DATA_DIR / "boston_2024-reported-energy-and-water-metrics-1.xlsx"),
    "California":           str(DATA_DIR / "california_2023_Download_ADA.xlsx"),
    "Chicago":              str(DATA_DIR / "chicago_Chicago_Energy_Benchmarking_20250923.xlsx"),
    "Denver":               str(DATA_DIR / "denver_Energize_Denver_2023_Final_Master_Dataset.xlsx"),
    "Montgomery County":    str(DATA_DIR / "moco_2024_Energy_Benchmarking_All_Sites_20250923.xlsx"),
    "New York City":        str(DATA_DIR / "nyc_NYC_Building_Energy_and_Water_Data_Disclosure_for_Local_Law_84__2022-Present__20250923.xlsx"),
    "Philadelphia":         str(DATA_DIR / "philly_properties_reported_2023.xlsx"),
    "Seattle":              str(DATA_DIR / "seattle_Building_Energy_Benchmarking_Data,_2015-Present_20250923.xlsx"),
    "Washington DC":        str(DATA_DIR / "dc_Building_Energy_Benchmarking.xlsx"),
}

SOURCES: Dict[str, str] = {
    "Boston": "https://data.boston.gov/dataset/building-emissions-reduction-and-disclosure-ordinance",
    "California": "https://www.energy.ca.gov/media/10811",
    "Chicago": "https://data.cityofchicago.org/Environment-Sustainable-Development/Chicago-Energy-Benchmarking/xq83-jr8c",
    "Denver": "https://opendata-geospatialdenver.hub.arcgis.com/search?q=energize%20denver&sort=Date%20Updated%7Cmodified%7Cdesc",
    "Montgomery County": "https://data.montgomerycountymd.gov/Environment/2024-Energy-Benchmarking-All-Sites/g6nn-rgwc",
    "New York City": "https://data.cityofnewyork.us/Environment/NYC-Building-Energy-and-Water-Data-Disclosure-for-/5zyy-y8am",
    "Philadelphia": "https://opendataphilly.org/datasets/large-building-energy-benchmarking-data/",
    "Seattle": "https://data.seattle.gov/Built-Environment/Building-Energy-Benchmarking-Data-2015-Present/teqw-tu6e",
    "Washington DC": "https://opendata.dc.gov/datasets/DCGIS%3A%3Abuilding-energy-benchmarking/about",
}

CANONICAL_COLUMNS: List[str] = list(CANONICAL_MAP.keys())
PROVENANCE_COLS = ["Source Program", "Source URL", "Source File", "Source Sheet"]

# --- Column type expectations ---
NUMERIC_COLS = {
    # adjust if needed
    "Floor Area (sq ft)",
    "Natural Gas Usage",
    "Electricity Usage",
    "Renewable Energy Usage",
}
# Everything else in CANONICAL_COLUMNS that is not numeric (and not "Data Year") is text
TEXT_COLS = [c for c in CANONICAL_COLUMNS if c not in NUMERIC_COLS and c != "Data Year"]

# ---------- Helpers ----------
def normkey(s: str) -> str:
    return "".join(ch.lower() for ch in str(s) if ch.isalnum())

def pick_best_sheet(xls: pd.ExcelFile) -> str:
    best, best_cols = None, -1
    for name in xls.sheet_names:
        try:
            df = pd.read_excel(xls, sheet_name=name, nrows=50, dtype="object")
            c = df.dropna(axis=1, how="all").shape[1]
            if c > best_cols:
                best_cols, best = c, name
        except Exception:
            continue
    return best or xls.sheet_names[0]

def resolve_header(actual_headers: List[str], desired: str) -> Optional[str]:
    """Map a desired header to the actual column in the sheet (exact → ci → normalized → fuzzy)."""
    if not desired:
        return None
    # exact
    for h in actual_headers:
        if h == desired:
            return h
    # case-insensitive
    dlow = desired.lower()
    for h in actual_headers:
        if str(h).lower() == dlow:
            return h
    # normalized
    lookup = {normkey(h): h for h in actual_headers}
    dn = normkey(desired)
    if dn in lookup:
        return lookup[dn]
    # fuzzy
    close = difflib.get_close_matches(desired, [str(h) for h in actual_headers], n=1, cutoff=0.92)
    if close:
        target = close[0]
        for h in actual_headers:
            if str(h) == target:
                return h
    return None

@dataclass
class ProgramBuildReport:
    program: str
    file: str
    sheet: str
    rows: int
    mapped_columns: int
    missing: List[str]
    notes: List[str]

def build_one_program(program: str, path: str, dry_run: bool=False) -> Tuple[pd.DataFrame, ProgramBuildReport]:
    xls = pd.ExcelFile(path)
    sheet = pick_best_sheet(xls)

    # Peek headers for resolution
    header_df = pd.read_excel(xls, sheet_name=sheet, nrows=0, dtype="object")
    actual_headers = list(header_df.columns)

    desired_specs = {canon: CANONICAL_MAP[canon].get(program) for canon in CANONICAL_COLUMNS}
    actual_needed: Dict[str, str] = {}
    missing: List[str] = []
    mapped_count = 0
    notes: List[str] = []

    for canon, spec in desired_specs.items():
        if not spec or spec.get("type") == "literal":
            continue
        desired = spec.get("name", "")
        found = resolve_header(actual_headers, desired)
        if found:
            actual_needed[desired] = found
            mapped_count += 1
        else:
            missing.append(f"{canon} ⇒ {desired}")

    if dry_run:
        return pd.DataFrame(), ProgramBuildReport(program, Path(path).name, sheet, 0, mapped_count, missing, notes)

    # Read only resolved columns (fallback to all on error)
    usecols = list(set(actual_needed.values()))
    try:
        df_raw = pd.read_excel(xls, sheet_name=sheet, dtype="object", usecols=usecols if usecols else None)
    except Exception as e:
        notes.append(f"retry read-all due to usecols error: {e}")
        df_raw = pd.read_excel(xls, sheet_name=sheet, dtype="object")

    df_raw = df_raw.dropna(how="all")
    n = len(df_raw)

    out_cols: Dict[str, pd.Series] = {}
    for canon in CANONICAL_COLUMNS:
        spec = CANONICAL_MAP.get(canon, {}).get(program)
        if not spec:
            out_cols[canon] = pd.Series([None] * n, index=df_raw.index); continue
        if spec.get("type") == "literal":
            out_cols[canon] = pd.Series([spec.get("value", "")] * n, index=df_raw.index); continue

        desired = spec.get("name", "")
        actual = actual_needed.get(desired)
        if actual and actual in df_raw.columns:
            out_cols[canon] = df_raw[actual]
        else:
            # try again if we read all columns
            fallback = resolve_header(list(df_raw.columns), desired)
            out_cols[canon] = df_raw[fallback] if fallback and fallback in df_raw.columns else pd.Series([None] * n, index=df_raw.index)

    out = pd.DataFrame(out_cols)
    out["Source Program"] = program
    out["Source URL"] = SOURCES.get(program, "")
    out["Source File"] = Path(path).name
    out["Source Sheet"] = sheet

    return out, ProgramBuildReport(program, Path(path).name, sheet, len(out), mapped_count, missing, notes)

# ---------- DTYPE COERCION & ORDER ----------
def finalize_schema(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()

    # numeric columns
    for col in NUMERIC_COLS:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    # Data Year as nullable int if possible, else string
    if "Data Year" in df.columns:
        y = pd.to_numeric(df["Data Year"], errors="coerce").astype("Int64")
        df["Data Year"] = y

    # text columns (strings)
    for col in TEXT_COLS + PROVENANCE_COLS:
        if col in df.columns:
            df[col] = df[col].astype("string")

    # stable column order: canonical + provenance (keep only those that exist)
    desired_order = [c for c in CANONICAL_COLUMNS if c in df.columns] + [c for c in PROVENANCE_COLS if c in df.columns]
    # include any extra columns at the end (just in case)
    extras = [c for c in df.columns if c not in desired_order]
    df = df[desired_order + extras]
    return df

def main():
    parser = argparse.ArgumentParser(description="Build canonical benchmarking dataset from local Excel files.")
    parser.add_argument("--outdir", default=str(COMBINED_DIR), help="Output folder (default: data/combined)")
    parser.add_argument("--program", action="append", help="Limit to one or more programs by name (repeatable).")
    parser.add_argument("--dry-run", action="store_true", help="Resolve headers only; do not read data or write output.")
    parser.add_argument("--json-report", default="", help="Optional path to save a JSON build report.")
    args = parser.parse_args()

    outdir = Path(args.outdir); outdir.mkdir(parents=True, exist_ok=True)
    programs = args.program or list(PROGRAM_FILES.keys())

    frames: List[pd.DataFrame] = []
    reports: List[ProgramBuildReport] = []
    for prog in programs:
        path = PROGRAM_FILES.get(prog)
        if not path or not Path(path).exists():
            print(f"[SKIP] {prog}: file not found at {path}"); continue
        print(f"[BUILD] {prog} from {path}")
        dfp, rep = build_one_program(prog, path, dry_run=args.dry_run)
        reports.append(rep)
        if not args.dry_run and not dfp.empty:
            frames.append(dfp)

    print("\n=== Build Report ===")
    for r in reports:
        print(f"- {r.program} (sheet '{r.sheet}') => rows={r.rows}, mapped={r.mapped_columns}, missing={len(r.missing)}")
        for n in r.notes: print(f"  note: {n}")
        if r.missing:
            for m in r.missing[:8]: print(f"  missing: {m}")
            if len(r.missing) > 8: print(f"  ... and {len(r.missing) - 8} more")

    if args.json_report:
        Path(args.json_report).write_text(json.dumps([r.__dict__ for r in reports], indent=2))
        print(f"\nSaved JSON report to {args.json_report}")

    if args.dry_run:
        print("\n(dry-run) No output files written."); return

    if not frames:
        print("\nNo data frames were built. Check the 'missing' items above (likely header mismatches)."); return

    combined = pd.concat(frames, ignore_index=True, sort=False)
    combined = finalize_schema(combined)

    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    out_csv = outdir / f"benchmarking_canonical_{ts}.csv"
    out_parq = outdir / f"benchmarking_canonical_{ts}.parquet"

    combined.to_csv(out_csv, index=False)
    try:
        combined.to_parquet(out_parq, index=False)  # engine='pyarrow' by default
        print(f"\nWrote: {out_csv}\nWrote: {out_parq}")
    except Exception as e:
        print(f"\nWrote: {out_csv}\nParquet not written ({e})")

if __name__ == "__main__":
    main()
