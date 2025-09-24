# app/pages/2_Sources.py
import streamlit as st
import pandas as pd

st.title("Data sources")

data = [
    {"Program": "Boston", "URL": "https://data.boston.gov/dataset/building-emissions-reduction-and-disclosure-ordinance"},
    {"Program": "California", "URL": "https://www.energy.ca.gov/media/10811"},
    {"Program": "Chicago", "URL": "https://data.cityofchicago.org/Environment-Sustainable-Development/Chicago-Energy-Benchmarking/xq83-jr8c"},
    {"Program": "Denver", "URL": "https://opendata-geospatialdenver.hub.arcgis.com/search?q=energize%20denver&sort=Date%20Updated%7Cmodified%7Cdesc"},
    {"Program": "Montgomery County", "URL": "https://data.montgomerycountymd.gov/Environment/2024-Energy-Benchmarking-All-Sites/g6nn-rgwc"},
    {"Program": "New York City", "URL": "https://data.cityofnewyork.us/Environment/NYC-Building-Energy-and-Water-Data-Disclosure-for-/5zyy-y8am"},
    {"Program": "Philadelphia", "URL": "https://opendataphilly.org/datasets/large-building-energy-benchmarking-data/"},
    {"Program": "Seattle", "URL": "https://data.seattle.gov/Built-Environment/Building-Energy-Benchmarking-Data-2015-Present/teqw-tu6e"},
    {"Program": "Washington DC", "URL": "https://opendata.dc.gov/datasets/DCGIS%3A%3Abuilding-energy-benchmarking/about"},
]
df = pd.DataFrame(data)
st.dataframe(df, use_container_width=True, hide_index=True)

st.markdown("### Links")
for _, row in df.iterrows():
    st.markdown(f"- **{row['Program']}**  \n  {row['URL']}")
