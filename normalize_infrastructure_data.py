#!/usr/bin/env python3
"""Normalize extracted infrastructure datasets for analysis and mapping."""

from __future__ import annotations

import csv
import hashlib
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any


OUT_DIR = Path("data")
COMBINED_CSV = OUT_DIR / "combined_infrastructure_sources.csv"
NORMALIZED_CSV = OUT_DIR / "normalized_infrastructure.csv"
NORMALIZED_GEOJSON = OUT_DIR / "normalized_infrastructure.geojson"
REPORT_JSON = OUT_DIR / "normalization_report.json"


CSV_FIELDS = [
    "uid",
    "source_dataset",
    "source_record_id",
    "source_url",
    "source_capture_date",
    "source_layer",
    "source_feature_index",
    "name",
    "name_original",
    "description",
    "display_label",
    "asset_class",
    "asset_type",
    "asset_subtype",
    "domain",
    "operator",
    "product",
    "country",
    "region",
    "locality",
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
    "bbox_min_latitude",
    "bbox_min_longitude",
    "bbox_max_latitude",
    "bbox_max_longitude",
    "coordinate_count",
    "length_km",
    "has_point_location",
    "location_quality",
    "selectable",
    "map_layer",
    "map_color",
    "map_icon",
    "risk_flags",
    "dedupe_key",
    "possible_duplicate_group",
    "search_text",
    "tags_json",
    "geometry_json",
    "raw_json",
]


SOURCE_RUSSIA = "Russia Oil & Power Infrastructure Map"
SOURCE_VARTA = "OSINT Varta"
SOURCE_MILITARY_KML = "Military KML text archive"


def value(row: dict[str, str], key: str) -> str:
    return (row.get(key) or "").strip()


def parse_float(raw: Any) -> float | None:
    if raw in ("", None):
        return None
    try:
        return float(raw)
    except (TypeError, ValueError):
        return None


def parse_bool(raw: Any) -> bool | None:
    if isinstance(raw, bool):
        return raw
    if raw in ("", None):
        return None
    text = str(raw).strip().casefold()
    if text in {"true", "1", "yes", "y"}:
        return True
    if text in {"false", "0", "no", "n"}:
        return False
    return None


def csv_bool(raw: Any) -> str:
    parsed = parse_bool(raw)
    if parsed is None:
        return ""
    return "true" if parsed else "false"


def json_loads_maybe(raw: str) -> Any:
    if not raw:
        return None
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return raw


def stable_uid(parts: list[str]) -> str:
    digest = hashlib.sha256("|".join(parts).encode("utf-8", errors="replace")).hexdigest()
    return f"infra_{digest[:16]}"


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


def geometry_from_row(row: dict[str, str]) -> dict[str, Any] | None:
    geometry = json_loads_maybe(value(row, "geometry_json"))
    if isinstance(geometry, dict) and geometry.get("type"):
        return geometry

    lon = parse_float(value(row, "longitude"))
    lat = parse_float(value(row, "latitude"))
    if lon is not None and lat is not None:
        return {"type": "Point", "coordinates": [lon, lat]}
    return None


def first_nonempty(*items: Any) -> str:
    for item in items:
        if item is None:
            continue
        text = str(item).strip()
        if text:
            return text
    return ""


def lower_blob(*items: Any) -> str:
    return " ".join(str(item or "") for item in items).casefold()


def classify(row: dict[str, str]) -> tuple[str, str, str, str]:
    layer = value(row, "layer")
    category = value(row, "category").casefold()
    name = value(row, "name")
    product = value(row, "product")
    line_type = value(row, "properties_line_type").casefold()
    power_tag = value(row, "properties_tags_power").casefold()
    blob = lower_blob(layer, category, name, product, line_type, power_tag)

    if value(row, "source_dataset") == SOURCE_VARTA:
        return "military_industrial", "company", "defense_industrial_company", "military"
    if value(row, "source_dataset") == SOURCE_MILITARY_KML:
        if layer == "military_kml_paths":
            if "boundary" in category:
                return "military", "military_boundary", category, "military"
            return "military", "military_path", category, "military"
        return "military", "military_site", category or "military_site", "military"

    if layer == "gas_pipelines":
        return "energy", "gas_pipeline", "pipeline", "gas"
    if layer == "pipelines":
        return "energy", "oil_pipeline", "pipeline", "oil"
    if layer == "refineries" or category == "refinery":
        return "energy", "refinery", "", "oil"
    if layer == "pump_stations" or category == "pumping_station":
        return "energy", "pump_station", "", "oil"
    if category == "pipeline_facility":
        return "energy", "pipeline_facility", "", "oil"
    if category == "gas_pipeline_facility":
        return "energy", "gas_pipeline_facility", "", "gas"
    if layer == "power_hv_lines":
        return "power", "hv_line", "transmission_line", "electricity"
    if layer == "railway_lines":
        return "transport", "railway", "", "rail"
    if "substation" in blob:
        return "power", "substation", "", "electricity"
    if category == "power_station" or "power station" in blob or "power plant" in blob:
        return "power", "power_station", "", "electricity"
    if layer == "custom_lines" and (line_type == "electric" or power_tag == "line"):
        return "power", "hv_line", "custom_line", "electricity"
    if "bridge" in blob:
        return "transport", "bridge", "", "transport"
    if layer == "custom_lines":
        return "other_infrastructure", "custom_line", line_type or "", "other"
    if layer == "custom_pins":
        return "other_infrastructure", "other", category or "", "other"
    return "unknown", "unknown", category or "", "unknown"


def marker_style(asset_class: str, asset_type: str) -> tuple[str, str, str]:
    styles = {
        "oil_pipeline": ("energy_oil", "#993d1f", "line-pipeline"),
        "gas_pipeline": ("energy_gas", "#e07b39", "line-pipeline"),
        "refinery": ("energy_facilities", "#d62728", "factory"),
        "pump_station": ("energy_facilities", "#d62728", "pump"),
        "pipeline_facility": ("energy_facilities", "#d62728", "storage"),
        "gas_pipeline_facility": ("energy_facilities", "#e07b39", "storage"),
        "power_station": ("power_facilities", "#d4a600", "zap"),
        "substation": ("power_facilities", "#ffd200", "grid"),
        "hv_line": ("power_lines", "#ffd200", "line-power"),
        "railway": ("transport_rail", "#8a8a8a", "rail"),
        "bridge": ("transport_other", "#2a93d5", "bridge"),
        "company": ("military_industrial", "#4f7cff", "building"),
        "military_site": ("military_sites", "#d4472f", "shield"),
        "military_boundary": ("military_boundaries", "#ff6b4a", "line"),
        "military_path": ("military_boundaries", "#ff6b4a", "line"),
    }
    if asset_type in styles:
        return styles[asset_type]
    fallback = {
        "energy": ("energy_other", "#b84a2a", "circle"),
        "power": ("power_other", "#d4a600", "circle"),
        "transport": ("transport_other", "#777777", "circle"),
        "military_industrial": ("military_industrial", "#4f7cff", "building"),
        "military": ("military_sites", "#d4472f", "shield"),
        "other_infrastructure": ("other_infrastructure", "#2a93d5", "circle"),
    }
    return fallback.get(asset_class, ("unknown", "#999999", "circle"))


def compact_json(value_to_dump: Any) -> str:
    if value_to_dump in ("", None):
        return ""
    return json.dumps(value_to_dump, ensure_ascii=False, separators=(",", ":"))


def derive_location(row: dict[str, str], geometry: dict[str, Any] | None) -> dict[str, str]:
    geometry_type = geometry.get("type") if geometry else value(row, "geometry_type")
    lon = parse_float(value(row, "longitude"))
    lat = parse_float(value(row, "latitude"))
    centroid_lon = parse_float(value(row, "centroid_longitude"))
    centroid_lat = parse_float(value(row, "centroid_latitude"))

    positions = iter_positions(geometry)
    if geometry and positions and (centroid_lon is None or centroid_lat is None):
        centroid_lon = sum(p[0] for p in positions) / len(positions)
        centroid_lat = sum(p[1] for p in positions) / len(positions)

    map_lon: float | None = None
    map_lat: float | None = None
    location_quality = "missing"
    if geometry_type == "Point" and lon is not None and lat is not None:
        map_lon, map_lat = lon, lat
        location_quality = "exact"
    elif geometry_type in {"LineString", "MultiLineString"} and centroid_lon is not None and centroid_lat is not None:
        map_lon, map_lat = centroid_lon, centroid_lat
        location_quality = "line_centroid"
    elif geometry_type in {"Polygon", "MultiPolygon"} and centroid_lon is not None and centroid_lat is not None:
        map_lon, map_lat = centroid_lon, centroid_lat
        location_quality = "polygon_centroid"
    elif centroid_lon is not None and centroid_lat is not None:
        map_lon, map_lat = centroid_lon, centroid_lat
        location_quality = "centroid"

    return {
        "geometry_type": geometry_type or "",
        "latitude": "" if lat is None else f"{lat:.8f}",
        "longitude": "" if lon is None else f"{lon:.8f}",
        "centroid_latitude": "" if centroid_lat is None else f"{centroid_lat:.8f}",
        "centroid_longitude": "" if centroid_lon is None else f"{centroid_lon:.8f}",
        "map_latitude": "" if map_lat is None else f"{map_lat:.8f}",
        "map_longitude": "" if map_lon is None else f"{map_lon:.8f}",
        "start_latitude": value(row, "start_latitude"),
        "start_longitude": value(row, "start_longitude"),
        "end_latitude": value(row, "end_latitude"),
        "end_longitude": value(row, "end_longitude"),
        "bbox_min_latitude": value(row, "bbox_min_latitude"),
        "bbox_min_longitude": value(row, "bbox_min_longitude"),
        "bbox_max_latitude": value(row, "bbox_max_latitude"),
        "bbox_max_longitude": value(row, "bbox_max_longitude"),
        "coordinate_count": value(row, "coordinate_count") or str(len(positions) if positions else ""),
        "length_km": value(row, "length_km"),
        "has_point_location": "true" if map_lat is not None and map_lon is not None else "false",
        "location_quality": location_quality,
    }


def extract_tags(row: dict[str, str]) -> dict[str, str]:
    raw_props = json_loads_maybe(value(row, "raw_properties_json"))
    if isinstance(raw_props, dict) and isinstance(raw_props.get("tags"), dict):
        return raw_props["tags"]

    tags = {}
    for key, val in row.items():
        if key.startswith("properties_tags_") and val not in ("", None):
            tags[key.removeprefix("properties_tags_")] = val
    return tags


def raw_payload(row: dict[str, str], tags: dict[str, str]) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "source_dataset": value(row, "source_dataset"),
        "source_layer": value(row, "layer"),
    }
    raw_item = json_loads_maybe(value(row, "raw_item_json"))
    raw_props = json_loads_maybe(value(row, "raw_properties_json"))
    if raw_item:
        payload["item"] = raw_item
    if raw_props:
        payload["properties"] = raw_props
    if tags:
        payload["tags"] = tags
    return payload


def normalize_row(row: dict[str, str]) -> tuple[dict[str, str], dict[str, Any]]:
    source_dataset = value(row, "source_dataset")
    layer = value(row, "layer")
    feature_id = value(row, "feature_id")
    feature_index = value(row, "feature_index")
    source_record_id = first_nonempty(feature_id, value(row, "osm_id"), f"{layer}:{feature_index}")

    asset_class, asset_type, asset_subtype, domain = classify(row)
    map_layer, map_color, map_icon = marker_style(asset_class, asset_type)
    geometry = geometry_from_row(row)
    location = derive_location(row, geometry)
    tags = extract_tags(row)

    name_original = value(row, "name")
    description = value(row, "description")
    operator = value(row, "operator")
    product = value(row, "product")
    inn = value(row, "inn")
    region = value(row, "region")
    display_label = first_nonempty(name_original, operator, inn, f"{asset_type}:{source_record_id}")

    risk_flags: list[str] = []
    for key, label in [
        ("is_sanctioned", "sanctioned"),
        ("is_mass_director", "mass_director"),
        ("is_mass_founder", "mass_founder"),
        ("is_disqualified_persons", "disqualified_persons"),
    ]:
        if parse_bool(value(row, key)):
            risk_flags.append(label)

    rounded_lat = ""
    rounded_lon = ""
    if location["map_latitude"] and location["map_longitude"]:
        rounded_lat = f"{round(float(location['map_latitude']), 4):.4f}"
        rounded_lon = f"{round(float(location['map_longitude']), 4):.4f}"
    normalized_name = " ".join(display_label.casefold().split())
    dedupe_key = "|".join([asset_type, normalized_name, rounded_lat, rounded_lon])

    uid = stable_uid([source_dataset, layer, source_record_id, feature_index, location["map_latitude"], location["map_longitude"]])
    search_text = " ".join(
        part
        for part in [
            display_label,
            name_original,
            description,
            asset_class,
            asset_type,
            asset_subtype,
            domain,
            operator,
            product,
            inn,
            region,
            source_dataset,
            layer,
        ]
        if part
    )

    normalized = {
        "uid": uid,
        "source_dataset": source_dataset,
        "source_record_id": source_record_id,
        "source_url": value(row, "source_url"),
        "source_capture_date": value(row, "archive_timestamp"),
        "source_layer": layer,
        "source_feature_index": feature_index,
        "name": display_label,
        "name_original": name_original,
        "description": description,
        "display_label": display_label,
        "asset_class": asset_class,
        "asset_type": asset_type,
        "asset_subtype": asset_subtype,
        "domain": domain,
        "operator": operator,
        "product": product,
        "country": "Russia",
        "region": region,
        "locality": "",
        "inn": inn,
        "is_sanctioned": csv_bool(value(row, "is_sanctioned")),
        "is_mass_director": csv_bool(value(row, "is_mass_director")),
        "is_mass_founder": csv_bool(value(row, "is_mass_founder")),
        "is_disqualified_persons": csv_bool(value(row, "is_disqualified_persons")),
        **location,
        "selectable": "true" if location["has_point_location"] == "true" else "false",
        "map_layer": map_layer,
        "map_color": map_color,
        "map_icon": map_icon,
        "risk_flags": ",".join(risk_flags),
        "dedupe_key": dedupe_key,
        "possible_duplicate_group": "",
        "search_text": search_text,
        "tags_json": compact_json(tags),
        "geometry_json": compact_json(geometry),
        "raw_json": compact_json(raw_payload(row, tags)),
    }

    feature = {
        "type": "Feature",
        "id": uid,
        "geometry": geometry,
        "properties": {key: normalized[key] for key in CSV_FIELDS if key not in {"geometry_json", "raw_json", "tags_json"}},
    }
    feature["properties"]["tags"] = tags
    feature["properties"]["raw"] = raw_payload(row, tags)
    return normalized, feature


def add_duplicate_groups(rows: list[dict[str, str]]) -> None:
    groups: dict[str, list[dict[str, str]]] = defaultdict(list)
    for row in rows:
        if row["dedupe_key"].endswith("||"):
            continue
        groups[row["dedupe_key"]].append(row)
    group_num = 0
    for group_rows in groups.values():
        if len(group_rows) < 2:
            continue
        group_num += 1
        group_id = f"dup_{group_num:06d}"
        for row in group_rows:
            row["possible_duplicate_group"] = group_id


def write_csv(rows: list[dict[str, str]]) -> None:
    with NORMALIZED_CSV.open("w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.DictWriter(handle, fieldnames=CSV_FIELDS, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def write_geojson(features: list[dict[str, Any]], duplicate_by_uid: dict[str, str]) -> None:
    for feature in features:
        group = duplicate_by_uid.get(feature["id"], "")
        feature["properties"]["possible_duplicate_group"] = group
    collection = {"type": "FeatureCollection", "features": features}
    NORMALIZED_GEOJSON.write_text(json.dumps(collection, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def build_report(rows: list[dict[str, str]]) -> dict[str, Any]:
    source_counts = Counter(row["source_dataset"] for row in rows)
    class_counts = Counter(row["asset_class"] for row in rows)
    type_counts = Counter(row["asset_type"] for row in rows)
    geometry_counts = Counter(row["geometry_type"] or "missing" for row in rows)
    location_quality_counts = Counter(row["location_quality"] for row in rows)
    missing_locations = sum(1 for row in rows if row["has_point_location"] != "true")
    duplicate_groups = Counter(row["possible_duplicate_group"] for row in rows if row["possible_duplicate_group"])

    by_source_layer: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for row in rows:
        by_source_layer[row["source_dataset"]][row["source_layer"]] += 1

    return {
        "inputs": {
            "combined_csv": str(COMBINED_CSV),
        },
        "outputs": {
            "normalized_csv": str(NORMALIZED_CSV),
            "normalized_geojson": str(NORMALIZED_GEOJSON),
            "report_json": str(REPORT_JSON),
        },
        "total_rows": len(rows),
        "source_counts": dict(sorted(source_counts.items())),
        "asset_class_counts": dict(sorted(class_counts.items())),
        "asset_type_counts": dict(sorted(type_counts.items())),
        "geometry_type_counts": dict(sorted(geometry_counts.items())),
        "location_quality_counts": dict(sorted(location_quality_counts.items())),
        "missing_map_location_count": missing_locations,
        "selectable_count": len(rows) - missing_locations,
        "possible_duplicate_group_count": len(duplicate_groups),
        "possible_duplicate_record_count": sum(duplicate_groups.values()),
        "source_layer_counts": {
            source: dict(sorted(layers.items())) for source, layers in sorted(by_source_layer.items())
        },
        "normalization_notes": [
            "Full original coordinate arrays are preserved in geometry_json and GeoJSON geometry.",
            "map_latitude/map_longitude uses exact point coordinates where available, otherwise line/polygon centroids.",
            "OSINT Varta rows are classified as military_industrial/company.",
            "Rows with missing coordinates are retained in CSV and included in GeoJSON with null geometry.",
            "possible_duplicate_group flags likely duplicates but does not remove any records.",
        ],
    }


def main() -> int:
    if not COMBINED_CSV.exists():
        raise FileNotFoundError(f"Missing input: {COMBINED_CSV}")

    normalized_rows: list[dict[str, str]] = []
    features: list[dict[str, Any]] = []
    with COMBINED_CSV.open("r", newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            normalized, feature = normalize_row(row)
            normalized_rows.append(normalized)
            features.append(feature)

    add_duplicate_groups(normalized_rows)
    duplicate_by_uid = {row["uid"]: row["possible_duplicate_group"] for row in normalized_rows}

    write_csv(normalized_rows)
    write_geojson(features, duplicate_by_uid)
    report = build_report(normalized_rows)
    REPORT_JSON.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"Wrote {len(normalized_rows):,} rows to {NORMALIZED_CSV}")
    print(f"Wrote {len(features):,} features to {NORMALIZED_GEOJSON}")
    print(f"Wrote report to {REPORT_JSON}")
    print(f"Selectable features: {report['selectable_count']:,}")
    print(f"Missing map locations: {report['missing_map_location_count']:,}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
