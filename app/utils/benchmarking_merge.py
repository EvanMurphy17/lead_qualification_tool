# app/utils/benchmarking_merge.py
from __future__ import annotations
import json
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Tuple
import pandas as pd

from .canonical_map import CANONICAL_MAP  # your hard-coded mapping

# ---------- Paths ----------
def _find_project_root() -> Path:
    here = Path(__file__).resolve()
    for candidate in [here.parents[2], here.parents[1], Path.cwd(), Path.cwd().parent]:
        if (candidate / "data").exists():
            return candidate
    return here.parents[2]

PROJECT_ROOT = _find_project_root()
DATA_DIR = PROJECT_ROOT / "data"
OUTPUT_DIR = DATA_DIR / "combined"
MANIFEST_PATH = DATA_DIR / "combined_manifest.json"

# ---------- Programs & file locations ----------
# Match these keys to the program names used in your CANONICAL_MAP
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

# Canonical column order from your mapping (row labels)
CANONICAL_COLUMNS: List[str] = list(CANONICAL_MAP.keys())

# ---------- Helpers ----------
def _pick_best_sheet(xls: pd.ExcelFile) -> str:
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

def _normalize_lookup(df: pd.DataFrame) -> Dict[str, str]:
    # map normalized -> actual column to survive minor punctuation/case differences
    def norm(s: str) -> str:
        s = str(s)
        return "".join(ch.lower() for ch in s if ch.isalnum())
    return {norm(c): c for c in df.columns}

def _collect_usecols_for_program(program: str) -> List[str]:
    # Any mapped "column" spec becomes a usecol
    usecols = []
    for canon, per_prog in CANONICAL_MAP.items():
        spec = per_prog.get(program)
        if not spec:
            continue
        if spec.get("type") == "column":
            usecols.append(spec["name"])
    # de-duplicate while preserving order
    seen, out = set(), []
    for c in usecols:
        if c not in seen:
            seen.add(c)
            out.append(c)
    return out

def _build_canonical_df_for_program(program: str, path: str) -> pd.DataFrame:
    xls = pd.ExcelFile(path)
    sheet = _pick_best_sheet(xls)

    usecols = _collect_usecols_for_program(program)
    # Read only needed columns if we have any; else read all and we'll fill from literals
    df_raw = pd.read_excel(xls, sheet_name=sheet, dtype="object", usecols=usecols or None)
    # Strip fully empty rows
    df_raw = df_raw.dropna(how="all")
    if df_raw.empty:
        # still return empty frame with canonical columns so concat works
        return pd.DataFrame(columns=CANONICAL_COLUMNS + ["Source Program", "Source URL", "Source File", "Source Sheet"])

    # Build normalized lookup to handle slight header drift
    lookup = _normalize_lookup(df_raw)

    # Assemble canonical columns for this program
    canon_cols: Dict[str, pd.Series] = {}
    n = len(df_raw)

    def normkey(s: str) -> str:
        return "".join(ch.lower() for ch in s if ch.isalnum())

    for canon in CANONICAL_COLUMNS:
        spec = CANONICAL_MAP.get(canon, {}).get(program)
        if not spec:
            canon_cols[canon] = pd.Series([None] * n, index=df_raw.index)
            continue
        if spec.get("type") == "literal":
            canon_cols[canon] = pd.Series([spec.get("value", "")] * n, index=df_raw.index)
        else:
            raw_name = spec.get("name", "")
            col = df_raw.columns[df_raw.columns == raw_name]
            if len(col) == 1:
                canon_cols[canon] = df_raw[raw_name]
            else:
                # try normalized fallback
                nk = normkey(raw_name)
                actual = lookup.get(nk)
                if actual and actual in df_raw.columns:
                    canon_cols[canon] = df_raw[actual]
                else:
                    canon_cols[canon] = pd.Series([None] * n, index=df_raw.index)

    out = pd.DataFrame(canon_cols)

    # Provenance
    out["Source Program"] = program
    out["Source URL"] = SOURCES.get(program, "")
    out["Source File"] = Path(path).name
    out["Source Sheet"] = sheet
    return out

def _file_facts(path: Path) -> dict:
    return {"path": str(path), "size": path.stat().st_size, "mtime": int(path.stat().st_mtime)}

def _manifest_for(files_map: Dict[str, str]) -> dict:
    m = {}
    for prog, p in files_map.items():
        fp = Path(p)
        if fp.exists():
            m[prog] = _file_facts(fp)
    return m

def _load_manifest() -> dict:
    return json.loads(MANIFEST_PATH.read_text()) if MANIFEST_PATH.exists() else {}

def _save_manifest(m: dict) -> None:
    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST_PATH.write_text(json.dumps(m, indent=2))

def _needs_rebuild(old: dict, new: dict) -> bool:
    if not old:
        return True
    if set(old.keys()) != set(new.keys()):
        return True
    for k in new:
        if old.get(k, {}) != new[k]:
            return True
    return False

def _write_outputs(df: pd.DataFrame, out_dir: Path) -> Tuple[Path, Path | None]:
    out_dir.mkdir(parents=True, exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    csv_path = out_dir / f"benchmarking_canonical_{ts}.csv"
    pq_path = out_dir / f"benchmarking_canonical_{ts}.parquet"
    df.to_csv(csv_path, index=False)
    try:
        df.to_parquet(pq_path, index=False)
    except Exception:
        pq_path = None
    return csv_path, pq_path

def newest_combined(out_dir: Path = OUTPUT_DIR) -> Path | None:
    if not out_dir.exists():
        return None
    cands = sorted(out_dir.glob("benchmarking_canonical_*.parquet")) + sorted(out_dir.glob("benchmarking_canonical_*.csv"))
    return cands[-1] if cands else None

def expected_files_status() -> pd.DataFrame:
    rows = []
    for prog, p in PROGRAM_FILES.items():
        fp = Path(p)
        rows.append({
            "Program": prog,
            "Path": str(fp),
            "Exists": fp.exists(),
            "Size": fp.stat().st_size if fp.exists() else None
        })
    return pd.DataFrame(rows)

def build_from_local_data(
    files_map: Dict[str, str] | None = None,
    out_dir: Path = OUTPUT_DIR,
    force: bool = False,
) -> Path | None:
    """Return path to newest canonical combined file. Rebuild if needed."""
    files_map = files_map or PROGRAM_FILES
    files_map = {k: v for k, v in files_map.items() if Path(v).exists()}

    current = _manifest_for(files_map)
    old = _load_manifest()
    must_build = force or _needs_rebuild(old, current)

    if not must_build:
        latest = newest_combined(out_dir)
        if latest:
            return latest

    frames: List[pd.DataFrame] = []
    for program, path in files_map.items():
        try:
            dfp = _build_canonical_df_for_program(program, path)
            frames.append(dfp)
        except Exception as e:
            print(f"ERROR loading {program} from {path}: {e}")

    if not frames:
        return newest_combined(out_dir)

    merged = pd.concat(frames, ignore_index=True, sort=False)
    csv_path, pq_path = _write_outputs(merged, out_dir)
    _save_manifest(current)
    return pq_path or csv_path
