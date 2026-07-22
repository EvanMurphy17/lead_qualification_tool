"use client";

import { useState } from "react";
import { DEFAULT_FILTERS, type Dataset, type Filters } from "@/lib/data";
import { Input, Label, Select } from "@/components/ui";
import { IconChevronDown, IconChevronUp, IconSearch, IconSliders, IconX } from "@/components/icons";

const KWH_OPTIONS = [
  { v: 0, label: "Any" },
  { v: 100_000, label: "≥ 100k kWh" },
  { v: 250_000, label: "≥ 250k kWh" },
  { v: 500_000, label: "≥ 500k kWh" },
  { v: 1_000_000, label: "≥ 1M kWh" },
  { v: 2_000_000, label: "≥ 2M kWh" },
  { v: 5_000_000, label: "≥ 5M kWh" },
  { v: 10_000_000, label: "≥ 10M kWh" },
];

const SQFT_OPTIONS = [
  { v: 0, label: "Any" },
  { v: 25_000, label: "≥ 25k ft²" },
  { v: 50_000, label: "≥ 50k ft²" },
  { v: 100_000, label: "≥ 100k ft²" },
  { v: 250_000, label: "≥ 250k ft²" },
  { v: 500_000, label: "≥ 500k ft²" },
];

const PEAK_OPTIONS = [
  { v: 0, label: "Any" },
  { v: 100, label: "≥ 100 kW" },
  { v: 250, label: "≥ 250 kW" },
  { v: 500, label: "≥ 500 kW" },
  { v: 1000, label: "≥ 1 MW" },
];

function CheckList({
  options,
  selected,
  onChange,
  initialShown = 8,
}: {
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  initialShown?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? options : options.slice(0, initialShown);
  return (
    <div className="flex flex-col gap-1">
      {shown.map((opt) => {
        const checked = selected.includes(opt);
        return (
          <label
            key={opt}
            className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-sm hover:bg-foreground/5"
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={() =>
                onChange(checked ? selected.filter((s) => s !== opt) : [...selected, opt])
              }
              className="h-3.5 w-3.5 accent-[#0B1E3F] cursor-pointer"
            />
            <span className={checked ? "text-foreground" : "text-muted"}>{opt}</span>
          </label>
        );
      })}
      {options.length > initialShown && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-1 flex items-center gap-1 text-xs text-primary hover:text-accent cursor-pointer"
        >
          {expanded ? <IconChevronUp size={13} /> : <IconChevronDown size={13} />}
          {expanded ? "Show less" : `Show all ${options.length}`}
        </button>
      )}
    </div>
  );
}

export function FilterSidebar({
  dataset,
  filters,
  onChange,
  resultCount,
}: {
  dataset: Dataset;
  filters: Filters;
  onChange: (f: Filters) => void;
  resultCount: number;
}) {
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });
  const isDirty = JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS);

  return (
    <aside className="flex w-72 shrink-0 flex-col overflow-y-auto border-r border-border">
      <div className="flex items-center justify-between px-4 pt-4">
        <span className="flex items-center gap-2 font-heading text-sm font-medium">
          <IconSliders size={16} className="text-primary" />
          Filters
        </span>
        {isDirty && (
          <button
            onClick={() => onChange(DEFAULT_FILTERS)}
            className="flex items-center gap-1 text-xs text-muted hover:text-foreground cursor-pointer"
          >
            <IconX size={12} />
            Reset
          </button>
        )}
      </div>

      <div className="flex flex-col gap-5 p-4">
        {/* Search */}
        <div className="relative">
          <IconSearch size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <Input
            value={filters.search}
            onChange={(e) => set({ search: e.target.value })}
            placeholder="Name, owner, address, zip…"
            className="pl-9"
          />
        </div>

        {/* Thresholds */}
        <div className="flex flex-col gap-1.5">
          <Label>Min. annual electricity</Label>
          <Select value={filters.minKwh} onChange={(e) => set({ minKwh: Number(e.target.value) })}>
            {KWH_OPTIONS.map((o) => (
              <option key={o.v} value={o.v}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Min. floor area</Label>
          <Select value={filters.minSqft} onChange={(e) => set({ minSqft: Number(e.target.value) })}>
            {SQFT_OPTIONS.map((o) => (
              <option key={o.v} value={o.v}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Min. peak demand (NYC only)</Label>
          <Select
            value={filters.minPeakKw}
            onChange={(e) => set({ minPeakKw: Number(e.target.value) })}
          >
            {PEAK_OPTIONS.map((o) => (
              <option key={o.v} value={o.v}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>

        {/* Toggles */}
        <div className="flex flex-col gap-1">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-muted hover:text-foreground">
            <input
              type="checkbox"
              checked={filters.withUsageOnly}
              onChange={(e) => set({ withUsageOnly: e.target.checked })}
              className="h-3.5 w-3.5 accent-[#0B1E3F] cursor-pointer"
            />
            Has reported electricity use
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-muted hover:text-foreground">
            <input
              type="checkbox"
              checked={filters.mappedOnly}
              onChange={(e) => set({ mappedOnly: e.target.checked })}
              className="h-3.5 w-3.5 accent-[#0B1E3F] cursor-pointer"
            />
            Has map coordinates
          </label>
        </div>

        {/* Sector */}
        <div className="flex flex-col gap-2">
          <Label>Sector</Label>
          <CheckList
            options={dataset.sectors}
            selected={filters.sectors}
            onChange={(sectors) => set({ sectors })}
          />
        </div>

        {/* State */}
        <div className="flex flex-col gap-2">
          <Label>State</Label>
          <CheckList
            options={dataset.states}
            selected={filters.states}
            onChange={(states) => set({ states })}
          />
        </div>

        {/* Program */}
        <div className="flex flex-col gap-2">
          <Label>Program</Label>
          <CheckList
            options={dataset.programs}
            selected={filters.programs}
            onChange={(programs) => set({ programs })}
          />
        </div>
      </div>

      <div className="mt-auto border-t border-border px-4 py-3 text-xs text-muted">
        {resultCount.toLocaleString()} of {dataset.buildings.length.toLocaleString()} buildings ·
        data {dataset.generated}
      </div>
    </aside>
  );
}
