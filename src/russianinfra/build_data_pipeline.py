#!/usr/bin/env python3
"""Run the local data build pipeline for all configured sources."""

from __future__ import annotations

import argparse
import importlib.util
import subprocess
import sys


LOCAL_STEPS = [
    ["russianinfra.extract_nightwatch_map"],
    ["russianinfra.combine_infrastructure_sources"],
    ["russianinfra.normalize_infrastructure_data"],
    ["russianinfra.enrich_translations_and_categories"],
    ["russianinfra.derive_countries_from_boundaries", "--input", "data/normalized_infrastructure.geojson", "--write"],
    ["russianinfra.generate_change_report"],
    ["russianinfra.prepare_web_data"],
]

REMOTE_STEPS = [
    ["russianinfra.extract_russia_oil_power_map"],
    ["russianinfra.extract_osint_varta_archive"],
    ["russianinfra.extract_nightwatch_map", "--refresh"],
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
    args = parser.parse_args()

    missing = [step[0] for step in [*REMOTE_STEPS, *LOCAL_STEPS] if importlib.util.find_spec(step[0]) is None]
    if missing:
        raise ModuleNotFoundError(f"Missing pipeline modules: {', '.join(missing)}")

    if args.refresh_remote:
        for step in REMOTE_STEPS:
            run_step(step)

    for step in LOCAL_STEPS:
        run_step(step)

    print("\nPipeline complete.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
