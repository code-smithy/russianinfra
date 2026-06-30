#!/usr/bin/env python3
"""Generate temporal metadata and a static change report between data builds."""

from __future__ import annotations

import argparse
import gzip
import json
import math
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


CURRENT_GEOJSON = Path("data/normalized_infrastructure.geojson")
NORMALIZATION_REPORT = Path("data/normalization_report.json")
CHANGE_REPORT_JSON = Path("data/change_report.json")
BUILD_HISTORY_DIR = Path("data_package/build_history")
LATEST_GEOJSON = BUILD_HISTORY_DIR / "latest_change_baseline.geojson.gz"
LATEST_METADATA = BUILD_HISTORY_DIR / "latest_manifest.json"
MOVE_THRESHOLD_KM = 1.0
SUSPICIOUS_MOVE_THRESHOLD_KM = 20.0
MAX_CHANGE_ITEMS = 250

CHANGE_FIELDS = {
    "category": ["asset_class", "asset_type", "domain", "map_layer", "derived_subcategory"],
    "name": ["name", "display_label", "name_translated"],
    "confidence": [
        "confidence",
        "confidence_score",
        "coordinate_precision",
        "entity_confidence",
        "source_reliability",
        "freshness",
        "cross_source_support",
        "review_status",
    ],
    "source": ["source_id", "source_dataset", "source_record_id", "source_url", "source_layer", "source_reference_id"],
}

BASELINE_PROPERTY_FIELDS = sorted(
    {
        "asset_class",
        "asset_type",
        "change_status",
        "changed_since_previous_build",
        "confidence",
        "confidence_score",
        "coordinate_precision",
        "country",
        "cross_source_support",
        "derived_subcategory",
        "display_label",
        "domain",
        "entity_confidence",
        "first_seen_build",
        "freshness",
        "last_seen_build",
        "map_latitude",
        "map_layer",
        "map_longitude",
        "name",
        "name_translated",
        "new_in_latest_build",
        "removed_from_latest_build",
        "review_status",
        "source_archive_date",
        "source_capture_date",
        "source_dataset",
        "source_id",
        "source_layer",
        "source_record_id",
        "source_reference_id",
        "source_reliability",
        "source_url",
        "uid",
    }
)


def read_json(path: Path) -> dict[str, Any]:
    if path.suffix == ".gz":
        with gzip.open(path, "rt", encoding="utf-8") as handle:
            return json.load(handle)
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def write_compact_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.suffix == ".gz":
        with gzip.open(path, "wt", encoding="utf-8", compresslevel=9) as handle:
            json.dump(payload, handle, ensure_ascii=False, separators=(",", ":"))
        return
    path.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def baseline_feature(feature: dict[str, Any]) -> dict[str, Any]:
    props = feature.get("properties") or {}
    baseline_props = {key: props.get(key, "") for key in BASELINE_PROPERTY_FIELDS if key in props}
    uid = feature_uid(feature)
    if uid and "uid" not in baseline_props:
        baseline_props["uid"] = uid
    return {
        "type": "Feature",
        "id": uid or feature.get("id", ""),
        "geometry": None,
        "properties": baseline_props,
    }


def baseline_snapshot(data: dict[str, Any]) -> dict[str, Any]:
    return {
        "type": "FeatureCollection",
        "features": [
            baseline_feature(feature)
            for feature in data.get("features", [])
            if isinstance(feature, dict) and feature_uid(feature)
        ],
    }


def utc_now_id() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def build_id_from_report(path: Path) -> str:
    if not path.exists():
        return utc_now_id()
    report = read_json(path)
    return str(report.get("build_id") or report.get("generated_at") or utc_now_id())


def feature_uid(feature: dict[str, Any]) -> str:
    props = feature.get("properties") or {}
    return str(props.get("uid") or feature.get("id") or "")


def feature_index(data: dict[str, Any]) -> dict[str, dict[str, Any]]:
    indexed = {}
    for feature in data.get("features", []):
        uid = feature_uid(feature)
        if uid:
            indexed[uid] = feature
    return indexed


def normalized_value(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, (list, dict)):
        return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return " ".join(str(value).split())


def first_nonempty(*values: Any) -> str:
    for value in values:
        text = normalized_value(value)
        if text:
            return text
    return ""


def feature_label(feature: dict[str, Any]) -> str:
    props = feature.get("properties") or {}
    return first_nonempty(props.get("display_label"), props.get("name"), feature_uid(feature), "Unnamed")


def feature_date_value(feature: dict[str, Any]) -> str:
    props = feature.get("properties") or {}
    return first_nonempty(props.get("source_archive_date"), props.get("source_capture_date"))


def point_for_feature(feature: dict[str, Any]) -> tuple[float, float] | None:
    props = feature.get("properties") or {}
    for lat_key, lon_key in (("map_latitude", "map_longitude"), ("latitude", "longitude")):
        try:
            lat = float(props.get(lat_key) or "")
            lon = float(props.get(lon_key) or "")
        except (TypeError, ValueError):
            continue
        if math.isfinite(lat) and math.isfinite(lon):
            return lat, lon

    geometry = feature.get("geometry") or {}
    if geometry.get("type") == "Point":
        coordinates = geometry.get("coordinates") or []
        if len(coordinates) >= 2:
            try:
                lon = float(coordinates[0])
                lat = float(coordinates[1])
            except (TypeError, ValueError):
                return None
            if math.isfinite(lat) and math.isfinite(lon):
                return lat, lon
    return None


def haversine_km(a: tuple[float, float], b: tuple[float, float]) -> float:
    lat1, lon1 = a
    lat2, lon2 = b
    radius_km = 6371.0088
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    value = math.sin(delta_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
    return radius_km * 2 * math.atan2(math.sqrt(value), math.sqrt(1 - value))


def changed_fields(previous: dict[str, Any], current: dict[str, Any], fields: list[str]) -> list[str]:
    previous_props = previous.get("properties") or {}
    current_props = current.get("properties") or {}
    changed = []
    for field in fields:
        if normalized_value(previous_props.get(field)) != normalized_value(current_props.get(field)):
            changed.append(field)
    return changed


def feature_summary(feature: dict[str, Any]) -> dict[str, Any]:
    props = feature.get("properties") or {}
    point = point_for_feature(feature)
    return {
        "uid": feature_uid(feature),
        "name": feature_label(feature),
        "map_layer": props.get("map_layer") or "",
        "asset_type": props.get("asset_type") or "",
        "derived_subcategory": props.get("derived_subcategory") or "",
        "country": props.get("country") or "",
        "confidence": props.get("confidence") or "",
        "source_id": props.get("source_id") or props.get("source_dataset") or "",
        "source_record_id": props.get("source_record_id") or "",
        "source_date": feature_date_value(feature),
        "map_latitude": point[0] if point else None,
        "map_longitude": point[1] if point else None,
    }


def field_change_summary(previous: dict[str, Any], current: dict[str, Any], fields: list[str]) -> dict[str, Any]:
    previous_props = previous.get("properties") or {}
    current_props = current.get("properties") or {}
    return {
        field: {
            "previous": previous_props.get(field, ""),
            "current": current_props.get(field, ""),
        }
        for field in changed_fields(previous, current, fields)
    }


def compare_builds(
    previous_data: dict[str, Any] | None,
    current_data: dict[str, Any],
    previous_build_id: str | None,
    current_build_id: str,
) -> dict[str, Any]:
    previous_by_uid = feature_index(previous_data or {"features": []})
    current_by_uid = feature_index(current_data)
    compare_available = bool(previous_by_uid)
    previous_ids = set(previous_by_uid)
    current_ids = set(current_by_uid)

    new_ids = sorted(current_ids - previous_ids)
    removed_ids = sorted(previous_ids - current_ids)
    common_ids = sorted(current_ids & previous_ids)

    category_changes = []
    name_changes = []
    confidence_changes = []
    source_changes = []
    moved_objects = []
    suspicious_moves = []
    changed_objects: dict[str, set[str]] = {}

    def mark_changed(uid: str, change_type: str) -> None:
        changed_objects.setdefault(uid, set()).add(change_type)

    for uid in common_ids:
        previous_feature = previous_by_uid[uid]
        current_feature = current_by_uid[uid]

        for change_type, fields in CHANGE_FIELDS.items():
            fields_changed = changed_fields(previous_feature, current_feature, fields)
            if not fields_changed:
                continue
            mark_changed(uid, change_type)
            item = {
                **feature_summary(current_feature),
                "changed_fields": fields_changed,
                "changes": field_change_summary(previous_feature, current_feature, fields),
            }
            if change_type == "category":
                category_changes.append(item)
            elif change_type == "name":
                name_changes.append(item)
            elif change_type == "confidence":
                confidence_changes.append(item)
            elif change_type == "source":
                source_changes.append(item)

        previous_point = point_for_feature(previous_feature)
        current_point = point_for_feature(current_feature)
        if previous_point and current_point:
            distance_km = haversine_km(previous_point, current_point)
            if distance_km >= MOVE_THRESHOLD_KM:
                mark_changed(uid, "moved")
                item = {
                    **feature_summary(current_feature),
                    "previous_latitude": previous_point[0],
                    "previous_longitude": previous_point[1],
                    "current_latitude": current_point[0],
                    "current_longitude": current_point[1],
                    "distance_km": round(distance_km, 3),
                }
                moved_objects.append(item)
                if distance_km >= SUSPICIOUS_MOVE_THRESHOLD_KM:
                    suspicious_moves.append(item)

    for feature in current_by_uid.values():
        props = feature.setdefault("properties", {})
        uid = feature_uid(feature)
        previous_feature = previous_by_uid.get(uid)
        if not compare_available:
            status = "baseline"
            change_types: list[str] = []
        elif uid in new_ids:
            status = "new"
            change_types = ["new"]
        else:
            change_types = sorted(changed_objects.get(uid, set()))
            status = "changed" if change_types else "unchanged"

        props["first_seen_build"] = (
            current_build_id
            if status in {"baseline", "new"} or not previous_feature
            else first_nonempty((previous_feature.get("properties") or {}).get("first_seen_build"), previous_build_id, current_build_id)
        )
        props["last_seen_build"] = current_build_id
        props["change_status"] = status
        props["change_types"] = change_types
        props["changed_since_previous_build"] = "true" if status == "changed" else "false"
        props["new_in_latest_build"] = "true" if status == "new" else "false"
        props["removed_from_latest_build"] = "false"
        props["source_archive_date"] = feature_date_value(feature)

    removed_objects = []
    for uid in removed_ids:
        feature = previous_by_uid[uid]
        props = feature.get("properties") or {}
        removed_objects.append(
            {
                **feature_summary(feature),
                "first_seen_build": first_nonempty(props.get("first_seen_build"), previous_build_id),
                "last_seen_build": first_nonempty(props.get("last_seen_build"), previous_build_id),
                "removed_from_latest_build": "true",
            }
        )

    changed_ids = set(changed_objects)
    summary = {
        "compare_available": compare_available,
        "previous_build_id": previous_build_id or "",
        "current_build_id": current_build_id,
        "current_object_count": len(current_ids),
        "previous_object_count": len(previous_ids),
        "new_objects": len(new_ids) if compare_available else 0,
        "removed_objects": len(removed_ids) if compare_available else 0,
        "changed_objects": len(changed_ids) if compare_available else 0,
        "moved_objects": len(moved_objects) if compare_available else 0,
        "category_changes": len(category_changes) if compare_available else 0,
        "name_changes": len(name_changes) if compare_available else 0,
        "confidence_changes": len(confidence_changes) if compare_available else 0,
        "source_changes": len(source_changes) if compare_available else 0,
        "suspicious_coordinate_shifts": len(suspicious_moves) if compare_available else 0,
    }

    return {
        "schema_version": 1,
        "generated_at": utc_now_id(),
        "comparison": {
            "previous": previous_build_id or "",
            "current": current_build_id,
        },
        "summary": summary,
        "change_type_counts": dict(sorted(Counter(change for changes in changed_objects.values() for change in changes).items())),
        "new_objects": [feature_summary(current_by_uid[uid]) for uid in new_ids[:MAX_CHANGE_ITEMS]] if compare_available else [],
        "removed_objects": removed_objects[:MAX_CHANGE_ITEMS] if compare_available else [],
        "moved_objects": moved_objects[:MAX_CHANGE_ITEMS] if compare_available else [],
        "category_changes": category_changes[:MAX_CHANGE_ITEMS] if compare_available else [],
        "name_changes": name_changes[:MAX_CHANGE_ITEMS] if compare_available else [],
        "confidence_changes": confidence_changes[:MAX_CHANGE_ITEMS] if compare_available else [],
        "source_changes": source_changes[:MAX_CHANGE_ITEMS] if compare_available else [],
        "suspicious_coordinate_shifts": suspicious_moves[:MAX_CHANGE_ITEMS] if compare_available else [],
        "limits": {
            "max_items_per_section": MAX_CHANGE_ITEMS,
            "move_threshold_km": MOVE_THRESHOLD_KM,
            "suspicious_move_threshold_km": SUSPICIOUS_MOVE_THRESHOLD_KM,
        },
    }


def update_latest_snapshot(current_data: dict[str, Any], current_build_id: str) -> None:
    BUILD_HISTORY_DIR.mkdir(parents=True, exist_ok=True)
    baseline = baseline_snapshot(current_data)
    write_compact_json(LATEST_GEOJSON, baseline)
    write_json(
        LATEST_METADATA,
        {
            "build_id": current_build_id,
            "snapshot": str(LATEST_GEOJSON),
            "snapshot_type": "compact_change_baseline",
            "object_count": len(baseline["features"]),
            "updated_at": utc_now_id(),
        },
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--current", default=str(CURRENT_GEOJSON), help="Current normalized GeoJSON path.")
    parser.add_argument("--previous", default=str(LATEST_GEOJSON), help="Previous normalized GeoJSON snapshot path.")
    parser.add_argument("--previous-metadata", default=str(LATEST_METADATA), help="Previous build metadata path.")
    parser.add_argument("--output", default=str(CHANGE_REPORT_JSON), help="Change report JSON path.")
    parser.add_argument("--no-update-snapshot", action="store_true", help="Do not replace the latest build snapshot.")
    args = parser.parse_args()

    current_path = Path(args.current)
    previous_path = Path(args.previous)
    previous_metadata_path = Path(args.previous_metadata)
    output_path = Path(args.output)
    if not current_path.exists():
        raise FileNotFoundError(f"Missing current GeoJSON: {current_path}")

    current_build_id = build_id_from_report(NORMALIZATION_REPORT)
    previous_data = read_json(previous_path) if previous_path.exists() else None
    previous_build_id = ""
    if previous_metadata_path.exists():
        previous_build_id = str(read_json(previous_metadata_path).get("build_id") or "")

    current_data = read_json(current_path)
    report = compare_builds(previous_data, current_data, previous_build_id or None, current_build_id)
    write_json(output_path, report)
    write_compact_json(current_path, current_data)
    if not args.no_update_snapshot:
        update_latest_snapshot(current_data, current_build_id)

    summary = report["summary"]
    if summary["compare_available"]:
        print(
            "Change report: "
            f"+{summary['new_objects']:,} "
            f"-{summary['removed_objects']:,} "
            f"~{summary['changed_objects']:,} "
            f"!{summary['suspicious_coordinate_shifts']:,}"
        )
    else:
        print("Change report: initialized baseline snapshot; no previous build to compare.")
    print(f"Wrote {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
