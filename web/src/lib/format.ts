/** Number formatting helpers shared by table, map, and detail panel. */

export function fmtInt(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return "—";
  return Math.round(v).toLocaleString("en-US");
}

export function fmtCompact(v: number | null | undefined, digits = 1): string {
  if (v == null || !isFinite(v)) return "—";
  const abs = Math.abs(v);
  if (abs >= 1e9) return `${(v / 1e9).toFixed(digits)}B`;
  if (abs >= 1e6) return `${(v / 1e6).toFixed(digits)}M`;
  if (abs >= 1e3) return `${(v / 1e3).toFixed(digits)}k`;
  return Math.round(v).toString();
}

export function fmtKwh(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return "—";
  return `${fmtCompact(v)} kWh`;
}

export function fmtFixed(v: number | null | undefined, digits = 1): string {
  if (v == null || !isFinite(v)) return "—";
  return v.toFixed(digits);
}
