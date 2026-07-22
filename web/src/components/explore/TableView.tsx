"use client";

import { useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { Building } from "@/lib/data";
import { fmtCompact, fmtFixed, fmtInt } from "@/lib/format";
import { IconArrowDown, IconArrowUp } from "@/components/icons";
import { clsx } from "clsx";

type SortKey =
  | "name" | "city" | "state" | "sector" | "floorArea" | "elecKwh"
  | "estSpendUsd" | "kwhPerSqft" | "peakKw" | "energyStar" | "dataYear";

interface Col {
  key: SortKey;
  label: string;
  width: string;
  align?: "right";
  render: (b: Building) => React.ReactNode;
}

const COLS: Col[] = [
  {
    key: "name",
    label: "Building",
    width: "minmax(220px, 2fr)",
    render: (b) => (
      <div className="min-w-0">
        <p className="truncate text-foreground">{b.name ?? b.address ?? "—"}</p>
        <p className="truncate text-xs text-muted">
          {b.name ? b.address ?? "" : ""}
          {b.owner ? `${b.name && b.address ? " · " : ""}${b.owner}` : ""}
        </p>
      </div>
    ),
  },
  { key: "city", label: "City", width: "minmax(110px, 1fr)", render: (b) => <span className="truncate text-muted">{b.city ?? "—"}</span> },
  { key: "state", label: "St", width: "44px", render: (b) => <span className="text-muted">{b.state ?? "—"}</span> },
  { key: "sector", label: "Sector", width: "minmax(130px, 1fr)", render: (b) => <span className="truncate text-muted">{b.sector}</span> },
  { key: "floorArea", label: "Floor ft²", width: "90px", align: "right", render: (b) => <span className="font-heading text-sm">{fmtCompact(b.floorArea, 0)}</span> },
  { key: "elecKwh", label: "kWh/yr", width: "95px", align: "right", render: (b) => <span className="font-heading text-sm font-medium text-primary">{fmtCompact(b.elecKwh)}</span> },
  { key: "estSpendUsd", label: "Est $/yr", width: "85px", align: "right", render: (b) => <span className="font-heading text-sm">{b.estSpendUsd != null ? `$${fmtCompact(b.estSpendUsd)}` : "—"}</span> },
  { key: "kwhPerSqft", label: "kWh/ft²", width: "80px", align: "right", render: (b) => <span className="font-heading text-sm">{fmtFixed(b.kwhPerSqft, 1)}</span> },
  { key: "peakKw", label: "Peak kW", width: "85px", align: "right", render: (b) => <span className="font-heading text-sm">{fmtInt(b.peakKw)}</span> },
  { key: "energyStar", label: "ES", width: "50px", align: "right", render: (b) => <span className="font-heading text-sm">{fmtInt(b.energyStar)}</span> },
  { key: "dataYear", label: "Year", width: "60px", align: "right", render: (b) => <span className="font-heading text-sm text-muted">{b.dataYear ?? "—"}</span> },
];

const GRID = COLS.map((c) => c.width).join(" ");

export function TableView({
  rows,
  selected,
  onSelect,
}: {
  rows: Building[];
  selected: Building | null;
  onSelect: (b: Building | null) => void;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("elecKwh");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    const key = sortKey;
    return [...rows].sort((a, b) => {
      const av = a[key];
      const bv = b[key];
      if (av == null && bv == null) return 0;
      if (av == null) return 1; // nulls last in either direction
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }, [rows, sortKey, sortDir]);

  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: sorted.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48,
    overscan: 12,
  });

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir(key === "name" || key === "city" || key === "state" || key === "sector" ? "asc" : "desc");
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div
        className="grid shrink-0 border-b border-border bg-background px-4 text-xs font-medium uppercase tracking-wide text-muted"
        style={{ gridTemplateColumns: GRID }}
      >
        {COLS.map((c) => (
          <button
            key={c.key}
            onClick={() => toggleSort(c.key)}
            className={clsx(
              "flex items-center gap-1 py-2.5 pr-3 hover:text-foreground transition-colors cursor-pointer",
              c.align === "right" && "justify-end"
            )}
          >
            {c.label}
            {sortKey === c.key &&
              (sortDir === "asc" ? <IconArrowUp size={12} /> : <IconArrowDown size={12} />)}
          </button>
        ))}
      </div>

      {/* Virtualized body */}
      <div ref={parentRef} className="min-h-0 flex-1 overflow-auto">
        <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
          {virtualizer.getVirtualItems().map((vi) => {
            const b = sorted[vi.index];
            const isSel = selected?.id === b.id;
            return (
              <div
                key={b.id}
                onClick={() => onSelect(isSel ? null : b)}
                className={clsx(
                  "grid cursor-pointer items-center border-b border-border/50 px-4 text-sm transition-colors",
                  isSel ? "bg-primary/10 border-l-2 border-l-primary" : "hover:bg-foreground/5"
                )}
                style={{
                  gridTemplateColumns: GRID,
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: vi.size,
                  transform: `translateY(${vi.start}px)`,
                }}
              >
                {COLS.map((c) => (
                  <div
                    key={c.key}
                    className={clsx("min-w-0 pr-3", c.align === "right" && "text-right")}
                  >
                    {c.render(b)}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
        {sorted.length === 0 && (
          <p className="p-8 text-center text-sm text-muted">No buildings match these filters.</p>
        )}
      </div>
    </div>
  );
}
