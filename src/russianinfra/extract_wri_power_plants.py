#!/usr/bin/env python3
"""Prepare cached WRI Global Power Plant Database enrichment files."""

from __future__ import annotations

import sys
from pathlib import Path

from russianinfra.power_enrichment_cache import cache_source_main


CACHE_DIR = Path("data/raw/power_enrichment/wri")
DEFAULT_URLS = [
    "https://raw.githubusercontent.com/wri/global-power-plant-database/master/output_database/global_power_plant_database.csv",
]


def main(argv: list[str] | None = None) -> int:
    return cache_source_main(
        CACHE_DIR,
        "WRI Global Power Plant Database",
        argv,
        default_urls=DEFAULT_URLS,
        env_url_names=["RUSSIANINFRA_WRI_POWER_URL", "WRI_POWER_URL"],
    )


if __name__ == "__main__":
    sys.exit(main())
