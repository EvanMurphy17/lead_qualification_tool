"use client";

import { useEffect, useMemo, useState } from "react";
import {
  applyFilters,
  DEFAULT_FILTERS,
  enrich,
  loadDataset,
  loadReference,
  toCsv,
  type Building,
  type Dataset,
  type Filters,
  type Reference,
} from "@/lib/data";
import Link from "next/link";
import { fmtInt } from "@/lib/format";
import { IconArrowRight, IconDatabase, IconDownload, IconLoader, IconLock, IconMap } from "@/components/icons";
import { FilterSidebar } from "./FilterSidebar";
import { MapView } from "./MapView";
import { TableView } from "./TableView";
import { DetailPanel } from "./DetailPanel";

type View = "map" | "table";

export function ExploreApp({ preview }: { preview: boolean }) {
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [reference, setReference] = useState<Reference | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [view, setView] = useState<View>("map");
  const [selected, setSelected] = useState<Building | null>(null);

  useEffect(() => {
    const url = preview ? "/data/buildings-preview.json.gz" : "/api/data/buildings";
    Promise.all([loadDataset(url), loadReference()])
      .then(([ds, ref]) => {
        enrich(ds.buildings, ref);
        setReference(ref);
        setDataset(ds);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [preview]);

  const filtered = useMemo(
    () => (dataset ? applyFilters(dataset.buildings, filters) : []),
    [dataset, filters]
  );

  function exportCsv() {
    const csv = toCsv(filtered);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `loadstone-export-${filtered.length}-buildings.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <p className="max-w-md text-center text-muted">
          Failed to load the dataset: {error}. Make sure{" "}
          <code className="text-primary">public/data/buildings.json.gz</code> exists (run{" "}
          <code className="text-primary">python scripts/build_web_dataset.py</code>).
        </p>
      </div>
    );
  }

  if (!dataset) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-muted">
        <IconLoader size={28} className="animate-spin text-primary" />
        <p className="text-sm">Loading the building database (~5 MB)…</p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {preview && (
        <div className="flex shrink-0 flex-wrap items-center justify-center gap-x-2 gap-y-1 border-b border-border bg-primary px-4 py-2 text-center text-sm text-background">
          <span>
            Free preview: the{" "}
            <span className="font-heading font-semibold">{fmtInt(dataset.buildings.length)}</span>{" "}
            biggest energy users of{" "}
            <span className="font-heading font-semibold">{fmtInt(dataset.fullCount)}</span>{" "}
            buildings. Looking for yours?
          </span>
          <Link
            href="/signup?next=/explore"
            className="inline-flex items-center gap-1 font-semibold underline underline-offset-2 hover:text-accent transition-colors"
          >
            Create a free account for the full database
            <IconArrowRight size={14} />
          </Link>
        </div>
      )}
      <div className="flex min-h-0 flex-1">
      <FilterSidebar dataset={dataset} filters={filters} onChange={setFilters} resultCount={filtered.length} />

      <div className="relative flex min-w-0 flex-1 flex-col">
        {/* Toolbar */}
        <div className="flex h-12 shrink-0 items-center justify-between gap-4 border-b border-border px-4">
          <div className="flex items-center gap-1 rounded-md border border-border p-0.5">
            <button
              onClick={() => setView("map")}
              className={`flex items-center gap-1.5 rounded px-3 py-1 text-sm transition-colors cursor-pointer ${
                view === "map" ? "bg-primary font-medium text-background" : "text-muted hover:text-foreground"
              }`}
            >
              <IconMap size={15} />
              Map
            </button>
            <button
              onClick={() => setView("table")}
              className={`flex items-center gap-1.5 rounded px-3 py-1 text-sm transition-colors cursor-pointer ${
                view === "table" ? "bg-primary font-medium text-background" : "text-muted hover:text-foreground"
              }`}
            >
              <IconDatabase size={15} />
              Database
            </button>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm text-muted">
              <span className="font-heading text-foreground">{fmtInt(filtered.length)}</span>{" "}
              buildings match
            </span>
            {preview ? (
              <Link
                href="/signup?next=/explore"
                className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-muted hover:border-primary hover:text-primary transition-colors"
                title="CSV export is free with an account"
              >
                <IconLock size={14} />
                Export CSV (sign up)
              </Link>
            ) : (
              <button
                onClick={exportCsv}
                disabled={filtered.length === 0}
                className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:border-accent hover:text-accent transition-colors disabled:opacity-40 cursor-pointer"
              >
                <IconDownload size={15} />
                Export CSV
              </button>
            )}
          </div>
        </div>

        {/* Main view */}
        <div className="relative min-h-0 flex-1">
          {view === "map" ? (
            <MapView rows={filtered} selected={selected} onSelect={setSelected} />
          ) : (
            <TableView rows={filtered} selected={selected} onSelect={setSelected} />
          )}

          {selected && (
            <DetailPanel
              building={selected}
              sourceUrl={dataset.sources[selected.program]}
              reference={reference}
              preview={preview}
              onClose={() => setSelected(null)}
            />
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
