#!/usr/bin/env python3
"""Run the local data build pipeline for all configured sources."""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path


LOCAL_STEPS = [
    "extract_military_kml_text.py",
    "combine_infrastructure_sources.py",
    "normalize_infrastructure_data.py",
    "enrich_translations_and_categories.py",
    "prepare_web_data.py",
]

REMOTE_STEPS = [
    "extract_russia_oil_power_map.py",
    "extract_osint_varta_archive.py",
]


def run_step(script: str) -> None:
    print(f"\n==> {script}", flush=True)
    subprocess.run([sys.executable, script], check=True)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--refresh-remote",
        action="store_true",
        help="Re-fetch remote/archived sources before rebuilding local outputs.",
    )
    args = parser.parse_args()

    missing = [script for script in [*REMOTE_STEPS, *LOCAL_STEPS] if not Path(script).exists()]
    if missing:
        raise FileNotFoundError(f"Missing pipeline scripts: {', '.join(missing)}")

    if args.refresh_remote:
        for script in REMOTE_STEPS:
            run_step(script)

    for script in LOCAL_STEPS:
        run_step(script)

    print("\nPipeline complete.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
