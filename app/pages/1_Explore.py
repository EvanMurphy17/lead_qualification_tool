# app/pages/1_Explore.py
import streamlit as st
import pandas as pd
from pathlib import Path

st.title("Explore canonical dataset")

DATA_DIR = Path(__file__).resolve().parents[2] / "data"
COMBINED_DIR = DATA_DIR / "combined"

def newest_combined() -> Path | None:
    if not COMBINED_DIR.exists():
        return None
    cands = sorted(COMBINED_DIR.glob("benchmarking_canonical_*.parquet")) + \
            sorted(COMBINED_DIR.glob("benchmarking_canonical_*.csv"))
    return cands[-1] if cands else None

p = newest_combined()
if not p:
    st.error("No combined dataset found. Run the builder from the command line:")
    st.code("python scripts/build_canonical.py", language="bash")
    st.stop()

st.caption(f"Using file: {p}")

try:
    df = pd.read_parquet(p) if str(p).endswith(".parquet") else pd.read_csv(p, dtype="object")
except Exception as e:
    st.error(f"Failed to load combined dataset: {e}")
    st.stop()

st.success(f"Loaded rows {len(df)} cols {len(df.columns)}")

df_view = df.copy()

left, right = st.columns([2, 1])
with left:
    if "Source Program" in df_view.columns:
        progs = sorted(df_view["Source Program"].dropna().unique())
        sel = st.multiselect("Program", progs, default=progs)
        if sel:
            df_view = df_view[df_view["Source Program"].isin(sel)]
    if "Property Type" in df_view.columns:
        pts = sorted(df_view["Property Type"].dropna().unique())[:200]
        sel_pt = st.multiselect("Property Type", pts)
        if sel_pt:
            df_view = df_view[df_view["Property Type"].isin(sel_pt)]
with right:
    q = st.text_input("Search text (name/address/city/zip)")
    if q:
        ql = q.lower()
        mask = pd.Series(False, index=df_view.index)
        for c in ["Building Name", "Street Address", "City", "Zip Code"]:
            if c in df_view.columns:
                mask = mask | df_view[c].astype(str).str.lower().str.contains(ql, na=False)
        df_view = df_view[mask]

preview_rows = st.slider("Preview rows", 50, 2000, 200, step=50)
st.dataframe(df_view.head(preview_rows), use_container_width=True, height=600)

st.download_button(
    "Download filtered CSV",
    data=df_view.to_csv(index=False),
    file_name="benchmarking_canonical_filtered.csv",
    mime="text/csv",
)
