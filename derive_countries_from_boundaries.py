#!/usr/bin/env python3
"""Derive feature countries from country boundary polygons.

This is intentionally dependency-free so it can run in the local project
environment without Shapely/GeoPandas. It uses exact point-in-boundary checks
for Point features and each feature's representative map coordinate for lines
and polygons. The derived countries are written to feature properties.
"""

from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path
from typing import Any, Iterable


BOUNDARY_PATH = Path("data/boundaries/ne_50m_admin_0_countries.geojson")
DEFAULT_INPUTS = ["web/data/*.geojson"]
REPORT_PATH = Path("data/country_derivation_report.json")


def ring_bbox(ring: list[list[float]]) -> tuple[float, float, float, float]:
    xs = [point[0] for point in ring]
    ys = [point[1] for point in ring]
    return min(xs), min(ys), max(xs), max(ys)


def bbox_contains(bbox: tuple[float, float, float, float], point: tuple[float, float]) -> bool:
    x, y = point
    min_x, min_y, max_x, max_y = bbox
    return min_x <= x <= max_x and min_y <= y <= max_y


def point_in_ring(point: tuple[float, float], ring: list[list[float]]) -> bool:
    x, y = point
    inside = False
    if len(ring) < 3:
        return False
    x1, y1 = ring[0]
    for index in range(1, len(ring) + 1):
        x2, y2 = ring[index % len(ring)]
        if y1 == y2:
            x1, y1 = x2, y2
            continue
        intersects = (y1 > y) != (y2 > y)
        if intersects:
            x_at_y = (x2 - x1) * (y - y1) / (y2 - y1) + x1
            if x <= x_at_y:
                inside = not inside
        x1, y1 = x2, y2
    return inside


def point_in_polygon(point: tuple[float, float], rings: list[list[list[float]]]) -> bool:
    if not rings or not point_in_ring(point, rings[0]):
        return False
    return not any(point_in_ring(point, hole) for hole in rings[1:])


def country_name(properties: dict[str, Any]) -> str:
    for key in ("ADMIN", "NAME_EN", "NAME", "SOVEREIGNT"):
        value = properties.get(key)
        if value and value != "-99":
            return str(value)
    return "Unknown"


def load_boundaries(path: Path) -> list[dict[str, Any]]:
    data = json.loads(path.read_text(encoding="utf-8"))
    countries = []
    for feature in data.get("features", []):
        geometry = feature.get("geometry") or {}
        properties = feature.get("properties") or {}
        name = country_name(properties)
        polygons = []
        coordinates = geometry.get("coordinates") or []
        if geometry.get("type") == "Polygon":
            coordinates = [coordinates]
        if geometry.get("type") not in {"Polygon", "MultiPolygon"}:
            continue
        for polygon in coordinates:
            if not polygon:
                continue
            bbox = ring_bbox(polygon[0])
            polygons.append({"bbox": bbox, "rings": polygon})
        if polygons:
            min_x = min(item["bbox"][0] for item in polygons)
            min_y = min(item["bbox"][1] for item in polygons)
            max_x = max(item["bbox"][2] for item in polygons)
            max_y = max(item["bbox"][3] for item in polygons)
            countries.append(
                {
                    "name": name,
                    "bbox": (min_x, min_y, max_x, max_y),
                    "polygons": polygons,
                }
            )
    return countries


def iter_positions(node: Any) -> Iterable[tuple[float, float]]:
    if (
        isinstance(node, list)
        and len(node) >= 2
        and isinstance(node[0], (int, float))
        and isinstance(node[1], (int, float))
    ):
        yield float(node[0]), float(node[1])
        return
    if isinstance(node, list):
        for item in node:
            yield from iter_positions(item)


def sample_positions(geometry: dict[str, Any], limit: int = 25) -> list[tuple[float, float]]:
    positions = list(iter_positions(geometry.get("coordinates")))
    if not positions:
        return []
    if len(positions) <= limit:
        return positions
    indexes = {0, len(positions) - 1, len(positions) // 2}
    for step in range(limit):
        indexes.add(round(step * (len(positions) - 1) / (limit - 1)))
    return [positions[index] for index in sorted(indexes)]


def matching_countries(point: tuple[float, float], boundaries: list[dict[str, Any]]) -> list[str]:
    matches = []
    for country in boundaries:
        if not bbox_contains(country["bbox"], point):
            continue
        for polygon in country["polygons"]:
            if bbox_contains(polygon["bbox"], point) and point_in_polygon(point, polygon["rings"]):
                matches.append(country["name"])
                break
    return matches


def derive_feature_countries(feature: dict[str, Any], boundaries: list[dict[str, Any]]) -> tuple[list[str], str]:
    geometry = feature.get("geometry") or {}
    props = feature.get("properties") or {}
    if geometry.get("type") == "Point":
        points = sample_positions(geometry, limit=1)
        method_name = "point_in_boundary"
    else:
        points = []
        lon = props.get("map_longitude")
        lat = props.get("map_latitude")
        try:
            points = [(float(lon), float(lat))]
            method_name = "representative_point_in_boundary"
        except (TypeError, ValueError):
            points = sample_positions(geometry, limit=3)
            method_name = "geometry_sample_in_boundary"
    if not points:
        return [], "missing_geometry"

    counts = Counter()
    for point in points:
        for name in matching_countries(point, boundaries):
            counts[name] += 1

    if not counts:
        return [], "no_boundary_match"
    return [name for name, _ in counts.most_common()], method_name


def expand_inputs(patterns: list[str]) -> list[Path]:
    paths: list[Path] = []
    for pattern in patterns:
        matches = sorted(Path().glob(pattern))
        if matches:
            paths.extend(path for path in matches if path.is_file())
        else:
            path = Path(pattern)
            if path.is_file():
                paths.append(path)
    return paths


def enrich_file(path: Path, boundaries: list[dict[str, Any]], write: bool) -> dict[str, Any]:
    data = json.loads(path.read_text(encoding="utf-8"))
    country_counts = Counter()
    method_counts = Counter()
    changed = 0
    unmatched = 0
    for feature in data.get("features", []):
        props = feature.setdefault("properties", {})
        if "source_country" not in props:
            props["source_country"] = props.get("country", "")
        countries, method = derive_feature_countries(feature, boundaries)
        method_counts[method] += 1
        if not countries:
            unmatched += 1
            countries = [props.get("country") or "Unknown"]
        old_country = props.get("country")
        old_countries = props.get("countries")
        props["country"] = countries[0]
        props["countries"] = countries
        props["country_match_method"] = method
        if old_country != props["country"] or old_countries != props["countries"]:
            changed += 1
        for country in countries:
            country_counts[country] += 1

    if write:
        path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    return {
        "file": str(path),
        "features": len(data.get("features", [])),
        "changed": changed,
        "unmatched": unmatched,
        "countries": dict(sorted(country_counts.items())),
        "methods": dict(sorted(method_counts.items())),
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--boundaries", type=Path, default=BOUNDARY_PATH)
    parser.add_argument("--input", action="append", dest="inputs", default=[])
    parser.add_argument("--write", action="store_true")
    parser.add_argument("--report", type=Path, default=REPORT_PATH)
    args = parser.parse_args()

    inputs = expand_inputs(args.inputs or DEFAULT_INPUTS)
    if not inputs:
        raise FileNotFoundError("No input GeoJSON files matched.")
    boundaries = load_boundaries(args.boundaries)
    reports = [enrich_file(path, boundaries, args.write) for path in inputs]
    summary = {
        "boundary_file": str(args.boundaries),
        "write": args.write,
        "files": reports,
    }
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    total_changed = sum(item["changed"] for item in reports)
    print(f"Processed {len(reports)} files; changed {total_changed:,} features")
    print(f"Wrote report: {args.report}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
