"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  Map as MLMap,
  NavigationControl,
  Popup,
  setWorkerUrl,
  type ExpressionSpecification,
  type GeoJSONSource,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

// MapLibre resolves its worker from import.meta.url, which points into
// /_next/static under Turbopack where the file doesn't exist. Serve the
// worker (+ its shared chunk) from /public instead — kept in sync by the
// postinstall script (scripts/copy-maplibre-worker.mjs).
setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
import type { Building } from "@/lib/data";
import { fmtKwh } from "@/lib/format";
import { COLORS, KWH_CLASS_LABELS, KWH_RAMP, NO_DATA_COLOR, kwhClass, kwhColor } from "@/lib/brand";
import { IconMapPin } from "@/components/icons";

const BASEMAP = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";
const US_CENTER: [number, number] = [-96.5, 38.5];

type FC = GeoJSON.FeatureCollection<GeoJSON.Point>;

function toGeoJSON(rows: Building[]): FC {
  const feats: GeoJSON.Feature<GeoJSON.Point>[] = [];
  for (const b of rows) {
    if (b.lat == null || b.lon == null) continue;
    feats.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [b.lon, b.lat] },
      properties: {
        id: b.id,
        label: b.name ?? b.address ?? "Building",
        kwh: b.elecKwh,
        cls: kwhClass(b.elecKwh),
        color: kwhColor(b.elecKwh),
      },
    });
  }
  // Draw high-usage buildings on top
  feats.sort((a, b) => (a.properties!.cls as number) - (b.properties!.cls as number));
  return { type: "FeatureCollection", features: feats };
}

export function MapView({
  rows,
  selected,
  onSelect,
}: {
  rows: Building[];
  selected: Building | null;
  onSelect: (b: Building | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const loadedRef = useRef(false);
  const popupRef = useRef<Popup | null>(null);
  const rowsRef = useRef<Building[]>(rows);
  rowsRef.current = rows;

  const geojson = useMemo(() => toGeoJSON(rows), [rows]);
  const geojsonRef = useRef<FC>(geojson);
  geojsonRef.current = geojson;

  // Init once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new MLMap({
      container: containerRef.current,
      style: BASEMAP,
      center: US_CENTER,
      zoom: 3.6,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    map.on("error", (e) => console.error("[map]", e.error?.message ?? e));
    map.addControl(new NavigationControl({ showCompass: false }), "top-right");
    // Debug handle (useful for support/diagnostics)
    (window as unknown as Record<string, unknown>).__loadstone_map = map;

    map.on("load", () => {
      map.addSource("buildings", { type: "geojson", data: geojsonRef.current });

      const clsExpr: ExpressionSpecification = ["max", ["get", "cls"], 0];
      map.addLayer({
        id: "buildings-circles",
        type: "circle",
        source: "buildings",
        paint: {
          "circle-color": ["get", "color"],
          "circle-opacity": 0.85,
          "circle-radius": [
            "interpolate", ["linear"], ["zoom"],
            3, ["+", 1.3, ["*", 0.5, clsExpr]],
            9, ["+", 2.5, ["*", 1.7, clsExpr]],
            13, ["+", 4, ["*", 3, clsExpr]],
          ],
          // 1px surface ring once circles are big enough to overlap
          "circle-stroke-color": COLORS.background,
          "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 7, 0, 9, 1],
        },
      });

      map.addLayer({
        id: "buildings-selected",
        type: "circle",
        source: "buildings",
        filter: ["==", ["get", "id"], -1],
        paint: {
          "circle-color": "rgba(0,0,0,0)",
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 6, 9, 10, 13, 16],
          "circle-stroke-color": COLORS.foreground,
          "circle-stroke-width": 2,
        },
      });

      loadedRef.current = true;

      const popup = new Popup({
        closeButton: false,
        closeOnClick: false,
        offset: 10,
        maxWidth: "260px",
      });
      popupRef.current = popup;

      map.on("mousemove", "buildings-circles", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        map.getCanvas().style.cursor = "pointer";
        const p = f.properties as { label: string; kwh: number | null };
        popup
          .setLngLat(e.lngLat)
          .setHTML(
            `<div style="font-size:12px;line-height:1.4"><strong>${String(p.label)
              .replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")}</strong><br/><span style="color:#404244">${
              p.kwh != null ? fmtKwh(Number(p.kwh)) + " / yr" : "no reported usage"
            }</span></div>`
          )
          .addTo(map);
      });
      map.on("mouseleave", "buildings-circles", () => {
        map.getCanvas().style.cursor = "";
        popup.remove();
      });
      map.on("click", "buildings-circles", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const id = Number((f.properties as { id: number }).id);
        const b = rowsRef.current.find((r) => r.id === id);
        if (b) onSelect(b);
      });
    });

    return () => {
      map.remove();
      mapRef.current = null;
      loadedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update data when filters change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    const src = map.getSource("buildings") as GeoJSONSource | undefined;
    src?.setData(geojson);
  }, [geojson]);

  // Highlight selection
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    map.setFilter("buildings-selected", ["==", ["get", "id"], selected?.id ?? -1]);
  }, [selected]);

  function fitToResults() {
    const map = mapRef.current;
    if (!map) return;
    const feats = geojsonRef.current.features;
    if (!feats.length) return;
    let minX = 180, minY = 90, maxX = -180, maxY = -90;
    for (const f of feats) {
      const [x, y] = f.geometry.coordinates;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    map.fitBounds(
      [[minX, minY], [maxX, maxY]],
      { padding: 60, maxZoom: 13, duration: 800 }
    );
  }

  const mappedCount = geojson.features.length;

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />

      {/* Fit-to-results */}
      <button
        onClick={fitToResults}
        className="absolute left-3 top-3 flex items-center gap-1.5 rounded-md border border-border bg-background/90 px-3 py-1.5 text-xs text-foreground hover:border-accent hover:text-accent transition-colors cursor-pointer"
      >
        <IconMapPin size={13} />
        Fit to results
      </button>

      {/* Legend */}
      <div className="absolute bottom-6 left-3 rounded-md border border-border bg-background/90 p-3">
        <p className="mb-2 text-xs font-medium text-foreground">Annual electricity (kWh)</p>
        <div className="flex flex-col gap-1">
          {KWH_RAMP.map((c, i) => (
            <div key={c} className="flex items-center gap-2 text-xs text-muted">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ background: c, width: 7 + i * 2, height: 7 + i * 2 }}
              />
              {KWH_CLASS_LABELS[i]}
            </div>
          ))}
          <div className="flex items-center gap-2 text-xs text-muted">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: NO_DATA_COLOR }} />
            no reported usage
          </div>
        </div>
        <p className="mt-2 max-w-[180px] text-[11px] leading-snug text-muted">
          {mappedCount.toLocaleString()} of {rows.length.toLocaleString()} matching buildings
          have coordinates
        </p>
      </div>
    </div>
  );
}
