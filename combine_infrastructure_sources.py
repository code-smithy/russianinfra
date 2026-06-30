#!/usr/bin/env python3
"""Combine extracted infrastructure/map CSV sources into one wide CSV."""

from __future__ import annotations

import csv
import sys
from pathlib import Path


OUT_DIR = Path("data")
RUSSIA_OIL_POWER_CSV = OUT_DIR / "russia_oil_power_infrastructure.csv"
OSINT_VARTA_CSV = OUT_DIR / "osint_varta_map_points_archived.csv"
NIGHTWATCH_CSV = OUT_DIR / "nightwatch_map.csv"
COMBINED_CSV = OUT_DIR / "combined_infrastructure_sources.csv"


SOURCES = [
    (RUSSIA_OIL_POWER_CSV, "Russia Oil & Power Infrastructure Map"),
    (OSINT_VARTA_CSV, "OSINT Varta archived map points"),
    (NIGHTWATCH_CSV, "Nightwatch map"),
]


def read_rows(path: Path, source_dataset: str) -> list[dict[str, str]]:
    with path.open("r", newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        rows = []
        for row_index, row in enumerate(reader, start=2):
            row.setdefault("source_dataset", source_dataset)
            if not row["source_dataset"]:
                row["source_dataset"] = source_dataset
            row.setdefault("source_file", str(path))
            if not row["source_file"]:
                row["source_file"] = str(path)
            row.setdefault("source_line_or_record_id", str(row_index))
            if not row["source_line_or_record_id"]:
                row["source_line_or_record_id"] = str(row_index)
            rows.append(row)
        return rows


def main() -> int:
    all_rows: list[dict[str, str]] = []
    counts: dict[str, int] = {}
    for path, source_dataset in SOURCES:
        if not path.exists():
            raise FileNotFoundError(f"Missing input CSV: {path}")
        rows = read_rows(path, source_dataset)
        counts[source_dataset] = len(rows)
        all_rows.extend(rows)

    preferred = [
        "source_dataset",
        "layer",
        "feature_id",
        "feature_index",
        "name",
        "category",
        "description",
        "operator",
        "product",
        "inn",
        "region",
        "longitude",
        "latitude",
        "centroid_longitude",
        "centroid_latitude",
        "geometry_type",
        "coordinate_count",
        "length_km",
        "is_sanctioned",
        "is_mass_director",
        "is_mass_founder",
        "is_disqualified_persons",
        "source_url",
        "source_file",
        "source_line_or_record_id",
        "archive_timestamp",
        "kml_type",
        "kml_folder",
        "kml_color",
        "kml_width",
        "kml_symbol",
        "military_unit",
    ]
    raw_fieldnames = preferred + sorted({key for row in all_rows for key in row} - set(preferred))
    fieldnames: list[str] = []
    output_to_input: dict[str, str] = {}
    seen_lower: dict[str, int] = {}
    for key in raw_fieldnames:
        lower = key.casefold()
        count = seen_lower.get(lower, 0)
        output_key = key if count == 0 else f"{key}__{count + 1}"
        while output_key.casefold() in seen_lower:
            count += 1
            output_key = f"{key}__{count + 1}"
        seen_lower[output_key.casefold()] = 1
        seen_lower[lower] = count + 1
        fieldnames.append(output_key)
        output_to_input[output_key] = key

    COMBINED_CSV.parent.mkdir(parents=True, exist_ok=True)
    with COMBINED_CSV.open("w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        for row in all_rows:
            writer.writerow({output_key: row.get(input_key, "") for output_key, input_key in output_to_input.items()})

    print(f"Wrote {len(all_rows):,} combined rows to {COMBINED_CSV}")
    for source, count in counts.items():
        print(f"  {source}: {count:,}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
