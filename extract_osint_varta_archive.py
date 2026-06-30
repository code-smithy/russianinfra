#!/usr/bin/env python3
"""Export archived OSINT Varta map points to CSV."""

from __future__ import annotations

import csv
import json
import sys
import time
import urllib.parse
import urllib.request
from urllib.error import URLError
from pathlib import Path
from typing import Any


CDX_URLS = [
    "https://web.archive.org/cdx?"
    "url=map.osint-varta.com.ua/graphql*&"
    "output=json&fl=timestamp,original,statuscode,mimetype,digest&"
    "filter=statuscode:200&collapse=digest",
    "https://web.archive.org/cdx?"
    "url=map.osint-varta.com.ua/*&"
    "output=json&fl=timestamp,original,statuscode,mimetype,digest&"
    "filter=statuscode:200&collapse=digest",
]
OUT_DIR = Path("data")
RAW_DIR = OUT_DIR / "raw"
CSV_PATH = OUT_DIR / "osint_varta_map_points_archived.csv"
FALLBACK_WEB_GEOJSON = Path("web/data/military_industrial.geojson")
SOURCE_NAME = "OSINT Varta"


def fetch_bytes(url: str, attempts: int = 3) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    last_error: Exception | None = None
    for attempt in range(1, attempts + 1):
        try:
            with urllib.request.urlopen(req, timeout=90) as resp:
                return resp.read()
        except URLError as exc:
            last_error = exc
            if attempt == attempts:
                break
            wait_seconds = 2**attempt
            print(f"Fetch failed ({exc}); retrying in {wait_seconds}s...", file=sys.stderr)
            time.sleep(wait_seconds)
    raise RuntimeError(f"Failed to fetch {url} after {attempts} attempts") from last_error


def fetch_json(url: str, target: Path | None = None) -> Any:
    data = fetch_bytes(url)
    if target:
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
    return json.loads(data.decode("utf-8-sig"))


def flatten(prefix: str, value: Any, out: dict[str, Any]) -> None:
    if isinstance(value, dict):
        for key, child in value.items():
            flatten(f"{prefix}_{key}" if prefix else str(key), child, out)
    elif isinstance(value, list):
        out[prefix] = json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    else:
        out[prefix] = value


def cdx_rows(cdx: Any) -> list[dict[str, str]]:
    if not isinstance(cdx, list) or len(cdx) < 2:
        return []

    headers = cdx[0]
    return [dict(zip(headers, row)) for row in cdx[1:]]


def map_points_captures() -> list[tuple[str, str]]:
    cached_cdx = RAW_DIR / "osint_varta_cdx_all.json"
    all_rows: list[dict[str, str]] = []
    if cached_cdx.exists():
        all_rows.extend(cdx_rows(json.loads(cached_cdx.read_text(encoding="utf-8-sig"))))
    else:
        for index, url in enumerate(CDX_URLS, 1):
            try:
                cdx = fetch_json(url, RAW_DIR / f"osint_varta_cdx_{index}.json")
            except Exception as exc:
                print(f"WARNING: OSINT Varta CDX lookup failed for {url}: {exc}", file=sys.stderr)
                continue
            all_rows.extend(cdx_rows(cdx))

    rows = [row for row in all_rows if "GetMapPoints" in row.get("original", "")]
    if not rows:
        raise RuntimeError("CDX returned captures, but none matched GetMapPoints.")

    seen: set[tuple[str, str]] = set()
    captures: list[tuple[str, str]] = []
    for row in sorted(rows, key=lambda item: item["timestamp"], reverse=True):
        capture = (row["timestamp"], row["original"])
        if capture in seen:
            continue
        seen.add(capture)
        captures.append(capture)
    return captures


def archived_url(timestamp: str, original: str) -> str:
    return f"https://web.archive.org/web/{timestamp}if_/{original}"


def map_points_payload(payload: Any) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    if not isinstance(payload, dict):
        raise RuntimeError("Archived payload was not a JSON object.")
    map_points = payload.get("data", {}).get("mapPoints", {})
    items = map_points.get("items", [])
    pagination = map_points.get("pagination", {})
    if not isinstance(items, list):
        raise RuntimeError("Archived payload did not contain mapPoints.items.")
    return items, pagination if isinstance(pagination, dict) else {}


def fetch_latest_available_map_points() -> tuple[list[dict[str, Any]], dict[str, Any], str, str]:
    errors: list[str] = []
    captures = map_points_captures()
    for timestamp, original in captures:
        url = archived_url(timestamp, original)
        print(f"Fetching archived OSINT Varta map points: {url}")
        try:
            payload = fetch_json(url, RAW_DIR / "osint_varta_get_map_points_archived.json")
            items, pagination = map_points_payload(payload)
        except Exception as exc:
            errors.append(f"{timestamp}: {exc}")
            print(f"WARNING: OSINT Varta capture {timestamp} failed: {exc}", file=sys.stderr)
            continue
        return items, pagination, timestamp, url

    detail = "; ".join(errors[:5])
    suffix = f" First failures: {detail}" if detail else ""
    raise RuntimeError(f"No usable archived OSINT Varta GetMapPoints capture found after trying {len(captures)} captures.{suffix}")


def item_to_row(item: dict[str, Any], index: int, source_url: str, archive_timestamp: str) -> dict[str, Any]:
    address = item.get("address") if isinstance(item.get("address"), dict) else {}
    sanctioned = item.get("sanctioned") if isinstance(item.get("sanctioned"), dict) else {}
    latitude = address.get("latitude")
    longitude = address.get("longitude")
    row: dict[str, Any] = {
        "source_dataset": SOURCE_NAME,
        "layer": "osint_varta_map_points",
        "feature_index": index,
        "feature_id": item.get("id", ""),
        "name": item.get("nameShort") or item.get("name") or "",
        "inn": item.get("inn", ""),
        "region": item.get("regionName", ""),
        "longitude": longitude if longitude is not None else "",
        "latitude": latitude if latitude is not None else "",
        "is_sanctioned": sanctioned.get("isSanctioned", ""),
        "is_mass_director": item.get("isMassDirector", ""),
        "is_mass_founder": item.get("isMassFounder", ""),
        "is_disqualified_persons": item.get("isDisqualifiedPersons", ""),
        "archive_timestamp": archive_timestamp,
        "source_url": source_url,
        "raw_item_json": json.dumps(item, ensure_ascii=False, separators=(",", ":")),
    }
    flattened: dict[str, Any] = {}
    flatten("varta", item, flattened)
    row.update(flattened)
    return row


def write_csv(rows: list[dict[str, Any]]) -> None:
    preferred = [
        "source_dataset",
        "layer",
        "feature_id",
        "feature_index",
        "name",
        "inn",
        "region",
        "longitude",
        "latitude",
        "is_sanctioned",
        "is_mass_director",
        "is_mass_founder",
        "is_disqualified_persons",
        "archive_timestamp",
        "source_url",
    ]
    fieldnames = preferred + sorted({key for row in rows for key in row} - set(preferred))
    CSV_PATH.parent.mkdir(parents=True, exist_ok=True)
    with CSV_PATH.open("w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def fallback_row_from_feature(feature: dict[str, Any], index: int) -> dict[str, Any]:
    props = feature.get("properties") if isinstance(feature.get("properties"), dict) else {}
    geometry = feature.get("geometry") if isinstance(feature.get("geometry"), dict) else {}
    coordinates = geometry.get("coordinates") if geometry.get("type") == "Point" else []
    longitude = props.get("longitude") or props.get("map_longitude") or (coordinates[0] if len(coordinates) >= 2 else "")
    latitude = props.get("latitude") or props.get("map_latitude") or (coordinates[1] if len(coordinates) >= 2 else "")
    source_record_id = props.get("source_record_id") or props.get("uid") or f"fallback_{index:05d}"
    archive_timestamp = props.get("source_archive_date") or props.get("source_capture_date") or ""
    source_url = props.get("source_url") or ""
    raw_item = {
        "fallback_source": str(FALLBACK_WEB_GEOJSON),
        "uid": props.get("uid", ""),
        "source_id": props.get("source_id", ""),
    }
    return {
        "source_dataset": SOURCE_NAME,
        "layer": "osint_varta_map_points",
        "feature_index": index,
        "feature_id": source_record_id,
        "name": props.get("name") or props.get("display_label") or "",
        "inn": props.get("inn", ""),
        "region": props.get("region", ""),
        "longitude": longitude,
        "latitude": latitude,
        "is_sanctioned": props.get("is_sanctioned", ""),
        "is_mass_director": props.get("is_mass_director", ""),
        "is_mass_founder": props.get("is_mass_founder", ""),
        "is_disqualified_persons": props.get("is_disqualified_persons", ""),
        "archive_timestamp": archive_timestamp,
        "source_url": source_url,
        "raw_item_json": json.dumps(raw_item, ensure_ascii=False, separators=(",", ":")),
    }


def fallback_rows_from_web_geojson(path: Path = FALLBACK_WEB_GEOJSON) -> list[dict[str, Any]]:
    if not path.exists():
        raise FileNotFoundError(f"Missing fallback OSINT Varta web layer: {path}")
    with path.open("r", encoding="utf-8") as handle:
        data = json.load(handle)
    features = data.get("features", [])
    if not isinstance(features, list):
        raise RuntimeError(f"Fallback OSINT Varta layer has no features list: {path}")
    rows = [
        fallback_row_from_feature(feature, index)
        for index, feature in enumerate(features, 1)
        if isinstance(feature, dict)
    ]
    if not rows:
        raise RuntimeError(f"Fallback OSINT Varta layer had no usable features: {path}")
    return rows


def main() -> int:
    try:
        items, pagination, timestamp, url = fetch_latest_available_map_points()
        rows = [item_to_row(item, index, url, timestamp) for index, item in enumerate(items, 1)]
        write_csv(rows)

        total_count = pagination.get("totalCount", "")
        print(f"Wrote {len(rows):,} OSINT Varta map points to {CSV_PATH}")
        if total_count != "":
            print(f"Archived pagination totalCount: {total_count:,}")
        print(f"Archive timestamp: {timestamp}")
    except Exception as exc:
        print(f"WARNING: OSINT Varta archive refresh failed: {exc}", file=sys.stderr)
        print(f"Using fallback rows from {FALLBACK_WEB_GEOJSON}", file=sys.stderr)
        rows = fallback_rows_from_web_geojson()
        write_csv(rows)
        print(f"Wrote {len(rows):,} fallback OSINT Varta map points to {CSV_PATH}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
