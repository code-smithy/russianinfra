#!/usr/bin/env python3
"""Run the local data build pipeline for all configured sources."""

from __future__ import annotations

import argparse
import importlib.util
import subprocess
import sys


LOCAL_STEPS = [
    ["russianinfra.extract_nightwatch_map"],
    ["russianinfra.extract_un_locode"],
    ["russianinfra.combine_infrastructure_sources"],
    ["russianinfra.normalize_infrastructure_data"],
    ["russianinfra.enrich_translations_and_categories"],
    ["russianinfra.enrich_power_facilities"],
    ["russianinfra.derive_countries_from_boundaries", "--input", "data/normalized_infrastructure.geojson", "--write"],
    ["russianinfra.generate_change_report"],
    ["russianinfra.prepare_web_data"],
]

ROAD_OSM_STEP = ["russianinfra.extract_geofabrik_osm_roads"]

REMOTE_STEPS = [
    ["russianinfra.extract_russia_oil_power_map"],
    ["russianinfra.extract_osint_varta_archive"],
    ["russianinfra.extract_nightwatch_map", "--refresh"],
    ["russianinfra.extract_un_locode", "--refresh"],
    ["russianinfra.extract_gem_power_plants", "--refresh"],
    ["russianinfra.extract_iaea_pris", "--refresh"],
    ["russianinfra.extract_wri_power_plants", "--refresh"],
    ["russianinfra.extract_osm_power_facilities", "--refresh"],
]


def run_step(step: list[str]) -> None:
    module, *args = step
    print(f"\n==> {' '.join(step)}", flush=True)
    subprocess.run([sys.executable, "-m", module, *args], check=True)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--refresh-remote",
        action="store_true",
        help="Re-fetch remote/archived sources before rebuilding local outputs.",
    )
    parser.add_argument(
        "--refresh-road-osm",
        action="store_true",
        help="Download/update Geofabrik OSM PBF files for Russia, Ukraine, and Belarus before extraction.",
    )
    parser.add_argument(
        "--include-road-osm",
        action="store_true",
        help="Run the Geofabrik OSM road import and include its CSV in the combined build.",
    )
    parser.add_argument(
        "--skip-road-osm",
        action="store_true",
        help="Skip Geofabrik OSM road import and exclude roads from the combined build for faster non-road rebuilds.",
    )
    args = parser.parse_args()

    missing = [step[0] for step in [*REMOTE_STEPS, *LOCAL_STEPS, ROAD_OSM_STEP] if importlib.util.find_spec(step[0]) is None]
    if missing:
        raise ModuleNotFoundError(f"Missing pipeline modules: {', '.join(missing)}")

    if args.refresh_remote:
        for step in REMOTE_STEPS:
            run_step(step)
    include_roads = args.include_road_osm or args.refresh_road_osm
    if args.skip_road_osm:
        include_roads = False
    if include_roads:
        road_step = [*ROAD_OSM_STEP, *(["--refresh"] if args.refresh_road_osm else [])]
        run_step(road_step)

    for step in LOCAL_STEPS:
        if step[0] == "russianinfra.combine_infrastructure_sources" and not include_roads:
            run_step([*step, "--skip-osm-roads"])
        else:
            run_step(step)

    print("\nPipeline complete.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
