#!/usr/bin/env python3
"""Prepare normalized infrastructure data for the static map app."""

from __future__ import annotations

import json
import csv
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any


NORMALIZED_GEOJSON = Path("data/normalized_infrastructure.geojson")
WEB_DATA_DIR = Path("web/data")


APP_PROPERTY_KEYS = [
    "uid",
    "source_dataset",
    "source_record_id",
    "source_url",
    "source_capture_date",
    "source_layer",
    "name",
    "display_label",
    "asset_class",
    "asset_type",
    "asset_subtype",
    "domain",
    "operator",
    "product",
    "country",
    "region",
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
    "selectable",
    "map_layer",
    "map_color",
    "map_icon",
    "risk_flags",
    "possible_duplicate_group",
    "search_text",
]

RADIUS_PROPERTY_KEYS = [
    "uid",
    "source_dataset",
    "source_record_id",
    "source_url",
    "source_capture_date",
    "source_layer",
    "name",
    "display_label",
    "asset_class",
    "asset_type",
    "asset_subtype",
    "domain",
    "operator",
    "product",
    "region",
    "inn",
    "is_sanctioned",
    "is_mass_director",
    "is_mass_founder",
    "is_disqualified_persons",
    "map_latitude",
    "map_longitude",
    "location_quality",
    "map_color",
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
    "other_infrastructure": "Other Infrastructure",
    "unknown": "Unknown",
}


DEFAULT_VISIBLE = {
    "energy_facilities",
    "power_facilities",
    "military_industrial",
}


def compact_feature(feature: dict[str, Any]) -> dict[str, Any]:
    props = feature.get("properties") or {}
    app_props = {key: props.get(key, "") for key in APP_PROPERTY_KEYS}
    tags = props.get("tags")
    if isinstance(tags, dict) and tags:
        app_props["tags"] = tags
    return {
        "type": "Feature",
        "id": feature.get("id") or app_props.get("uid"),
        "geometry": feature.get("geometry"),
        "properties": app_props,
    }


def write_geojson(path: Path, features: list[dict[str, Any]]) -> None:
    payload = {"type": "FeatureCollection", "features": features}
    path.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def write_radius_index(path: Path, features: list[dict[str, Any]]) -> None:
    fields = ["id", *RADIUS_PROPERTY_KEYS]
    def clean(value: Any) -> str:
        return str(value or "").replace("\t", " ").replace("\r", " ").replace("\n", " ")

    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, delimiter="\t", lineterminator="\n")
        writer.writeheader()
        for feature in features:
            props = feature.get("properties") or {}
            row = {"id": clean(feature.get("id") or props.get("uid") or "")}
            row.update({key: clean(props.get(key, "")) for key in RADIUS_PROPERTY_KEYS})
            writer.writerow(row)


def main() -> int:
    if not NORMALIZED_GEOJSON.exists():
        raise FileNotFoundError(f"Missing normalized GeoJSON: {NORMALIZED_GEOJSON}")

    WEB_DATA_DIR.mkdir(parents=True, exist_ok=True)
    data = json.loads(NORMALIZED_GEOJSON.read_text(encoding="utf-8"))
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    radius_features: list[dict[str, Any]] = []
    counts = Counter()
    geometry_counts = Counter()
    class_counts = Counter()
    missing = 0

    for feature in data.get("features", []):
        props = feature.get("properties") or {}
        layer = props.get("map_layer") or "unknown"
        compact = compact_feature(feature)
        grouped[layer].append(compact)
        props = compact.get("properties") or {}
        try:
            map_lat = float(props.get("map_latitude") or "")
            map_lon = float(props.get("map_longitude") or "")
        except ValueError:
            map_lat = None
            map_lon = None
        if map_lat is not None and map_lon is not None:
            radius_features.append(
                {
                    "type": "Feature",
                    "id": compact.get("id"),
                    "geometry": {"type": "Point", "coordinates": [map_lon, map_lat]},
                    "properties": {key: props.get(key, "") for key in RADIUS_PROPERTY_KEYS},
                }
            )
        counts[layer] += 1
        class_counts[props.get("asset_class") or "unknown"] += 1
        geometry = feature.get("geometry")
        geometry_counts[(geometry or {}).get("type") or "missing"] += 1
        if geometry is None:
            missing += 1

    manifest_layers = []
    for layer, features in sorted(grouped.items()):
        filename = f"{layer}.geojson"
        path = WEB_DATA_DIR / filename
        write_geojson(path, features)
        point_count = sum(1 for f in features if (f.get("geometry") or {}).get("type") == "Point")
        line_count = sum(1 for f in features if (f.get("geometry") or {}).get("type") in {"LineString", "MultiLineString"})
        manifest_layers.append(
            {
                "id": layer,
                "label": LAYER_LABELS.get(layer, layer.replace("_", " ").title()),
                "file": filename,
                "count": len(features),
                "point_count": point_count,
                "line_count": line_count,
                "default_visible": layer in DEFAULT_VISIBLE,
            }
        )

    manifest = {
        "generated_from": str(NORMALIZED_GEOJSON),
        "total_features": sum(counts.values()),
        "missing_geometry_count": missing,
        "geometry_counts": dict(sorted(geometry_counts.items())),
        "asset_class_counts": dict(sorted(class_counts.items())),
        "layers": manifest_layers,
    }
    (WEB_DATA_DIR / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    write_radius_index(WEB_DATA_DIR / "radius_index.tsv", radius_features)
    old_radius_geojson = WEB_DATA_DIR / "radius_index.geojson"
    if old_radius_geojson.exists():
        old_radius_geojson.unlink()

    print(f"Wrote {len(manifest_layers)} layer files to {WEB_DATA_DIR}")
    print(f"Wrote {len(radius_features):,} radius index features")
    print(f"Total features: {manifest['total_features']:,}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
