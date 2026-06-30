#!/usr/bin/env python3
"""Run the local data build pipeline for all configured sources."""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path


LOCAL_STEPS = [
    ["extract_nightwatch_map.py"],
    ["combine_infrastructure_sources.py"],
    ["normalize_infrastructure_data.py"],
    ["enrich_translations_and_categories.py"],
    ["derive_countries_from_boundaries.py", "--input", "data/normalized_infrastructure.geojson", "--write"],
    ["generate_change_report.py"],
    ["prepare_web_data.py"],
]

REMOTE_STEPS = [
    ["extract_russia_oil_power_map.py"],
    ["extract_osint_varta_archive.py"],
    ["extract_nightwatch_map.py", "--refresh"],
]


def run_step(step: list[str]) -> None:
    script, *args = step
    print(f"\n==> {' '.join(step)}", flush=True)
    subprocess.run([sys.executable, script, *args], check=True)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--refresh-remote",
        action="store_true",
        help="Re-fetch remote/archived sources before rebuilding local outputs.",
    )
    args = parser.parse_args()

    missing = [step[0] for step in [*REMOTE_STEPS, *LOCAL_STEPS] if not Path(step[0]).exists()]
    if missing:
        raise FileNotFoundError(f"Missing pipeline scripts: {', '.join(missing)}")

    if args.refresh_remote:
        for step in REMOTE_STEPS:
            run_step(step)

    for step in LOCAL_STEPS:
        run_step(step)

    print("\nPipeline complete.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
