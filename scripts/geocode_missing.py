"""Geocode buildings that have no published coordinates (Boston, Denver,
Montgomery County) using the free US Census Bureau batch geocoder.

Results are cached in data/reference/geocode_cache.json keyed by a normalized
address string; build_web_dataset.py fills missing lat/lon from that cache on
its next run. Re-running skips cached addresses (including known no-matches).

Usage:  python scripts/geocode_missing.py
Then:   python scripts/build_web_dataset.py
"""
from __future__ import annotations

import csv
import gzip
import io
import json
import re
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
CACHE_PATH = DATA_DIR / "reference" / "geocode_cache.json"
PAYLOAD = DATA_DIR / "web" / "buildings.json.gz"

CENSUS_URL = "https://geocoding.geo.census.gov/geocoder/locations/addressbatch"
CHUNK = 2000

# Accept results only inside the state's bounding box (guards bad matches)
STATE_BBOX = {
    "CO": (36.8, 41.2, -109.2, -101.9),
    "MA": (41.1, 43.0, -73.7, -69.8),
    "MD": (37.8, 39.9, -79.6, -74.8),
    "DC": (38.7, 39.1, -77.2, -76.8),
    "NY": (40.4, 45.1, -79.9, -71.7),
    "CA": (32.4, 42.1, -124.6, -114.0),
    "IL": (36.9, 42.6, -91.6, -87.0),
    "PA": (39.6, 42.4, -80.6, -74.6),
    "WA": (45.5, 49.1, -124.9, -116.9),
}


def norm_geo_key(address: str, city: str | None, state: str | None, zip5: str | None) -> str:
    """Cache key — must stay in sync with build_web_dataset.fill_geocoded()."""
    a = re.sub(r"[^A-Z0-9 ]", "", str(address).upper())
    a = re.sub(r"\s+", " ", a).strip()
    return f"{a}|{str(city or '').upper().strip()}|{state or ''}|{zip5 or ''}"


def load_missing() -> dict[str, tuple[str, str, str, str]]:
    """Unique geocode keys -> (street, city, state, zip) for rows lacking coords."""
    with gzip.open(PAYLOAD, "rb") as f:
        payload = json.load(f)
    idx = {c: i for i, c in enumerate(payload["columns"])}
    out: dict[str, tuple[str, str, str, str]] = {}
    for r in payload["rows"]:
        if r[idx["lat"]] is not None or r[idx["address"]] is None:
            continue
        addr, city, st, zp = r[idx["address"]], r[idx["city"]], r[idx["state"]], r[idx["zip"]]
        key = norm_geo_key(addr, city, st, zp)
        out.setdefault(key, (str(addr), str(city or ""), str(st or ""), str(zp or "")))
    return out


def census_batch(rows: list[tuple[str, str, str, str, str]]) -> dict[str, tuple[float, float]]:
    """rows = [(key, street, city, state, zip)] -> {key: (lat, lon)}"""
    buf = io.StringIO()
    w = csv.writer(buf)
    for key_id, (key, street, city, st, zp) in enumerate(rows):
        w.writerow([key_id, street, city, st, zp])
    csv_bytes = buf.getvalue().encode("utf-8")

    boundary = "----loadstone-geocode"
    body = (
        f"--{boundary}\r\n"
        'Content-Disposition: form-data; name="benchmark"\r\n\r\n'
        "Public_AR_Current\r\n"
        f"--{boundary}\r\n"
        'Content-Disposition: form-data; name="addressFile"; filename="addresses.csv"\r\n'
        "Content-Type: text/csv\r\n\r\n"
    ).encode("utf-8") + csv_bytes + f"\r\n--{boundary}--\r\n".encode("utf-8")

    req = urllib.request.Request(
        CENSUS_URL,
        data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
    )
    with urllib.request.urlopen(req, timeout=900) as resp:
        text = resp.read().decode("utf-8", errors="replace")

    results: dict[str, tuple[float, float]] = {}
    for fields in csv.reader(io.StringIO(text)):
        if len(fields) < 6 or fields[2] != "Match":
            continue
        try:
            key_id = int(fields[0])
            lon_s, lat_s = fields[5].split(",")
            lat, lon = float(lat_s), float(lon_s)
        except (ValueError, IndexError):
            continue
        key, _, _, st, _ = rows[key_id]
        box = STATE_BBOX.get(st)
        if box and not (box[0] <= lat <= box[1] and box[2] <= lon <= box[3]):
            continue  # matched to the wrong part of the country — discard
        results[key] = (round(lat, 5), round(lon, 5))
    return results


if __name__ == "__main__":
    missing = load_missing()
    cache: dict = json.loads(CACHE_PATH.read_text()) if CACHE_PATH.exists() else {}
    todo = {k: v for k, v in missing.items() if k not in cache}
    print(f"{len(missing)} unique un-mapped addresses; {len(missing) - len(todo)} cached; {len(todo)} to geocode")

    items = [(k, *v) for k, v in todo.items()]
    matched_total = 0
    for i in range(0, len(items), CHUNK):
        chunk = items[i : i + CHUNK]
        print(f"chunk {i // CHUNK + 1}/{-(-len(items) // CHUNK)} ({len(chunk)} addresses)…", flush=True)
        try:
            results = census_batch(chunk)
        except Exception as e:
            print(f"  chunk failed ({str(e)[:120]}) — retrying once")
            try:
                results = census_batch(chunk)
            except Exception as e2:
                print(f"  retry failed ({str(e2)[:120]}) — skipping chunk, re-run later")
                continue
        for key, _, _, _, _ in chunk:
            cache[key] = list(results[key]) if key in results else None  # None = known no-match
        matched_total += len(results)
        CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
        CACHE_PATH.write_text(json.dumps(cache, indent=0))
        print(f"  matched {len(results)}/{len(chunk)}")

    solved = sum(1 for v in cache.values() if v)
    print(f"\ncache now holds {solved} geocoded of {len(cache)} attempted addresses")
    print("Next: python scripts/build_web_dataset.py  (fills coordinates from the cache)")
