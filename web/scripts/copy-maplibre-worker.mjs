// Copies MapLibre's worker module (+ shared chunk) into public/ so it can be
// served at a stable URL. Needed because Turbopack doesn't emit the worker
// file that maplibre-gl resolves via import.meta.url. Runs on postinstall.
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dist = join(root, "node_modules", "maplibre-gl", "dist");
const out = join(root, "public", "maplibre");

mkdirSync(out, { recursive: true });
for (const f of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  copyFileSync(join(dist, f), join(out, f));
}
console.log("maplibre worker copied to public/maplibre/");
