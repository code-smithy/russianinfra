#!/usr/bin/env python3
"""Download and cache OpenStreetMap power facilities from Geofabrik PBF extracts."""

from __future__ import annotations

import argparse
import email.utils
import json
import os
import shutil
import subprocess
import sys
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.error import HTTPError

from russianinfra.power_enrichment_cache import cache_source_main


RAW_DIR = Path("data/raw/osm/geofabrik")
CACHE_DIR = Path("data/raw/power_enrichment/osm")
WORK_DIR = Path("data/extracted/osm_power")
DEFAULT_USER_AGENT = "russianinfra-power-enrichment/0.8"


@dataclass(frozen=True)
class OsmExtract:
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
        return WORK_DIR / f"{self.slug}-power-facilities.osm.pbf"

    @property
    def geojsonseq_path(self) -> Path:
        return WORK_DIR / f"{self.slug}-power-facilities.geojsonseq"

    @property
    def cache_path(self) -> Path:
        return CACHE_DIR / f"geofabrik_{self.slug}_power_facilities.json"


EXTRACTS = {
    "russia": OsmExtract(
        slug="russia",
        country_code="RU",
        country_name="Russia",
        pbf_url="https://download.geofabrik.de/russia-latest.osm.pbf",
        page_url="https://download.geofabrik.de/russia.html",
    ),
    "kaliningrad": OsmExtract(
        slug="kaliningrad",
        country_code="RU",
        country_name="Russia",
        pbf_url="https://download.geofabrik.de/russia/kaliningrad-latest.osm.pbf",
        page_url="https://download.geofabrik.de/russia/kaliningrad.html",
    ),
}


def fetch_source(extract: OsmExtract, force: bool = False) -> str:
    """Download a Geofabrik PBF, using If-Modified-Since when a cache exists."""
    extract.raw_path.parent.mkdir(parents=True, exist_ok=True)
    headers = {"User-Agent": DEFAULT_USER_AGENT}
    if extract.raw_path.exists() and not force:
        headers["If-Modified-Since"] = email.utils.formatdate(extract.raw_path.stat().st_mtime, usegmt=True)

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


def run_osmium_extract(extract: OsmExtract, osmium_bin: str = "osmium") -> None:
    if not extract.raw_path.exists():
        raise FileNotFoundError(f"Missing cached PBF: {extract.raw_path}")
    if shutil.which(osmium_bin) is None:
        raise FileNotFoundError(f"Missing osmium executable: {osmium_bin}")

    WORK_DIR.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [
            osmium_bin,
            "tags-filter",
            str(extract.raw_path),
            "n/power=plant,generator,substation",
            "w/power=plant,generator,substation",
            "r/power=plant,generator,substation",
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


def representative_point(geometry: dict[str, Any] | None) -> tuple[str, str]:
    positions = iter_positions(geometry)
    if not positions:
        return "", ""
    lon = sum(item[0] for item in positions) / len(positions)
    lat = sum(item[1] for item in positions) / len(positions)
    return f"{lat:.8f}", f"{lon:.8f}"


def normalize_feature(feature: dict[str, Any], extract: OsmExtract, index: int) -> dict[str, Any] | None:
    props = dict(feature.get("properties") or {})
    power_value = str(props.get("power") or "").strip()
    if power_value not in {"plant", "generator", "substation"}:
        return None
    lat, lon = representative_point(feature.get("geometry"))
    props.setdefault("latitude", lat)
    props.setdefault("longitude", lon)
    props.setdefault("country_code", extract.country_code)
    props.setdefault("country", extract.country_name)
    props.setdefault("source_url", extract.pbf_url)
    props.setdefault("source_page_url", extract.page_url)
    props.setdefault("source_file", str(extract.raw_path))
    props.setdefault("source_line_or_record_id", str(index))
    props.setdefault("source_record_id", str(feature.get("id") or f"{extract.slug}:{index}"))
    props.setdefault("tags", {key: val for key, val in props.items() if isinstance(val, (str, int, float, bool))})
    return {
        "type": "Feature",
        "id": props["source_record_id"],
        "geometry": feature.get("geometry"),
        "properties": props,
    }


def geojsonseq_to_feature_collection(extract: OsmExtract) -> dict[str, Any]:
    features = []
    with extract.geojsonseq_path.open("r", encoding="utf-8-sig") as handle:
        for index, line in enumerate(handle, start=1):
            line = line.strip()
            if not line:
                continue
            feature = normalize_feature(json.loads(line), extract, index)
            if feature:
                features.append(feature)
    return {"type": "FeatureCollection", "features": features}


def write_cache(extract: OsmExtract, collection: dict[str, Any]) -> None:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    extract.cache_path.write_text(json.dumps(collection, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", action="append", type=Path, default=[], help="Local CSV or JSON file to copy into the OSM power cache.")
    parser.add_argument("--refresh", action="store_true", help="Download/filter/export Geofabrik OSM power facilities.")
    parser.add_argument("--extract", choices=sorted(EXTRACTS), default="russia", help="Geofabrik extract to refresh.")
    parser.add_argument("--extract-url", help="Override the Geofabrik PBF URL for the selected extract.")
    parser.add_argument("--force-download", action="store_true", help="Ignore local PBF timestamps when refreshing.")
    parser.add_argument("--osmium-bin", default="osmium", help="Path to the osmium executable.")
    parser.add_argument("--allow-empty", action="store_true", help="Allow writing an empty cache file if the filter returns no features.")
    args = parser.parse_args(argv)

    if args.input:
        copy_args = []
        for path in args.input:
            copy_args.extend(["--input", str(path)])
        cache_source_main(CACHE_DIR, "OpenStreetMap power facilities", copy_args)
    if not args.refresh:
        if not args.input:
            print(f"OpenStreetMap power facilities cache directory ready: {CACHE_DIR}")
        return 0

    extract = EXTRACTS[args.extract]
    if args.extract_url:
        extract = OsmExtract(extract.slug, extract.country_code, extract.country_name, args.extract_url, extract.page_url)
    status = fetch_source(extract, force=args.force_download)
    print(f"{extract.country_name} ({extract.slug}) PBF: {status}")
    run_osmium_extract(extract, osmium_bin=args.osmium_bin)
    collection = geojsonseq_to_feature_collection(extract)
    if not collection["features"] and not args.allow_empty:
        raise RuntimeError("No OSM power facilities extracted; pass --allow-empty for an intentional empty cache.")
    write_cache(extract, collection)
    print(f"Wrote {len(collection['features']):,} OSM power feature(s) to {extract.cache_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
