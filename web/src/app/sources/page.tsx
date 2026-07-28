import Link from "next/link";
import statsJson from "../../../public/data/stats.json";
import { Logo } from "@/components/Logo";
import { IconExternalLink } from "@/components/icons";

export const metadata = { title: "Data sources & methodology" };

interface Stats {
  generated: string;
  buildings: number;
  programs: { program: string; buildings: number; latest_year: number | null; source: string }[];
}

// Baked in at build time (Workers have no runtime filesystem).
function loadStats(): Stats | null {
  return statsJson as unknown as Stats;
}

export default function SourcesPage() {
  const stats = loadStats();
  return (
    <main className="flex flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between px-6 py-4">
          <Logo />
          <Link href="/" className="text-sm text-muted hover:text-foreground transition-colors">
            ← Back
          </Link>
        </div>
      </header>

      <div className="mx-auto w-full max-w-4xl px-6 py-12">
        <h1 className="text-3xl">Data sources &amp; methodology</h1>
        <p className="mt-4 max-w-2xl text-muted leading-relaxed">
          Every record comes from a public building energy benchmarking disclosure: datasets
          that cities and states publish under their benchmarking and building performance
          ordinances. We merge them into one canonical schema, normalize units (electricity to
          kWh, gas to kBtu), and keep each building&apos;s most recent reported year.
        </p>

        <h2 className="mt-10 text-xl">Sources</h2>
        <div className="mt-4 overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="px-4 py-3 font-medium">Program</th>
                <th className="px-4 py-3 font-medium text-right">Buildings</th>
                <th className="px-4 py-3 font-medium text-right">Latest year</th>
                <th className="px-4 py-3 font-medium">Source</th>
              </tr>
            </thead>
            <tbody>
              {(stats?.programs ?? [])
                .sort((a, b) => b.buildings - a.buildings)
                .map((p) => (
                  <tr key={p.program} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">{p.program}</td>
                    <td className="px-4 py-3 text-right font-heading">
                      {p.buildings.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right font-heading">{p.latest_year ?? "—"}</td>
                    <td className="px-4 py-3">
                      <a
                        href={p.source}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-primary hover:text-accent transition-colors"
                      >
                        Open portal <IconExternalLink size={13} />
                      </a>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <h2 className="mt-10 text-xl">Methodology notes</h2>
        <ul className="mt-4 flex max-w-2xl list-disc flex-col gap-2 pl-5 text-sm text-muted leading-relaxed">
          <li>
            Electricity is grid-purchase where the source distinguishes it; values reported in
            kBtu are converted at 3,412 Btu/kWh. Gas reported in therms is converted at 100
            kBtu/therm.
          </li>
          <li>
            Buildings reporting in multiple years are deduplicated to the most recent year with
            reported usage; the years-reported count is retained.
          </li>
          <li>
            Sectors are a normalized rollup of each program&apos;s reported property type
            (ENERGY STAR Portfolio Manager categories).
          </li>
          <li>
            Coordinates come from the source datasets where published. Boston, Denver, and
            Montgomery County publish no coordinates, so their addresses are geocoded with
            the U.S. Census Bureau batch geocoder; unmatched addresses appear in the
            database view but not on the map.
          </li>
          <li>
            Estimates: annual spend uses EIA average state retail rates by sector (EPM Table
            5.6.A); CO₂ uses EPA eGRID state output emission rates; PV sizing uses PVWatts v8
            local yield where computed, else state means. REopt runs use DOE reference load
            shapes scaled to reported kWh with a blended tariff, directional only.
          </li>
          <li>
            Physically implausible reported values (unit errors in self-reported disclosures)
            are excluded: electricity above 2 GWh/yr with intensity over 2,000 kWh/ft² is
            treated as unreported.
          </li>
          <li>
            Data is provided as-is for screening; verify with the building owner and utility
            before relying on it. Disclosure programs have reporting errors, and some values
            are self-reported or estimated.
          </li>
        </ul>

        <p className="mt-10 text-sm text-muted">
          Data last rebuilt: <span className="font-heading">{stats?.generated ?? "—"}</span>
        </p>
      </div>
    </main>
  );
}
