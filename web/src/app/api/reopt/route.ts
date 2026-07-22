import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

/**
 * On-demand REopt v3 screening for a selected building.
 * POST { lat, lon, annualKwh, sector, rate } -> { uuid }
 * GET  ?uuid=...                             -> { status, ...trimmed outputs }
 *
 * Uses the NLR (formerly NREL) developer API — set NLR_API_KEY in .env.
 * DEMO_KEY works for a handful of runs per hour.
 */

const BASE = "https://developer.nlr.gov/api/reopt/stable";

const DOE_REF: Record<string, string> = {
  "Office": "LargeOffice",
  "Retail": "RetailStore",
  "Grocery": "SuperMarket",
  "Warehouse / Distribution": "Warehouse",
  "Industrial / Manufacturing": "FlatLoad",
  "Hospital / Healthcare": "Hospital",
  "Hotel": "LargeHotel",
  "K-12 School": "SecondarySchool",
  "College / University": "LargeOffice",
  "Multifamily": "MidriseApartment",
  "Data Center": "FlatLoad",
  "Public Assembly": "MediumOffice",
  "Public Services": "MediumOffice",
  "Parking": "FlatLoad",
};

function apiKey(): string | null {
  return process.env.NLR_API_KEY || null;
}

export async function POST(req: Request) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const key = apiKey();
  if (!key) {
    return NextResponse.json(
      { error: "REopt is not configured. Set NLR_API_KEY in web/.env (free key at developer.nlr.gov)." },
      { status: 503 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const lat = Number(body.lat);
  const lon = Number(body.lon);
  const annualKwh = Number(body.annualKwh);
  const rate = Number(body.rate) || 0.12;
  const sector = String(body.sector ?? "");
  if (!isFinite(lat) || !isFinite(lon) || !isFinite(annualKwh) || annualKwh <= 0) {
    return NextResponse.json({ error: "Building needs coordinates and annual kWh." }, { status: 400 });
  }

  const payload = {
    Site: { latitude: lat, longitude: lon },
    ElectricLoad: {
      doe_reference_name: DOE_REF[sector] ?? "MediumOffice",
      annual_kwh: annualKwh,
    },
    ElectricTariff: {
      blended_annual_energy_rate: rate,
      blended_annual_demand_rate: 10,
    },
    PV: {},
    ElectricStorage: {},
  };

  const res = await fetch(`${BASE}/job/?api_key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.run_uuid) {
    const detail =
      res.status === 429
        ? "NLR API rate limit hit (DEMO_KEY allows only a few runs/hour — get a free key at developer.nlr.gov)."
        : (json.messages ? JSON.stringify(json.messages).slice(0, 300) : `REopt returned ${res.status}`);
    return NextResponse.json({ error: detail }, { status: 502 });
  }
  return NextResponse.json({ uuid: json.run_uuid });
}

export async function GET(req: Request) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const key = apiKey();
  if (!key) return NextResponse.json({ error: "REopt not configured" }, { status: 503 });

  const uuid = new URL(req.url).searchParams.get("uuid");
  if (!uuid || !/^[a-f0-9-]{36}$/.test(uuid)) {
    return NextResponse.json({ error: "Invalid uuid" }, { status: 400 });
  }

  const res = await fetch(`${BASE}/job/${uuid}/results/?api_key=${key}`);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json({ error: `REopt results returned ${res.status}` }, { status: 502 });
  }

  const status: string = json.status ?? "unknown";
  if (status.toLowerCase().includes("optimiz")) {
    return NextResponse.json({ status: "running" });
  }
  if (status !== "optimal") {
    return NextResponse.json({ status: "error", error: `REopt status: ${status}` });
  }
  const o = json.outputs ?? {};
  const fin = o.Financial ?? {};
  return NextResponse.json({
    status: "optimal",
    pvKw: o.PV?.size_kw ?? null,
    bessKw: o.ElectricStorage?.size_kw ?? null,
    bessKwh: o.ElectricStorage?.size_kwh ?? null,
    npv: fin.npv ?? fin.npv_us_dollars ?? null,
    paybackYears: fin.simple_payback_years ?? null,
    lcc: fin.lcc ?? null,
  });
}
