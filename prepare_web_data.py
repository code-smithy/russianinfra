#!/usr/bin/env python3
"""Prepare normalized infrastructure data for the static map app."""

from __future__ import annotations

import json
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any


NORMALIZED_GEOJSON = Path("data/normalized_infrastructure.geojson")
WEB_DATA_DIR = Path("web/data")
MAX_WEB_DATA_FILE_BYTES = 48_000_000


APP_PROPERTY_KEYS = [
    "uid",
    "source_dataset",
    "source_id",
    "source_record_id",
    "source_url",
    "source_capture_date",
    "source_layer",
    "source_reference_id",
    "source_name",
    "source_type",
    "source_reliability",
    "license_or_terms",
    "name",
    "description",
    "name_translated",
    "description_translated",
    "display_label",
    "asset_class",
    "asset_type",
    "asset_subtype",
    "domain",
    "operator",
    "product",
    "country",
    "countries",
    "source_country",
    "country_match_method",
    "region",
    "region_translated",
    "inn",
    "is_sanctioned",
    "is_mass_director",
    "is_mass_founder",
    "is_disqualified_persons",
    "geometry_type",
    "latitude",
    "longitude",
    "centroid_latitude",
    "centroid_longitude",
    "map_latitude",
    "map_longitude",
    "start_latitude",
    "start_longitude",
    "end_latitude",
    "end_longitude",
    "coordinate_count",
    "length_km",
    "has_point_location",
    "location_quality",
    "coordinate_precision",
    "entity_confidence",
    "freshness",
    "cross_source_support",
    "review_status",
    "confidence",
    "confidence_score",
    "selectable",
    "map_layer",
    "map_color",
    "map_icon",
    "risk_flags",
    "detected_language",
    "translation_source",
    "derived_subcategory",
    "derived_subcategory_label",
    "derived_subcategory_confidence",
    "derived_subcategory_reason",
    "possible_duplicate_group",
    "search_text",
    "references_json",
]

LAYER_LABELS = {
    "energy_oil": "Oil Pipelines",
    "energy_gas": "Gas Pipelines",
    "energy_facilities": "Oil/Gas Facilities",
    "power_lines": "HV Transmission Lines",
    "power_facilities": "Power Plants & Substations",
    "transport_rail": "Railway Lines",
    "transport_other": "Transport Structures",
    "military_industrial": "Military-Industrial Companies",
    "military_sites": "Military Sites",
    "military_boundaries": "Military Boundaries & Paths",
    "other_infrastructure": "Other Infrastructure",
    "unknown": "Unknown",
}


DEFAULT_VISIBLE = {
    "energy_facilities",
    "power_facilities",
    "military_industrial",
    "military_sites",
}


def compact_feature(feature: dict[str, Any]) -> dict[str, Any]:
    props = feature.get("properties") or {}
    app_props = {key: props.get(key, "") for key in APP_PROPERTY_KEYS}
    tags = props.get("tags")
    if isinstance(tags, dict) and tags:
        app_props["tags"] = tags
    references = props.get("references")
    if isinstance(references, list) and references:
        app_props["references"] = references
    return {
        "type": "Feature",
        "id": feature.get("id") or app_props.get("uid"),
        "geometry": feature.get("geometry"),
        "properties": app_props,
    }


def clean_web_data_dir() -> None:
    for pattern in ("*.geojson", "radius_index.tsv"):
        for path in WEB_DATA_DIR.glob(pattern):
            path.unlink()


def feature_json(feature: dict[str, Any]) -> str:
    return json.dumps(feature, ensure_ascii=False, separators=(",", ":"))


def write_geojson_items(path: Path, feature_items: list[str]) -> int:
    body = ",".join(feature_items)
    payload = f'{{"type":"FeatureCollection","features":[{body}]}}'
    path.write_text(payload, encoding="utf-8")
    return path.stat().st_size


def write_layer_files(layer: str, features: list[dict[str, Any]]) -> list[dict[str, Any]]:
    prefix_bytes = len(b'{"type":"FeatureCollection","features":[')
    suffix_bytes = len(b"]}")
    chunks: list[list[str]] = []
    current: list[str] = []
    current_bytes = prefix_bytes + suffix_bytes

    for feature in features:
        item = feature_json(feature)
        item_bytes = len(item.encode("utf-8"))
        separator_bytes = 1 if current else 0
        if current and current_bytes + separator_bytes + item_bytes > MAX_WEB_DATA_FILE_BYTES:
            chunks.append(current)
            current = []
            current_bytes = prefix_bytes + suffix_bytes
            separator_bytes = 0
        current.append(item)
        current_bytes += separator_bytes + item_bytes
    if current:
        chunks.append(current)

    if len(chunks) == 1:
        filename = f"{layer}.geojson"
        size = write_geojson_items(WEB_DATA_DIR / filename, chunks[0])
        return [{"file": filename, "size_bytes": size, "feature_count": len(chunks[0])}]

    files = []
    width = len(str(len(chunks)))
    for index, chunk in enumerate(chunks, start=1):
        filename = f"{layer}_part{index:0{max(3, width)}d}.geojson"
        size = write_geojson_items(WEB_DATA_DIR / filename, chunk)
        files.append({"file": filename, "size_bytes": size, "feature_count": len(chunk)})
    return files


def main() -> int:
    if not NORMALIZED_GEOJSON.exists():
        raise FileNotFoundError(f"Missing normalized GeoJSON: {NORMALIZED_GEOJSON}")

    WEB_DATA_DIR.mkdir(parents=True, exist_ok=True)
    clean_web_data_dir()
    data = json.loads(NORMALIZED_GEOJSON.read_text(encoding="utf-8"))
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    counts = Counter()
    geometry_counts = Counter()
    class_counts = Counter()
    country_counts = Counter()
    country_point_counts = Counter()
    source_counts = Counter()
    confidence_counts = Counter()
    coordinate_precision_counts = Counter()
    missing = 0

    for feature in data.get("features", []):
        props = feature.get("properties") or {}
        layer = props.get("map_layer") or "unknown"
        compact = compact_feature(feature)
        grouped[layer].append(compact)
        props = compact.get("properties") or {}
        counts[layer] += 1
        class_counts[props.get("asset_class") or "unknown"] += 1
        source_counts[props.get("source_id") or props.get("source_dataset") or "unknown"] += 1
        confidence_counts[props.get("confidence") or "unknown"] += 1
        coordinate_precision_counts[props.get("coordinate_precision") or props.get("location_quality") or "unknown"] += 1
        countries = props.get("countries")
        if not isinstance(countries, list) or not countries:
            countries = [(props.get("country") or "Unknown").strip() or "Unknown"]
        for country in countries:
            country_counts[country] += 1
        geometry = feature.get("geometry")
        geometry_type = (geometry or {}).get("type") or "missing"
        geometry_counts[geometry_type] += 1
        if geometry_type == "Point":
            for country in countries:
                country_point_counts[country] += 1
        if geometry is None:
            missing += 1

    manifest_layers = []
    for layer, features in sorted(grouped.items()):
        layer_files = write_layer_files(layer, features)
        point_count = sum(1 for f in features if (f.get("geometry") or {}).get("type") == "Point")
        line_count = sum(1 for f in features if (f.get("geometry") or {}).get("type") in {"LineString", "MultiLineString"})
        subcategory_counts = Counter(
            (f.get("properties") or {}).get("derived_subcategory") or (f.get("properties") or {}).get("asset_type") or "uncategorized"
            for f in features
        )
        subcategory_labels = {}
        for f in features:
            props = f.get("properties") or {}
            key = props.get("derived_subcategory") or props.get("asset_type") or "uncategorized"
            subcategory_labels.setdefault(key, props.get("derived_subcategory_label") or key.replace("_", " ").title())
        manifest_layers.append(
            {
                "id": layer,
                "label": LAYER_LABELS.get(layer, layer.replace("_", " ").title()),
                "file": layer_files[0]["file"],
                "files": [item["file"] for item in layer_files],
                "file_details": layer_files,
                "count": len(features),
                "point_count": point_count,
                "line_count": line_count,
                "subcategories": [
                    {
                        "id": key,
                        "label": subcategory_labels.get(key, key.replace("_", " ").title()),
                        "count": count,
                    }
                    for key, count in sorted(subcategory_counts.items(), key=lambda item: (-item[1], item[0]))
                ],
                "default_visible": layer in DEFAULT_VISIBLE,
            }
        )

    manifest = {
        "generated_from": str(NORMALIZED_GEOJSON),
        "total_features": sum(counts.values()),
        "missing_geometry_count": missing,
        "geometry_counts": dict(sorted(geometry_counts.items())),
        "asset_class_counts": dict(sorted(class_counts.items())),
        "source_counts": dict(sorted(source_counts.items())),
        "confidence_counts": dict(sorted(confidence_counts.items())),
        "coordinate_precision_counts": dict(sorted(coordinate_precision_counts.items())),
        "countries": [
            {
                "id": country,
                "label": country,
                "count": count,
                "point_count": country_point_counts.get(country, 0),
            }
            for country, count in sorted(country_counts.items(), key=lambda item: (-item[1], item[0]))
        ],
        "layers": manifest_layers,
    }
    (WEB_DATA_DIR / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")

    output_files = [path for path in WEB_DATA_DIR.iterdir() if path.is_file()]
    oversized = [path for path in output_files if path.stat().st_size > 50_000_000]
    if oversized:
        details = ", ".join(f"{path.name} ({path.stat().st_size:,} bytes)" for path in oversized)
        raise RuntimeError(f"Web data files exceed 50 MB: {details}")

    print(f"Wrote {sum(len(layer['files']) for layer in manifest_layers)} layer files to {WEB_DATA_DIR}")
    print(f"Total features: {manifest['total_features']:,}")
    print(f"Largest web data file: {max(path.stat().st_size for path in output_files):,} bytes")
    return 0


if __name__ == "__main__":
    sys.exit(main())
