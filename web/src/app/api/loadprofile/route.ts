import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { DOE_REF, DEFAULT_DOE_REF } from "@/lib/doeRef";

const BASE = "https://developer.nlr.gov/api/reopt/stable";

/**
 * Downloadable 8760 hourly load profile for a building: the DOE commercial
 * reference shape for its sector and location, scaled to its reported annual
 * kWh via REopt's simulated_load endpoint. Returns CSV.
 */
export async function GET(req: Request) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const key = process.env.NLR_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "Load profiles are not configured. Set NLR_API_KEY in web/.env (free key at developer.nlr.gov)." },
      { status: 503 }
    );
  }

  const q = new URL(req.url).searchParams;
  const lat = Number(q.get("lat"));
  const lon = Number(q.get("lon"));
  const annualKwh = Number(q.get("annualKwh"));
  const sector = q.get("sector") ?? "";
  const label = (q.get("label") ?? "building").replace(/[^\w.-]+/g, "-").slice(0, 60);
  if (!isFinite(lat) || !isFinite(lon) || !isFinite(annualKwh) || annualKwh <= 0) {
    return NextResponse.json({ error: "Building needs coordinates and annual kWh." }, { status: 400 });
  }

  const doeRef = DOE_REF[sector] ?? DEFAULT_DOE_REF;
  const url =
    `${BASE}/simulated_load?api_key=${key}&latitude=${lat}&longitude=${lon}` +
    `&doe_reference_name=${doeRef}&annual_kwh=${annualKwh}`;
  const res = await fetch(url);
  if (!res.ok) {
    const detail =
      res.status === 429
        ? "NLR API rate limit hit. Try again in a few minutes."
        : `Load profile service returned ${res.status}`;
    return NextResponse.json({ error: detail }, { status: 502 });
  }
  const data = (await res.json()) as {
    loads_kw?: number[];
    annual_kwh?: number;
    max_kw?: number;
    mean_kw?: number;
  };
  if (!Array.isArray(data.loads_kw) || data.loads_kw.length !== 8760) {
    return NextResponse.json({ error: "Unexpected load profile response." }, { status: 502 });
  }

  const lines = [
    `# Typical-year hourly load profile (8760), ${label}`,
    `# DOE reference shape: ${doeRef}, scaled to ${Math.round(annualKwh).toLocaleString("en-US")} kWh/yr at (${lat}, ${lon})`,
    `# Source: NLR REopt simulated_load. Synthetic shape for screening and modeling, not metered data.`,
    `# annual_kwh=${data.annual_kwh ?? annualKwh}, peak_kw=${data.max_kw ?? ""}, mean_kw=${data.mean_kw ?? ""}`,
    "hour,kw",
    ...data.loads_kw.map((v, i) => `${i + 1},${v}`),
  ];

  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="loadstone-8760-${label}.csv"`,
      "Cache-Control": "private, max-age=86400",
    },
  });
}
