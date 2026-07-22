import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import { APP_NAME, COMPANY, TAGLINE } from "@/lib/brand";
import { getSession } from "@/lib/auth";
import { Logo } from "@/components/Logo";
import { Card } from "@/components/ui";
import {
  IconArrowRight,
  IconDatabase,
  IconDownload,
  IconFilter,
  IconMap,
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

function loadStats(): Stats | null {
  try {
    const p = path.join(process.cwd(), "public", "data", "stats.json");
    return JSON.parse(fs.readFileSync(p, "utf-8"));
  } catch {
    return null;
  }
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
          {stats ? `${stats.buildings.toLocaleString()} buildings · updated ${stats.generated}` : ""}
        </p>
        <h1 className="max-w-3xl text-4xl md:text-6xl leading-tight">
          {TAGLINE}.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-muted">
          {APP_NAME}{" "}turns public building energy benchmarking disclosures into a lead
          qualification tool for C&amp;I solar and storage developers. Filter by state, sector,
          size, and annual electricity usage — on a map or in a database — and export your
          target list.
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
            No signup needed for the preview — full database, CSV export, and REopt runs are
            free with an account.
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

      {/* How it works */}
      <section className="mx-auto w-full max-w-6xl px-6 py-16">
        <h2 className="text-2xl md:text-3xl">Built for prospecting, not compliance</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <Card>
            <IconFilter className="text-primary" size={24} />
            <h3 className="mt-4 text-lg">Qualify</h3>
            <p className="mt-2 text-sm text-muted leading-relaxed">
              Screen by annual kWh, floor area, sector, and peak demand. A 2 GWh/yr warehouse
              with a flat roof is a different conversation than a 200 MWh office floor.
            </p>
          </Card>
          <Card>
            <IconMap className="text-primary" size={24} />
            <h3 className="mt-4 text-lg">Map</h3>
            <p className="mt-2 text-sm text-muted leading-relaxed">
              See every qualifying building on a map, colored by annual electricity usage.
              Cluster your outreach by neighborhood, feeder, or utility territory.
            </p>
          </Card>
          <Card>
            <IconDownload className="text-primary" size={24} />
            <h3 className="mt-4 text-lg">Export</h3>
            <p className="mt-2 text-sm text-muted leading-relaxed">
              Download any filtered list as CSV — addresses, owners where disclosed, usage,
              and intensity — ready for your CRM or site-screening workflow.
            </p>
          </Card>
        </div>
      </section>

      {/* Coverage */}
      <section className="border-t border-border">
        <div className="mx-auto w-full max-w-6xl px-6 py-16">
          <div className="flex items-center gap-3">
            <IconDatabase className="text-primary" size={22} />
            <h2 className="text-2xl md:text-3xl">Coverage</h2>
          </div>
          <p className="mt-3 max-w-2xl text-muted">
            Every record comes from a public benchmarking disclosure — buildings that are
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
        <div className="mx-auto flex w-full max-w-6xl flex-col items-start gap-6 px-6 py-16">
          <h2 className="text-2xl md:text-3xl max-w-2xl">
            Free to use. Sign up and start building your pipeline.
          </h2>
          <Link
            href={session ? "/explore" : "/signup"}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 font-semibold text-background hover:bg-accent hover:text-foreground transition-colors"
          >
            {session ? "Open the explorer" : "Get free access"}
            <IconArrowRight size={18} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-6 py-8 text-sm text-muted md:flex-row md:items-center md:justify-between">
          <span>
            {APP_NAME} — built by {COMPANY}
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
