import streamlit as st

st.set_page_config(page_title="Energy Benchmarking Explorer", layout="wide")

st.title("Energy Benchmarking Explorer")
st.markdown(
    """
The app builds a canonical dataset from Excel files in your `data/` folder using a hard-coded crosswalk.  
Open **Explore** to filter and download the merged dataset.  
Open **Sources** to see the citations.
"""
)
