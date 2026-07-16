#!/usr/bin/env python3
"""Extract major road geometry from Geofabrik OpenStreetMap country extracts."""

from __future__ import annotations

import argparse
import csv
import email.utils
import json
import math
import os
import shutil
import subprocess
import sys
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError


RAW_DIR = Path("data/raw/osm/geofabrik")
WORK_DIR = Path("data/extracted/osm_roads")
CSV_PATH = WORK_DIR / "geofabrik_osm_roads.csv"
SOURCE_DATASET = "Geofabrik OpenStreetMap roads"
EXTRACTOR_VERSION = "geofabrik_osm_roads_1"

STRATEGIC_HIGHWAY_CLASSES = [
    "motorway",
    "motorway_link",
    "trunk",
    "trunk_link",
    "primary",
    "primary_link",
]

REGIONAL_HIGHWAY_CLASSES = [
    *STRATEGIC_HIGHWAY_CLASSES,
    "secondary",
    "secondary_link",
    "tertiary",
    "tertiary_link",
]

MAJOR_HIGHWAY_CLASSES = REGIONAL_HIGHWAY_CLASSES


@dataclass(frozen=True)
class CountryExtract:
    slug: str
    country_code: str
    country_name: str
    pbf_url: str
    page_url: str

    @property
    def raw_path(self) -> Path:
        return RAW_DIR / f"{self.slug}-latest.osm.pbf"

    @property
    def filtered_path(self) -> Path:
        return WORK_DIR / f"{self.slug}-major-roads.osm.pbf"

    @property
    def geojsonseq_path(self) -> Path:
        return WORK_DIR / f"{self.slug}-major-roads.geojsonseq"


COUNTRY_EXTRACTS = {
    "russia": CountryExtract(
        slug="russia",
        country_code="RU",
        country_name="Russia",
        pbf_url="https://download.geofabrik.de/russia-latest.osm.pbf",
        page_url="https://download.geofabrik.de/russia.html",
    ),
    "ukraine": CountryExtract(
        slug="ukraine",
        country_code="UA",
        country_name="Ukraine",
        pbf_url="https://download.geofabrik.de/europe/ukraine-latest.osm.pbf",
        page_url="https://download.geofabrik.de/europe/ukraine.html",
    ),
    "belarus": CountryExtract(
        slug="belarus",
        country_code="BY",
        country_name="Belarus",
        pbf_url="https://download.geofabrik.de/europe/belarus-latest.osm.pbf",
        page_url="https://download.geofabrik.de/europe/belarus.html",
    ),
}

FIELDNAMES = [
    "source_dataset",
    "layer",
    "feature_id",
    "feature_index",
    "name",
    "name_en",
    "description",
    "category",
    "subcategory",
    "transport_functions",
    "country_code",
    "country_source",
    "operator",
    "ref",
    "network",
    "status",
    "source_url",
    "source_file",
    "source_line_or_record_id",
    "extractor_version",
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
    "geometry_json",
    "raw_properties_json",
]


def fetch_source(extract: CountryExtract, force: bool = False) -> str:
    """Download a Geofabrik PBF, using If-Modified-Since when a cache exists."""
    extract.raw_path.parent.mkdir(parents=True, exist_ok=True)
    headers = {"User-Agent": "russianinfra-data-pipeline/1.0"}
    if extract.raw_path.exists() and not force:
        modified = email.utils.formatdate(extract.raw_path.stat().st_mtime, usegmt=True)
        headers["If-Modified-Since"] = modified

    request = urllib.request.Request(extract.pbf_url, headers=headers)
    temp_path = extract.raw_path.with_suffix(extract.raw_path.suffix + ".part")
    try:
        with urllib.request.urlopen(request, timeout=300) as response:
            with temp_path.open("wb") as handle:
                shutil.copyfileobj(response, handle, length=1024 * 1024)
            temp_path.replace(extract.raw_path)
            last_modified = response.headers.get("Last-Modified")
            if last_modified:
                timestamp = email.utils.parsedate_to_datetime(last_modified).timestamp()
                os.utime(extract.raw_path, (timestamp, timestamp))
    except HTTPError as exc:
        if exc.code == 304 and extract.raw_path.exists():
            return "not_modified"
        raise
    finally:
        if temp_path.exists():
            temp_path.unlink()
    return "downloaded"


def run_osmium_extract(
    extract: CountryExtract,
    highway_classes: list[str],
    osmium_bin: str = "osmium",
) -> None:
    if not extract.raw_path.exists():
        raise FileNotFoundError(f"Missing cached PBF: {extract.raw_path}")
    if shutil.which(osmium_bin) is None:
        raise FileNotFoundError(f"Missing osmium executable: {osmium_bin}")

    WORK_DIR.mkdir(parents=True, exist_ok=True)
    highway_filter = "w/highway=" + ",".join(highway_classes)
    subprocess.run(
        [
            osmium_bin,
            "tags-filter",
            str(extract.raw_path),
            highway_filter,
            "--output",
            str(extract.filtered_path),
            "--overwrite",
        ],
        check=True,
    )
    subprocess.run(
        [
            osmium_bin,
            "export",
            str(extract.filtered_path),
            "--output",
            str(extract.geojsonseq_path),
            "--output-format",
            "geojsonseq",
            "--overwrite",
        ],
        check=True,
    )


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
            for child in node:
                walk(child)

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
        points = [
            (float(point[0]), float(point[1]))
            for point in line
            if isinstance(point, list)
            and len(point) >= 2
            and isinstance(point[0], (int, float))
            and isinstance(point[1], (int, float))
        ]
        return sum(haversine_km(points[index - 1], points[index]) for index in range(1, len(points)))

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

    lons = [point[0] for point in positions]
    lats = [point[1] for point in positions]
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


def feature_properties(feature: dict[str, Any]) -> dict[str, Any]:
    props = feature.get("properties")
    return props if isinstance(props, dict) else {}


def feature_to_row(extract: CountryExtract, feature: dict[str, Any], index: int) -> dict[str, Any] | None:
    props = feature_properties(feature)
    geometry = feature.get("geometry") if isinstance(feature.get("geometry"), dict) else None
    highway = str(props.get("highway") or "").strip()
    if highway not in REGIONAL_HIGHWAY_CLASSES:
        return None
    if not geometry or geometry.get("type") not in {"LineString", "MultiLineString"}:
        return None
    osm_id = str(feature.get("id") or props.get("@id") or props.get("id") or f"{extract.slug}:{index}")
    name = str(props.get("name") or props.get("name:en") or props.get("ref") or "").strip()
    ref = str(props.get("ref") or "").strip()
    operator = str(props.get("operator") or "").strip()
    status = "construction" if highway == "construction" or props.get("construction") else ""
    description_parts = [
        f"OSM highway={highway}" if highway else "OSM road",
        f"ref={ref}" if ref else "",
        f"surface={props.get('surface')}" if props.get("surface") else "",
    ]

    row: dict[str, Any] = {
        "source_dataset": SOURCE_DATASET,
        "layer": "osm_major_roads",
        "feature_id": osm_id,
        "feature_index": str(index),
        "name": name,
        "name_en": str(props.get("name:en") or ""),
        "description": "; ".join(part for part in description_parts if part),
        "category": highway,
        "subcategory": highway,
        "transport_functions": "road",
        "country_code": extract.country_code,
        "country_source": "geofabrik_extract_boundary",
        "operator": operator,
        "ref": ref,
        "network": str(props.get("network") or ""),
        "status": status,
        "source_url": extract.pbf_url,
        "source_file": str(extract.raw_path),
        "source_line_or_record_id": str(index),
        "extractor_version": EXTRACTOR_VERSION,
        "raw_properties_json": json.dumps({"tags": props}, ensure_ascii=False, separators=(",", ":")),
    }
    row.update(geometry_summary(geometry))
    for key in [
        "highway",
        "name",
        "name:en",
        "ref",
        "network",
        "surface",
        "smoothness",
        "lanes",
        "maxspeed",
        "access",
        "motor_vehicle",
        "hgv",
        "bridge",
        "tunnel",
        "construction",
        "seasonal",
        "winter_road",
        "operator",
        "width",
    ]:
        if props.get(key) not in ("", None):
            row[f"properties_tags_{key}"] = props[key]
    return row


def iter_geojsonseq_rows(extract: CountryExtract) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    with extract.geojsonseq_path.open("r", encoding="utf-8-sig") as handle:
        for line_index, line in enumerate(handle, start=1):
            text = line.strip()
            if not text:
                continue
            if text.startswith("\x1e"):
                text = text[1:]
            feature = json.loads(text)
            if isinstance(feature, dict):
                row = feature_to_row(extract, feature, line_index)
                if row:
                    rows.append(row)
    return rows


def write_csv(rows: list[dict[str, Any]], path: Path = CSV_PATH) -> None:
    extras = sorted({key for row in rows for key in row} - set(FIELDNAMES))
    fieldnames = FIELDNAMES + extras
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def csv_has_data_rows(path: Path = CSV_PATH) -> bool:
    if not path.exists():
        return False
    with path.open("r", newline="", encoding="utf-8-sig") as handle:
        reader = csv.reader(handle)
        next(reader, None)
        return any(any(cell.strip() for cell in row) for row in reader)


def selected_extracts(country_slugs: list[str]) -> list[CountryExtract]:
    if not country_slugs:
        return list(COUNTRY_EXTRACTS.values())
    unknown = sorted(set(country_slugs) - set(COUNTRY_EXTRACTS))
    if unknown:
        raise ValueError(f"Unknown country slug(s): {', '.join(unknown)}")
    return [COUNTRY_EXTRACTS[slug] for slug in country_slugs]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--country",
        action="append",
        choices=sorted(COUNTRY_EXTRACTS),
        help="Country extract to process. Repeat to select multiple countries. Defaults to all configured countries.",
    )
    parser.add_argument("--refresh", action="store_true", help="Download or update the configured Geofabrik PBF files.")
    parser.add_argument("--force-download", action="store_true", help="Ignore local PBF timestamps when refreshing.")
    parser.add_argument("--osmium-bin", default="osmium", help="Path to the osmium executable.")
    parser.add_argument(
        "--road-profile",
        choices=["strategic", "regional"],
        default="strategic",
        help="Road detail profile. strategic keeps motorway/trunk/primary roads; regional also adds secondary and tertiary roads.",
    )
    parser.add_argument(
        "--highway-class",
        action="append",
        choices=REGIONAL_HIGHWAY_CLASSES,
        help="Highway class to extract. Repeat to override the selected road profile.",
    )
    parser.add_argument(
        "--allow-empty",
        action="store_true",
        help="Write an empty road CSV when extraction produces no rows. Without this, an empty extraction fails closed.",
    )
    args = parser.parse_args()

    extracts = selected_extracts(args.country or [])
    profile_classes = STRATEGIC_HIGHWAY_CLASSES if args.road_profile == "strategic" else REGIONAL_HIGHWAY_CLASSES
    highway_classes = args.highway_class or profile_classes
    rows: list[dict[str, Any]] = []
    counts: dict[str, int] = {}

    if args.refresh:
        for extract in extracts:
            try:
                status = fetch_source(extract, force=args.force_download)
                print(f"{extract.country_name}: {status} {extract.raw_path}")
            except (OSError, URLError, HTTPError, TimeoutError) as exc:
                print(f"Warning: failed to refresh {extract.country_name} OSM PBF: {exc}", file=sys.stderr)

    for extract in extracts:
        if not extract.raw_path.exists():
            print(f"Warning: missing {extract.raw_path}; skipping {extract.country_name} roads", file=sys.stderr)
            counts[extract.slug] = 0
            continue
        try:
            run_osmium_extract(extract, highway_classes, osmium_bin=args.osmium_bin)
            country_rows = iter_geojsonseq_rows(extract)
        except (OSError, subprocess.CalledProcessError, json.JSONDecodeError) as exc:
            print(f"Warning: failed to extract {extract.country_name} roads: {exc}", file=sys.stderr)
            country_rows = []
        counts[extract.slug] = len(country_rows)
        rows.extend(country_rows)

    if not rows and not args.allow_empty:
        if csv_has_data_rows(CSV_PATH):
            print(
                f"Warning: no Geofabrik OSM road records extracted; preserving existing non-empty {CSV_PATH}",
                file=sys.stderr,
            )
        else:
            print(
                "Error: no Geofabrik OSM road records extracted and no existing non-empty road CSV is available. "
                "Run with --refresh after installing osmium-tool, or pass --allow-empty for an intentional no-road build.",
                file=sys.stderr,
            )
            for slug, count in sorted(counts.items()):
                print(f"  {slug}: {count:,}", file=sys.stderr)
            return 1
    else:
        write_csv(rows)
        print(f"Wrote {len(rows):,} Geofabrik OSM road records to {CSV_PATH}")
    for slug, count in sorted(counts.items()):
        print(f"  {slug}: {count:,}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
