"use client";

import { useEffect, useRef, useState } from "react";
import type { Building, Reference } from "@/lib/data";
import { fmtFixed, fmtInt, fmtKwh } from "@/lib/format";
import {
  IconBarChart,
  IconBattery,
  IconExternalLink,
  IconGlobe,
  IconLoader,
  IconMapPin,
  IconSun,
  IconX,
} from "@/components/icons";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border/50 py-2 text-sm">
      <span className="shrink-0 text-muted">{label}</span>
      <span className="text-right font-heading">{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// REopt on-demand screening
// ---------------------------------------------------------------------------

interface ReoptResult {
  status: string;
  pvKw?: number | null;
  bessKw?: number | null;
  bessKwh?: number | null;
  npv?: number | null;
  paybackYears?: number | null;
  error?: string;
}

function ReoptSection({ building: b }: { building: Building }) {
  const [state, setState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [result, setResult] = useState<ReoptResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef(false);

  // Reset when the selected building changes
  useEffect(() => {
    abortRef.current = false;
    setState("idle");
    setResult(null);
    setError(null);
    return () => {
      abortRef.current = true;
    };
  }, [b.id]);

  const runnable = b.lat != null && b.lon != null && b.elecKwh != null && b.elecKwh > 0;

  async function run() {
    setState("running");
    setError(null);
    try {
      const res = await fetch("/api/reopt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat: b.lat,
          lon: b.lon,
          annualKwh: b.elecKwh,
          sector: b.sector,
          rate: b.estRate ?? 0.12,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);

      // Poll for up to ~4 minutes
      for (let i = 0; i < 48; i++) {
        await new Promise((r) => setTimeout(r, 5000));
        if (abortRef.current) return;
        const poll = await fetch(`/api/reopt?uuid=${json.uuid}`);
        const pj: ReoptResult & { error?: string } = await poll.json();
        if (!poll.ok) throw new Error(pj.error ?? `Polling failed (${poll.status})`);
        if (pj.status === "optimal") {
          setResult(pj);
          setState("done");
          return;
        }
        if (pj.status === "error") throw new Error(pj.error ?? "REopt could not solve this site.");
      }
      throw new Error("REopt timed out. Try again later.");
    } catch (e) {
      if (abortRef.current) return;
      setError(e instanceof Error ? e.message : String(e));
      setState("error");
    }
  }

  return (
    <section className="rounded-md border border-border p-3">
      <h4 className="mb-2 text-xs uppercase tracking-wide text-muted">
        REopt techno-economic screening
      </h4>

      {state === "idle" && (
        <>
          <p className="mb-2 text-xs leading-snug text-muted">
            Runs NLR&apos;s REopt optimizer for this site (DOE reference load shape scaled to
            reported kWh, blended tariff). Takes ~1–2 minutes.
          </p>
          <button
            onClick={run}
            disabled={!runnable}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-background hover:bg-accent hover:text-foreground transition-colors disabled:opacity-40 cursor-pointer"
          >
            <IconBarChart size={15} />
            Run REopt analysis
          </button>
          {!runnable && (
            <p className="mt-2 text-[11px] text-muted">
              Needs coordinates and reported annual electricity.
            </p>
          )}
        </>
      )}

      {state === "running" && (
        <div className="flex items-center gap-2 py-2 text-sm text-muted">
          <IconLoader size={16} className="animate-spin text-primary" />
          Optimizing… this typically takes a minute or two.
        </div>
      )}

      {state === "error" && (
        <>
          <p className="py-1 text-sm font-medium text-foreground">{error}</p>
          <button onClick={run} className="mt-1 text-sm text-primary hover:text-accent cursor-pointer">
            Try again
          </button>
        </>
      )}

      {state === "done" && result && (
        <>
          <Row label="Optimal PV" value={result.pvKw != null ? `${fmtInt(result.pvKw)} kW` : "none"} />
          <Row
            label="Optimal battery"
            value={
              result.bessKw != null && result.bessKw > 0
                ? `${fmtInt(result.bessKw)} kW / ${fmtInt(result.bessKwh)} kWh`
                : "none"
            }
          />
          <Row label="Net present value" value={result.npv != null ? `$${fmtInt(result.npv)}` : "—"} />
          <Row
            label="Simple payback"
            value={result.paybackYears != null ? `${fmtFixed(result.paybackYears, 1)} yrs` : "—"}
          />
          <p className="mt-2 text-[11px] leading-snug text-muted">
            REopt v3 with default costs/incentives, DOE reference load shape, and a blended
            tariff. Directional only; rerun with the real tariff and interval data to refine.
          </p>
        </>
      )}
    </section>
  );
}

/** National fallback when no PVWatts/state yield is available. */
const FALLBACK_YIELD = 1300;

export function DetailPanel({
  building: b,
  sourceUrl,
  reference,
  preview = false,
  onClose,
}: {
  building: Building;
  sourceUrl?: string;
  reference: Reference | null;
  preview?: boolean;
  onClose: () => void;
}) {
  const mapsQuery = encodeURIComponent(
    [b.address, b.city, b.state, b.zip].filter(Boolean).join(", ")
  );
  const pvYield = b.pvYield ?? FALLBACK_YIELD;
  const pvKw = b.elecKwh != null ? b.elecKwh / pvYield : null;

  return (
    <aside className="absolute inset-y-0 right-0 z-20 flex w-full max-w-sm flex-col overflow-y-auto border-l border-border bg-background shadow-[-8px_0_24px_rgba(0,0,0,0.5)]">
      <div className="flex items-start justify-between gap-3 border-b border-border p-4">
        <div className="min-w-0">
          <h3 className="text-base leading-snug">{b.name ?? b.address ?? "Building"}</h3>
          <p className="mt-1 text-sm text-muted">
            {[b.address, b.city, b.state, b.zip].filter(Boolean).join(", ")}
          </p>
        </div>
        <button
          onClick={onClose}
          className="shrink-0 rounded p-1 text-muted hover:text-foreground cursor-pointer"
          aria-label="Close details"
        >
          <IconX size={18} />
        </button>
      </div>

      <div className="flex flex-col gap-5 p-4">
        {/* Energy profile */}
        <section>
          <h4 className="mb-1 text-xs uppercase tracking-wide text-muted">
            Energy profile · {b.dataYear ?? "latest"}
          </h4>
          <Row label="Annual electricity" value={<span className="text-primary">{fmtKwh(b.elecKwh)}</span>} />
          {b.estSpendUsd != null && (
            <Row
              label="Est. annual spend"
              value={
                <span>
                  ${fmtInt(b.estSpendUsd)}{" "}
                  <span className="text-xs text-muted">@ ${fmtFixed(b.estRate, 3)}/kWh</span>
                </span>
              }
            />
          )}
          <Row label="Electric intensity" value={b.kwhPerSqft != null ? `${fmtFixed(b.kwhPerSqft, 1)} kWh/ft²` : "—"} />
          <Row label="Peak demand" value={b.peakKw != null ? `${fmtInt(b.peakKw)} kW` : "—"} />
          <Row label="Natural gas" value={b.gasKbtu != null ? `${fmtInt(b.gasKbtu / 100)} therms` : "—"} />
          <Row label="Site EUI" value={b.siteEui != null ? `${fmtFixed(b.siteEui, 1)} kBtu/ft²` : "—"} />
          <Row label="ENERGY STAR score" value={fmtInt(b.energyStar)} />
        </section>

        {/* Screening estimates */}
        {b.elecKwh != null && (
          <section className="rounded-md border border-border p-3">
            <h4 className="mb-2 text-xs uppercase tracking-wide text-muted">
              Screening estimates
            </h4>
            <div className="flex items-center gap-2.5 py-1 text-sm">
              <IconSun size={16} className="shrink-0 text-primary" />
              <span>
                ~<span className="font-heading">{fmtInt(pvKw)} kW</span> PV for full annual
                offset
              </span>
            </div>
            {b.peakKw != null && (
              <div className="flex items-center gap-2.5 py-1 text-sm">
                <IconBattery size={16} className="shrink-0 text-primary" />
                <span>
                  ~<span className="font-heading">{fmtInt(b.peakKw * 0.3)}–{fmtInt(b.peakKw * 0.5)} kW</span>{" "}
                  BESS for peak shaving
                </span>
              </div>
            )}
            {b.estCo2Tons != null && (
              <div className="flex items-center gap-2.5 py-1 text-sm">
                <IconGlobe size={16} className="shrink-0 text-primary" />
                <span>
                  ~<span className="font-heading">{fmtInt(b.estCo2Tons)} t CO₂e/yr</span> grid
                  emissions at stake
                </span>
              </div>
            )}
            <p className="mt-2 text-[11px] leading-snug text-muted">
              PV at {fmtInt(pvYield)} kWh/kWp·yr ({b.pvYield != null ? "PVWatts, local" : "national avg"});
              battery at 30–50% of annual peak; CO₂ from the {b.state ?? "state"} grid mix (eGRID).
              Rough screening only.
            </p>
          </section>
        )}

        {/* REopt */}
        {b.elecKwh != null &&
          (preview ? (
            <section className="rounded-md border border-border p-3">
              <h4 className="mb-2 text-xs uppercase tracking-wide text-muted">
                REopt techno-economic screening
              </h4>
              <p className="mb-2 text-xs leading-snug text-muted">
                Run NLR&apos;s REopt optimizer on any building: optimal PV + battery size,
                NPV, and payback. Free with an account.
              </p>
              <a
                href="/signup?next=/explore"
                className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-background hover:bg-accent hover:text-foreground transition-colors"
              >
                Sign up free to run REopt
              </a>
            </section>
          ) : (
            <ReoptSection building={b} />
          ))}

        {/* Property */}
        <section>
          <h4 className="mb-1 text-xs uppercase tracking-wide text-muted">Property</h4>
          <Row label="Sector" value={b.sector} />
          <Row label="Reported type" value={b.propertyType ?? "—"} />
          <Row label="Floor area" value={b.floorArea != null ? `${fmtInt(b.floorArea)} ft²` : "—"} />
          <Row label="Year built" value={b.yearBuilt ?? "—"} />
          {b.owner && <Row label="Owner of record" value={b.owner} />}
          <Row label="Years reported" value={b.yearsReported ?? "—"} />
        </section>

        {/* Links */}
        <section className="flex flex-col gap-2">
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${mapsQuery}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-primary hover:text-accent transition-colors"
          >
            <IconMapPin size={15} />
            Open in Google Maps (satellite roof check)
          </a>
          {sourceUrl && (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-primary hover:text-accent transition-colors"
            >
              <IconExternalLink size={15} />
              Source: {b.program} benchmarking disclosure
            </a>
          )}
          {reference && (
            <p className="text-[11px] text-muted">
              Rates: EIA · CO₂: eGRID · Yield: PVWatts (ref. {reference.generated})
            </p>
          )}
        </section>
      </div>
    </aside>
  );
}
