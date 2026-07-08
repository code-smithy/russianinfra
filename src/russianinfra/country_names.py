"""Country display-name helpers for app-facing data."""

from __future__ import annotations

from typing import Any


COUNTRY_CODE_NAMES = {
    "AF": "Afghanistan",
    "AM": "Armenia",
    "AZ": "Azerbaijan",
    "BG": "Bulgaria",
    "BY": "Belarus",
    "CN": "China",
    "DE": "Germany",
    "EE": "Estonia",
    "FI": "Finland",
    "GE": "Georgia",
    "IQ": "Iraq",
    "IR": "Iran",
    "KG": "Kyrgyzstan",
    "KZ": "Kazakhstan",
    "LT": "Lithuania",
    "LV": "Latvia",
    "MD": "Moldova",
    "MN": "Mongolia",
    "NO": "Norway",
    "PK": "Pakistan",
    "PL": "Poland",
    "RO": "Romania",
    "RU": "Russia",
    "SY": "Syria",
    "TJ": "Tajikistan",
    "TM": "Turkmenistan",
    "TR": "Turkey",
    "UA": "Ukraine",
}


def country_name_from_code(raw: Any) -> str:
    country = str(raw or "").strip()
    return COUNTRY_CODE_NAMES.get(country.upper(), country or "Unknown")


def normalized_country_list(raw: Any, fallback: Any = "Unknown") -> list[str]:
    values = raw if isinstance(raw, list) and raw else [fallback]
    countries = []
    seen = set()
    for value in values:
        country = country_name_from_code(value)
        if country not in seen:
            countries.append(country)
            seen.add(country)
    return countries or ["Unknown"]
