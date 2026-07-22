# Public C&I Energy Data — Research Findings (July 22, 2026)

Three research passes: (1) refreshed vintages of the 9 original sources,
(2) new benchmarking programs with usable public data, (3) complementary
datasets for solar/storage lead qualification. All URLs verified live in
July 2026 unless flagged.

## 1. Status of the original 9 sources

| Program | Latest data year | Notes |
|---|---|---|
| Boston BERDO | CY2024 (2025 report) | **Integrated.** XLSX only; headers on row 2. BERDO 2.0 threshold ≥20k sqft. |
| California AB 802 | CY2024 | **Integrated.** New file naming (`2024_Download_ADA.xlsx`); has lat/lon. |
| Chicago | CY2023 (stale) | Nothing newer published (last load Feb 2025); program relaunched Mar 2026 on ClearlyEnergy BEAM — watch for a new drop. |
| Denver Energize | mixed | Data model changed: current-cycle table only (no coords, numerics as strings); longitudinal series ends 2023. Handle with care. |
| Montgomery County | RY2024/25 | Unchanged dataset. Note: MoCo buildings exempt from MD state program since Oct 2025. |
| NYC LL84 | CY2024 | 103k rows now; also NEW **monthly** electricity/gas dataset (`fvp3-gcb2`) — valuable for load shape. |
| Philadelphia | CY2024 | **Integrated.** One ArcGIS layer per year. |
| Seattle | CY2024 | Same dataset/schema, CSV download works. |
| Washington DC | RY2024 | Threshold dropped to ≥10k sqft (bigger cohort); layer includes **monthly** usage columns. |

## 2. New programs with usable building-level usage data

Integrated this round:
- **San Francisco** (`4ua7-5sfx`): kWh + gas + lat/lon, ~2.5k buildings, threshold 10k sqft. ✅
- **Cambridge MA BEUDO** (`72g6-j7aq`): kWh + gas + owner + lat/lon, ~900 buildings. ✅

High-value, not yet integrated (endpoints in `scripts/fetch_data.py`):
- **Massachusetts LBER (statewide!)** — every MA building ≥20k sqft, CY2024,
  published Oct 2025. Likely the single biggest addition available. mass.gov
  blocks scripts — download manually in a browser:
  https://www.mass.gov/info-details/large-building-energy-reporting-results
- **San Jose** (CY2024 CSV, kWh+therms), **Berkeley BESO** (kWh/therms per year),
  **Portland OR** (CY2024 XLSX, kWh incl. onsite solar — good for "already has
  solar" screening), **Honolulu** (~800 bldgs, kWh split grid/renewable; HI rates
  make these premium storage leads).
- **Minnesota statewide** — map only so far (map.benchmarkingmn.org); check for export.

EUI-only (no fuel split, lower value): LA EBEWE (~10k bldgs/yr), Kansas City,
Orlando. Map-only or PDF-only: Miami, SLC, Boulder, Detroit, Minneapolis, St.
Louis, Columbus, Providence, Pittsburgh. No public data yet despite programs:
Washington State CBPS, Colorado, Maryland BEPS, New Jersey, Oregon.

~25–30 more jurisdictions are expected to launch BPS disclosure programs within
two years (IMT-coordinated National BPS Coalition) — recurring pipeline of new
sources.

## 3. Complementary datasets (top picks for this tool)

> **Status (July 22, 2026):** four integrations shipped — EIA state retail rates
> (est. $/yr per lead), EPA eGRID CO₂ rates, a PVWatts v8 yield grid (all via
> `scripts/build_reference.py`), and on-demand REopt v3 runs per building
> (`web/src/app/api/reopt/route.ts`, needs `NLR_API_KEY`).

1. **ComStock / End-Use Load Profiles** (latest release 2025_3) — synthetic
   15-min load shapes by building type/size/county. Attach a load shape +
   estimated peak to any benchmarking record → storage screening. Free, S3/OEDI.
2. **Utility Rate Database (URDB)** — machine-readable C&I tariffs incl. demand
   charges for 3,700+ utilities. Join buildings → utility → $/kW to rank leads
   by dollar savings, not kWh. Bulk CSV/JSON at https://apps.openei.org/USURDB/.
   Pair with **REopt API v3** to auto-size PV+BESS per lead.
3. **Regrid parcels + Overture building footprints** — owner name/mailing
   address (outreach) and roof area from footprint polygons (PV sizing).
   Overture is free (GeoParquet, monthly releases); Regrid is paid beyond a
   sandbox tier; county assessor data is the free per-metro alternative.

Also useful: EIA-861 (utility-level C&I rates/DR/net metering, 2024 final),
NYC & DC monthly usage columns (real seasonal shape for those cities),
LBNL Building Performance Database (peer-group EUI percentiles; aggregate only).

⚠️ **Heads-up:** NREL was renamed "National Laboratory of the Rockies" (Dec
2025) and `developer.nrel.gov` was retired May 29, 2026 — build any URDB/REopt/
PVWatts integrations against `developer.nlr.gov`. ENERGY STAR Portfolio Manager
(the backbone of all these disclosures) is funded through FY2026; beyond that
is uncertain — worth keeping local copies of source files (as this repo does).
