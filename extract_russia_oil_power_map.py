#!/usr/bin/env python3
"""Export Russia Oil & Power Infrastructure Map GeoJSON layers to CSV."""

from __future__ import annotations

import csv
import json
import math
import sys
import time
import urllib.request
from urllib.error import HTTPError, URLError
from pathlib import Path
from typing import Any


BASE_URL = "https://russiaoilpowermap.com"
OUT_DIR = Path("data")
RAW_DIR = OUT_DIR / "raw"
CSV_PATH = OUT_DIR / "russia_oil_power_infrastructure.csv"
MANIFEST_URL = f"{BASE_URL}/data/static/manifest.json"
FALLBACK_WEB_MANIFEST = Path("web/data/manifest.json")
CUSTOM_DATASETS = {
    "custom_pins": "data/custom_pins.json",
    "custom_lines": "data/custom_lines.json",
}


def fetch_bytes(url: str, attempts: int = 3) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    last_error: Exception | None = None
    for attempt in range(1, attempts + 1):
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                return resp.read()
        except (HTTPError, URLError) as exc:
            last_error = exc
            if attempt == attempts:
                break
            wait_seconds = 2**attempt
            print(f"Fetch failed ({exc}); retrying in {wait_seconds}s...", file=sys.stderr)
            time.sleep(wait_seconds)
    raise RuntimeError(f"Failed to fetch {url} after {attempts} attempts") from last_error


def fetch_json(url: str, target: Path) -> Any:
    target.parent.mkdir(parents=True, exist_ok=True)
    data = fetch_bytes(url)
    target.write_bytes(data)
    return json.loads(data.decode("utf-8-sig"))


def flatten(prefix: str, value: Any, out: dict[str, Any]) -> None:
    if isinstance(value, dict):
        for key, child in value.items():
            safe_key = str(key).replace(".", "_").replace(" ", "_")
            flatten(f"{prefix}_{safe_key}" if prefix else safe_key, child, out)
    elif isinstance(value, list):
        out[prefix] = json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    else:
        out[prefix] = value


def iter_positions(geometry: dict[str, Any] | None) -> list[tuple[float, float]]:
    if not geometry:
        return []

    positions: list[tuple[float, float]] = []

    def walk(node: Any) -> None:
        if (
            isinstance(node, list)
            and len(node) >= 2
            and isinstance(node[0], (int, float))
            and isinstance(node[1], (int, float))
        ):
            positions.append((float(node[0]), float(node[1])))
            return
        if isinstance(node, list):
            for item in node:
                walk(item)

    walk(geometry.get("coordinates"))
    return positions


def haversine_km(a: tuple[float, float], b: tuple[float, float]) -> float:
    lon1, lat1 = a
    lon2, lat2 = b
    radius = 6371.0088
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lon2 - lon1)
    h = (
        math.sin(d_phi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    )
    return 2 * radius * math.asin(min(1.0, math.sqrt(h)))


def line_length_km(geometry: dict[str, Any] | None) -> float | None:
    if not geometry:
        return None
    gtype = geometry.get("type")
    coords = geometry.get("coordinates")

    def length_of_line(line: list[Any]) -> float:
        pts = [
            (float(p[0]), float(p[1]))
            for p in line
            if isinstance(p, list)
            and len(p) >= 2
            and isinstance(p[0], (int, float))
            and isinstance(p[1], (int, float))
        ]
        return sum(haversine_km(pts[i - 1], pts[i]) for i in range(1, len(pts)))

    if gtype == "LineString" and isinstance(coords, list):
        return length_of_line(coords)
    if gtype == "MultiLineString" and isinstance(coords, list):
        return sum(length_of_line(line) for line in coords if isinstance(line, list))
    return None


def geometry_summary(geometry: dict[str, Any] | None) -> dict[str, Any]:
    positions = iter_positions(geometry)
    summary: dict[str, Any] = {
        "geometry_type": geometry.get("type") if geometry else "",
        "coordinate_count": len(positions),
        "longitude": "",
        "latitude": "",
        "centroid_longitude": "",
        "centroid_latitude": "",
        "bbox_min_longitude": "",
        "bbox_min_latitude": "",
        "bbox_max_longitude": "",
        "bbox_max_latitude": "",
        "start_longitude": "",
        "start_latitude": "",
        "end_longitude": "",
        "end_latitude": "",
        "length_km": "",
        "geometry_json": json.dumps(geometry or {}, ensure_ascii=False, separators=(",", ":")),
    }
    if not positions:
        return summary

    lons = [p[0] for p in positions]
    lats = [p[1] for p in positions]
    summary.update(
        {
            "centroid_longitude": sum(lons) / len(lons),
            "centroid_latitude": sum(lats) / len(lats),
            "bbox_min_longitude": min(lons),
            "bbox_min_latitude": min(lats),
            "bbox_max_longitude": max(lons),
            "bbox_max_latitude": max(lats),
            "start_longitude": positions[0][0],
            "start_latitude": positions[0][1],
            "end_longitude": positions[-1][0],
            "end_latitude": positions[-1][1],
        }
    )
    if geometry and geometry.get("type") == "Point":
        summary["longitude"] = positions[0][0]
        summary["latitude"] = positions[0][1]

    length = line_length_km(geometry)
    if length is not None:
        summary["length_km"] = round(length, 6)
    return summary


def dataset_url(layer: str, manifest: dict[str, str]) -> str:
    if layer in CUSTOM_DATASETS:
        return f"{BASE_URL}/{CUSTOM_DATASETS[layer]}"
    return f"{BASE_URL}/data/static/{manifest[layer]}"


def load_datasets() -> list[tuple[str, str, dict[str, Any]]]:
    print(f"Fetching manifest: {MANIFEST_URL}")
    manifest = fetch_json(MANIFEST_URL, RAW_DIR / "manifest.json")
    datasets: list[tuple[str, str, dict[str, Any]]] = []

    for layer in sorted(manifest):
        url = dataset_url(layer, manifest)
        target = RAW_DIR / manifest[layer]
        print(f"Fetching {layer}: {url}")
        datasets.append((layer, url, fetch_json(url, target)))

    for layer, path in CUSTOM_DATASETS.items():
        url = dataset_url(layer, manifest)
        target = RAW_DIR / Path(path).name
        print(f"Fetching {layer}: {url}")
        datasets.append((layer, url, fetch_json(url, target)))

    return datasets


def web_manifest_layer_files(path: Path | None = None) -> list[Path]:
    path = path or FALLBACK_WEB_MANIFEST
    with path.open("r", encoding="utf-8") as handle:
        manifest = json.load(handle)
    files: list[Path] = []
    for layer in manifest.get("layers", []):
        if not isinstance(layer, dict):
            continue
        for file_name in layer.get("files") or []:
            file_path = path.parent / file_name
            if file_path.exists():
                files.append(file_path)
    return files


def fallback_layer_from_source_layer(source_layer: str, map_layer: str) -> str:
    if source_layer:
        return source_layer
    fallback = {
        "energy_facilities": "custom_pins",
        "energy_gas": "gas_pipelines",
        "energy_oil": "pipelines",
        "power_facilities": "custom_pins",
        "power_lines": "power_hv_lines",
        "transport_other": "custom_pins",
        "transport_rail": "railway_lines",
        "other_infrastructure": "custom_pins",
    }
    return fallback.get(map_layer, map_layer)


def fallback_row_from_feature(feature: dict[str, Any], index: int) -> dict[str, Any] | None:
    props = feature.get("properties") if isinstance(feature.get("properties"), dict) else {}
    if props.get("source_id") != "russia_oil_power_map":
        return None
    geometry = feature.get("geometry") if isinstance(feature.get("geometry"), dict) else None
    tags = props.get("tags") if isinstance(props.get("tags"), dict) else {}
    layer = fallback_layer_from_source_layer(str(props.get("source_layer") or ""), str(props.get("map_layer") or ""))
    source_record_id = str(props.get("source_record_id") or "")
    row: dict[str, Any] = {
        "layer": layer,
        "source_url": props.get("source_url") or "",
        "feature_index": index,
        "feature_id": source_record_id,
        "feature_type": feature.get("type", ""),
        "name": props.get("name") or props.get("display_label") or "",
        "category": props.get("asset_type") or props.get("asset_subtype") or "",
        "operator": props.get("operator") or "",
        "product": props.get("product") or "",
        "source": props.get("source_name") or "",
        "osm_id": source_record_id,
        "raw_properties_json": json.dumps({"tags": tags}, ensure_ascii=False, separators=(",", ":")) if tags else "",
    }
    row.update(geometry_summary(geometry))
    if tags:
        for key, value in tags.items():
            row[f"properties_tags_{key}"] = value
    return row


def fallback_rows_from_web_data(path: Path | None = None) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    path = path or FALLBACK_WEB_MANIFEST
    for file_path in web_manifest_layer_files(path):
        with file_path.open("r", encoding="utf-8") as handle:
            data = json.load(handle)
        for feature in data.get("features", []):
            if not isinstance(feature, dict):
                continue
            row = fallback_row_from_feature(feature, len(rows) + 1)
            if row:
                rows.append(row)
    if not rows:
        raise RuntimeError(f"No fallback Russia Oil & Power rows found in {path}")
    return rows


def feature_to_row(layer: str, source_url: str, index: int, feature: dict[str, Any]) -> dict[str, Any]:
    props = feature.get("properties") or {}
    tags = props.get("tags") if isinstance(props.get("tags"), dict) else {}
    row: dict[str, Any] = {
        "layer": layer,
        "source_url": source_url,
        "feature_index": index,
        "feature_id": feature.get("id", ""),
        "feature_type": feature.get("type", ""),
        "name": props.get("name") or tags.get("name") or "",
        "category": props.get("category") or "",
        "operator": props.get("operator") or tags.get("operator") or "",
        "product": props.get("product")
        or tags.get("product")
        or tags.get("substance")
        or tags.get("pipeline:product")
        or "",
        "source": props.get("source") or tags.get("source") or "",
        "osm_id": props.get("id") or props.get("@id") or tags.get("id") or "",
        "raw_properties_json": json.dumps(props, ensure_ascii=False, separators=(",", ":")),
    }
    row.update(geometry_summary(feature.get("geometry")))

    flattened: dict[str, Any] = {}
    flatten("properties", props, flattened)
    for key, value in flattened.items():
        row.setdefault(key, value)
    return row


def write_csv(rows: list[dict[str, Any]]) -> None:
    preferred = [
        "layer",
        "feature_id",
        "feature_index",
        "name",
        "category",
        "operator",
        "product",
        "source",
        "osm_id",
        "geometry_type",
        "longitude",
        "latitude",
        "centroid_longitude",
        "centroid_latitude",
        "bbox_min_longitude",
        "bbox_min_latitude",
        "bbox_max_longitude",
        "bbox_max_latitude",
        "start_longitude",
        "start_latitude",
        "end_longitude",
        "end_latitude",
        "coordinate_count",
        "length_km",
        "source_url",
        "feature_type",
    ]
    fieldnames = preferred + sorted({k for row in rows for k in row} - set(preferred))
    CSV_PATH.parent.mkdir(parents=True, exist_ok=True)
    with CSV_PATH.open("w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def main() -> int:
    try:
        datasets = load_datasets()
        rows: list[dict[str, Any]] = []
        counts: dict[str, int] = {}
        for layer, source_url, geojson in datasets:
            features = geojson.get("features") or []
            counts[layer] = len(features)
            for index, feature in enumerate(features, 1):
                rows.append(feature_to_row(layer, source_url, index, feature))

        write_csv(rows)

        print(f"Wrote {len(rows):,} features to {CSV_PATH}")
        print("Layer counts:")
        for layer, count in sorted(counts.items()):
            print(f"  {layer}: {count:,}")
    except Exception as exc:
        print(f"WARNING: Russia Oil & Power remote refresh failed: {exc}", file=sys.stderr)
        print(f"Using fallback rows from {FALLBACK_WEB_MANIFEST}", file=sys.stderr)
        rows = fallback_rows_from_web_data()
        write_csv(rows)
        counts: dict[str, int] = {}
        for row in rows:
            counts[str(row.get("layer") or "unknown")] = counts.get(str(row.get("layer") or "unknown"), 0) + 1
        print(f"Wrote {len(rows):,} fallback Russia Oil & Power features to {CSV_PATH}")
        print("Fallback layer counts:")
        for layer, count in sorted(counts.items()):
            print(f"  {layer}: {count:,}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
