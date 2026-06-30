import csv
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import combine_infrastructure_sources as combine
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


if __name__ == "__main__":
    unittest.main()
