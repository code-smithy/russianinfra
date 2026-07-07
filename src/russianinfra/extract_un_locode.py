#!/usr/bin/env python3
"""Extract transport-relevant UN/LOCODE records for the local pipeline."""

from __future__ import annotations

import argparse
import csv
import json
import re
import sys
import urllib.request
from pathlib import Path
from urllib.error import URLError


RAW_CSV = Path("data/raw/un_locode/code-list.csv")
EXTRACTED_CSV = Path("data/extracted/un_locode_locations.csv")
SOURCE_URL = "https://raw.githubusercontent.com/datasets/un-locode/main/data/code-list.csv"
SOURCE_DATASET = "UN/LOCODE Codelist"
LAYER = "un_locode_transport"
EXTRACTOR_VERSION = "un_locode_1"

DEFAULT_UN_LOCODE_COUNTRIES = {
    "RU",
    "BY",
    "UA",
    "GE",
    "AZ",
    "KZ",
    "LT",
    "LV",
    "EE",
    "FI",
    "NO",
    "PL",
    "TR",
    "CN",
    "IR",
    "RO",
    "BG",
    "MD",
    "AM",
}

SUPPORTED_UN_LOCODE_FUNCTIONS = {
    "1": "seaport",
    "2": "rail_terminal",
    "3": "road_terminal",
    "4": "airport",
    "6": "inland_clearance_depot",
    "7": "fixed_transport_terminal",
    "8": "inland_port",
    "B": "border_crossing",
}

PRIMARY_SUBCATEGORY_PRIORITY = [
    "seaport",
    "inland_port",
    "inland_clearance_depot",
    "rail_terminal",
    "road_terminal",
    "border_crossing",
    "airport",
    "fixed_transport_terminal",
]

FIELDNAMES = [
    "object_id",
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
    "subdivision",
    "asset_class",
    "status",
    "un_locode",
    "locode_country",
    "locode_location",
    "iata",
    "remarks",
    "source_date",
    "coordinate_precision",
    "coordinate_source",
    "confidence_grade",
    "review_status",
    "longitude",
    "latitude",
    "geometry_type",
    "coordinate_count",
    "source_url",
    "source_file",
    "source_line_or_record_id",
    "extractor_version",
    "raw_item_json",
]

COORDINATE_RE = re.compile(r"^\s*(\d{2})(\d{2})([NS])\s+(\d{3})(\d{2})([EW])\s*$", re.I)


def parse_un_locode_coordinates(value: str) -> tuple[float, float] | None:
    """Parse compact UN/LOCODE coordinates into ``(longitude, latitude)``."""
    match = COORDINATE_RE.match(value or "")
    if not match:
        return None

    lat_degrees, lat_minutes, lat_hemi, lon_degrees, lon_minutes, lon_hemi = match.groups()
    lat = int(lat_degrees) + int(lat_minutes) / 60
    lon = int(lon_degrees) + int(lon_minutes) / 60
    if int(lat_minutes) >= 60 or int(lon_minutes) >= 60 or lat > 90 or lon > 180:
        return None
    if lat_hemi.upper() == "S":
        lat = -lat
    if lon_hemi.upper() == "W":
        lon = -lon
    return lon, lat


def classify_un_locode_functions(function_value: str) -> list[str]:
    """Map UN/LOCODE function codes to supported transport subcategories."""
    found: list[str] = []
    for char in str(function_value or "").upper():
        subcategory = SUPPORTED_UN_LOCODE_FUNCTIONS.get(char)
        if subcategory and subcategory not in found:
            found.append(subcategory)
    return found


def primary_subcategory(functions: list[str]) -> str:
    for subcategory in PRIMARY_SUBCATEGORY_PRIORITY:
        if subcategory in functions:
            return subcategory
    return functions[0] if functions else ""


def normalize_raw_row(row: dict[str, str], row_index: int, source_file: Path) -> dict[str, str] | None:
    country = (row.get("Country") or "").strip().upper()
    if country not in DEFAULT_UN_LOCODE_COUNTRIES:
        return None

    transport_functions = classify_un_locode_functions(row.get("Function", ""))
    if not transport_functions:
        return None

    coordinates = parse_un_locode_coordinates(row.get("Coordinates", ""))
    if coordinates is None:
        return None
    lon, lat = coordinates

    location = (row.get("Location") or "").strip().upper()
    if not country or not location:
        return None

    locode = f"{country} {location}"
    source_record_id = f"un_locode:{country}{location}"
    name = (row.get("NameWoDiacritics") or row.get("Name") or "").strip()
    original_name = (row.get("Name") or "").strip()
    if original_name and original_name != name:
        description = f"UN/LOCODE name: {original_name}"
    else:
        description = ""

    return {
        "source_dataset": SOURCE_DATASET,
        "layer": LAYER,
        "feature_id": source_record_id,
        "feature_index": str(row_index - 1),
        "name": name or original_name or locode,
        "name_en": name or original_name or locode,
        "description": description,
        "category": "transport",
        "subcategory": primary_subcategory(transport_functions),
        "transport_functions": ",".join(transport_functions),
        "country_code": country,
        "country_source": "un_locode",
        "subdivision": (row.get("Subdivision") or "").strip(),
        "asset_class": "transport",
        "status": (row.get("Status") or "").strip(),
        "un_locode": locode,
        "locode_country": country,
        "locode_location": location,
        "iata": (row.get("IATA") or "").strip(),
        "remarks": (row.get("Remarks") or "").strip(),
        "source_date": (row.get("Date") or "").strip(),
        "coordinate_precision": "location_centroid",
        "coordinate_source": "un_locode",
        "confidence_grade": "B",
        "review_status": "unreviewed",
        "longitude": f"{lon:.8f}",
        "latitude": f"{lat:.8f}",
        "geometry_type": "Point",
        "coordinate_count": "1",
        "source_url": "https://github.com/datasets/un-locode",
        "source_file": str(source_file),
        "source_line_or_record_id": str(row_index),
        "extractor_version": EXTRACTOR_VERSION,
        "raw_item_json": json.dumps(row, ensure_ascii=False, separators=(",", ":")),
    }


def iter_un_locode_records(path: Path = RAW_CSV) -> list[dict[str, str]]:
    with path.open("r", newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        records = []
        seen: dict[str, int] = {}
        for row_index, row in enumerate(reader, start=2):
            record = normalize_raw_row(row, row_index, path)
            if record:
                base_id = record["feature_id"]
                seen[base_id] = seen.get(base_id, 0) + 1
                suffix = "" if seen[base_id] == 1 else f"_{seen[base_id]}"
                if suffix:
                    record["feature_id"] = f"{base_id}:{seen[base_id]}"
                record["object_id"] = f"un_locode_{record['locode_country']}_{record['locode_location']}{suffix}"
                records.append(record)
        return records


def fetch_source(path: Path = RAW_CSV) -> None:
    request = urllib.request.Request(SOURCE_URL, headers={"User-Agent": "russianinfra-data-pipeline/1.0"})
    with urllib.request.urlopen(request, timeout=120) as response:
        data = response.read()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)


def write_un_locode_extracted_csv(records: list[dict[str, str]], path: Path = EXTRACTED_CSV) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDNAMES, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(records)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=RAW_CSV)
    parser.add_argument("--output", type=Path, default=EXTRACTED_CSV)
    parser.add_argument("--refresh", action="store_true", help="Refresh the cached UN/LOCODE CSV before extraction.")
    args = parser.parse_args()

    if args.refresh:
        try:
            fetch_source(args.input)
            print(f"Downloaded UN/LOCODE source to {args.input}")
        except (OSError, URLError, TimeoutError, RuntimeError) as exc:
            if args.input.exists():
                print(f"Warning: UN/LOCODE refresh failed; using cached {args.input}: {exc}", file=sys.stderr)
            else:
                print(f"Warning: UN/LOCODE refresh failed and no cached source exists; skipping source: {exc}", file=sys.stderr)

    if not args.input.exists():
        write_un_locode_extracted_csv([], args.output)
        print(f"Warning: missing UN/LOCODE source {args.input}; wrote empty {args.output}", file=sys.stderr)
        return 0

    records = iter_un_locode_records(args.input)
    write_un_locode_extracted_csv(records, args.output)
    print(f"Wrote {len(records):,} UN/LOCODE transport records to {args.output}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
