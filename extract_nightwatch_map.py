#!/usr/bin/env python3
"""Extract public Nightwatch map placemarks into the shared CSV schema."""

from __future__ import annotations

import argparse
import csv
import html
import json
import math
import re
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


PAGE_URL = "https://nightwatch.services/map"
RAW_JSON = Path("data/raw/nightwatch_map_placemarks.json")
OUT_CSV = Path("data/nightwatch_map.csv")
SOURCE_DATASET = "Nightwatch map"


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
    "sidc",
    "parent_name",
    "node_id",
    "geometry_json",
    "raw_item_json",
]


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def clean_text(raw: Any) -> str:
    text = first_value(raw)
    text = html.unescape(text or "")
    text = re.sub(r"(?i)<br\s*/?>", "\n", text)
    text = re.sub(r"<[^>]+>", " ", text)
    return re.sub(r"[ \t]+", " ", text).strip()


def first_value(value: Any) -> str:
    if isinstance(value, list):
        return first_value(value[0]) if value else ""
    if value is None:
        return ""
    return str(value)


def military_unit(text: str) -> str:
    match = re.search(r"military\s+unit\s+([0-9A-Za-z/-]+)", text or "", flags=re.I)
    return match.group(1) if match else ""


def category_for_path(parent_name: str, name: str) -> str:
    blob = f"{parent_name} {name}".casefold()
    if "district" in blob and "boundar" in blob:
        return "military_district_boundary"
    if "boundar" in blob or "territory" in blob:
        return "military_facility_boundary"
    return "military_path"


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


def fetch_page() -> str:
    request = urllib.request.Request(
        PAGE_URL,
        headers={
            "User-Agent": "russianinfra-data-collector/1.0 (+https://github.com/)",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        return response.read().decode("utf-8")


def flight_stream(page_html: str) -> str:
    chunks: list[str] = []
    for match in re.finditer(r'self\.__next_f\.push\(\[1,"(.*?)"\]\)</script>', page_html, re.S):
        chunks.append(json.loads(f'"{match.group(1)}"'))
    if not chunks:
        raise ValueError("No Next.js flight stream chunks found in Nightwatch page")
    return "".join(chunks)


def text_references(stream: str) -> dict[str, str]:
    refs: dict[str, str] = {}
    pattern = re.compile(r"([0-9a-z]{1,2}):T([0-9a-f]+),")
    position = 0
    while True:
        match = pattern.search(stream, position)
        if not match:
            return refs
        key = f"${match.group(1)}"
        length = int(match.group(2), 16)
        start = match.end()
        refs[key] = stream[start : start + length]
        position = start + length


def coordinate_references(placemarks: list[dict[str, Any]]) -> set[str]:
    refs: set[str] = set()
    for placemark in placemarks:
        for geometry_key in ("Point", "LineString"):
            for geometry in placemark.get(geometry_key) or []:
                if not isinstance(geometry, dict):
                    continue
                value = first_value(geometry.get("coordinates")).strip()
                if value.startswith("$"):
                    refs.add(value)
    return refs


def resolve_text_reference(stream: str, reference: str) -> str | None:
    key = reference.removeprefix("$")
    index = stream.find(f"{key}:T")
    if index < 0:
        return None
    match = re.match(rf"{re.escape(key)}:T([0-9a-f]+),", stream[index:])
    if not match:
        return None
    length = int(match.group(1), 16)
    start = index + match.end()
    return stream[start : start + length]


def json_array_after(stream: str, needle: str) -> list[dict[str, Any]]:
    index = stream.find(needle)
    if index < 0:
        raise ValueError(f"Could not find {needle!r} in Nightwatch flight stream")
    start = stream.find("[", index)
    if start < 0:
        raise ValueError("Could not find Nightwatch placemark array start")

    depth = 0
    in_string = False
    escape = False
    for position in range(start, len(stream)):
        char = stream[position]
        if in_string:
            if escape:
                escape = False
            elif char == "\\":
                escape = True
            elif char == '"':
                in_string = False
            continue
        if char == '"':
            in_string = True
        elif char == "[":
            depth += 1
        elif char == "]":
            depth -= 1
            if depth == 0:
                return json.loads(stream[start : position + 1])
    raise ValueError("Could not find Nightwatch placemark array end")


def extract_from_page(page_html: str) -> tuple[list[dict[str, Any]], dict[str, str]]:
    stream = flight_stream(page_html)
    placemarks = json_array_after(stream, '"placemark":[')
    refs = text_references(stream)
    for reference in sorted(coordinate_references(placemarks) - set(refs)):
        value = resolve_text_reference(stream, reference)
        if value is not None:
            refs[reference] = value
    return placemarks, refs


def refresh_raw() -> dict[str, Any]:
    placemarks, refs = extract_from_page(fetch_page())
    payload = {
        "source_url": PAGE_URL,
        "retrieved_at": utc_now(),
        "placemarks": placemarks,
        "text_references": refs,
    }
    RAW_JSON.parent.mkdir(parents=True, exist_ok=True)
    with RAW_JSON.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    return payload


def load_raw(refresh: bool) -> dict[str, Any]:
    if refresh or not RAW_JSON.exists():
        return refresh_raw()
    with RAW_JSON.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def parse_coordinate_blob(raw: Any, refs: dict[str, str]) -> list[tuple[float, float]]:
    blob = first_value(raw).strip()
    if blob in refs:
        blob = refs[blob]
    coords: list[tuple[float, float]] = []
    for token in blob.replace("\n", " ").replace("\t", " ").split():
        parts = token.split(",")
        if len(parts) < 2:
            continue
        try:
            lon = float(parts[0])
            lat = float(parts[1])
        except ValueError:
            continue
        coords.append((lon, lat))
    return coords


def raw_summary(placemark: dict[str, Any]) -> str:
    payload = {
        "id": placemark.get("id", ""),
        "sidc": placemark.get("sidc", ""),
        "styleUrl": first_value(placemark.get("styleUrl")),
        "parentName": placemark.get("parentName", ""),
        "nodeId": placemark.get("nodeId", ""),
    }
    return json.dumps(payload, ensure_ascii=False, separators=(",", ":"))


def output_point(
    placemark: dict[str, Any],
    index: int,
    coords: list[tuple[float, float]],
    retrieved_at: str,
) -> dict[str, str] | None:
    if not coords:
        return None
    lon, lat = coords[0]
    name = clean_text(placemark.get("name")) or f"Nightwatch point {index}"
    desc = clean_text(placemark.get("description"))
    geometry = {"type": "Point", "coordinates": [lon, lat]}
    return {
        "source_dataset": SOURCE_DATASET,
        "layer": "nightwatch_points",
        "feature_id": first_value(placemark.get("id")) or f"point_{index:05d}",
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
        "source_url": PAGE_URL,
        "archive_timestamp": retrieved_at,
        "kml_type": "W",
        "kml_folder": first_value(placemark.get("parentName")),
        "kml_color": "",
        "kml_opacity": "",
        "kml_width": "",
        "kml_scale": "",
        "kml_symbol": first_value(placemark.get("styleUrl")),
        "military_unit": military_unit(desc),
        "sidc": first_value(placemark.get("sidc")),
        "parent_name": first_value(placemark.get("parentName")),
        "node_id": first_value(placemark.get("nodeId")),
        "geometry_json": json.dumps(geometry, ensure_ascii=False, separators=(",", ":")),
        "raw_item_json": raw_summary(placemark),
    }


def output_path(
    placemark: dict[str, Any],
    index: int,
    coords: list[tuple[float, float]],
    retrieved_at: str,
) -> dict[str, str] | None:
    if len(coords) < 2:
        return None
    name = clean_text(placemark.get("name")) or f"Nightwatch path {index}"
    desc = clean_text(placemark.get("description"))
    parent = first_value(placemark.get("parentName"))
    centroid_lon = sum(lon for lon, _ in coords) / len(coords)
    centroid_lat = sum(lat for _, lat in coords) / len(coords)
    geometry = {"type": "LineString", "coordinates": [[lon, lat] for lon, lat in coords]}
    return {
        "source_dataset": SOURCE_DATASET,
        "layer": "nightwatch_paths",
        "feature_id": first_value(placemark.get("id")) or f"path_{index:05d}",
        "feature_index": str(index),
        "name": name,
        "category": category_for_path(parent, name),
        "description": desc,
        "longitude": "",
        "latitude": "",
        "centroid_longitude": f"{centroid_lon:.9f}",
        "centroid_latitude": f"{centroid_lat:.9f}",
        "geometry_type": "LineString",
        "coordinate_count": str(len(coords)),
        "length_km": f"{path_length_km(coords):.6f}",
        "source_url": PAGE_URL,
        "archive_timestamp": retrieved_at,
        "kml_type": "T",
        "kml_folder": parent,
        "kml_color": "",
        "kml_opacity": "",
        "kml_width": "",
        "kml_scale": "",
        "kml_symbol": first_value(placemark.get("styleUrl")),
        "military_unit": military_unit(desc),
        "sidc": first_value(placemark.get("sidc")),
        "parent_name": parent,
        "node_id": first_value(placemark.get("nodeId")),
        "geometry_json": json.dumps(geometry, ensure_ascii=False, separators=(",", ":")),
        "raw_item_json": raw_summary(placemark),
    }


def convert(payload: dict[str, Any]) -> list[dict[str, str]]:
    placemarks = payload.get("placemarks") or []
    refs = payload.get("text_references") or {}
    retrieved_at = payload.get("retrieved_at") or utc_now()
    rows: list[dict[str, str]] = []
    point_index = 0
    path_index = 0
    for placemark in placemarks:
        if not isinstance(placemark, dict):
            continue
        if "Point" in placemark:
            point_index += 1
            point = (placemark.get("Point") or [{}])[0]
            coords = parse_coordinate_blob(point.get("coordinates", ""), refs) if isinstance(point, dict) else []
            row = output_point(placemark, point_index, coords, retrieved_at)
        elif "LineString" in placemark:
            path_index += 1
            line = (placemark.get("LineString") or [{}])[0]
            coords = parse_coordinate_blob(line.get("coordinates", ""), refs) if isinstance(line, dict) else []
            row = output_path(placemark, path_index, coords, retrieved_at)
        else:
            row = None
        if row:
            rows.append(row)
    return rows


def write_csv(rows: list[dict[str, str]]) -> None:
    OUT_CSV.parent.mkdir(parents=True, exist_ok=True)
    with OUT_CSV.open("w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDNAMES, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--refresh", action="store_true", help="Fetch the current public Nightwatch map page.")
    args = parser.parse_args()

    payload = load_raw(args.refresh)
    rows = convert(payload)
    write_csv(rows)

    geometry_counts: dict[str, int] = {}
    for row in rows:
        geometry_counts[row["geometry_type"]] = geometry_counts.get(row["geometry_type"], 0) + 1
    print(f"Wrote {len(rows):,} Nightwatch map features to {OUT_CSV}")
    for geometry_type, count in sorted(geometry_counts.items()):
        print(f"  {geometry_type}: {count:,}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
