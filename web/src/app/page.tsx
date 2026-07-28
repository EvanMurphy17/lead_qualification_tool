import Link from "next/link";
import statsJson from "../../public/data/stats.json";
import { APP_NAME, COMPANY, TAGLINE } from "@/lib/brand";
import { getSession } from "@/lib/auth";
import { Logo } from "@/components/Logo";
import { Card } from "@/components/ui";
import {
  IconArrowRight,
  IconDatabase,
  IconFilter,
  IconLayers,
  IconSun,
} from "@/components/icons";

interface Stats {
  generated: string;
  buildings: number;
  with_coords: number;
  total_annual_kwh: number;
  total_sqft: number;
  programs: { program: string; buildings: number; latest_year: number | null; source: string }[];
  states: Record<string, number>;
}

// Baked in at build time (Workers have no runtime filesystem). Rebuild after
// refreshing the data pipeline.
function loadStats(): Stats | null {
  return statsJson as unknown as Stats;
}

function StatTile({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col gap-1 border-l-2 border-primary pl-4">
      <span className="font-heading text-3xl md:text-4xl font-semibold">{value}</span>
      <span className="text-sm text-muted">{label}</span>
    </div>
  );
}

export default async function Home() {
  const stats = loadStats();
  const session = await getSession();
  const twh = stats ? (stats.total_annual_kwh / 1e9).toFixed(0) : "—";
  const sqftB = stats ? (stats.total_sqft / 1e9).toFixed(1) : "—";
  const nStates = stats ? Object.keys(stats.states).length : 0;
  const nBuildings = stats ? stats.buildings.toLocaleString() : "";

  return (
    <main className="flex flex-col">
      {/* Nav */}
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <Logo />
          <nav className="flex items-center gap-6 text-sm">
            <Link href="/sources" className="text-muted hover:text-foreground transition-colors">
              Data sources
            </Link>
            {session ? (
              <Link
                href="/explore"
                className="rounded-md bg-primary px-4 py-2 font-semibold text-background hover:bg-accent hover:text-foreground transition-colors"
              >
                Open the explorer
              </Link>
            ) : (
              <>
                <Link href="/login" className="text-muted hover:text-foreground transition-colors">
                  Sign in
                </Link>
                <Link
                  href="/signup"
                  className="rounded-md bg-primary px-4 py-2 font-semibold text-background hover:bg-accent hover:text-foreground transition-colors"
                >
                  Get free access
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto w-full max-w-6xl px-6 pt-20 pb-16">
        <p className="mb-4 font-heading text-sm text-muted">
          {stats ? `${nBuildings} buildings · updated ${stats.generated}` : ""}
        </p>
        <h1 className="max-w-3xl text-4xl md:text-6xl leading-tight">
          {TAGLINE}.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-muted">
          Fifteen disclosure programs, one searchable map. Filter {nBuildings} commercial
          buildings by usage, size, and sector. Open any building for cost and system
          estimates, REopt economics, and a downloadable 8760 load profile scaled to its
          reported use.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Link
            href="/explore"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 font-semibold text-background hover:bg-accent hover:text-foreground transition-colors"
          >
            {session ? "Open the explorer" : "Try the live preview"}
            <IconArrowRight size={18} />
          </Link>
          {!session && (
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-md border border-border px-6 py-3 text-foreground hover:border-primary hover:text-primary transition-colors"
            >
              Create free account
            </Link>
          )}
        </div>
        {!session && (
          <p className="mt-3 text-sm text-muted">
            The preview needs no signup. A free account unlocks the full database, CSV
            export, and REopt runs.
          </p>
        )}
      </section>

      {/* Stats */}
      <section className="border-y border-border">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-8 px-6 py-12 md:grid-cols-4">
          <StatTile value={stats ? stats.buildings.toLocaleString() : "—"} label="unique buildings, latest reported year" />
          <StatTile value={`${twh} TWh`} label="disclosed annual electricity use" />
          <StatTile value={`${sqftB}B ft²`} label="of commercial floor area" />
          <StatTile value={`${stats?.programs.length ?? 0} programs · ${nStates} states`} label="public benchmarking disclosures" />
        </div>
      </section>

      {/* Capabilities */}
      <section className="mx-auto w-full max-w-6xl px-6 py-16">
        <h2 className="text-2xl md:text-3xl">What it does</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <Card>
            <IconFilter className="text-primary" size={24} />
            <h3 className="mt-4 text-lg">Explore</h3>
            <p className="mt-2 text-sm text-muted leading-relaxed">
              Map and database views over every building, filterable by annual kWh,
              sector, floor area, and estimated spend. Export any filtered list to CSV.
            </p>
          </Card>
          <Card>
            <IconSun className="text-primary" size={24} />
            <h3 className="mt-4 text-lg">Look closer</h3>
            <p className="mt-2 text-sm text-muted leading-relaxed">
              Open any building for its reported usage, estimated annual cost, grid
              emissions, and a PV estimate sized with local solar yields.
            </p>
          </Card>
          <Card>
            <IconLayers className="text-primary" size={24} />
            <h3 className="mt-4 text-lg">Run the numbers</h3>
            <p className="mt-2 text-sm text-muted leading-relaxed">
              One click sends a building through NREL&apos;s REopt optimizer for system
              size, NPV, and payback. Download an 8760 hourly load profile scaled to its
              reported use for your own modeling.
            </p>
          </Card>
        </div>
        <p className="mt-6 max-w-2xl text-sm text-muted">
          Scout a market, sanity-check a lead before the first call, or look up a building
          you already know.
        </p>
      </section>

      {/* Coverage */}
      <section className="border-t border-border">
        <div className="mx-auto w-full max-w-6xl px-6 py-16">
          <div className="flex items-center gap-3">
            <IconDatabase className="text-primary" size={22} />
            <h2 className="text-2xl md:text-3xl">Coverage</h2>
          </div>
          <p className="mt-3 max-w-2xl text-muted">
            Every record comes from a public benchmarking disclosure. These are buildings
            already required to report their energy use.
          </p>
          <div className="mt-8 overflow-x-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted">
                  <th className="px-4 py-3 font-medium">Program</th>
                  <th className="px-4 py-3 font-medium text-right">Buildings</th>
                  <th className="px-4 py-3 font-medium text-right">Latest data year</th>
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
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-start gap-4 px-6 py-16">
          <h2 className="text-2xl md:text-3xl max-w-2xl">Have a building in mind?</h2>
          <p className="max-w-2xl text-muted">
            {APP_NAME} is free, from the team at {COMPANY}. The preview is open right now;
            an account gets you the full database.
          </p>
          <Link
            href="/explore"
            className="mt-2 inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 font-semibold text-background hover:bg-accent hover:text-foreground transition-colors"
          >
            {session ? "Open the explorer" : "Try the live preview"}
            <IconArrowRight size={18} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-6 py-8 text-sm text-muted md:flex-row md:items-center md:justify-between">
          <span>
            {APP_NAME}, built by {COMPANY}
          </span>
          <span>
            Public data, provided as-is for screening purposes.{" "}
            <Link href="/sources" className="text-primary hover:text-accent">
              Sources &amp; methodology
            </Link>
          </span>
        </div>
      </footer>
    </main>
  );
}
