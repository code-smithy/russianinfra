#!/usr/bin/env python3
"""Add offline translations and derived subcategories to normalized data."""

from __future__ import annotations

import csv
import json
import re
import sys
from collections import Counter
from pathlib import Path
from typing import Any


NORMALIZED_CSV = Path("data/normalized_infrastructure.csv")
NORMALIZED_GEOJSON = Path("data/normalized_infrastructure.geojson")
REPORT_JSON = Path("data/normalization_report.json")

ENRICHMENT_FIELDS = [
    "detected_language",
    "name_translated",
    "description_translated",
    "region_translated",
    "translation_source",
    "derived_subcategory",
    "derived_subcategory_label",
    "derived_subcategory_confidence",
    "derived_subcategory_reason",
]

CYRILLIC_RE = re.compile(r"[\u0400-\u04FF]")

TRANSLIT = str.maketrans(
    {
        "А": "A", "а": "a", "Б": "B", "б": "b", "В": "V", "в": "v",
        "Г": "G", "г": "g", "Ґ": "G", "ґ": "g", "Д": "D", "д": "d",
        "Е": "E", "е": "e", "Ё": "Yo", "ё": "yo", "Є": "Ye", "є": "ye",
        "Ж": "Zh", "ж": "zh", "З": "Z", "з": "z", "И": "I", "и": "i",
        "І": "I", "і": "i", "Ї": "Yi", "ї": "yi", "Й": "Y", "й": "y",
        "К": "K", "к": "k", "Л": "L", "л": "l", "М": "M", "м": "m",
        "Н": "N", "н": "n", "О": "O", "о": "o", "П": "P", "п": "p",
        "Р": "R", "р": "r", "С": "S", "с": "s", "Т": "T", "т": "t",
        "У": "U", "у": "u", "Ф": "F", "ф": "f", "Х": "Kh", "х": "kh",
        "Ц": "Ts", "ц": "ts", "Ч": "Ch", "ч": "ch", "Ш": "Sh", "ш": "sh",
        "Щ": "Shch", "щ": "shch", "Ъ": "", "ъ": "", "Ы": "Y", "ы": "y",
        "Ь": "", "ь": "", "Э": "E", "э": "e", "Ю": "Yu", "ю": "yu",
        "Я": "Ya", "я": "ya",
    }
)

PHRASES = [
    ("акционерное общество", "joint-stock company"),
    ("публичное акционерное общество", "public joint-stock company"),
    ("общество с ограниченной ответственностью", "limited liability company"),
    ("федеральное государственное унитарное предприятие", "federal state unitary enterprise"),
    ("научно-производственное объединение", "research and production association"),
    ("научно-исследовательский институт", "research institute"),
    ("конструкторское бюро", "design bureau"),
    ("машиностроительный завод", "machine-building plant"),
    ("ремонтный завод", "repair plant"),
    ("судостроительный завод", "shipbuilding plant"),
    ("авиационный завод", "aviation plant"),
    ("приборостроительный завод", "instrument-making plant"),
    ("радиозавод", "radio plant"),
    ("область", "oblast"),
    ("край", "krai"),
    ("республика", "republic"),
    ("місто", "city"),
    ("город", "city"),
    ("район", "district"),
    ("штаб", "headquarters"),
    ("военная часть", "military unit"),
    ("военный", "military"),
    ("военная", "military"),
    ("военное", "military"),
    ("учебный", "training"),
    ("учебная", "training"),
    ("училище", "school"),
    ("институт", "institute"),
    ("завод", "plant"),
    ("арсенал", "arsenal"),
    ("база", "base"),
    ("склад", "depot"),
    ("полигон", "test site"),
    ("аэродром", "airfield"),
    ("авиа", "aviation"),
    ("флот", "fleet"),
    ("кораб", "ship"),
    ("связь", "communications"),
    ("радио", "radio"),
    ("ракет", "missile"),
    ("артиллер", "artillery"),
    ("ремонт", "repair"),
    ("брон", "armor"),
    ("двигател", "engine"),
    ("хим", "chemical"),
    ("электрон", "electronics"),
    ("електрон", "electronics"),
]

LEGAL_FORMS = [
    (re.compile(r"\bАО\b", re.I), "JSC"),
    (re.compile(r"\bПАО\b", re.I), "PJSC"),
    (re.compile(r"\bОАО\b", re.I), "OJSC"),
    (re.compile(r"\bЗАО\b", re.I), "CJSC"),
    (re.compile(r"\bООО\b", re.I), "LLC"),
    (re.compile(r"\bФГУП\b", re.I), "FSUE"),
    (re.compile(r"\bФКП\b", re.I), "Federal state enterprise"),
]

REGIONS = {
    "Орловская область": "Oryol Oblast",
    "Московская область": "Moscow Oblast",
    "Ленинградская область": "Leningrad Oblast",
    "Свердловская область": "Sverdlovsk Oblast",
    "Нижегородская область": "Nizhny Novgorod Oblast",
    "Самарская область": "Samara Oblast",
    "Тульская область": "Tula Oblast",
    "Ростовская область": "Rostov Oblast",
    "Новосибирская область": "Novosibirsk Oblast",
    "Челябинская область": "Chelyabinsk Oblast",
    "Республика Татарстан": "Republic of Tatarstan",
    "Республика Башкортостан": "Republic of Bashkortostan",
    "Краснодарский край": "Krasnodar Krai",
    "Пермский край": "Perm Krai",
    "Приморский край": "Primorsky Krai",
    "Санкт-Петербург": "Saint Petersburg",
    "Москва": "Moscow",
}

SUBCATEGORY_LABELS = {
    "aviation_aerospace": "Aviation & aerospace",
    "command_hq": "Command & HQ",
    "communications_ew_radar": "Communications, EW & radar",
    "defense_company": "Defense company",
    "district_boundary": "District boundary",
    "energy_gas_facility": "Gas facility",
    "energy_gas_pipeline": "Gas pipeline",
    "energy_oil_facility": "Oil facility",
    "energy_oil_pipeline": "Oil pipeline",
    "facility_boundary": "Facility boundary",
    "logistics_storage": "Logistics & storage",
    "military_other": "Military other",
    "missile_artillery_air_defense": "Missile, artillery & air defense",
    "naval_fleet_coast_guard": "Naval, fleet & coast guard",
    "nbc_chemical": "NBC & chemical",
    "power_station": "Power station",
    "railway": "Railway",
    "repair_maintenance": "Repair & maintenance",
    "research_design": "Research & design",
    "shipbuilding_naval_industry": "Shipbuilding & naval industry",
    "substation": "Substation",
    "training_education": "Training & education",
    "transport_bridge": "Bridge",
    "vehicle_armor": "Vehicles & armor",
    "weapons_ammunition": "Weapons & ammunition",
}

CATEGORY_RULES = [
    ("aviation_aerospace", 0.86, ["авиа", "aerospace", "aviation", "aircraft", "airfield", "flight", "вертолет", "helicopter", "самолет"]),
    ("naval_fleet_coast_guard", 0.86, ["naval", "fleet", "coast guard", "ship", "флот", "кораб", "судостро"]),
    ("communications_ew_radar", 0.84, ["communications", "radio", "radar", "связ", "радио", "рлс", "ew ", "electronic warfare", "intelligence"]),
    ("missile_artillery_air_defense", 0.84, ["missile", "rocket", "artillery", "air defense", "antiaircraft", "ракет", "артиллер", "пво"]),
    ("repair_maintenance", 0.82, ["repair", "maintenance", "ремонт", "восстанов"]),
    ("training_education", 0.82, ["training", "school", "academy", "учеб", "училищ", "академ", "institute"]),
    ("command_hq", 0.82, ["hq", "headquarters", "command", "control center", "штаб", "управлен"]),
    ("logistics_storage", 0.8, ["base", "depot", "arsenal", "storage", "logistical", "logistics", "база", "склад", "арсенал"]),
    ("research_design", 0.8, ["research", "design bureau", "institute", "scientific", "нии", "кб", "конструктор", "науч"]),
    ("vehicle_armor", 0.78, ["armor", "armored", "vehicle", "tank", "автомоб", "брон", "танк"]),
    ("weapons_ammunition", 0.78, ["weapon", "ammunition", "munitions", "ordnance", "оруж", "боеприп", "патрон"]),
    ("nbc_chemical", 0.78, ["nbc", "chemical", "biological", "radiation", "хим", "радиац", "биолог"]),
]


def has_cyrillic(text: str) -> bool:
    return bool(CYRILLIC_RE.search(text or ""))


def translate_text(text: str) -> tuple[str, str]:
    if not text or not has_cyrillic(text):
        return "", ""
    result = text
    for pattern, replacement in LEGAL_FORMS:
        result = pattern.sub(replacement, result)
    for original, translated in REGIONS.items():
        result = result.replace(original, translated)
    lowered = result.casefold()
    for original, translated in sorted(PHRASES, key=lambda item: len(item[0]), reverse=True):
        lowered = lowered.replace(original, translated)
    translated = lowered.translate(TRANSLIT)
    translated = re.sub(r"\s+", " ", translated).strip()
    return translated, "offline_rules+transliteration"


def detected_language(*texts: str) -> str:
    blob = " ".join(texts)
    if not has_cyrillic(blob):
        return "en_or_unknown"
    if any(ch in blob for ch in "іїєґІЇЄҐ"):
        return "uk_or_mixed"
    return "ru_or_mixed"


def classify(row: dict[str, str]) -> tuple[str, str, str]:
    layer = row.get("map_layer", "")
    asset_type = row.get("asset_type", "")
    subtype = row.get("asset_subtype", "")
    text = " ".join(
        row.get(key, "")
        for key in [
            "name",
            "name_original",
            "description",
            "name_translated",
            "description_translated",
            "asset_subtype",
            "source_layer",
        ]
    ).casefold()

    direct = {
        "energy_gas": ("energy_gas_pipeline", 1.0, "map layer"),
        "energy_oil": ("energy_oil_pipeline", 1.0, "map layer"),
        "power_lines": ("power_line", 1.0, "map layer"),
        "transport_rail": ("railway", 1.0, "map layer"),
        "transport_other": ("transport_bridge", 1.0, "asset type"),
    }
    if layer in direct:
        return direct[layer]
    if layer == "energy_facilities":
        if asset_type == "gas_pipeline_facility":
            return "energy_gas_facility", "1.0", "asset type"
        return "energy_oil_facility", "0.95", "asset type"
    if layer == "power_facilities":
        return (asset_type or "power_facility", "1.0", "asset type")
    if layer == "military_boundaries":
        if subtype == "military_district_boundary":
            return "district_boundary", "1.0", "asset subtype"
        if subtype == "military_facility_boundary":
            return "facility_boundary", "1.0", "asset subtype"
        return "military_other", "0.6", "fallback"

    for category, confidence, needles in CATEGORY_RULES:
        if any(needle in text for needle in needles):
            return category, f"{confidence:.2f}", "keyword match"

    if layer == "military_industrial":
        if any(token in text for token in ["shipbuilding", "судостро", "fleet", "naval"]):
            return "shipbuilding_naval_industry", "0.78", "keyword match"
        return "defense_company", "0.55", "source default"
    if layer == "military_sites":
        return "military_other", "0.45", "source default"
    return asset_type or "other", "0.5", "asset type fallback"


def enrich_row(row: dict[str, str]) -> dict[str, str]:
    name_translated, name_source = translate_text(row.get("name", ""))
    description_translated, desc_source = translate_text(row.get("description", ""))
    region_translated = REGIONS.get(row.get("region", ""), "")
    if not region_translated:
        region_translated, _ = translate_text(row.get("region", ""))

    row["detected_language"] = detected_language(row.get("name", ""), row.get("description", ""), row.get("region", ""))
    row["name_translated"] = name_translated
    row["description_translated"] = description_translated
    row["region_translated"] = region_translated
    sources = sorted({source for source in [name_source, desc_source] if source})
    row["translation_source"] = ",".join(sources)

    subcategory, confidence, reason = classify(row)
    row["derived_subcategory"] = subcategory
    row["derived_subcategory_label"] = SUBCATEGORY_LABELS.get(subcategory, subcategory.replace("_", " ").title())
    row["derived_subcategory_confidence"] = str(confidence)
    row["derived_subcategory_reason"] = reason
    row["search_text"] = " ".join(
        part
        for part in [
            row.get("search_text", ""),
            name_translated,
            description_translated,
            region_translated,
            row["derived_subcategory_label"],
        ]
        if part
    )
    return row


def enrich_csv() -> tuple[dict[str, dict[str, str]], Counter[str]]:
    with NORMALIZED_CSV.open("r", newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        fieldnames = list(reader.fieldnames or [])
        rows = [enrich_row(row) for row in reader]

    for field in ENRICHMENT_FIELDS:
        if field not in fieldnames:
            fieldnames.append(field)

    with NORMALIZED_CSV.open("w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)

    by_uid = {row["uid"]: row for row in rows}
    return by_uid, Counter(row["derived_subcategory"] for row in rows)


def enrich_geojson(rows_by_uid: dict[str, dict[str, str]]) -> None:
    data = json.loads(NORMALIZED_GEOJSON.read_text(encoding="utf-8"))
    for feature in data.get("features", []):
        props = feature.get("properties") or {}
        uid = props.get("uid") or feature.get("id")
        row = rows_by_uid.get(uid)
        if not row:
            continue
        for field in ENRICHMENT_FIELDS:
            props[field] = row.get(field, "")
        props["search_text"] = row.get("search_text", props.get("search_text", ""))
    NORMALIZED_GEOJSON.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def update_report(category_counts: Counter[str]) -> None:
    if not REPORT_JSON.exists():
        return
    report = json.loads(REPORT_JSON.read_text(encoding="utf-8"))
    report["translation_enrichment"] = {
        "method": "offline phrase rules plus Cyrillic transliteration",
        "fields_added": ENRICHMENT_FIELDS,
        "derived_subcategory_counts": dict(sorted(category_counts.items())),
    }
    REPORT_JSON.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")


def main() -> int:
    if not NORMALIZED_CSV.exists() or not NORMALIZED_GEOJSON.exists():
        raise FileNotFoundError("Run normalize_infrastructure_data.py before enrichment.")
    rows_by_uid, category_counts = enrich_csv()
    enrich_geojson(rows_by_uid)
    update_report(category_counts)
    print(f"Enriched {len(rows_by_uid):,} normalized rows")
    print(f"Derived subcategories: {len(category_counts):,}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
