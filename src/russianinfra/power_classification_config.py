"""Configuration for power-facility classification and matching."""

from __future__ import annotations


POWER_MATCH_CONFIG = {
    "automatic_verified_threshold": 0.90,
    "automatic_corroborated_threshold": 0.75,
    "review_threshold": 0.55,
    "maximum_name_match_distance_km": 25.0,
    "maximum_operator_match_distance_km": 15.0,
    "maximum_weak_match_distance_km": 5.0,
}

NUCLEAR_SOURCE_PRIORITY = [
    "iaea_pris",
    "global_energy_monitor",
    "official",
    "wri_global_power_plant_database",
    "openstreetmap",
    "russia_oil_power_map",
    "name_pattern",
]

NON_NUCLEAR_SOURCE_PRIORITY = [
    "global_energy_monitor",
    "official",
    "wri_global_power_plant_database",
    "openstreetmap",
    "russia_oil_power_map",
    "name_pattern",
]

SOURCE_DISPLAY_NAMES = {
    "iaea_pris": "IAEA PRIS",
    "global_energy_monitor": "Global Energy Monitor",
    "official": "Official operator/government source",
    "wri_global_power_plant_database": "WRI Global Power Plant Database",
    "openstreetmap": "OpenStreetMap",
    "russia_oil_power_map": "Russia Oil & Power Infrastructure Map",
    "name_pattern": "Conservative name pattern",
}
