#!/usr/bin/env python3
"""Prepare cached Global Energy Monitor power-plant enrichment files."""

from __future__ import annotations

import sys
from pathlib import Path

from russianinfra.power_enrichment_cache import cache_source_main


CACHE_DIR = Path("data/raw/power_enrichment/gem")


def main(argv: list[str] | None = None) -> int:
    return cache_source_main(
        CACHE_DIR,
        "Global Energy Monitor",
        argv,
        env_url_names=["RUSSIANINFRA_GEM_POWER_URL", "GEM_POWER_URL"],
    )


if __name__ == "__main__":
    sys.exit(main())
