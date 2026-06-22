#!/usr/bin/env python3
"""Export archived OSINT Varta map points to CSV."""

from __future__ import annotations

import csv
import json
import sys
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any


CDX_URL = (
    "https://web.archive.org/cdx?"
    "url=map.osint-varta.com.ua/graphql*&"
    "output=json&fl=timestamp,original,statuscode,mimetype,digest&"
    "filter=statuscode:200&collapse=digest"
)
OUT_DIR = Path("data")
RAW_DIR = OUT_DIR / "raw"
CSV_PATH = OUT_DIR / "osint_varta_map_points_archived.csv"
SOURCE_NAME = "OSINT Varta"


def fetch_bytes(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=90) as resp:
        return resp.read()


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


def latest_map_points_capture() -> tuple[str, str]:
    cached_cdx = RAW_DIR / "osint_varta_cdx_all.json"
    if cached_cdx.exists():
        cdx = json.loads(cached_cdx.read_text(encoding="utf-8-sig"))
    else:
        cdx = fetch_json(CDX_URL, RAW_DIR / "osint_varta_cdx_get_map_points.json")
    if not isinstance(cdx, list) or len(cdx) < 2:
        raise RuntimeError("No archived OSINT Varta GetMapPoints capture found.")

    headers = cdx[0]
    rows = [dict(zip(headers, row)) for row in cdx[1:]]
    rows = [row for row in rows if "GetMapPoints" in row.get("original", "")]
    if not rows:
        raise RuntimeError("CDX returned captures, but none matched GetMapPoints.")
    rows.sort(key=lambda row: row["timestamp"])
    chosen = rows[-1]
    return chosen["timestamp"], chosen["original"]


def archived_url(timestamp: str, original: str) -> str:
    return f"https://web.archive.org/web/{timestamp}if_/{original}"


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


def main() -> int:
    timestamp, original = latest_map_points_capture()
    url = archived_url(timestamp, original)
    print(f"Fetching archived OSINT Varta map points: {url}")
    payload = fetch_json(url, RAW_DIR / "osint_varta_get_map_points_archived.json")
    items = payload.get("data", {}).get("mapPoints", {}).get("items", [])
    pagination = payload.get("data", {}).get("mapPoints", {}).get("pagination", {})
    if not isinstance(items, list):
        raise RuntimeError("Archived payload did not contain mapPoints.items.")

    rows = [item_to_row(item, index, url, timestamp) for index, item in enumerate(items, 1)]
    write_csv(rows)

    total_count = pagination.get("totalCount", "")
    print(f"Wrote {len(rows):,} OSINT Varta map points to {CSV_PATH}")
    if total_count != "":
        print(f"Archived pagination totalCount: {total_count:,}")
    print(f"Archive timestamp: {timestamp}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
