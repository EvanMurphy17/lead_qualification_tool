/** App identity — rename the product here and it changes everywhere. */
export const APP_NAME = "Loadstone";
export const COMPANY = "Alpengrid Analytics";
export const TAGLINE = "Public energy data, ready to work with";
export const CONTACT_EMAIL = "ap@alpengridanalytics.com";

/** Brand palette (mirrors the CSS tokens for use in canvas/map contexts). */
export const COLORS = {
  background: "#FFFFFF",
  foreground: "#0F1115",
  muted: "#404244",
  primary: "#0B1E3F",
  accent: "#94A3B8",
  border: "#DDDEE0",
} as const;

/**
 * Sequential ramp for annual electricity usage (magnitude), low → high.
 * Single navy hue anchored on the brand primary, monotone lightness —
 * validated against the #FFFFFF surface (ordinal ramp checks: pass).
 */
export const KWH_RAMP = ["#96A9C6", "#6E87AE", "#4A6690", "#2A4570", "#0B1E3F"] as const;

/** Class breakpoints for annual kWh (aligned with KWH_RAMP steps). */
export const KWH_BREAKS = [100_000, 500_000, 2_000_000, 10_000_000] as const;

export const KWH_CLASS_LABELS = [
  "< 100k",
  "100k – 500k",
  "500k – 2M",
  "2M – 10M",
  "≥ 10M",
] as const;

/** Color for buildings with no reported electricity usage. */
export const NO_DATA_COLOR = "#C9CACC";

export function kwhClass(kwh: number | null): number {
  if (kwh == null) return -1;
  for (let i = 0; i < KWH_BREAKS.length; i++) {
    if (kwh < KWH_BREAKS[i]) return i;
  }
  return KWH_BREAKS.length;
}

export function kwhColor(kwh: number | null): string {
  const c = kwhClass(kwh);
  return c === -1 ? NO_DATA_COLOR : KWH_RAMP[c];
}
