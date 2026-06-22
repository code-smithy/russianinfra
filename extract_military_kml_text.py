#!/usr/bin/env python3
"""Extract semicolon-delimited KML text export into the shared CSV schema."""

from __future__ import annotations

import csv
import html
import json
import math
import re
import sys
from pathlib import Path
from typing import Any


RAW_PATH = Path("data/raw/20260618052118-00000-data.txt")
OUT_CSV = Path("data/military_kml_text_archive.csv")
SOURCE_DATASET = "Military KML text archive"
CAPTURE_DATE = "2026-06-18T05:21:18Z"


FIELDNAMES = [
    "source_dataset",
    "layer",
    "feature_id",
    "feature_index",
    "name",
    "category",
    "description",
    "longitude",
    "latitude",
    "centroid_longitude",
    "centroid_latitude",
    "geometry_type",
    "coordinate_count",
    "length_km",
    "source_url",
    "archive_timestamp",
    "kml_type",
    "kml_folder",
    "kml_color",
    "kml_opacity",
    "kml_width",
    "kml_scale",
    "kml_symbol",
    "military_unit",
    "geometry_json",
    "raw_item_json",
]


def clean_text(raw: str) -> str:
    text = html.unescape(raw or "")
    text = re.sub(r"(?i)<br\s*/?>", "\n", text)
    text = re.sub(r"<[^>]+>", " ", text)
    return re.sub(r"[ \t]+", " ", text).strip()


def parse_float(raw: str) -> float | None:
    try:
        return float(raw)
    except (TypeError, ValueError):
        return None


def haversine_km(a: tuple[float, float], b: tuple[float, float]) -> float:
    radius = 6371.0088
    lon1, lat1 = a
    lon2, lat2 = b
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lon2 - lon1)
    h = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    return 2 * radius * math.asin(min(1, math.sqrt(h)))


def path_length_km(coords: list[tuple[float, float]]) -> float:
    return sum(haversine_km(a, b) for a, b in zip(coords, coords[1:]))


def military_unit(text: str) -> str:
    match = re.search(r"military\s+unit\s+([0-9A-Za-z/-]+)", text or "", flags=re.I)
    return match.group(1) if match else ""


def category_for_path(folder: str, name: str) -> str:
    blob = f"{folder} {name}".casefold()
    if "district" in blob and "boundar" in blob:
        return "military_district_boundary"
    if "boundar" in blob or "territory" in blob:
        return "military_facility_boundary"
    return "military_path"


def make_raw(row: dict[str, str], line_number: int, segment_size: int | None = None) -> str:
    payload: dict[str, Any] = {
        "line_number": line_number,
        "type": row.get("type", ""),
        "color": row.get("color", ""),
        "opacity": row.get("opacity", ""),
        "width": row.get("width", ""),
        "scale": row.get("scale", ""),
        "symbol": row.get("sym", ""),
        "ge_hotspot": row.get("ge_hotspot", ""),
        "kml_folder": row.get("kml_folder", ""),
    }
    if segment_size is not None:
        payload["segment_vertex_count"] = segment_size
    return json.dumps(payload, ensure_ascii=False, separators=(",", ":"))


def output_waypoint(row: dict[str, str], index: int, line_number: int) -> dict[str, str] | None:
    lat = parse_float(row.get("latitude", ""))
    lon = parse_float(row.get("longitude", ""))
    if lat is None or lon is None:
        return None
    desc = clean_text(row.get("desc", ""))
    name = clean_text(row.get("name", "")) or f"Waypoint {index}"
    geometry = {"type": "Point", "coordinates": [lon, lat]}
    return {
        "source_dataset": SOURCE_DATASET,
        "layer": "military_kml_waypoints",
        "feature_id": f"waypoint_{index:05d}",
        "feature_index": str(index),
        "name": name,
        "category": "military_site",
        "description": desc,
        "longitude": f"{lon:.9f}",
        "latitude": f"{lat:.9f}",
        "centroid_longitude": "",
        "centroid_latitude": "",
        "geometry_type": "Point",
        "coordinate_count": "1",
        "length_km": "",
        "source_url": "",
        "archive_timestamp": CAPTURE_DATE,
        "kml_type": "W",
        "kml_folder": row.get("kml_folder", ""),
        "kml_color": row.get("color", ""),
        "kml_opacity": row.get("opacity", ""),
        "kml_width": row.get("width", ""),
        "kml_scale": row.get("scale", ""),
        "kml_symbol": row.get("sym", ""),
        "military_unit": military_unit(desc),
        "geometry_json": json.dumps(geometry, ensure_ascii=False, separators=(",", ":")),
        "raw_item_json": make_raw(row, line_number),
    }


def output_path(segment: list[tuple[int, dict[str, str]]], index: int) -> dict[str, str] | None:
    coords: list[tuple[float, float]] = []
    for _, row in segment:
        lat = parse_float(row.get("latitude", ""))
        lon = parse_float(row.get("longitude", ""))
        if lat is not None and lon is not None:
            coords.append((lon, lat))
    if len(coords) < 2:
        return None

    first_line, first = segment[0]
    desc = clean_text(first.get("desc", ""))
    name = clean_text(first.get("name", "")) or f"Path {index}"
    centroid_lon = sum(lon for lon, _ in coords) / len(coords)
    centroid_lat = sum(lat for _, lat in coords) / len(coords)
    geometry = {"type": "LineString", "coordinates": [[lon, lat] for lon, lat in coords]}
    return {
        "source_dataset": SOURCE_DATASET,
        "layer": "military_kml_paths",
        "feature_id": f"path_{index:05d}",
        "feature_index": str(index),
        "name": name,
        "category": category_for_path(first.get("kml_folder", ""), name),
        "description": desc,
        "longitude": "",
        "latitude": "",
        "centroid_longitude": f"{centroid_lon:.9f}",
        "centroid_latitude": f"{centroid_lat:.9f}",
        "geometry_type": "LineString",
        "coordinate_count": str(len(coords)),
        "length_km": f"{path_length_km(coords):.6f}",
        "source_url": "",
        "archive_timestamp": CAPTURE_DATE,
        "kml_type": "T",
        "kml_folder": first.get("kml_folder", ""),
        "kml_color": first.get("color", ""),
        "kml_opacity": first.get("opacity", ""),
        "kml_width": first.get("width", ""),
        "kml_scale": first.get("scale", ""),
        "kml_symbol": first.get("sym", ""),
        "military_unit": military_unit(desc),
        "geometry_json": json.dumps(geometry, ensure_ascii=False, separators=(",", ":")),
        "raw_item_json": make_raw(first, first_line, len(coords)),
    }


def main() -> int:
    if not RAW_PATH.exists():
        raise FileNotFoundError(f"Missing raw KML text export: {RAW_PATH}")

    outputs: list[dict[str, str]] = []
    waypoint_index = 0
    path_index = 0
    path_segment: list[tuple[int, dict[str, str]]] = []

    def flush_path() -> None:
        nonlocal path_index, path_segment
        if path_segment:
            path_index += 1
            row = output_path(path_segment, path_index)
            if row:
                outputs.append(row)
            path_segment = []

    with RAW_PATH.open("r", newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle, delimiter=";")
        for line_number, row in enumerate(reader, start=2):
            row_type = row.get("type", "")
            if row_type == "type":
                flush_path()
                continue
            if row_type == "T":
                path_segment.append((line_number, row))
                continue
            flush_path()
            if row_type == "W":
                waypoint_index += 1
                output = output_waypoint(row, waypoint_index, line_number)
                if output:
                    outputs.append(output)
    flush_path()

    OUT_CSV.parent.mkdir(parents=True, exist_ok=True)
    with OUT_CSV.open("w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDNAMES, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(outputs)

    print(f"Wrote {len(outputs):,} military KML features to {OUT_CSV}")
    print(f"  waypoints: {waypoint_index:,}")
    print(f"  paths: {path_index:,}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
