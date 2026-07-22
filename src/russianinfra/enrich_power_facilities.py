#!/usr/bin/env python3
"""Classify power stations and substations with conservative provenance."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
import re
import sys
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from russianinfra.power_classification_config import (
    NON_NUCLEAR_SOURCE_PRIORITY,
    NUCLEAR_SOURCE_PRIORITY,
    POWER_MATCH_CONFIG,
    SOURCE_DISPLAY_NAMES,
)


DATA_DIR = Path("data")
NORMALIZED_CSV = DATA_DIR / "normalized_infrastructure.csv"
NORMALIZED_GEOJSON = DATA_DIR / "normalized_infrastructure.geojson"
REPORT_JSON = DATA_DIR / "power_classification_report.json"
NORMALIZATION_REPORT_JSON = DATA_DIR / "normalization_report.json"
POWER_REFERENCES_CSV = DATA_DIR / "power_classification_references.csv"
RAW_ENRICHMENT_DIR = DATA_DIR / "raw" / "power_enrichment"
REVIEW_DIR = DATA_DIR / "review"
MANUAL_OBJECT_OVERRIDES_CSV = DATA_DIR / "manual" / "object_overrides.csv"
DATA_PACKAGE_MANIFEST = Path("data_package") / "manifest.json"

POWER_CLASSIFICATION_FIELDS = [
    "generation_type",
    "primary_fuel",
    "secondary_fuels",
    "plant_role",
    "technology",
    "installed_capacity_mw",
    "operational_status",
    "classification_confidence",
    "classification_confidence_score",
    "classification_method",
    "classification_sources",
    "classification_notes",
    "alternate_names",
    "name_ru",
    "match_score",
    "match_method",
    "matched_source_record_ids",
    "is_nuclear",
    "nuclear_status",
    "reactor_count",
    "operating_reactor_count",
    "reactor_types",
    "nuclear_reference_ids",
    "radiological_risk",
    "substation_type",
    "voltage_kv",
    "voltage_levels_kv",
    "connected_generation_type",
    "ecological_risk_category",
    "political_significance",
    "risk_assessment_status",
]

POWER_DERIVED_FIELDS = [
    "derived_subcategory",
    "derived_subcategory_label",
    "derived_subcategory_confidence",
    "derived_subcategory_reason",
]

POWER_ALL_FIELDS = POWER_CLASSIFICATION_FIELDS + POWER_DERIVED_FIELDS

POWER_REFERENCE_FIELDS = [
    "object_id",
    "reference_id",
    "source_id",
    "source_name",
    "source_record_id",
    "source_url",
    "retrieved_at",
    "field_supported",
    "value_supported",
    "match_score",
    "relationship",
]

MANUAL_OVERRIDE_ISSUE_FIELDS = [
    "object_id",
    "field",
    "new_value",
    "issue_reason",
    "reason",
    "reviewer",
    "reviewed_at",
    "review_status",
]

MANUAL_OVERRIDE_FIELDS = {
    "generation_type",
    "primary_fuel",
    "plant_role",
    "technology",
    "is_nuclear",
    "nuclear_status",
    "operational_status",
    "classification_confidence",
    "classification_notes",
}

POWER_STATION_SUBCATEGORY_LABELS = {
    "nuclear_power_station": "Nuclear power stations",
    "thermal_power_station": "Thermal power stations",
    "hydro_power_station": "Hydroelectric power stations",
    "pumped_storage_power_station": "Pumped-storage stations",
    "solar_power_station": "Solar power stations",
    "wind_power_station": "Wind power stations",
    "bioenergy_power_station": "Bioenergy power stations",
    "other_power_station": "Other power stations",
    "power_station_unknown_type": "Unknown power-station type",
    "substation": "Substations",
}

NON_NUCLEAR_GENERATION_TYPES = {
    "thermal",
    "hydro",
    "pumped_storage",
    "solar",
    "wind",
    "geothermal",
    "bioenergy",
    "tidal",
    "other",
}

NAME_FALSE_POSITIVE_RE = re.compile(
    r"\b(research institute|fuel company|energy corporation|atomic energy corporation|office|equipment factory|engineering company)\b",
    re.I,
)

PATTERN_RULES = [
    (
        "nuclear",
        re.compile(
            r"(\bnuclear\s+(power\s+)?(plant|station)\b|\bnpp\b|\b[a-z]+skaya\s+aes\b|\bаэс\b|атомн\w+\s+(электростанц|станц))",
            re.I,
        ),
    ),
    (
        "pumped_storage",
        re.compile(r"(\bpumped[-\s]?storage\b|\bpspp\b|\bгаэс\b)", re.I),
    ),
    (
        "hydro",
        re.compile(r"(\bhydroelectric\b|\bhydro\s+power\b|\bhpp\b|\bгэс\b|гидроэлектростанц)", re.I),
    ),
    (
        "solar",
        re.compile(r"(\bsolar\s+(power\s+)?(plant|station|farm)\b|\bphotovoltaic\b|\bсэс\b)", re.I),
    ),
    (
        "wind",
        re.compile(r"(\bwind\s+(power\s+)?(plant|station|farm)\b|\bвэс\b)", re.I),
    ),
    (
        "thermal",
        re.compile(r"(\bthermal\s+power\s+(plant|station)\b|\btpp\b|\bgres\b|\bтэс\b|\bгрэс\b)", re.I),
    ),
    (
        "chp",
        re.compile(r"(\bchp[-\s]?\d*\b|\bcombined\s+heat\s+and\s+power\b|\bcogeneration\b|\bтэц\b|теплоэлектроцентрал)", re.I),
    ),
]

FUEL_ALIASES = {
    "nuclear": "uranium",
    "hydro": "water",
    "pumped_storage": "water",
    "solar": "solar",
    "wind": "wind",
    "geothermal": "geothermal",
    "tidal": "tidal",
    "coal": "coal",
    "gas": "natural_gas",
    "natural gas": "natural_gas",
    "oil": "oil",
    "diesel": "diesel",
    "biomass": "biomass",
    "waste": "waste",
    "lignite": "lignite",
    "peat": "peat",
}

CYRILLIC_RE = re.compile(r"[\u0400-\u04FF]")


@dataclass
class Evidence:
    source_id: str
    source_name: str
    source_record_id: str
    field_values: dict[str, str]
    source_url: str = ""
    match_score: float = 1.0
    match_method: str = "name_pattern"
    relationship: str = "classification_evidence"


@dataclass
class ClassificationResult:
    fields: dict[str, str] = field(default_factory=dict)
    evidence: list[Evidence] = field(default_factory=list)
    conflicts: list[dict[str, str]] = field(default_factory=list)
    review_matches: list[Evidence] = field(default_factory=list)
    nuclear_candidate_reason: str = ""


def value(row: dict[str, Any], key: str) -> str:
    return str(row.get(key) or "").strip()


def parse_float(raw: Any) -> float | None:
    if raw in ("", None):
        return None
    try:
        return float(raw)
    except (TypeError, ValueError):
        return None


def compact_json(raw: Any) -> str:
    if raw in ("", None):
        return ""
    return json.dumps(raw, ensure_ascii=False, separators=(",", ":"))


def source_value(row: dict[str, Any], *keys: str) -> str:
    for key in keys:
        if key in row:
            text = value(row, key)
            if text:
                return text
    return ""


def source_aliases(row: dict[str, Any], primary_name: str) -> list[str]:
    aliases: list[str] = []
    for key in [
        "name_en",
        "name:en",
        "english_name",
        "name_ru",
        "name:ru",
        "russian_name",
        "local_name",
        "alternate_names",
        "alternative_names",
        "aliases",
        "other_names",
    ]:
        raw = row.get(key)
        if isinstance(raw, list):
            aliases.extend(str(item).strip() for item in raw if str(item).strip())
            continue
        text = str(raw or "").strip()
        if not text:
            continue
        aliases.extend(part.strip() for part in re.split(r"[;|]", text) if part.strip())
    return sorted({alias for alias in aliases if alias and alias != primary_name})


def cached_source_row(row: dict[str, Any]) -> dict[str, Any]:
    """Flatten common CSV/JSON/GeoJSON source shapes into one lookup dict."""
    flattened = dict(row)
    properties = row.get("properties")
    if isinstance(properties, dict):
        for key, val in properties.items():
            flattened.setdefault(key, val)
    tags = flattened.get("tags")
    if isinstance(tags, dict):
        for key, val in tags.items():
            flattened.setdefault(key, val)
            flattened.setdefault(f"tag_{key}", val)
    geometry = row.get("geometry")
    if isinstance(geometry, dict) and geometry.get("type") == "Point":
        coords = geometry.get("coordinates")
        if isinstance(coords, list) and len(coords) >= 2:
            flattened.setdefault("longitude", coords[0])
            flattened.setdefault("latitude", coords[1])
    return flattened


def normalize_name(raw: str) -> str:
    text = str(raw or "").casefold()
    replacements = {
        "nuclear power plant": "npp",
        "nuclear power station": "npp",
        "hydroelectric power plant": "hpp",
        "hydroelectric station": "hpp",
        "hydro power plant": "hpp",
        "thermal power plant": "tpp",
        "thermal power station": "tpp",
        "combined heat and power": "chp",
        "power plant": "",
        "power station": "",
        "station": "",
        "plant": "",
        "электростанция": "",
        "электростанции": "",
    }
    for old, new in replacements.items():
        text = text.replace(old, new)
    text = re.sub(r"[^0-9a-zа-яё]+", " ", text, flags=re.I)
    return " ".join(text.split())


def name_similarity(a: str, b: str) -> float:
    left = set(normalize_name(a).split())
    right = set(normalize_name(b).split())
    if not left or not right:
        return 0.0
    overlap = len(left & right)
    return overlap / max(len(left), len(right))


def distance_km(lat1: float | None, lon1: float | None, lat2: float | None, lon2: float | None) -> float | None:
    if None in {lat1, lon1, lat2, lon2}:
        return None
    assert lat1 is not None and lon1 is not None and lat2 is not None and lon2 is not None
    radius = 6371.0088
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    h = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * radius * math.asin(min(1.0, math.sqrt(h)))


def source_priority(source_id: str, generation_type: str) -> int:
    priority = NUCLEAR_SOURCE_PRIORITY if generation_type == "nuclear" else NON_NUCLEAR_SOURCE_PRIORITY
    try:
        return priority.index(source_id)
    except ValueError:
        return len(priority)


def default_power_fields(asset_type: str) -> dict[str, str]:
    fields = {field_name: "" for field_name in POWER_CLASSIFICATION_FIELDS}
    fields.update(
        {
            "generation_type": "unknown",
            "primary_fuel": "unknown",
            "secondary_fuels": "[]",
            "plant_role": "unknown",
            "operational_status": "unknown",
            "classification_confidence": "unknown",
            "classification_confidence_score": "0.00",
            "classification_method": "insufficient_evidence",
            "classification_sources": "[]",
            "classification_notes": "",
            "match_score": "",
            "match_method": "",
            "matched_source_record_ids": "[]",
            "is_nuclear": "unknown",
            "nuclear_status": "unknown",
            "reactor_types": "[]",
            "nuclear_reference_ids": "[]",
            "radiological_risk": "unknown",
            "substation_type": "unknown",
            "voltage_levels_kv": "[]",
            "ecological_risk_category": "unknown",
            "political_significance": "unknown",
            "risk_assessment_status": "not_assessed",
        }
    )
    if asset_type == "substation":
        fields.update(
            {
                "generation_type": "",
                "primary_fuel": "",
                "plant_role": "",
                "classification_confidence": "verified",
                "classification_confidence_score": "1.00",
                "classification_method": "asset_type",
                "is_nuclear": "false",
                "radiological_risk": "not_present",
            }
        )
    return fields


def source_reference(source_id: str, source_record_id: str, fields: dict[str, str], match_score: float, method: str) -> Evidence:
    return Evidence(
        source_id=source_id,
        source_name=SOURCE_DISPLAY_NAMES.get(source_id, source_id.replace("_", " ").title()),
        source_record_id=source_record_id,
        field_values=fields,
        match_score=match_score,
        match_method=method,
    )


def row_text(row: dict[str, str]) -> str:
    pieces = [
        value(row, "name"),
        value(row, "name_en"),
        value(row, "name_original"),
        value(row, "display_label"),
        value(row, "description"),
        value(row, "name_translated"),
        value(row, "description_translated"),
        value(row, "asset_subtype"),
    ]
    try:
        tags = json.loads(value(row, "tags_json"))
        if isinstance(tags, dict):
            pieces.extend(str(v) for v in tags.values() if v)
    except json.JSONDecodeError:
        pass
    return " ".join(pieces)


def row_names(row: dict[str, str]) -> list[str]:
    names = [
        value(row, "name"),
        value(row, "name_en"),
        value(row, "name_original"),
        value(row, "display_label"),
        value(row, "name_translated"),
    ]
    try:
        tags = json.loads(value(row, "tags_json"))
        if isinstance(tags, dict):
            names.extend(str(tags.get(key) or "") for key in ["name", "name:en", "name:ru", "official_name", "alt_name"])
    except json.JSONDecodeError:
        pass
    return [name for name in dict.fromkeys(names) if name]


def evidence_names(evidence: Evidence) -> list[str]:
    names = [evidence.field_values.get("external_name", "")]
    try:
        aliases = json.loads(evidence.field_values.get("external_aliases", "[]"))
        if isinstance(aliases, list):
            names.extend(str(alias) for alias in aliases)
    except json.JSONDecodeError:
        pass
    return [name for name in dict.fromkeys(names) if name]


def evidence_alias_list(evidence: Evidence) -> list[str]:
    try:
        aliases = json.loads(evidence.field_values.get("external_aliases", "[]"))
        if isinstance(aliases, list):
            return [str(alias).strip() for alias in aliases if str(alias).strip()]
    except json.JSONDecodeError:
        pass
    return []


def collect_alternate_names(row: dict[str, str], evidence: list[Evidence]) -> tuple[list[str], str]:
    names = [
        value(row, "name_en"),
        value(row, "name_original"),
        value(row, "name_translated"),
    ]
    name_ru = value(row, "name_ru")
    try:
        tags = json.loads(value(row, "tags_json"))
        if isinstance(tags, dict):
            names.extend(str(tags.get(key) or "") for key in ["alt_name", "official_name", "name:en", "name:ru"])
            if not name_ru:
                name_ru = str(tags.get("name:ru") or "").strip()
    except json.JSONDecodeError:
        pass
    for item in evidence:
        names.extend(evidence_alias_list(item))
        if not name_ru:
            for alias in evidence_alias_list(item):
                if CYRILLIC_RE.search(alias):
                    name_ru = alias
                    break
    primary = value(row, "name")
    aliases = sorted({name for name in names if name and name != primary})
    return aliases, name_ru


def operator_agreement_score(row_operator: str, source_operator: str) -> float:
    if not row_operator or not source_operator:
        return 0.0
    if row_operator.casefold() == source_operator.casefold():
        return 1.0
    return 0.75 if name_similarity(row_operator, source_operator) >= 0.5 else 0.0


def region_agreement_score(row_region: str, source_region: str) -> float:
    if not row_region or not source_region:
        return 0.0
    return 1.0 if normalize_name(row_region) == normalize_name(source_region) else 0.0


def capacity_agreement_score(row_capacity: str, source_capacity: str) -> float:
    row_value = parse_float(row_capacity)
    source_value = parse_float(source_capacity)
    if row_value is None or source_value is None or row_value <= 0 or source_value <= 0:
        return 0.0
    relative_delta = abs(row_value - source_value) / max(row_value, source_value)
    if relative_delta <= 0.05:
        return 1.0
    if relative_delta <= 0.15:
        return 0.7
    if relative_delta <= 0.30:
        return 0.35
    return 0.0


def classify_by_name(row: dict[str, str]) -> ClassificationResult:
    result = ClassificationResult(fields=default_power_fields(value(row, "asset_type")))
    if value(row, "asset_type") != "power_station":
        return result

    text = row_text(row)
    if NAME_FALSE_POSITIVE_RE.search(text):
        return result

    detected = ""
    for generation_type, pattern in PATTERN_RULES:
        if pattern.search(text):
            detected = generation_type
            break

    if not detected:
        return result

    if detected == "chp":
        detected = "thermal"
        result.fields["plant_role"] = "combined_heat_and_power"

    result.fields.update(
        {
            "generation_type": detected,
            "primary_fuel": FUEL_ALIASES.get(detected, "unknown"),
            "classification_confidence": "inferred",
            "classification_confidence_score": "0.62",
            "classification_method": "name_pattern",
            "is_nuclear": "true" if detected == "nuclear" else "false",
            "radiological_risk": "present" if detected == "nuclear" else "not_present",
            "political_significance": "high" if detected == "nuclear" else "standard",
            "risk_assessment_status": "not_assessed",
        }
    )
    if detected == "thermal" and result.fields["plant_role"] != "combined_heat_and_power":
        result.fields["primary_fuel"] = "unknown"
    if detected == "nuclear":
        result.nuclear_candidate_reason = "name_pattern_suggests_nuclear"
    evidence_fields = {
        "generation_type": detected,
        "is_nuclear": result.fields["is_nuclear"],
        "primary_fuel": result.fields["primary_fuel"],
    }
    if result.fields["plant_role"] == "combined_heat_and_power":
        evidence_fields["plant_role"] = "combined_heat_and_power"
    result.evidence.append(source_reference("name_pattern", value(row, "uid"), evidence_fields, 0.62, "name_pattern"))
    return result


def classify_substation(row: dict[str, str]) -> ClassificationResult:
    fields = default_power_fields("substation")
    text = row_text(row).casefold()
    tags = {}
    try:
        tags = json.loads(value(row, "tags_json"))
    except json.JSONDecodeError:
        tags = {}
    voltage = value(tags, "voltage") if isinstance(tags, dict) else ""
    voltage_levels = []
    for part in re.split(r"[;,/\s]+", voltage):
        number = parse_float(part)
        if number is None:
            continue
        if number > 1000:
            number = number / 1000
        voltage_levels.append(int(number) if number.is_integer() else number)
    if voltage_levels:
        fields["voltage_levels_kv"] = compact_json(sorted(set(voltage_levels)))
        fields["voltage_kv"] = str(max(voltage_levels))
    if "converter" in text:
        fields["substation_type"] = "converter"
    elif "traction" in text:
        fields["substation_type"] = "traction"
    elif "industrial" in text:
        fields["substation_type"] = "industrial"
    elif voltage_levels and max(voltage_levels) >= 110:
        fields["substation_type"] = "transmission"
    elif voltage_levels:
        fields["substation_type"] = "distribution"
    return ClassificationResult(fields=fields)


def read_cached_records() -> list[Evidence]:
    records: list[Evidence] = []
    for source_dir in [RAW_ENRICHMENT_DIR / item for item in ("iaea_pris", "gem", "wri", "osm", "official")]:
        if not source_dir.exists():
            continue
        for path in sorted(source_dir.glob("*.csv")):
            records.extend(read_cached_csv(path, source_dir.name))
        for path in sorted(source_dir.glob("*.json")):
            records.extend(read_cached_json(path, source_dir.name))
    return aggregate_pris_reactors(records)


def canonical_source_id(source_dir_name: str) -> str:
    return {
        "gem": "global_energy_monitor",
        "wri": "wri_global_power_plant_database",
        "osm": "openstreetmap",
        "iaea_pris": "iaea_pris",
        "official": "official",
    }.get(source_dir_name, source_dir_name)


def cached_row_to_evidence(row: dict[str, Any], source_dir_name: str, fallback_record_id: str) -> Evidence | None:
    row = cached_source_row(row)
    source_id = canonical_source_id(source_dir_name)
    name = source_value(row, "plant_name", "name", "station_name", "facility_name", "project_name", "title", "tag_name")
    if not name and source_id != "iaea_pris":
        return None
    generation_type = normalize_generation_type(
        source_value(
            row,
            "generation_type",
            "plant_source",
            "plant:source",
            "generator:source",
            "fuel",
            "primary_fuel",
            "technology",
        )
    )
    primary_fuel = normalize_fuel(source_value(row, "primary_fuel", "fuel", "plant:source", "generator:source"))
    if source_id == "iaea_pris":
        generation_type = "nuclear"
        primary_fuel = "uranium"
        name = station_name_from_pris(row)
    aliases = source_aliases(row, name)
    fields = {
        "external_name": name,
        "external_aliases": compact_json(aliases),
        "external_latitude": source_value(row, "latitude", "lat"),
        "external_longitude": source_value(row, "longitude", "lon", "lng"),
        "external_region": source_value(row, "region", "admin1", "subnational_unit", "state", "oblast"),
        "generation_type": generation_type,
        "primary_fuel": primary_fuel,
        "installed_capacity_mw": source_value(
            row,
            "capacity_mw",
            "installed_capacity_mw",
            "capacity",
            "capacity_mwe",
            "gross_electrical_capacity_mw",
            "reference_unit_power_mw",
            "mw",
        ),
        "operator": source_value(row, "operator", "owner", "utility"),
        "operational_status": normalize_operational_status(source_value(row, "status", "operational_status", "plant_status")),
        "technology": source_value(row, "technology", "plant:method", "generator:method", "reactor_type"),
        "nuclear_status": normalize_nuclear_status(source_value(row, "status", "nuclear_status", "operational_status")),
        "reactor_type": source_value(row, "reactor_type", "type", "model"),
        "reactor_id": source_value(row, "reactor_id", "unit_id", "source_record_id") or fallback_record_id,
    }
    return Evidence(
        source_id=source_id,
        source_name=SOURCE_DISPLAY_NAMES.get(source_id, source_id),
        source_record_id=source_value(row, "source_record_id", "id", "osm_id", "@id") or fallback_record_id,
        source_url=source_value(row, "source_url", "url", "website"),
        field_values=fields,
        match_method=f"{source_id}_cached_record",
    )


def read_cached_csv(path: Path, source_dir_name: str) -> list[Evidence]:
    out = []
    with path.open("r", newline="", encoding="utf-8-sig") as handle:
        for index, row in enumerate(csv.DictReader(handle), start=2):
            evidence = cached_row_to_evidence(row, source_dir_name, f"{path.name}:{index}")
            if evidence:
                out.append(evidence)
    return out


def read_cached_json(path: Path, source_dir_name: str) -> list[Evidence]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(payload, dict) and payload.get("type") == "FeatureCollection":
        items = payload.get("features")
    elif isinstance(payload, dict):
        items = payload.get("records") or payload.get("data") or payload.get("plants") or payload.get("features")
    else:
        items = payload
    if not isinstance(items, list):
        return []
    out = []
    for index, item in enumerate(items, start=1):
        if isinstance(item, dict):
            evidence = cached_row_to_evidence(item, source_dir_name, f"{path.name}:{index}")
            if evidence:
                out.append(evidence)
    return out


def station_name_from_pris(row: dict[str, Any]) -> str:
    station = value(row, "station_name") or value(row, "plant_name")
    if station:
        return station
    reactor = value(row, "reactor_name") or value(row, "name")
    return re.sub(r"[-\s]*(?:unit\s*)?\d+$", "", reactor, flags=re.I).strip()


def aggregate_pris_reactors(records: list[Evidence]) -> list[Evidence]:
    grouped: dict[str, list[Evidence]] = defaultdict(list)
    passthrough: list[Evidence] = []
    for evidence in records:
        if evidence.source_id != "iaea_pris":
            passthrough.append(evidence)
            continue
        name = evidence.field_values.get("external_name", "")
        key = normalize_name(name)
        grouped[key].append(evidence)
    for items in grouped.values():
        first = items[0]
        reactor_ids = [item.field_values.get("reactor_id") or item.source_record_id for item in items]
        reactor_types = sorted({
            item.field_values.get("reactor_type", "")
            for item in items
            if item.field_values.get("reactor_type", "")
        })
        statuses = [item.field_values.get("nuclear_status", "unknown") for item in items]
        operating = sum(1 for status in statuses if status == "operating")
        capacity_values = [parse_float(item.field_values.get("installed_capacity_mw")) for item in items]
        total_capacity = sum(value for value in capacity_values if value is not None)
        fields = dict(first.field_values)
        fields.update(
            {
                "generation_type": "nuclear",
                "primary_fuel": "uranium",
                "installed_capacity_mw": f"{total_capacity:g}" if total_capacity else fields.get("installed_capacity_mw", ""),
                "reactor_count": str(len(items)),
                "operating_reactor_count": str(operating),
                "reactor_types": compact_json(reactor_types),
                "nuclear_reference_ids": compact_json(reactor_ids),
                "nuclear_status": "operating" if operating else (statuses[0] if statuses else "unknown"),
            }
        )
        passthrough.append(
            Evidence(
                source_id="iaea_pris",
                source_name=SOURCE_DISPLAY_NAMES["iaea_pris"],
                source_record_id=";".join(reactor_ids),
                source_url=first.source_url,
                field_values=fields,
                match_method="iaea_pris_station_aggregation",
            )
        )
    return passthrough


def normalize_generation_type(raw: str) -> str:
    text = raw.casefold()
    if not text:
        return ""
    if "nuclear" in text or text in {"uranium"}:
        return "nuclear"
    if "pumped" in text:
        return "pumped_storage"
    if "hydro" in text or text == "water":
        return "hydro"
    if "solar" in text or "photovoltaic" in text:
        return "solar"
    if "wind" in text:
        return "wind"
    if "bio" in text or "waste" in text:
        return "bioenergy"
    if any(token in text for token in ["coal", "gas", "oil", "diesel", "thermal", "fossil"]):
        return "thermal"
    return text if text in {"geothermal", "tidal", "other"} else ""


def normalize_fuel(raw: str) -> str:
    text = raw.casefold().replace("_", " ").strip()
    for key, value_to_return in FUEL_ALIASES.items():
        if key in text:
            return value_to_return
    return "unknown" if not text else text.replace(" ", "_")


def normalize_operational_status(raw: str) -> str:
    text = raw.casefold().strip()
    if not text:
        return "unknown"
    if "construct" in text:
        return "under_construction"
    if "plan" in text:
        return "planned"
    if "suspend" in text:
        return "suspended"
    if "mothball" in text:
        return "mothballed"
    if "retir" in text or "shutdown" in text or "shut down" in text:
        return "retired"
    if "cancel" in text:
        return "cancelled"
    if "operat" in text or "active" in text:
        return "operating"
    return text if text in {"operating", "under_construction", "planned", "suspended", "mothballed", "retired", "cancelled"} else "unknown"


def normalize_nuclear_status(raw: str) -> str:
    text = normalize_operational_status(raw)
    return "shutdown" if text == "retired" else text if text in {"operating", "under_construction", "planned", "unknown"} else "unknown"


def match_external(row: dict[str, str], records: list[Evidence]) -> list[Evidence]:
    row_lat = parse_float(value(row, "map_latitude"))
    row_lon = parse_float(value(row, "map_longitude"))
    matches = []
    for evidence in records:
        generation_type = evidence.field_values.get("generation_type", "")
        score_name = 0.0
        for row_name in row_names(row):
            for external_name in evidence_names(evidence):
                score_name = max(score_name, name_similarity(row_name, external_name))
        external_lat = parse_float(evidence.field_values.get("external_latitude"))
        external_lon = parse_float(evidence.field_values.get("external_longitude"))
        distance = distance_km(row_lat, row_lon, external_lat, external_lon)
        if distance is None:
            score_distance = 0.0
        elif distance <= POWER_MATCH_CONFIG["maximum_weak_match_distance_km"]:
            score_distance = 1.0
        elif distance <= POWER_MATCH_CONFIG["maximum_name_match_distance_km"]:
            score_distance = max(0.0, 1.0 - (distance / POWER_MATCH_CONFIG["maximum_name_match_distance_km"]))
        else:
            score_distance = 0.0
        operator_score = operator_agreement_score(value(row, "operator"), evidence.field_values.get("operator", ""))
        region_score = region_agreement_score(value(row, "region"), evidence.field_values.get("external_region", ""))
        capacity_score = capacity_agreement_score(
            value(row, "installed_capacity_mw"),
            evidence.field_values.get("installed_capacity_mw", ""),
        )
        type_score = 1.0 if generation_type and (
            generation_type in row_text(row).casefold()
            or (evidence.source_id == "iaea_pris" and score_name >= 0.90)
        ) else 0.0
        score = (score_name * 0.50) + (score_distance * 0.28) + (operator_score * 0.10) + (region_score * 0.07) + (type_score * 0.05)
        score = min(1.0, score + (capacity_score * 0.08))
        method = "weighted_name_distance_match"
        if score_name >= 0.95 and score_distance >= 1.0:
            score = max(score, 0.93)
        elif evidence.source_id == "iaea_pris" and score_name >= 0.95:
            score = max(score, 0.93)
            method = "authoritative_exact_name_match"
        if score >= POWER_MATCH_CONFIG["review_threshold"]:
            copied = Evidence(
                source_id=evidence.source_id,
                source_name=evidence.source_name,
                source_record_id=evidence.source_record_id,
                source_url=evidence.source_url,
                field_values=evidence.field_values,
                match_score=round(score, 3),
                match_method=method,
            )
            matches.append(copied)
    return sorted(matches, key=lambda item: item.match_score, reverse=True)


def merge_evidence(row: dict[str, str], base: ClassificationResult, external_matches: list[Evidence]) -> ClassificationResult:
    result = ClassificationResult(fields=dict(base.fields), evidence=list(base.evidence), conflicts=[], review_matches=[], nuclear_candidate_reason=base.nuclear_candidate_reason)
    accepted = [
        evidence for evidence in external_matches
        if evidence.match_score >= POWER_MATCH_CONFIG["automatic_corroborated_threshold"]
    ]
    review_matches = [
        evidence for evidence in external_matches
        if POWER_MATCH_CONFIG["review_threshold"] <= evidence.match_score < POWER_MATCH_CONFIG["automatic_corroborated_threshold"]
    ]
    result.review_matches = review_matches
    if review_matches and not accepted:
        result.nuclear_candidate_reason = result.nuclear_candidate_reason or "low_confidence_external_match"
    if not accepted:
        return result

    result.evidence.extend(accepted)
    type_values: dict[str, list[Evidence]] = defaultdict(list)
    for evidence in accepted:
        generation_type = evidence.field_values.get("generation_type", "")
        if generation_type:
            type_values[generation_type].append(evidence)

    if len(type_values) > 1:
        for generation_type, items in type_values.items():
            for other_type, other_items in type_values.items():
                if generation_type >= other_type:
                    continue
                result.conflicts.append(conflict_row(row, items[0], other_items[0], "generation_type_disagreement"))
        pris_nuclear = next((item for item in type_values.get("nuclear", []) if item.source_id == "iaea_pris"), None)
        if pris_nuclear:
            fields = pris_nuclear.field_values
            result.fields.update(
                {
                    "generation_type": "nuclear",
                    "primary_fuel": fields.get("primary_fuel") or "uranium",
                    "is_nuclear": "true",
                    "radiological_risk": "present",
                    "political_significance": "high",
                    "nuclear_status": fields.get("nuclear_status", "unknown"),
                    "reactor_count": fields.get("reactor_count", ""),
                    "operating_reactor_count": fields.get("operating_reactor_count", ""),
                    "reactor_types": fields.get("reactor_types", "[]"),
                    "nuclear_reference_ids": fields.get("nuclear_reference_ids", "[]"),
                }
            )
        elif "nuclear" in type_values:
            result.fields.update({"is_nuclear": "unknown", "radiological_risk": "unknown"})
        result.fields.update(
            {
                "classification_confidence": "conflicting",
                "classification_confidence_score": f"{max(e.match_score for e in accepted):.2f}",
                "classification_method": "source_conflict",
            }
        )
        return result

    if type_values:
        generation_type = next(iter(type_values))
        best = sorted(type_values[generation_type], key=lambda item: (source_priority(item.source_id, generation_type), -item.match_score))[0]
        fields = best.field_values
        verified = best.source_id in {"iaea_pris", "global_energy_monitor", "official"} and best.match_score >= POWER_MATCH_CONFIG["automatic_verified_threshold"]
        confidence = "verified" if verified else "corroborated"
        result.fields.update(
            {
                "generation_type": generation_type,
                "primary_fuel": fields.get("primary_fuel") or FUEL_ALIASES.get(generation_type, "unknown"),
                "installed_capacity_mw": fields.get("installed_capacity_mw", ""),
                "operational_status": fields.get("operational_status") or result.fields.get("operational_status", "unknown"),
                "technology": fields.get("technology", ""),
                "classification_confidence": confidence,
                "classification_confidence_score": f"{best.match_score:.2f}",
                "classification_method": best.match_method,
                "match_score": f"{best.match_score:.2f}",
                "match_method": best.match_method,
                "is_nuclear": "true" if generation_type == "nuclear" else "false",
                "radiological_risk": "present" if generation_type == "nuclear" else "not_present",
                "political_significance": "high" if generation_type == "nuclear" else "standard",
            }
        )
        if generation_type == "nuclear":
            result.fields.update(
                {
                    "nuclear_status": fields.get("nuclear_status", "unknown"),
                    "reactor_count": fields.get("reactor_count", ""),
                    "operating_reactor_count": fields.get("operating_reactor_count", ""),
                    "reactor_types": fields.get("reactor_types", "[]"),
                    "nuclear_reference_ids": fields.get("nuclear_reference_ids", "[]"),
                }
            )
    return result


def conflict_row(row: dict[str, str], source_a: Evidence, source_b: Evidence, reason: str) -> dict[str, str]:
    return {
        "object_id": value(row, "uid"),
        "name": value(row, "name"),
        "latitude": value(row, "map_latitude"),
        "longitude": value(row, "map_longitude"),
        "current_generation_type": value(row, "generation_type"),
        "source_a": source_a.source_id,
        "source_a_value": source_a.field_values.get("generation_type", ""),
        "source_b": source_b.source_id,
        "source_b_value": source_b.field_values.get("generation_type", ""),
        "match_score": f"{min(source_a.match_score, source_b.match_score):.2f}",
        "conflict_reason": reason,
        "review_status": "unreviewed",
    }


def evidence_json(evidence: list[Evidence]) -> str:
    return compact_json(
        [
            {
                "source_id": item.source_id,
                "source_name": item.source_name,
                "source_record_id": item.source_record_id,
                "source_url": item.source_url,
                "field_supported": field_name,
                "value_supported": field_value,
                "match_score": item.match_score,
                "relationship": item.relationship,
            }
            for item in evidence
            for field_name, field_value in item.field_values.items()
            if field_name in POWER_CLASSIFICATION_FIELDS and field_value not in ("", None)
        ]
    )


def update_references(row: dict[str, str], evidence: list[Evidence]) -> None:
    existing = []
    try:
        parsed = json.loads(value(row, "references_json"))
        if isinstance(parsed, list):
            existing = parsed
    except json.JSONDecodeError:
        existing = []
    for item in evidence:
        digest = hashlib.sha256(f"{value(row, 'uid')}|{item.source_id}|{item.source_record_id}".encode("utf-8")).hexdigest()
        existing.append(
            {
                "reference_id": f"power_{item.source_id}_{digest[:16]}",
                "source_id": item.source_id,
                "source_name": item.source_name,
                "source_record_id": item.source_record_id,
                "url": item.source_url,
                "field_supported": "generation_type",
                "value_supported": item.field_values.get("generation_type", ""),
                "match_score": f"{item.match_score:.2f}",
                "relationship": item.relationship,
            }
        )
    row["references_json"] = compact_json(existing)


def derived_subcategory(fields: dict[str, str], asset_type: str) -> tuple[str, str, str]:
    if asset_type == "substation":
        return "substation", POWER_STATION_SUBCATEGORY_LABELS["substation"], "asset type"
    generation_type = fields.get("generation_type", "unknown")
    mapping = {
        "nuclear": "nuclear_power_station",
        "thermal": "thermal_power_station",
        "hydro": "hydro_power_station",
        "pumped_storage": "pumped_storage_power_station",
        "solar": "solar_power_station",
        "wind": "wind_power_station",
        "bioenergy": "bioenergy_power_station",
        "other": "other_power_station",
        "geothermal": "other_power_station",
        "tidal": "other_power_station",
        "unknown": "power_station_unknown_type",
    }
    subcategory = mapping.get(generation_type, "power_station_unknown_type")
    return subcategory, POWER_STATION_SUBCATEGORY_LABELS[subcategory], "generation type"


def classify_power_row(row: dict[str, str], external_records: list[Evidence]) -> ClassificationResult:
    asset_type = value(row, "asset_type")
    if asset_type == "substation":
        return classify_substation(row)
    base = classify_by_name(row)
    if asset_type != "power_station":
        return base
    matches = match_external(row, external_records)
    return merge_evidence(row, base, matches)


def load_manual_overrides() -> tuple[dict[str, list[dict[str, str]]], list[dict[str, str]]]:
    if not MANUAL_OBJECT_OVERRIDES_CSV.exists():
        return {}, []
    overrides: dict[str, list[dict[str, str]]] = defaultdict(list)
    issues: list[dict[str, str]] = []
    with MANUAL_OBJECT_OVERRIDES_CSV.open("r", newline="", encoding="utf-8-sig") as handle:
        for row in csv.DictReader(handle):
            object_id = value(row, "object_id")
            field_name = value(row, "field")
            if not object_id:
                issues.append(manual_override_issue_row(row, "missing_object_id"))
                continue
            if field_name not in MANUAL_OVERRIDE_FIELDS:
                issues.append(manual_override_issue_row(row, "unsupported_field"))
                continue
            if not value(row, "reason") or not value(row, "reviewer") or not value(row, "reviewed_at"):
                issues.append(manual_override_issue_row(row, "missing_review_metadata"))
                continue
            overrides[object_id].append(row)
    return overrides, issues


def manual_override_issue_row(row: dict[str, str], issue_reason: str) -> dict[str, str]:
    return {
        "object_id": value(row, "object_id"),
        "field": value(row, "field"),
        "new_value": value(row, "new_value"),
        "issue_reason": issue_reason,
        "reason": value(row, "reason"),
        "reviewer": value(row, "reviewer"),
        "reviewed_at": value(row, "reviewed_at"),
        "review_status": "unreviewed",
    }


def apply_manual_overrides(row: dict[str, str], overrides: dict[str, list[dict[str, str]]]) -> int:
    applied = 0
    for override in overrides.get(value(row, "uid"), []):
        field_name = value(override, "field")
        row[field_name] = value(override, "new_value")
        note = f"manual override {field_name}: {value(override, 'reason')} ({value(override, 'reviewer')}, {value(override, 'reviewed_at')})"
        row["classification_notes"] = "; ".join(part for part in [value(row, "classification_notes"), note] if part)
        row["review_status"] = "reviewed"
        applied += 1
    return applied


def enrich_rows(rows: list[dict[str, str]], external_records: list[Evidence]) -> tuple[list[dict[str, str]], dict[str, Any]]:
    conflicts: list[dict[str, str]] = []
    unknown_rows: list[dict[str, str]] = []
    nuclear_candidates: list[dict[str, str]] = []
    low_confidence_matches: list[dict[str, str]] = []
    unmatched_external = set(id(record) for record in external_records)
    manual_overrides, manual_override_issues = load_manual_overrides()
    manual_overrides_applied = 0

    for row in rows:
        if value(row, "map_layer") != "power_facilities":
            continue
        result = classify_power_row(row, external_records)
        row.update(result.fields)
        if result.evidence:
            row["classification_sources"] = evidence_json(result.evidence)
            row["matched_source_record_ids"] = compact_json([f"{item.source_id}:{item.source_record_id}" for item in result.evidence if item.source_id != "name_pattern"])
            update_references(row, result.evidence)
        alternate_names, name_ru = collect_alternate_names(row, result.evidence)
        row["alternate_names"] = compact_json(alternate_names)
        row["name_ru"] = name_ru
        for evidence in result.evidence:
            for index, record in enumerate(external_records):
                if record.source_id == evidence.source_id and record.source_record_id == evidence.source_record_id:
                    unmatched_external.discard(id(record))
                    break
        manual_overrides_applied += apply_manual_overrides(row, manual_overrides)
        subcategory, label, reason = derived_subcategory(row, value(row, "asset_type"))
        row["derived_subcategory"] = subcategory
        row["derived_subcategory_label"] = label
        row["derived_subcategory_confidence"] = row.get("classification_confidence_score", "")
        row["derived_subcategory_reason"] = reason
        row["search_text"] = " ".join(
            part for part in [
                value(row, "search_text"),
                label,
                value(row, "generation_type"),
                value(row, "primary_fuel"),
                value(row, "plant_role"),
                value(row, "classification_confidence"),
                " ".join(alternate_names),
                name_ru,
            ] if part
        )
        conflicts.extend(result.conflicts)
        if value(row, "asset_type") == "power_station" and value(row, "generation_type") == "unknown":
            unknown_rows.append(row)
        if result.nuclear_candidate_reason:
            nuclear_candidates.append(nuclear_candidate_row(row, result.nuclear_candidate_reason, result.evidence))
        if value(row, "classification_confidence") in {"inferred", "unknown", "conflicting"}:
            low_confidence_matches.append(low_confidence_row(row))
        for review_match in result.review_matches:
            low_confidence_matches.append(low_confidence_match_row(row, review_match))

    unmatched_records = [record for record in external_records if id(record) in unmatched_external]
    report = build_power_report(rows, conflicts, external_records, unmatched_records, manual_overrides_applied, len(manual_override_issues))
    write_review_outputs(unknown_rows, nuclear_candidates, conflicts, low_confidence_matches, unmatched_records, manual_override_issues)
    return rows, report


def nuclear_candidate_row(row: dict[str, str], reason: str, evidence: list[Evidence]) -> dict[str, str]:
    candidate = evidence[0] if evidence else None
    return {
        "object_id": value(row, "uid"),
        "name": value(row, "name"),
        "alternate_names": compact_json([name for name in [value(row, "name_en"), value(row, "name_original")] if name]),
        "latitude": value(row, "map_latitude"),
        "longitude": value(row, "map_longitude"),
        "operator": value(row, "operator"),
        "current_generation_type": value(row, "generation_type"),
        "nuclear_candidate_reason": reason,
        "candidate_source": candidate.source_id if candidate else "name_pattern",
        "candidate_source_record_id": candidate.source_record_id if candidate else value(row, "uid"),
        "match_score": f"{candidate.match_score:.2f}" if candidate else value(row, "classification_confidence_score"),
        "review_status": "unreviewed",
    }


def low_confidence_row(row: dict[str, str]) -> dict[str, str]:
    return {
        "object_id": value(row, "uid"),
        "name": value(row, "name"),
        "latitude": value(row, "map_latitude"),
        "longitude": value(row, "map_longitude"),
        "generation_type": value(row, "generation_type"),
        "classification_confidence": value(row, "classification_confidence"),
        "classification_method": value(row, "classification_method"),
        "match_score": value(row, "match_score"),
        "review_status": value(row, "review_status") or "unreviewed",
    }


def low_confidence_match_row(row: dict[str, str], evidence: Evidence) -> dict[str, str]:
    return {
        "object_id": value(row, "uid"),
        "name": value(row, "name"),
        "latitude": value(row, "map_latitude"),
        "longitude": value(row, "map_longitude"),
        "generation_type": evidence.field_values.get("generation_type", ""),
        "classification_confidence": "review_candidate",
        "classification_method": evidence.match_method,
        "match_score": f"{evidence.match_score:.2f}",
        "candidate_source": evidence.source_id,
        "candidate_source_record_id": evidence.source_record_id,
        "candidate_name": evidence.field_values.get("external_name", ""),
        "review_status": "unreviewed",
    }


def write_dict_csv(path: Path, fieldnames: list[str], rows: list[dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def write_review_outputs(
    unknown_rows: list[dict[str, str]],
    nuclear_candidates: list[dict[str, str]],
    conflicts: list[dict[str, str]],
    low_confidence_rows: list[dict[str, str]],
    unmatched_external: list[Evidence],
    manual_override_issues: list[dict[str, str]] | None = None,
) -> None:
    write_dict_csv(
        REVIEW_DIR / "power_station_unknown_type.csv",
        ["object_id", "name", "latitude", "longitude", "operator", "classification_confidence", "review_status"],
        [
            {
                "object_id": value(row, "uid"),
                "name": value(row, "name"),
                "latitude": value(row, "map_latitude"),
                "longitude": value(row, "map_longitude"),
                "operator": value(row, "operator"),
                "classification_confidence": value(row, "classification_confidence"),
                "review_status": value(row, "review_status"),
            }
            for row in unknown_rows
        ],
    )
    write_dict_csv(
        REVIEW_DIR / "power_nuclear_candidates.csv",
        [
            "object_id",
            "name",
            "alternate_names",
            "latitude",
            "longitude",
            "operator",
            "current_generation_type",
            "nuclear_candidate_reason",
            "candidate_source",
            "candidate_source_record_id",
            "match_score",
            "review_status",
        ],
        nuclear_candidates,
    )
    write_dict_csv(
        REVIEW_DIR / "power_classification_conflicts.csv",
        [
            "object_id",
            "name",
            "latitude",
            "longitude",
            "current_generation_type",
            "source_a",
            "source_a_value",
            "source_b",
            "source_b_value",
            "match_score",
            "conflict_reason",
            "review_status",
        ],
        conflicts,
    )
    write_dict_csv(
        REVIEW_DIR / "power_low_confidence_matches.csv",
        [
            "object_id",
            "name",
            "latitude",
            "longitude",
            "generation_type",
            "classification_confidence",
            "classification_method",
            "match_score",
            "candidate_source",
            "candidate_source_record_id",
            "candidate_name",
            "review_status",
        ],
        low_confidence_rows,
    )
    write_dict_csv(
        REVIEW_DIR / "power_unmatched_external_records.csv",
        ["source_id", "source_name", "source_record_id", "name", "generation_type", "latitude", "longitude", "review_status"],
        [
            {
                "source_id": item.source_id,
                "source_name": item.source_name,
                "source_record_id": item.source_record_id,
                "name": item.field_values.get("external_name", ""),
                "generation_type": item.field_values.get("generation_type", ""),
                "latitude": item.field_values.get("external_latitude", ""),
                "longitude": item.field_values.get("external_longitude", ""),
                "review_status": "unreviewed",
            }
            for item in unmatched_external
        ],
    )
    write_dict_csv(
        REVIEW_DIR / "power_manual_override_issues.csv",
        MANUAL_OVERRIDE_ISSUE_FIELDS,
        manual_override_issues or [],
    )


def write_power_reference_output(rows: list[dict[str, str]]) -> None:
    output_rows: list[dict[str, str]] = []
    for row in rows:
        if value(row, "map_layer") != "power_facilities":
            continue
        try:
            references = json.loads(value(row, "references_json"))
        except json.JSONDecodeError:
            references = []
        if not isinstance(references, list):
            continue
        for reference in references:
            if not isinstance(reference, dict) or not str(reference.get("reference_id", "")).startswith("power_"):
                continue
            output_rows.append(
                {
                    "object_id": value(row, "uid"),
                    "reference_id": str(reference.get("reference_id", "")),
                    "source_id": str(reference.get("source_id", "")),
                    "source_name": str(reference.get("source_name", "")),
                    "source_record_id": str(reference.get("source_record_id", "")),
                    "source_url": str(reference.get("url", "") or reference.get("source_url", "")),
                    "retrieved_at": str(reference.get("retrieved_at", "")),
                    "field_supported": str(reference.get("field_supported", "")),
                    "value_supported": str(reference.get("value_supported", "")),
                    "match_score": str(reference.get("match_score", "")),
                    "relationship": str(reference.get("relationship", "")),
                }
            )
    write_dict_csv(POWER_REFERENCES_CSV, POWER_REFERENCE_FIELDS, output_rows)


def build_power_report(
    rows: list[dict[str, str]],
    conflicts: list[dict[str, str]],
    external_records: list[Evidence],
    unmatched_external: list[Evidence],
    manual_overrides_applied: int,
    manual_override_issue_count: int = 0,
) -> dict[str, Any]:
    power_rows = [row for row in rows if value(row, "map_layer") == "power_facilities"]
    stations = [row for row in power_rows if value(row, "asset_type") == "power_station"]
    substations = [row for row in power_rows if value(row, "asset_type") == "substation"]
    classified = [row for row in stations if value(row, "generation_type") not in {"", "unknown"}]
    confirmed_non_nuclear = [
        row for row in stations
        if value(row, "is_nuclear") == "false" and value(row, "generation_type") in NON_NUCLEAR_GENERATION_TYPES
        and value(row, "classification_confidence") in {"verified", "corroborated"}
    ]
    capacity_by_type: dict[str, float] = defaultdict(float)
    for row in stations:
        capacity = parse_float(value(row, "installed_capacity_mw"))
        if capacity is not None:
            capacity_by_type[value(row, "generation_type") or "unknown"] += capacity
    source_match_counts = Counter()
    for row in stations:
        try:
            for source_id in json.loads(value(row, "matched_source_record_ids")):
                if source_id:
                    source_match_counts[str(source_id).split(":", 1)[0]] += 1
        except json.JSONDecodeError:
            pass
    return {
        "total_power_facilities": len(power_rows),
        "total_power_stations": len(stations),
        "total_substations": len(substations),
        "classified_power_stations": len(classified),
        "unknown_power_stations": sum(1 for row in stations if value(row, "generation_type") == "unknown"),
        "confirmed_nuclear_stations": sum(1 for row in stations if value(row, "is_nuclear") == "true" and value(row, "classification_confidence") in {"verified", "corroborated"}),
        "inferred_nuclear_stations": sum(1 for row in stations if value(row, "is_nuclear") == "true" and value(row, "classification_confidence") == "inferred"),
        "confirmed_non_nuclear_stations": len(confirmed_non_nuclear),
        "conflicting_classifications": len(conflicts),
        "classification_counts_by_generation_type": dict(sorted(Counter(value(row, "generation_type") or "unknown" for row in stations).items())),
        "classification_counts_by_confidence": dict(sorted(Counter(value(row, "classification_confidence") or "unknown" for row in stations).items())),
        "capacity_by_generation_type": dict(sorted((key, round(val, 3)) for key, val in capacity_by_type.items())),
        "source_match_counts": dict(sorted(source_match_counts.items())),
        "external_records_loaded": len(external_records),
        "external_records_matched": len(external_records) - len(unmatched_external),
        "unmatched_external_records": len(unmatched_external),
        "manual_overrides_applied": manual_overrides_applied,
        "manual_override_issues": manual_override_issue_count,
        "source_priority": {
            "nuclear": NUCLEAR_SOURCE_PRIORITY,
            "non_nuclear": NON_NUCLEAR_SOURCE_PRIORITY,
        },
        "matching_thresholds": POWER_MATCH_CONFIG,
        "licensing_notes": [
            "OpenStreetMap enrichment records are cached under data/raw/power_enrichment/osm when used; ODbL attribution and redistribution obligations must be reviewed before distributing derived outputs.",
            "The default build reads cached enrichment files only and does not make remote source requests.",
        ],
    }


def read_normalized_csv() -> tuple[list[str], list[dict[str, str]]]:
    with NORMALIZED_CSV.open("r", newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        return list(reader.fieldnames or []), list(reader)


def write_normalized_csv(fieldnames: list[str], rows: list[dict[str, str]]) -> None:
    for field_name in POWER_ALL_FIELDS:
        if field_name not in fieldnames:
            fieldnames.append(field_name)
    with NORMALIZED_CSV.open("w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def sync_geojson(rows: list[dict[str, str]]) -> None:
    data = json.loads(NORMALIZED_GEOJSON.read_text(encoding="utf-8"))
    by_uid = {value(row, "uid"): row for row in rows}
    for feature in data.get("features", []):
        props = feature.setdefault("properties", {})
        uid = props.get("uid") or feature.get("id")
        row = by_uid.get(uid)
        if not row:
            continue
        for field_name in POWER_ALL_FIELDS + ["search_text", "references_json"]:
            props[field_name] = row.get(field_name, props.get(field_name, ""))
        try:
            refs = json.loads(row.get("references_json", ""))
            if isinstance(refs, list):
                props["references"] = refs
        except json.JSONDecodeError:
            pass
    NORMALIZED_GEOJSON.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def update_normalization_report(report: dict[str, Any]) -> None:
    REPORT_JSON.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    if not NORMALIZATION_REPORT_JSON.exists():
        update_data_package_manifest()
        return
    normal = json.loads(NORMALIZATION_REPORT_JSON.read_text(encoding="utf-8"))
    normal["power_classification"] = report
    normal.setdefault("outputs", {})["power_classification_report"] = str(REPORT_JSON)
    normal.setdefault("outputs", {})["power_classification_references_csv"] = str(POWER_REFERENCES_CSV)
    NORMALIZATION_REPORT_JSON.write_text(json.dumps(normal, ensure_ascii=False, indent=2), encoding="utf-8")
    update_data_package_manifest()


def update_data_package_manifest() -> None:
    if not DATA_PACKAGE_MANIFEST.exists():
        return
    manifest = json.loads(DATA_PACKAGE_MANIFEST.read_text(encoding="utf-8"))
    files = manifest.setdefault("files", {})
    files["power_classification_report_json"] = str(REPORT_JSON)
    files["power_classification_references_csv"] = str(POWER_REFERENCES_CSV)
    files["power_station_unknown_type_review_csv"] = str(REVIEW_DIR / "power_station_unknown_type.csv")
    files["power_nuclear_candidates_review_csv"] = str(REVIEW_DIR / "power_nuclear_candidates.csv")
    files["power_classification_conflicts_review_csv"] = str(REVIEW_DIR / "power_classification_conflicts.csv")
    files["power_low_confidence_matches_review_csv"] = str(REVIEW_DIR / "power_low_confidence_matches.csv")
    files["power_unmatched_external_records_review_csv"] = str(REVIEW_DIR / "power_unmatched_external_records.csv")
    notes = manifest.setdefault("notes", [])
    power_note = "Power classification outputs are appended after normalization because the enrichment step runs later in the pipeline."
    if power_note not in notes:
        notes.append(power_note)
    DATA_PACKAGE_MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")


def ensure_cache_dirs() -> None:
    for name in ("gem", "iaea_pris", "wri", "osm", "official"):
        (RAW_ENRICHMENT_DIR / name).mkdir(parents=True, exist_ok=True)


def enrich_file() -> dict[str, Any]:
    if not NORMALIZED_CSV.exists() or not NORMALIZED_GEOJSON.exists():
        raise FileNotFoundError("Run normalize and category enrichment before power classification.")
    ensure_cache_dirs()
    fieldnames, rows = read_normalized_csv()
    external_records = read_cached_records()
    rows, report = enrich_rows(rows, external_records)
    write_normalized_csv(fieldnames, rows)
    write_power_reference_output(rows)
    sync_geojson(rows)
    update_normalization_report(report)
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.parse_args()
    report = enrich_file()
    print(f"Power facilities: {report['total_power_facilities']:,}")
    print(f"Power stations: {report['total_power_stations']:,}")
    print(f"Substations: {report['total_substations']:,}")
    print(f"Confirmed nuclear stations: {report['confirmed_nuclear_stations']:,}")
    print(f"Unknown power stations: {report['unknown_power_stations']:,}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
