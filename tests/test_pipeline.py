import csv
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import build_data_pipeline as build
import combine_infrastructure_sources as combine
import derive_countries_from_boundaries as countries
import extract_nightwatch_map as nightwatch
import extract_osint_varta_archive as varta
import generate_change_report as changes
import normalize_infrastructure_data as normalize
import prepare_web_data as prepare


class CombineSourcesTests(unittest.TestCase):
    def test_read_rows_adds_source_file_and_record_position(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "source.csv"
            with path.open("w", newline="", encoding="utf-8") as handle:
                writer = csv.DictWriter(handle, fieldnames=["name", "source_dataset"])
                writer.writeheader()
                writer.writerow({"name": "Alpha", "source_dataset": ""})
                writer.writerow({"name": "Bravo", "source_dataset": "Existing source"})

            rows = combine.read_rows(path, "Fallback source")

        self.assertEqual(rows[0]["source_dataset"], "Fallback source")
        self.assertEqual(rows[0]["source_file"], str(path))
        self.assertEqual(rows[0]["source_line_or_record_id"], "2")
        self.assertEqual(rows[1]["source_dataset"], "Existing source")
        self.assertEqual(rows[1]["source_line_or_record_id"], "3")


class BuildPipelineTests(unittest.TestCase):
    def test_country_derivation_runs_after_enrichment_before_web_prep(self):
        steps = build.LOCAL_STEPS
        step_names = [step[0] for step in steps]

        derive_index = step_names.index("derive_countries_from_boundaries.py")
        change_index = step_names.index("generate_change_report.py")
        self.assertLess(step_names.index("enrich_translations_and_categories.py"), derive_index)
        self.assertLess(derive_index, change_index)
        self.assertLess(change_index, step_names.index("prepare_web_data.py"))
        self.assertEqual(
            steps[derive_index],
            [
                "derive_countries_from_boundaries.py",
                "--input",
                "data/normalized_infrastructure.geojson",
                "--write",
            ],
        )


class CountryBoundaryTests(unittest.TestCase):
    def test_load_boundaries_downloads_missing_default_cache_file(self):
        boundary_payload = {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "properties": {"ADMIN": "Testland"},
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [[
                            [0.0, 0.0],
                            [2.0, 0.0],
                            [2.0, 2.0],
                            [0.0, 2.0],
                            [0.0, 0.0],
                        ]],
                    },
                },
            ],
        }

        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "data" / "boundaries" / "countries.geojson"
            with patch.object(countries, "fetch_bytes", return_value=json.dumps(boundary_payload).encode("utf-8")):
                boundaries = countries.load_boundaries(path)

            self.assertTrue(path.exists())
            self.assertEqual(boundaries[0]["name"], "Testland")
            self.assertEqual(countries.matching_countries((1.0, 1.0), boundaries), ["Testland"])


class NightwatchExtractorTests(unittest.TestCase):
    def test_convert_emits_points_and_referenced_paths(self):
        payload = {
            "retrieved_at": "2026-06-30T12:00:00Z",
            "text_references": {
                "$16": "37.0,55.0,0 37.1,55.1,0 37.2,55.2,0",
            },
            "placemarks": [
                {
                    "id": "point-id",
                    "sidc": "10062000001101000000",
                    "name": ["Alpha Base"],
                    "description": ["military unit 12345"],
                    "parentName": "Ministry of Defense",
                    "nodeId": "000000.000000",
                    "Point": [{"coordinates": ["37.264,55.603,0"]}],
                },
                {
                    "id": "path-id",
                    "name": ["Alpha Boundary"],
                    "parentName": "Training Territory",
                    "LineString": [{"coordinates": ["$16"]}],
                },
            ],
        }

        rows = nightwatch.convert(payload)

        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0]["source_dataset"], "Nightwatch map")
        self.assertEqual(rows[0]["layer"], "nightwatch_points")
        self.assertEqual(rows[0]["military_unit"], "12345")
        self.assertEqual(rows[0]["geometry_type"], "Point")
        self.assertEqual(rows[1]["layer"], "nightwatch_paths")
        self.assertEqual(rows[1]["geometry_type"], "LineString")
        self.assertEqual(rows[1]["coordinate_count"], "3")
        self.assertEqual(rows[1]["category"], "military_facility_boundary")


class OsintVartaExtractorTests(unittest.TestCase):
    def test_fetch_latest_available_map_points_skips_dead_capture(self):
        payload = {
            "data": {
                "mapPoints": {
                    "items": [{"id": "company_1", "nameShort": "Alpha"}],
                    "pagination": {"totalCount": 1},
                },
            },
        }

        def fake_fetch_json(url, _target=None):
            if "20260601" in url:
                raise RuntimeError("archive replay missing")
            return payload

        with patch.object(varta, "map_points_captures", return_value=[
            ("20260601", "https://map.osint-varta.com.ua/graphql?query=GetMapPoints"),
            ("20260527", "https://map.osint-varta.com.ua/graphql?query=GetMapPoints"),
        ]), patch.object(varta, "fetch_json", side_effect=fake_fetch_json):
            items, pagination, timestamp, url = varta.fetch_latest_available_map_points()

        self.assertEqual(items, payload["data"]["mapPoints"]["items"])
        self.assertEqual(pagination["totalCount"], 1)
        self.assertEqual(timestamp, "20260527")
        self.assertIn("20260527if_", url)

    def test_fallback_row_from_web_feature_preserves_core_fields(self):
        feature = {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [37.2, 55.1]},
            "properties": {
                "uid": "obj_1",
                "source_record_id": "company_1",
                "source_capture_date": "2026-05-27T13:16:14Z",
                "source_url": "https://web.archive.org/example",
                "name": "Alpha Works",
                "inn": "1234567890",
                "region": "Moscow",
                "is_sanctioned": "true",
            },
        }

        row = varta.fallback_row_from_feature(feature, 1)

        self.assertEqual(row["source_dataset"], "OSINT Varta")
        self.assertEqual(row["layer"], "osint_varta_map_points")
        self.assertEqual(row["feature_id"], "company_1")
        self.assertEqual(row["name"], "Alpha Works")
        self.assertEqual(row["longitude"], 37.2)
        self.assertEqual(row["latitude"], 55.1)
        self.assertEqual(row["archive_timestamp"], "2026-05-27T13:16:14Z")
        self.assertEqual(row["is_sanctioned"], "true")


class ChangeReportTests(unittest.TestCase):
    def test_baseline_snapshot_keeps_only_change_detection_fields(self):
        full = {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "id": "obj_1",
                    "geometry": {"type": "Point", "coordinates": [37.2, 55.1]},
                    "properties": {
                        "uid": "obj_1",
                        "display_label": "Alpha",
                        "map_latitude": "55.1",
                        "map_longitude": "37.2",
                        "source_id": "source_a",
                        "raw_json": "{\"large\":\"payload\"}",
                        "references_json": "[{\"large\":\"payload\"}]",
                    },
                },
            ],
        }

        baseline = changes.baseline_snapshot(full)
        feature = baseline["features"][0]

        self.assertEqual(feature["id"], "obj_1")
        self.assertIsNone(feature["geometry"])
        self.assertEqual(feature["properties"]["display_label"], "Alpha")
        self.assertEqual(feature["properties"]["map_latitude"], "55.1")
        self.assertNotIn("raw_json", feature["properties"])
        self.assertNotIn("references_json", feature["properties"])

    def test_compare_builds_reports_new_removed_changed_and_moved_objects(self):
        previous = {
            "type": "FeatureCollection",
            "features": [
                test_feature("same", "Alpha", "power_facilities", "substation", 55.0, 37.0, confidence="B"),
                test_feature("removed", "Removed", "energy_facilities", "refinery", 56.0, 38.0),
                test_feature("moved", "Mover", "energy_facilities", "terminal", 55.0, 37.0),
            ],
        }
        current = {
            "type": "FeatureCollection",
            "features": [
                test_feature("same", "Alpha renamed", "power_facilities", "substation", 55.0, 37.0, confidence="A"),
                test_feature("new", "New", "military_sites", "military_other", 54.0, 36.0),
                test_feature("moved", "Mover", "energy_facilities", "terminal", 55.5, 37.5),
            ],
        }

        report = changes.compare_builds(previous, current, "2026-06-18T00:00:00Z", "2026-06-30T00:00:00Z")
        summary = report["summary"]
        current_by_uid = {feature["properties"]["uid"]: feature for feature in current["features"]}

        self.assertEqual(summary["new_objects"], 1)
        self.assertEqual(summary["removed_objects"], 1)
        self.assertEqual(summary["changed_objects"], 2)
        self.assertEqual(summary["moved_objects"], 1)
        self.assertEqual(summary["name_changes"], 1)
        self.assertEqual(summary["confidence_changes"], 1)
        self.assertEqual(current_by_uid["new"]["properties"]["new_in_latest_build"], "true")
        self.assertEqual(current_by_uid["same"]["properties"]["changed_since_previous_build"], "true")
        self.assertEqual(current_by_uid["moved"]["properties"]["change_status"], "changed")


class NormalizePipelineTests(unittest.TestCase):
    def test_normalize_row_emits_reference_and_confidence_dimensions(self):
        row = {
            "source_dataset": normalize.SOURCE_RUSSIA,
            "layer": "refineries",
            "feature_id": "abc",
            "feature_index": "7",
            "name": "Test Refinery",
            "latitude": "55.100000",
            "longitude": "37.200000",
            "source_url": "https://example.test/source",
            "archive_timestamp": "20260630",
            "source_file": "data/source.csv",
            "source_line_or_record_id": "42",
        }

        normalized, feature, reference, object_reference = normalize.normalize_row(
            row,
            "2026-06-30T00:00:00Z",
            {},
        )

        self.assertEqual(normalized["source_id"], "russia_oil_power_map")
        self.assertEqual(normalized["source_reference_id"], reference["reference_id"])
        self.assertEqual(normalized["coordinate_precision"], "exact")
        self.assertEqual(normalized["entity_confidence"], "high")
        self.assertEqual(normalized["freshness"], "recent")
        self.assertIn(normalized["confidence"], {"A", "B"})
        self.assertEqual(reference["source_file"], "data/source.csv")
        self.assertEqual(reference["source_line_or_record_id"], "42")
        self.assertEqual(object_reference["object_id"], normalized["uid"])
        self.assertEqual(feature["properties"]["references"][0]["reference_id"], reference["reference_id"])

    def test_normalize_row_treats_name_todo_as_missing_name(self):
        row = {
            "source_dataset": normalize.SOURCE_RUSSIA,
            "layer": "pipelines",
            "feature_index": "42",
            "name": "Oil pipeline; name todo",
            "product": "oil",
            "raw_properties_json": json.dumps({
                "tags": {
                    "name": "Oil pipeline; name todo",
                    "man_made": "pipeline",
                    "substance": "oil",
                },
            }),
            "geometry_json": json.dumps({
                "type": "LineString",
                "coordinates": [[37.0, 55.0], [37.2, 55.1]],
            }),
            "source_url": "https://example.test/source",
            "source_file": "data/source.csv",
            "source_line_or_record_id": "42",
        }

        normalized, feature, _reference, _object_reference = normalize.normalize_row(
            row,
            "2026-06-30T00:00:00Z",
            {},
        )

        self.assertEqual(normalized["name_original"], "")
        self.assertEqual(normalized["name"], "oil_pipeline:pipelines:42")
        self.assertEqual(normalized["display_label"], "oil_pipeline:pipelines:42")
        self.assertNotIn("name", feature["properties"]["tags"])
        self.assertNotIn("todo", normalized["search_text"].casefold())

    def test_duplicate_groups_update_cross_source_support_and_confidence(self):
        base = {
            "dedupe_key": "substation|alpha|55.1000|37.2000",
            "source_id": "source_a",
            "source_reliability": "C",
            "coordinate_precision": "exact",
            "entity_confidence": "high",
            "freshness": "recent",
            "possible_duplicate_group": "",
        }
        rows = [
            {**base, "uid": "one", "confidence": "C", "confidence_score": "0.00"},
            {**base, "uid": "two", "source_id": "source_b", "confidence": "C", "confidence_score": "0.00"},
        ]

        normalize.add_duplicate_groups(rows)
        normalize.update_confidence_context(rows)

        self.assertEqual(rows[0]["possible_duplicate_group"], "dup_000001")
        self.assertEqual(rows[1]["possible_duplicate_group"], "dup_000001")
        self.assertEqual(rows[0]["cross_source_support"], "2")
        self.assertGreater(float(rows[0]["confidence_score"]), 0.0)

    def test_write_review_outputs_creates_queue_and_conflict_files(self):
        row = {
            "uid": "obj_1",
            "name": "Approximate object",
            "asset_class": "unknown",
            "asset_type": "unknown",
            "country": "Russia",
            "map_latitude": "",
            "map_longitude": "",
            "confidence": "D",
            "coordinate_precision": "missing",
            "source_id": "source_a",
            "possible_duplicate_group": "",
            "cross_source_support": "1",
        }

        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            with patch.object(normalize, "REVIEW_QUEUE_CSV", root / "review_queue.csv"), \
                patch.object(normalize, "DUPLICATE_CANDIDATES_CSV", root / "duplicate_candidates.csv"), \
                patch.object(normalize, "POSSIBLE_ALIASES_CSV", root / "possible_aliases.csv"), \
                patch.object(normalize, "CONFLICTS_CSV", root / "conflicts.csv"):
                normalize.write_review_outputs([row])
                with (root / "review_queue.csv").open(encoding="utf-8-sig") as handle:
                    queue_rows = list(csv.DictReader(handle))
                with (root / "duplicate_candidates.csv").open(encoding="utf-8-sig") as handle:
                    duplicate_rows = list(csv.DictReader(handle))

        self.assertEqual(len(queue_rows), 1)
        self.assertEqual(queue_rows[0]["object_id"], "obj_1")
        self.assertIn("low_confidence", queue_rows[0]["review_reason"])
        self.assertIn("missing_coordinates", queue_rows[0]["review_reason"])
        self.assertEqual(duplicate_rows, [])

    def test_source_overrides_accept_documented_reliability_column(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            overrides_path = Path(tmpdir) / "source_overrides.csv"
            with overrides_path.open("w", newline="", encoding="utf-8") as handle:
                writer = csv.DictWriter(handle, fieldnames=["source_id", "reliability", "reason", "reviewed_at"])
                writer.writeheader()
                writer.writerow({
                    "source_id": "russia_oil_power_map",
                    "reliability": "A",
                    "reason": "manual review",
                    "reviewed_at": "2026-06-30",
                })

            with patch.object(normalize, "MANUAL_SOURCE_OVERRIDES_CSV", overrides_path):
                overrides = normalize.load_source_overrides()

        self.assertEqual(overrides["russia_oil_power_map"]["source_reliability"], "A")


class PrepareWebDataTests(unittest.TestCase):
    def test_compact_feature_preserves_app_provenance_properties(self):
        feature = {
            "type": "Feature",
            "id": "obj_1",
            "geometry": {"type": "Point", "coordinates": [37.2, 55.1]},
            "properties": {
                "uid": "obj_1",
                "source_id": "russia_oil_power_map",
                "source_name": "Russia Oil & Power Infrastructure Map",
                "confidence": "A",
                "coordinate_precision": "exact",
                "references_json": json.dumps([{"reference_id": "ref_1"}]),
                "references": [{"reference_id": "ref_1", "source_name": "Source"}],
                "tags": {"power": "substation"},
                "raw": {"unused": "not copied"},
            },
        }

        compact = prepare.compact_feature(feature)
        props = compact["properties"]

        self.assertEqual(props["source_id"], "russia_oil_power_map")
        self.assertEqual(props["confidence"], "A")
        self.assertEqual(props["coordinate_precision"], "exact")
        self.assertEqual(props["references"][0]["reference_id"], "ref_1")
        self.assertEqual(props["tags"], {"power": "substation"})
        self.assertNotIn("raw", props)
        self.assertIn("first_seen_build", props)

    def test_compact_feature_removes_placeholder_name_tags(self):
        feature = {
            "type": "Feature",
            "id": "obj_1",
            "geometry": {"type": "LineString", "coordinates": [[37.0, 55.0], [37.2, 55.1]]},
            "properties": {
                "uid": "obj_1",
                "map_layer": "energy_oil",
                "tags": {
                    "name": "Oil pipeline; name todo",
                    "substance": "oil",
                },
            },
        }

        compact = prepare.compact_feature(feature)

        self.assertEqual(compact["properties"]["tags"], {"substance": "oil"})


def test_feature(uid, name, layer, asset_type, lat, lon, confidence="A"):
    return {
        "type": "Feature",
        "id": uid,
        "geometry": {"type": "Point", "coordinates": [lon, lat]},
        "properties": {
            "uid": uid,
            "display_label": name,
            "name": name,
            "asset_class": "test",
            "asset_type": asset_type,
            "map_layer": layer,
            "derived_subcategory": asset_type,
            "country": "Russia",
            "confidence": confidence,
            "confidence_score": "0.80",
            "source_id": "source_a",
            "source_dataset": "Source A",
            "source_record_id": uid,
            "source_capture_date": "2026-06-18T00:00:00Z",
            "map_latitude": str(lat),
            "map_longitude": str(lon),
        },
    }


if __name__ == "__main__":
    unittest.main()
