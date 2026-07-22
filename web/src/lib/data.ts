/** Client-side data layer: loads the gzipped columnar payload and filters it. */

export interface Building {
  id: number;
  program: string;
  name: string | null;
  owner: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  lat: number | null;
  lon: number | null;
  sector: string;
  propertyType: string | null;
  floorArea: number | null;
  yearBuilt: number | null;
  dataYear: number | null;
  elecKwh: number | null;
  gasKbtu: number | null;
  kwhPerSqft: number | null;
  siteEui: number | null;
  energyStar: number | null;
  peakKw: number | null;
  yearsReported: number | null;
  // Derived via enrich() from reference data (null until reference loads)
  estSpendUsd: number | null;
  estRate: number | null;
  pvYield: number | null;
  estCo2Tons: number | null;
}

export interface Dataset {
  generated: string;
  buildings: Building[];
  sources: Record<string, string>;
  programs: string[];
  states: string[];
  sectors: string[];
  /** Total buildings in the full database (set on the preview payload). */
  fullCount: number | null;
}

interface RawPayload {
  generated: string;
  columns: string[];
  rows: (string | number | null)[][];
  sources: Record<string, string>;
  fullCount?: number;
}

async function fetchPayload(url: string): Promise<RawPayload> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load dataset (${res.status})`);
  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf);
  // If the host already decoded the gzip (Content-Encoding), bytes are JSON.
  if (bytes[0] === 0x7b) {
    return JSON.parse(new TextDecoder().decode(bytes));
  }
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  const text = await new Response(stream).text();
  return JSON.parse(text);
}

export async function loadDataset(url = "/data/buildings.json.gz"): Promise<Dataset> {
  const payload = await fetchPayload(url);
  const idx: Record<string, number> = {};
  payload.columns.forEach((c, i) => (idx[c] = i));

  const n = (v: string | number | null) => (v == null ? null : Number(v));
  const s = (v: string | number | null) => (v == null ? null : String(v));

  const buildings: Building[] = payload.rows.map((r, i) => ({
    id: i,
    program: String(r[idx["program"]] ?? ""),
    name: s(r[idx["name"]]),
    owner: s(r[idx["owner"]]),
    address: s(r[idx["address"]]),
    city: s(r[idx["city"]]),
    state: s(r[idx["state"]]),
    zip: s(r[idx["zip"]]),
    lat: n(r[idx["lat"]]),
    lon: n(r[idx["lon"]]),
    sector: String(r[idx["sector"]] ?? "Other / Unknown"),
    propertyType: s(r[idx["property_type"]]),
    floorArea: n(r[idx["floor_area"]]),
    yearBuilt: n(r[idx["year_built"]]),
    dataYear: n(r[idx["data_year"]]),
    elecKwh: n(r[idx["elec_kwh"]]),
    gasKbtu: n(r[idx["gas_kbtu"]]),
    kwhPerSqft: n(r[idx["kwh_per_sqft"]]),
    siteEui: n(r[idx["site_eui"]]),
    energyStar: n(r[idx["energy_star"]]),
    peakKw: n(r[idx["peak_kw"]]),
    yearsReported: n(r[idx["years_reported"]]),
    estSpendUsd: null,
    estRate: null,
    pvYield: null,
    estCo2Tons: null,
  }));

  const uniq = (vals: (string | null)[]) =>
    Array.from(new Set(vals.filter((v): v is string => v != null))).sort();

  return {
    generated: payload.generated,
    buildings,
    sources: payload.sources,
    programs: uniq(buildings.map((b) => b.program)),
    states: uniq(buildings.map((b) => b.state)),
    sectors: uniq(buildings.map((b) => b.sector)),
    fullCount: payload.fullCount ?? null,
  };
}

// ---------------------------------------------------------------------------
// Reference data (state retail rates, grid CO2, PVWatts yield grid)
// ---------------------------------------------------------------------------

export interface Reference {
  generated: string;
  sources: Record<string, string>;
  rates: Record<string, { c: number; i: number }>;
  co2_lb_per_mwh: Record<string, number>;
  yield: { res: number; cells: Record<string, number>; states: Record<string, number>; default: number };
}

export async function loadReference(url = "/data/reference.json"): Promise<Reference | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return (await res.json()) as Reference;
  } catch {
    return null;
  }
}

function yieldCellKey(lat: number, lon: number, res: number): string {
  const half = res / 2;
  const clat = Math.trunc(lat / res) * res + (lat >= 0 ? half : -half);
  const clon = Math.trunc(lon / res) * res + (lon >= 0 ? half : -half);
  return `${clat.toFixed(2)},${clon.toFixed(2)}`;
}

/** kWh per kWp-yr for a building: PVWatts cell -> state mean -> national default. */
export function pvYieldFor(b: Building, ref: Reference | null): number {
  if (!ref) return 1300;
  const y = ref.yield;
  if (b.lat != null && b.lon != null) {
    const cell = y.cells[yieldCellKey(b.lat, b.lon, y.res)];
    if (cell) return cell;
  }
  if (b.state && y.states[b.state]) return y.states[b.state];
  return y.default;
}

const INDUSTRIAL_SECTORS = new Set(["Industrial / Manufacturing", "Data Center"]);
const LB_PER_METRIC_TON = 2204.62;

/** Attach reference-derived estimates to every building (idempotent). */
export function enrich(buildings: Building[], ref: Reference | null): void {
  if (!ref) return;
  for (const b of buildings) {
    b.pvYield = pvYieldFor(b, ref);
    if (b.state && b.elecKwh != null) {
      const rate = ref.rates[b.state];
      if (rate) {
        b.estRate = INDUSTRIAL_SECTORS.has(b.sector) ? rate.i : rate.c;
        b.estSpendUsd = Math.round(b.elecKwh * b.estRate);
      }
      const co2 = ref.co2_lb_per_mwh[b.state];
      if (co2) {
        b.estCo2Tons = Math.round(((b.elecKwh / 1000) * co2) / LB_PER_METRIC_TON);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Filtering
// ---------------------------------------------------------------------------

export interface Filters {
  search: string;
  states: string[];
  programs: string[];
  sectors: string[];
  minKwh: number;
  minSqft: number;
  minPeakKw: number;
  mappedOnly: boolean;
  withUsageOnly: boolean;
}

export const DEFAULT_FILTERS: Filters = {
  search: "",
  states: [],
  programs: [],
  sectors: [],
  minKwh: 0,
  minSqft: 0,
  minPeakKw: 0,
  mappedOnly: false,
  withUsageOnly: false,
};

export function applyFilters(buildings: Building[], f: Filters): Building[] {
  const q = f.search.trim().toLowerCase();
  return buildings.filter((b) => {
    if (f.states.length && (!b.state || !f.states.includes(b.state))) return false;
    if (f.programs.length && !f.programs.includes(b.program)) return false;
    if (f.sectors.length && !f.sectors.includes(b.sector)) return false;
    if (f.minKwh > 0 && (b.elecKwh == null || b.elecKwh < f.minKwh)) return false;
    if (f.minSqft > 0 && (b.floorArea == null || b.floorArea < f.minSqft)) return false;
    if (f.minPeakKw > 0 && (b.peakKw == null || b.peakKw < f.minPeakKw)) return false;
    if (f.mappedOnly && (b.lat == null || b.lon == null)) return false;
    if (f.withUsageOnly && b.elecKwh == null) return false;
    if (q) {
      const hay = `${b.name ?? ""} ${b.owner ?? ""} ${b.address ?? ""} ${b.city ?? ""} ${b.zip ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

// ---------------------------------------------------------------------------
// CSV export
// ---------------------------------------------------------------------------

export function toCsv(rows: Building[]): string {
  const headers = [
    "program", "name", "owner", "address", "city", "state", "zip", "lat", "lon",
    "sector", "property_type", "floor_area_sqft", "year_built", "data_year",
    "annual_electricity_kwh", "annual_gas_kbtu", "kwh_per_sqft", "site_eui_kbtu_sqft",
    "energy_star_score", "annual_peak_demand_kw",
    "est_annual_spend_usd", "est_retail_rate_usd_kwh", "est_pv_yield_kwh_per_kw", "est_grid_co2_tons",
  ];
  const esc = (v: unknown) => {
    if (v == null) return "";
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = rows.map((b) =>
    [
      b.program, b.name, b.owner, b.address, b.city, b.state, b.zip, b.lat, b.lon,
      b.sector, b.propertyType, b.floorArea, b.yearBuilt, b.dataYear,
      b.elecKwh, b.gasKbtu, b.kwhPerSqft, b.siteEui, b.energyStar, b.peakKw,
      b.estSpendUsd, b.estRate, b.pvYield, b.estCo2Tons,
    ]
      .map(esc)
      .join(",")
  );
  return [headers.join(","), ...lines].join("\n");
}
