#!/usr/bin/env python3
"""Normalize extracted infrastructure datasets for analysis and mapping."""

from __future__ import annotations

import csv
import hashlib
import json
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


OUT_DIR = Path("data")
COMBINED_CSV = OUT_DIR / "combined_infrastructure_sources.csv"
NORMALIZED_CSV = OUT_DIR / "normalized_infrastructure.csv"
NORMALIZED_GEOJSON = OUT_DIR / "normalized_infrastructure.geojson"
REPORT_JSON = OUT_DIR / "normalization_report.json"
SOURCE_CATALOG_CSV = OUT_DIR / "source_catalog.csv"
REFERENCES_CSV = OUT_DIR / "references.csv"
OBJECT_REFERENCES_CSV = OUT_DIR / "object_references.csv"
QUALITY_REPORT_JSON = OUT_DIR / "quality_report.json"
DATA_PACKAGE_DIR = Path("data_package")
DATA_PACKAGE_MANIFEST = DATA_PACKAGE_DIR / "manifest.json"
REVIEW_DIR = OUT_DIR / "review"
REVIEW_QUEUE_CSV = REVIEW_DIR / "review_queue.csv"
DUPLICATE_CANDIDATES_CSV = REVIEW_DIR / "duplicate_candidates.csv"
POSSIBLE_ALIASES_CSV = REVIEW_DIR / "possible_aliases.csv"
CONFLICTS_CSV = REVIEW_DIR / "conflicts.csv"
MANUAL_OBJECT_OVERRIDES_CSV = OUT_DIR / "manual" / "object_overrides.csv"
MANUAL_SOURCE_OVERRIDES_CSV = OUT_DIR / "manual" / "source_overrides.csv"


CSV_FIELDS = [
    "uid",
    "source_dataset",
    "source_id",
    "source_record_id",
    "source_url",
    "source_capture_date",
    "source_layer",
    "source_feature_index",
    "source_reference_id",
    "source_name",
    "source_type",
    "source_reliability",
    "license_or_terms",
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
    "dedupe_key",
    "possible_duplicate_group",
    "search_text",
    "references_json",
    "tags_json",
    "geometry_json",
    "raw_json",
]


SOURCE_RUSSIA = "Russia Oil & Power Infrastructure Map"
SOURCE_VARTA = "OSINT Varta"
SOURCE_NIGHTWATCH = "Nightwatch map"

SOURCE_CATALOG = {
    SOURCE_RUSSIA: {
        "source_id": "russia_oil_power_map",
        "source_name": "Russia Oil & Power Infrastructure Map",
        "source_type": "map_layer",
        "source_url": "https://russiaoilpowermap.com/",
        "retrieval_method": "remote_fetcher",
        "license_or_terms": "unknown",
        "terms_url": "",
        "can_redistribute_raw": "unknown",
        "can_redistribute_derived": "unknown",
        "attribution_required": "unknown",
        "source_reliability": "B",
        "notes": "Fetched map-layer infrastructure source.",
    },
    "OSINT Varta archived map points": {
        "source_id": "osint_varta_archive",
        "source_name": "OSINT Varta archived map points",
        "source_type": "archived_map_points",
        "source_url": "",
        "retrieval_method": "internet_archive",
        "license_or_terms": "unknown",
        "terms_url": "",
        "can_redistribute_raw": "unknown",
        "can_redistribute_derived": "unknown",
        "attribution_required": "unknown",
        "source_reliability": "C",
        "notes": "Archived map point extraction.",
    },
    SOURCE_VARTA: {
        "source_id": "osint_varta_archive",
        "source_name": "OSINT Varta archived map points",
        "source_type": "archived_map_points",
        "source_url": "",
        "retrieval_method": "internet_archive",
        "license_or_terms": "unknown",
        "terms_url": "",
        "can_redistribute_raw": "unknown",
        "can_redistribute_derived": "unknown",
        "attribution_required": "unknown",
        "source_reliability": "C",
        "notes": "Archived map point extraction.",
    },
    SOURCE_NIGHTWATCH: {
        "source_id": "nightwatch_map",
        "source_name": "Nightwatch map",
        "source_type": "public_embedded_map",
        "source_url": "https://nightwatch.services/map",
        "retrieval_method": "public_nextjs_embedded_data",
        "license_or_terms": "unknown",
        "terms_url": "",
        "can_redistribute_raw": "unknown",
        "can_redistribute_derived": "unknown",
        "attribution_required": "unknown",
        "source_reliability": "C",
        "notes": "Extracted from public server-rendered Nightwatch map placemarks.",
    },
}

SOURCE_CATALOG_FIELDS = [
    "source_id",
    "source_name",
    "source_type",
    "source_url",
    "retrieval_method",
    "license_or_terms",
    "terms_url",
    "can_redistribute_raw",
    "can_redistribute_derived",
    "attribution_required",
    "source_reliability",
    "notes",
]

REFERENCE_FIELDS = [
    "reference_id",
    "source_id",
    "source_name",
    "source_type",
    "url",
    "archive_url",
    "retrieved_at",
    "source_record_id",
    "source_file",
    "source_line_or_record_id",
    "extractor_version",
    "license_or_terms",
    "confidence_contribution",
]

OBJECT_REFERENCE_FIELDS = [
    "object_id",
    "reference_id",
    "source_id",
    "source_record_id",
    "confidence_contribution",
    "relationship",
]

REVIEW_QUEUE_FIELDS = [
    "object_id",
    "review_reason",
    "name",
    "asset_class",
    "asset_type",
    "country",
    "map_latitude",
    "map_longitude",
    "confidence",
    "coordinate_precision",
    "source_id",
    "possible_duplicate_group",
]

SOURCE_SCORE = {"A": 1.0, "B": 0.82, "C": 0.62, "D": 0.38, "E": 0.12}


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


def stable_reference_id(parts: list[str]) -> str:
    digest = hashlib.sha256("|".join(parts).encode("utf-8", errors="replace")).hexdigest()
    return f"ref_{digest[:16]}"


def is_placeholder_name(raw: str) -> bool:
    text = " ".join(str(raw or "").casefold().split())
    return text == "name todo" or text.endswith("; name todo")


def clean_name(raw: str) -> str:
    text = value({"value": raw}, "value")
    return "" if is_placeholder_name(text) else text


def source_info(source_dataset: str) -> dict[str, str]:
    if source_dataset in SOURCE_CATALOG:
        return dict(SOURCE_CATALOG[source_dataset])
    source_id = "_".join(source_dataset.casefold().split()) or "unknown_source"
    return {
        "source_id": source_id,
        "source_name": source_dataset or "Unknown source",
        "source_type": "unknown",
        "source_url": "",
        "retrieval_method": "unknown",
        "license_or_terms": "unknown",
        "terms_url": "",
        "can_redistribute_raw": "unknown",
        "can_redistribute_derived": "unknown",
        "attribution_required": "unknown",
        "source_reliability": "D",
        "notes": "Source was not present in the built-in source catalog.",
    }


def load_source_overrides() -> dict[str, dict[str, str]]:
    if not MANUAL_SOURCE_OVERRIDES_CSV.exists():
        return {}
    overrides: dict[str, dict[str, str]] = {}
    with MANUAL_SOURCE_OVERRIDES_CSV.open("r", newline="", encoding="utf-8-sig") as handle:
        for row in csv.DictReader(handle):
            source_id = value(row, "source_id")
            if not source_id:
                continue
            overrides[source_id] = {
                key: val.strip()
                for key, val in row.items()
                if key in SOURCE_CATALOG_FIELDS and val not in ("", None)
            }
            reliability = value(row, "reliability")
            if reliability:
                overrides[source_id]["source_reliability"] = reliability
    return overrides


def load_object_overrides() -> dict[str, list[dict[str, str]]]:
    if not MANUAL_OBJECT_OVERRIDES_CSV.exists():
        return {}
    overrides: dict[str, list[dict[str, str]]] = defaultdict(list)
    with MANUAL_OBJECT_OVERRIDES_CSV.open("r", newline="", encoding="utf-8-sig") as handle:
        for row in csv.DictReader(handle):
            object_id = value(row, "object_id")
            field = value(row, "field")
            if object_id and field:
                overrides[object_id].append(row)
    return overrides


def apply_object_overrides(rows: list[dict[str, str]], overrides: dict[str, list[dict[str, str]]]) -> int:
    applied = 0
    for row in rows:
        for override in overrides.get(row["uid"], []):
            field = value(override, "field")
            if field not in row:
                continue
            row[field] = value(override, "new_value")
            row["review_status"] = "reviewed"
            applied += 1
    return applied


def sync_feature_properties(features: list[dict[str, Any]], rows: list[dict[str, str]]) -> None:
    by_uid = {row["uid"]: row for row in rows}
    for feature in features:
        row = by_uid.get(feature["id"])
        if not row:
            continue
        props = feature.setdefault("properties", {})
        for key in CSV_FIELDS:
            if key in {"geometry_json", "raw_json", "tags_json"}:
                continue
            props[key] = row.get(key, "")
        tags = json_loads_maybe(row.get("tags_json", ""))
        raw = json_loads_maybe(row.get("raw_json", ""))
        refs = json_loads_maybe(row.get("references_json", ""))
        props["tags"] = tags if isinstance(tags, dict) else {}
        props["raw"] = raw if isinstance(raw, dict) else {}
        props["references"] = refs if isinstance(refs, list) else []


def coordinate_precision(location_quality: str) -> str:
    if location_quality == "exact":
        return "exact"
    if location_quality in {"line_centroid", "polygon_centroid", "centroid"}:
        return "centroid"
    if location_quality == "missing":
        return "missing"
    return "approximate"


def entity_confidence(asset_class: str, asset_type: str, display_label: str) -> str:
    if asset_class != "unknown" and asset_type != "unknown" and display_label:
        return "high"
    if asset_class != "unknown" or asset_type != "unknown" or display_label:
        return "medium"
    return "low"


def source_capture_date(row: dict[str, str]) -> str:
    return first_nonempty(value(row, "archive_timestamp"), value(row, "retrieved_at"), value(row, "source_capture_date"))


def freshness_from_capture(capture_date: str) -> str:
    if not capture_date:
        return "unknown"
    digits = "".join(ch for ch in capture_date if ch.isdigit())
    if len(digits) >= 8:
        try:
            year = int(digits[:4])
        except ValueError:
            return "unknown"
        if year >= 2025:
            return "recent"
        if year >= 2022:
            return "stale"
        return "old"
    return "unknown"


def confidence_score(
    source_reliability: str,
    precision: str,
    entity: str,
    freshness: str,
    cross_source_support: str,
) -> float:
    score = SOURCE_SCORE.get(source_reliability, 0.38)
    score += {"exact": 0.12, "approximate": 0.02, "centroid": -0.03, "missing": -0.25}.get(precision, -0.05)
    score += {"high": 0.10, "medium": 0.0, "low": -0.18}.get(entity, 0.0)
    score += {"recent": 0.05, "stale": -0.04, "old": -0.12, "unknown": -0.02}.get(freshness, -0.02)
    try:
        support_count = int(cross_source_support)
    except ValueError:
        support_count = 1
    if support_count >= 2:
        score += min(0.12, 0.06 * (support_count - 1))
    return max(0.0, min(1.0, score))


def confidence_grade(score: float) -> str:
    if score >= 0.90:
        return "A"
    if score >= 0.72:
        return "B"
    if score >= 0.52:
        return "C"
    if score >= 0.32:
        return "D"
    return "E"


def reference_for_row(
    row: dict[str, str],
    source: dict[str, str],
    source_record_id: str,
    build_id: str,
) -> dict[str, str]:
    source_id = source["source_id"]
    source_url = first_nonempty(value(row, "source_url"), source.get("source_url", ""))
    archive_url = value(row, "archive_url")
    retrieved_at = source_capture_date(row) or build_id
    reference_id = stable_reference_id([source_id, source_record_id, value(row, "layer"), source_url, archive_url])
    contribution = SOURCE_SCORE.get(source.get("source_reliability", ""), 0.38)
    return {
        "reference_id": reference_id,
        "source_id": source_id,
        "source_name": source["source_name"],
        "source_type": source["source_type"],
        "url": source_url,
        "archive_url": archive_url,
        "retrieved_at": retrieved_at,
        "source_record_id": source_record_id,
        "source_file": value(row, "source_file"),
        "source_line_or_record_id": first_nonempty(value(row, "source_line_or_record_id"), source_record_id),
        "extractor_version": value(row, "extractor_version") or "unknown",
        "license_or_terms": source.get("license_or_terms", "unknown"),
        "confidence_contribution": f"{contribution:.2f}",
    }


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

    if source_info(value(row, "source_dataset"))["source_id"] == "osint_varta_archive":
        return "military_industrial", "company", "defense_industrial_company", "military"
    if value(row, "source_dataset") == SOURCE_NIGHTWATCH:
        if layer == "nightwatch_paths":
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
        tags = dict(raw_props["tags"])
        if is_placeholder_name(tags.get("name", "")):
            tags.pop("name", None)
        return tags

    tags = {}
    for key, val in row.items():
        if key.startswith("properties_tags_") and val not in ("", None):
            tags[key.removeprefix("properties_tags_")] = val
    if is_placeholder_name(tags.get("name", "")):
        tags.pop("name", None)
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


def normalize_row(
    row: dict[str, str],
    build_id: str,
    source_overrides: dict[str, dict[str, str]],
) -> tuple[dict[str, str], dict[str, Any], dict[str, str], dict[str, str]]:
    source_dataset = value(row, "source_dataset")
    layer = value(row, "layer")
    feature_id = value(row, "feature_id")
    feature_index = value(row, "feature_index")
    source_record_id = first_nonempty(feature_id, value(row, "osm_id"), f"{layer}:{feature_index}")
    source = source_info(source_dataset)
    source.update(source_overrides.get(source["source_id"], {}))
    reference = reference_for_row(row, source, source_record_id, build_id)

    asset_class, asset_type, asset_subtype, domain = classify(row)
    map_layer, map_color, map_icon = marker_style(asset_class, asset_type)
    geometry = geometry_from_row(row)
    location = derive_location(row, geometry)
    tags = extract_tags(row)
    precision = coordinate_precision(location["location_quality"])

    name_original = clean_name(value(row, "name"))
    description = value(row, "description")
    operator = value(row, "operator")
    product = value(row, "product")
    inn = value(row, "inn")
    region = value(row, "region")
    display_label = first_nonempty(name_original, operator, inn, f"{asset_type}:{source_record_id}")
    entity = entity_confidence(asset_class, asset_type, display_label)
    freshness = freshness_from_capture(reference["retrieved_at"])
    score = confidence_score(source["source_reliability"], precision, entity, freshness, "1")
    confidence = confidence_grade(score)

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
        "source_id": source["source_id"],
        "source_record_id": source_record_id,
        "source_url": reference["url"],
        "source_capture_date": reference["retrieved_at"],
        "source_layer": layer,
        "source_feature_index": feature_index,
        "source_reference_id": reference["reference_id"],
        "source_name": source["source_name"],
        "source_type": source["source_type"],
        "source_reliability": source["source_reliability"],
        "license_or_terms": source["license_or_terms"],
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
        "coordinate_precision": precision,
        "entity_confidence": entity,
        "freshness": freshness,
        "cross_source_support": "1",
        "review_status": "unreviewed",
        "confidence": confidence,
        "confidence_score": f"{score:.2f}",
        "selectable": "true" if location["has_point_location"] == "true" else "false",
        "map_layer": map_layer,
        "map_color": map_color,
        "map_icon": map_icon,
        "risk_flags": ",".join(risk_flags),
        "dedupe_key": dedupe_key,
        "possible_duplicate_group": "",
        "search_text": search_text,
        "references_json": compact_json([reference]),
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
    feature["properties"]["references"] = [reference]
    object_reference = {
        "object_id": uid,
        "reference_id": reference["reference_id"],
        "source_id": source["source_id"],
        "source_record_id": source_record_id,
        "confidence_contribution": reference["confidence_contribution"],
        "relationship": "primary",
    }
    return normalized, feature, reference, object_reference


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


def update_confidence_context(rows: list[dict[str, str]]) -> None:
    support_by_group: dict[str, int] = {}
    grouped: dict[str, list[dict[str, str]]] = defaultdict(list)
    for row in rows:
        key = row["possible_duplicate_group"] or row["uid"]
        grouped[key].append(row)
    for key, group_rows in grouped.items():
        support_by_group[key] = len({row["source_id"] for row in group_rows if row["source_id"]})

    for row in rows:
        support = support_by_group[row["possible_duplicate_group"] or row["uid"]]
        row["cross_source_support"] = str(max(1, support))
        score = confidence_score(
            row["source_reliability"],
            row["coordinate_precision"],
            row["entity_confidence"],
            row["freshness"],
            row["cross_source_support"],
        )
        row["confidence_score"] = f"{score:.2f}"
        row["confidence"] = confidence_grade(score)


def unique_rows(rows: list[dict[str, str]], key_field: str) -> list[dict[str, str]]:
    seen: set[str] = set()
    unique: list[dict[str, str]] = []
    for row in rows:
        key = row.get(key_field, "")
        if not key or key in seen:
            continue
        seen.add(key)
        unique.append(row)
    return unique


def write_dict_csv(path: Path, fieldnames: list[str], rows: list[dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def write_source_catalog(rows: list[dict[str, str]], source_overrides: dict[str, dict[str, str]]) -> None:
    sources = {}
    for row in rows:
        source = source_info(row["source_dataset"])
        source.update(source_overrides.get(source["source_id"], {}))
        sources[source["source_id"]] = source
    write_dict_csv(
        SOURCE_CATALOG_CSV,
        SOURCE_CATALOG_FIELDS,
        [sources[key] for key in sorted(sources)],
    )


def write_reference_tables(references: list[dict[str, str]], object_references: list[dict[str, str]]) -> None:
    write_dict_csv(REFERENCES_CSV, REFERENCE_FIELDS, unique_rows(references, "reference_id"))
    write_dict_csv(OBJECT_REFERENCES_CSV, OBJECT_REFERENCE_FIELDS, object_references)


def review_reason(row: dict[str, str]) -> str:
    reasons = []
    if row["confidence"] in {"D", "E"}:
        reasons.append("low_confidence")
    if row["coordinate_precision"] in {"missing", "centroid", "approximate"}:
        reasons.append(f"{row['coordinate_precision']}_coordinates")
    if row["possible_duplicate_group"]:
        reasons.append("possible_duplicate")
    if row["asset_class"] == "unknown" or row["asset_type"] == "unknown":
        reasons.append("unknown_classification")
    return ",".join(reasons)


def review_output_row(row: dict[str, str], reason: str = "") -> dict[str, str]:
    return {
        "object_id": row["uid"],
        "review_reason": reason,
        "name": row["name"],
        "asset_class": row["asset_class"],
        "asset_type": row["asset_type"],
        "country": row["country"],
        "map_latitude": row["map_latitude"],
        "map_longitude": row["map_longitude"],
        "confidence": row["confidence"],
        "coordinate_precision": row["coordinate_precision"],
        "source_id": row["source_id"],
        "possible_duplicate_group": row["possible_duplicate_group"],
    }


def write_review_outputs(rows: list[dict[str, str]]) -> None:
    duplicate_rows = [row for row in rows if row["possible_duplicate_group"]]
    write_dict_csv(DUPLICATE_CANDIDATES_CSV, REVIEW_QUEUE_FIELDS, [review_output_row(row) for row in duplicate_rows])

    alias_rows = [
        row for row in duplicate_rows
        if row["cross_source_support"] != "1" and row["coordinate_precision"] != "missing"
    ]
    write_dict_csv(POSSIBLE_ALIASES_CSV, REVIEW_QUEUE_FIELDS, [review_output_row(row) for row in alias_rows])

    by_coord: dict[str, list[dict[str, str]]] = defaultdict(list)
    for row in rows:
        if row["map_latitude"] and row["map_longitude"]:
            key = f"{round(float(row['map_latitude']), 4):.4f}|{round(float(row['map_longitude']), 4):.4f}"
            by_coord[key].append(row)
    conflict_rows = []
    for group_rows in by_coord.values():
        if len({row["asset_class"] for row in group_rows}) > 1:
            conflict_rows.extend(group_rows)
    write_dict_csv(CONFLICTS_CSV, REVIEW_QUEUE_FIELDS, [review_output_row(row) for row in unique_rows(conflict_rows, "uid")])

    queue_rows = []
    for row in rows:
        reason = review_reason(row)
        if not reason:
            continue
        queue_rows.append(review_output_row(row, reason))
    write_dict_csv(REVIEW_QUEUE_CSV, REVIEW_QUEUE_FIELDS, queue_rows)


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


def quality_counts(rows: list[dict[str, str]], build_id: str) -> dict[str, Any]:
    duplicate_groups = Counter(row["possible_duplicate_group"] for row in rows if row["possible_duplicate_group"])
    return {
        "build_id": build_id,
        "total_records_raw": len(rows),
        "total_records_normalized": len(rows),
        "records_dropped": 0,
        "records_without_coordinates": sum(1 for row in rows if row["has_point_location"] != "true"),
        "records_without_category": sum(1 for row in rows if row["asset_class"] == "unknown" or row["asset_type"] == "unknown"),
        "records_with_approx_coordinates": sum(
            1 for row in rows
            if row["coordinate_precision"] in {"approximate", "centroid"}
        ),
        "duplicate_candidates": sum(duplicate_groups.values()),
        "duplicate_group_count": len(duplicate_groups),
        "country_mismatches": 0,
        "low_confidence_records": sum(1 for row in rows if row["confidence"] in {"D", "E"}),
        "new_since_previous_build": None,
        "changed_since_previous_build": None,
        "removed_since_previous_build": None,
        "review_queue_count": sum(1 for row in rows if review_reason(row)),
    }


def build_report(rows: list[dict[str, str]], build_id: str, object_overrides_applied: int) -> dict[str, Any]:
    source_counts = Counter(row["source_dataset"] for row in rows)
    source_id_counts = Counter(row["source_id"] for row in rows)
    class_counts = Counter(row["asset_class"] for row in rows)
    type_counts = Counter(row["asset_type"] for row in rows)
    geometry_counts = Counter(row["geometry_type"] or "missing" for row in rows)
    location_quality_counts = Counter(row["location_quality"] for row in rows)
    coordinate_precision_counts = Counter(row["coordinate_precision"] for row in rows)
    confidence_counts = Counter(row["confidence"] for row in rows)
    review_status_counts = Counter(row["review_status"] for row in rows)
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
            "source_catalog_csv": str(SOURCE_CATALOG_CSV),
            "references_csv": str(REFERENCES_CSV),
            "object_references_csv": str(OBJECT_REFERENCES_CSV),
            "quality_report_json": str(QUALITY_REPORT_JSON),
            "review_queue_csv": str(REVIEW_QUEUE_CSV),
            "data_package_manifest": str(DATA_PACKAGE_MANIFEST),
        },
        "build_id": build_id,
        "total_rows": len(rows),
        "source_counts": dict(sorted(source_counts.items())),
        "source_id_counts": dict(sorted(source_id_counts.items())),
        "asset_class_counts": dict(sorted(class_counts.items())),
        "asset_type_counts": dict(sorted(type_counts.items())),
        "geometry_type_counts": dict(sorted(geometry_counts.items())),
        "location_quality_counts": dict(sorted(location_quality_counts.items())),
        "coordinate_precision_counts": dict(sorted(coordinate_precision_counts.items())),
        "confidence_counts": dict(sorted(confidence_counts.items())),
        "review_status_counts": dict(sorted(review_status_counts.items())),
        "missing_map_location_count": missing_locations,
        "selectable_count": len(rows) - missing_locations,
        "possible_duplicate_group_count": len(duplicate_groups),
        "possible_duplicate_record_count": sum(duplicate_groups.values()),
        "manual_object_overrides_applied": object_overrides_applied,
        "quality": quality_counts(rows, build_id),
        "source_layer_counts": {
            source: dict(sorted(layers.items())) for source, layers in sorted(by_source_layer.items())
        },
        "normalization_notes": [
            "Full original coordinate arrays are preserved in geometry_json and GeoJSON geometry.",
            "map_latitude/map_longitude uses exact point coordinates where available, otherwise line/polygon centroids.",
            "Source references are emitted to references.csv/object_references.csv and copied into GeoJSON properties.references.",
            "Confidence separates source reliability, coordinate precision, entity confidence, freshness, cross-source support, and review status.",
            "OSINT Varta rows are classified as military_industrial/company.",
            "Rows with missing coordinates are retained in CSV and included in GeoJSON with null geometry.",
            "possible_duplicate_group flags likely duplicates but does not remove any records.",
        ],
    }


def write_quality_report(rows: list[dict[str, str]], build_id: str) -> dict[str, Any]:
    report = quality_counts(rows, build_id)
    QUALITY_REPORT_JSON.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    return report


def write_data_package_manifest(rows: list[dict[str, str]], build_id: str) -> None:
    DATA_PACKAGE_DIR.mkdir(parents=True, exist_ok=True)
    manifest = {
        "dataset_name": "Russian Infrastructure Explorer Dataset",
        "build_id": build_id,
        "pipeline_version": "0.6.0",
        "record_count": len(rows),
        "source_count": len({row["source_id"] for row in rows if row["source_id"]}),
        "generated_at": build_id,
        "files": {
            "objects_csv": str(NORMALIZED_CSV),
            "objects_geojson": str(NORMALIZED_GEOJSON),
            "references_csv": str(REFERENCES_CSV),
            "object_references_csv": str(OBJECT_REFERENCES_CSV),
            "source_catalog_csv": str(SOURCE_CATALOG_CSV),
            "quality_report_json": str(QUALITY_REPORT_JSON),
            "build_report_json": str(REPORT_JSON),
            "review_queue_csv": str(REVIEW_QUEUE_CSV),
            "duplicate_candidates_csv": str(DUPLICATE_CANDIDATES_CSV),
            "possible_aliases_csv": str(POSSIBLE_ALIASES_CSV),
            "conflicts_csv": str(CONFLICTS_CSV),
        },
        "notes": [
            "The package manifest references generated dataset files in data/ to avoid duplicating large CSV/GeoJSON files.",
            "Manual review overlays are read from data/manual/object_overrides.csv and data/manual/source_overrides.csv when present.",
        ],
    }
    DATA_PACKAGE_MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")


def main() -> int:
    if not COMBINED_CSV.exists():
        raise FileNotFoundError(f"Missing input: {COMBINED_CSV}")

    build_id = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    source_overrides = load_source_overrides()
    object_overrides = load_object_overrides()
    normalized_rows: list[dict[str, str]] = []
    features: list[dict[str, Any]] = []
    references: list[dict[str, str]] = []
    object_references: list[dict[str, str]] = []
    with COMBINED_CSV.open("r", newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            normalized, feature, reference, object_reference = normalize_row(row, build_id, source_overrides)
            normalized_rows.append(normalized)
            features.append(feature)
            references.append(reference)
            object_references.append(object_reference)

    add_duplicate_groups(normalized_rows)
    update_confidence_context(normalized_rows)
    object_overrides_applied = apply_object_overrides(normalized_rows, object_overrides)
    duplicate_by_uid = {row["uid"]: row["possible_duplicate_group"] for row in normalized_rows}
    sync_feature_properties(features, normalized_rows)

    write_source_catalog(normalized_rows, source_overrides)
    write_reference_tables(references, object_references)
    write_review_outputs(normalized_rows)
    write_csv(normalized_rows)
    write_geojson(features, duplicate_by_uid)
    write_quality_report(normalized_rows, build_id)
    write_data_package_manifest(normalized_rows, build_id)
    report = build_report(normalized_rows, build_id, object_overrides_applied)
    REPORT_JSON.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"Wrote {len(normalized_rows):,} rows to {NORMALIZED_CSV}")
    print(f"Wrote {len(features):,} features to {NORMALIZED_GEOJSON}")
    print(f"Wrote {len(unique_rows(references, 'reference_id')):,} references to {REFERENCES_CSV}")
    print(f"Wrote source catalog to {SOURCE_CATALOG_CSV}")
    print(f"Wrote quality report to {QUALITY_REPORT_JSON}")
    print(f"Wrote report to {REPORT_JSON}")
    print(f"Selectable features: {report['selectable_count']:,}")
    print(f"Missing map locations: {report['missing_map_location_count']:,}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
