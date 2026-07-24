import csv
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from russianinfra import build_data_pipeline as build
from russianinfra import combine_infrastructure_sources as combine
from russianinfra import derive_countries_from_boundaries as countries
from russianinfra import extract_geofabrik_osm_roads as roads
from russianinfra import extract_iaea_pris as pris
from russianinfra import extract_nightwatch_map as nightwatch
from russianinfra import extract_osm_power_facilities as osm_power
from russianinfra import extract_osint_varta_archive as varta
from russianinfra import extract_russia_oil_power_map as oil_power
from russianinfra import extract_wri_power_plants as wri_power
from russianinfra import enrich_power_facilities as power
from russianinfra import generate_change_report as changes
from russianinfra import normalize_infrastructure_data as normalize
from russianinfra import power_enrichment_cache
from russianinfra import prepare_web_data as prepare


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

        derive_index = step_names.index("russianinfra.derive_countries_from_boundaries")
        change_index = step_names.index("russianinfra.generate_change_report")
        self.assertLess(step_names.index("russianinfra.extract_un_locode"), step_names.index("russianinfra.combine_infrastructure_sources"))
        self.assertNotIn("russianinfra.extract_geofabrik_osm_roads", step_names)
        self.assertEqual(build.ROAD_OSM_STEP, ["russianinfra.extract_geofabrik_osm_roads"])
        self.assertLess(step_names.index("russianinfra.enrich_translations_and_categories"), derive_index)
        self.assertLess(step_names.index("russianinfra.enrich_translations_and_categories"), step_names.index("russianinfra.enrich_power_facilities"))
        self.assertLess(step_names.index("russianinfra.enrich_power_facilities"), derive_index)
        self.assertLess(derive_index, change_index)
        self.assertLess(change_index, step_names.index("russianinfra.prepare_web_data"))
        self.assertEqual(
            steps[derive_index],
            [
                "russianinfra.derive_countries_from_boundaries",
                "--input",
                "data/normalized_infrastructure.geojson",
                "--write",
            ],
        )

    def test_refresh_road_osm_is_separate_from_remote_refresh(self):
        self.assertNotIn(["russianinfra.extract_geofabrik_osm_roads", "--refresh"], build.REMOTE_STEPS)

    def test_remote_refresh_has_explicit_power_enrichment_hooks(self):
        self.assertIn(["russianinfra.extract_gem_power_plants", "--refresh"], build.REMOTE_STEPS)
        self.assertIn(["russianinfra.extract_iaea_pris", "--refresh"], build.REMOTE_STEPS)
        self.assertIn(["russianinfra.extract_wri_power_plants", "--refresh"], build.REMOTE_STEPS)
        self.assertIn(["russianinfra.extract_osm_power_facilities", "--refresh"], build.REMOTE_STEPS)


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

    def test_crimea_polygon_is_reassigned_to_ukraine(self):
        boundary_payload = {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "properties": {"ADMIN": "Russia"},
                    "geometry": {
                        "type": "MultiPolygon",
                        "coordinates": [
                            [[
                                [30.0, 58.0],
                                [31.0, 58.0],
                                [31.0, 59.0],
                                [30.0, 59.0],
                                [30.0, 58.0],
                            ]],
                            [[
                                [32.5, 44.3],
                                [36.7, 44.3],
                                [36.7, 46.3],
                                [32.5, 46.3],
                                [32.5, 44.3],
                            ]],
                        ],
                    },
                },
                {
                    "type": "Feature",
                    "properties": {"ADMIN": "Ukraine"},
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [[
                            [22.0, 48.0],
                            [23.0, 48.0],
                            [23.0, 49.0],
                            [22.0, 49.0],
                            [22.0, 48.0],
                        ]],
                    },
                },
            ],
        }

        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "countries.geojson"
            path.write_text(json.dumps(boundary_payload), encoding="utf-8")

            boundaries = countries.load_boundaries(path)

        self.assertEqual(countries.matching_countries((34.1, 44.95), boundaries), ["Ukraine"])
        self.assertEqual(countries.matching_countries((30.5, 58.5), boundaries), ["Russia"])

    def test_unmatched_features_are_unknown_not_source_country(self):
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
                            [1.0, 0.0],
                            [1.0, 1.0],
                            [0.0, 1.0],
                            [0.0, 0.0],
                        ]],
                    },
                },
            ],
        }
        feature_collection = {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "geometry": {"type": "Point", "coordinates": [10.0, 10.0]},
                    "properties": {"country": "Russia"},
                },
            ],
        }

        with tempfile.TemporaryDirectory() as tmpdir:
            boundary_path = Path(tmpdir) / "countries.geojson"
            data_path = Path(tmpdir) / "data.geojson"
            boundary_path.write_text(json.dumps(boundary_payload), encoding="utf-8")
            data_path.write_text(json.dumps(feature_collection), encoding="utf-8")
            boundaries = countries.load_boundaries(boundary_path)

            report = countries.enrich_file(data_path, boundaries, write=True)
            enriched = json.loads(data_path.read_text(encoding="utf-8"))

        props = enriched["features"][0]["properties"]
        self.assertEqual(props["country"], "Unknown")
        self.assertEqual(props["countries"], ["Unknown"])
        self.assertEqual(props["source_country"], "Russia")
        self.assertEqual(props["country_match_method"], "no_boundary_match")
        self.assertEqual(report["unmatched"], 1)

    def test_sample_positions_limit_one_handles_multivertex_geometry(self):
        geometry = {
            "type": "LineString",
            "coordinates": [
                [30.0, 50.0],
                [31.0, 51.0],
                [32.0, 52.0],
            ],
        }

        self.assertEqual(countries.sample_positions(geometry, limit=1), [(30.0, 50.0)])

    def test_non_point_features_fall_back_to_geometry_samples(self):
        boundaries = [
            {
                "name": "Testland",
                "bbox": (0.0, 0.0, 2.0, 2.0),
                "polygons": [
                    {
                        "bbox": (0.0, 0.0, 2.0, 2.0),
                        "rings": [[
                            [0.0, 0.0],
                            [2.0, 0.0],
                            [2.0, 2.0],
                            [0.0, 2.0],
                            [0.0, 0.0],
                        ]],
                    },
                ],
            },
        ]
        feature = {
            "type": "Feature",
            "geometry": {
                "type": "LineString",
                "coordinates": [
                    [1.0, 1.0],
                    [3.0, 3.0],
                ],
            },
            "properties": {"map_longitude": "3.0", "map_latitude": "3.0"},
        }

        self.assertEqual(countries.derive_feature_countries(feature, boundaries), (["Testland"], "geometry_sample_in_boundary"))

    def test_un_locode_country_source_is_not_overwritten_by_boundaries(self):
        boundary_payload = {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "properties": {"ADMIN": "Russia"},
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [[
                            [29.0, 59.0],
                            [31.0, 59.0],
                            [31.0, 60.5],
                            [29.0, 60.5],
                            [29.0, 59.0],
                        ]],
                    },
                },
            ],
        }
        feature_collection = {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "geometry": {"type": "Point", "coordinates": [30.316667, 59.933333]},
                    "properties": {
                        "source": "un_locode",
                        "country": "RU",
                        "country_code": "RU",
                        "country_source": "un_locode",
                    },
                },
            ],
        }

        with tempfile.TemporaryDirectory() as tmpdir:
            boundary_path = Path(tmpdir) / "countries.geojson"
            data_path = Path(tmpdir) / "data.geojson"
            boundary_path.write_text(json.dumps(boundary_payload), encoding="utf-8")
            data_path.write_text(json.dumps(feature_collection), encoding="utf-8")
            boundaries = countries.load_boundaries(boundary_path)

            countries.enrich_file(data_path, boundaries, write=True)
            enriched = json.loads(data_path.read_text(encoding="utf-8"))

        props = enriched["features"][0]["properties"]
        self.assertEqual(props["country"], "Russia")
        self.assertEqual(props["countries"], ["Russia"])
        self.assertEqual(props["country_match_method"], "un_locode_country")


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


class GeofabrikRoadExtractorTests(unittest.TestCase):
    def test_feature_to_row_preserves_country_source_geometry_and_tags(self):
        feature = {
            "type": "Feature",
            "id": "way/123",
            "geometry": {
                "type": "LineString",
                "coordinates": [[30.0, 50.0], [31.0, 50.5], [32.0, 51.0]],
            },
            "properties": {
                "highway": "trunk",
                "name": "M-01",
                "ref": "M-01",
                "surface": "asphalt",
                "bridge": "yes",
            },
        }

        row = roads.feature_to_row(roads.COUNTRY_EXTRACTS["ukraine"], feature, 7)

        self.assertEqual(row["source_dataset"], roads.SOURCE_DATASET)
        self.assertEqual(row["layer"], "osm_major_roads")
        self.assertEqual(row["feature_id"], "way/123")
        self.assertEqual(row["category"], "trunk")
        self.assertEqual(row["subcategory"], "trunk")
        self.assertEqual(row["country_code"], "UA")
        self.assertEqual(row["country_source"], "geofabrik_extract_boundary")
        self.assertEqual(row["geometry_type"], "LineString")
        self.assertEqual(row["coordinate_count"], 3)
        self.assertGreater(row["length_km"], 0)
        self.assertEqual(row["properties_tags_bridge"], "yes")
        self.assertIn("download.geofabrik.de/europe/ukraine-latest.osm.pbf", row["source_url"])

    def test_feature_to_row_skips_referenced_point_features(self):
        feature = {
            "type": "Feature",
            "id": "node/1",
            "geometry": {"type": "Point", "coordinates": [30.0, 50.0]},
            "properties": {"highway": "crossing"},
        }

        row = roads.feature_to_row(roads.COUNTRY_EXTRACTS["ukraine"], feature, 1)

        self.assertIsNone(row)

    def test_write_csv_emits_header_for_empty_optional_source(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "roads.csv"

            roads.write_csv([], path)

            with path.open("r", encoding="utf-8-sig") as handle:
                header = handle.readline().strip().split(",")
        self.assertIn("source_dataset", header)
        self.assertIn("geometry_json", header)

    def test_csv_has_data_rows_ignores_header_only_file(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "roads.csv"

            roads.write_csv([], path)

            self.assertFalse(roads.csv_has_data_rows(path))

            with path.open("a", newline="", encoding="utf-8-sig") as handle:
                writer = csv.DictWriter(handle, fieldnames=roads.FIELDNAMES)
                writer.writerow({"source_dataset": roads.SOURCE_DATASET, "layer": "osm_major_roads"})

            self.assertTrue(roads.csv_has_data_rows(path))

    def test_main_refuses_to_replace_roads_with_empty_extract(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "roads.csv"

            with patch.object(roads, "CSV_PATH", path), patch.object(sys, "argv", ["roads"]):
                result = roads.main()

            self.assertEqual(result, 1)
            self.assertFalse(path.exists())

    def test_main_preserves_existing_road_csv_when_extract_is_empty(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "roads.csv"
            roads.write_csv(
                [{"source_dataset": roads.SOURCE_DATASET, "layer": "osm_major_roads", "feature_id": "way/1"}],
                path,
            )
            before = path.read_text(encoding="utf-8-sig")

            with patch.object(roads, "CSV_PATH", path), patch.object(sys, "argv", ["roads"]):
                result = roads.main()

            self.assertEqual(result, 0)
            self.assertEqual(path.read_text(encoding="utf-8-sig"), before)

    def test_default_profile_is_smaller_than_regional_profile(self):
        self.assertEqual(
            roads.STRATEGIC_HIGHWAY_CLASSES,
            ["motorway", "motorway_link", "trunk", "trunk_link", "primary", "primary_link"],
        )
        self.assertLess(len(roads.STRATEGIC_HIGHWAY_CLASSES), len(roads.REGIONAL_HIGHWAY_CLASSES))


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

    def test_fallback_rows_from_web_manifest_reads_split_military_industrial_layer(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            data_dir = root / "web" / "data"
            data_dir.mkdir(parents=True)
            manifest_path = data_dir / "manifest.json"
            old_single_file = data_dir / "missing_single.geojson"
            manifest_path.write_text(json.dumps({
                "layers": [
                    {
                        "id": "military_industrial",
                        "files": [
                            "military_industrial_part001.geojson",
                            "military_industrial_part002.geojson",
                        ],
                    }
                ]
            }), encoding="utf-8")
            for index, name in enumerate([
                "military_industrial_part001.geojson",
                "military_industrial_part002.geojson",
            ], 1):
                (data_dir / name).write_text(json.dumps({
                    "type": "FeatureCollection",
                    "features": [
                        {
                            "type": "Feature",
                            "geometry": {"type": "Point", "coordinates": [30.0 + index, 50.0 + index]},
                            "properties": {
                                "uid": f"obj_{index}",
                                "source_record_id": f"company_{index}",
                                "name": f"Company {index}",
                            },
                        }
                    ],
                }), encoding="utf-8")

            with patch.object(varta, "FALLBACK_WEB_GEOJSON", old_single_file), \
                patch.object(varta, "FALLBACK_WEB_MANIFEST", manifest_path):
                rows = varta.fallback_rows_from_web_geojson()

        self.assertEqual([row["feature_id"] for row in rows], ["company_1", "company_2"])
        self.assertEqual([row["feature_index"] for row in rows], [1, 2])


class RussiaOilPowerExtractorTests(unittest.TestCase):
    def test_fallback_row_from_web_feature_preserves_geometry_and_tags(self):
        feature = {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [59.19823, 55.18044]},
            "properties": {
                "source_id": "russia_oil_power_map",
                "source_layer": "pump_stations",
                "source_record_id": "pump_stations:1",
                "source_url": "https://russiaoilpowermap.com/data/static/pump_stations.geojson",
                "display_label": "Oil Pumping Station",
                "asset_type": "pump_station",
                "product": "oil",
                "tags": {"man_made": "pumping_station", "substance": "oil"},
            },
        }

        row = oil_power.fallback_row_from_feature(feature, 1)

        self.assertIsNotNone(row)
        assert row is not None
        self.assertEqual(row["layer"], "pump_stations")
        self.assertEqual(row["feature_id"], "pump_stations:1")
        self.assertEqual(row["name"], "Oil Pumping Station")
        self.assertEqual(row["geometry_type"], "Point")
        self.assertEqual(row["longitude"], 59.19823)
        self.assertEqual(row["latitude"], 55.18044)
        self.assertEqual(row["properties_tags_man_made"], "pumping_station")

    def test_fallback_rows_from_web_manifest_reads_russia_features(self):
        manifest = {
            "layers": [
                {"files": ["energy_facilities.geojson"]},
            ],
        }
        feature_collection = {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "geometry": {"type": "Point", "coordinates": [37.2, 55.1]},
                    "properties": {
                        "source_id": "russia_oil_power_map",
                        "source_layer": "custom_pins",
                        "source_record_id": "pin_1",
                        "display_label": "Alpha Facility",
                    },
                },
                {
                    "type": "Feature",
                    "geometry": {"type": "Point", "coordinates": [38.2, 56.1]},
                    "properties": {
                        "source_id": "nightwatch_map",
                        "source_record_id": "ignored",
                    },
                },
            ],
        }

        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            web_data = root / "web" / "data"
            web_data.mkdir(parents=True)
            manifest_path = web_data / "manifest.json"
            manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
            (web_data / "energy_facilities.geojson").write_text(json.dumps(feature_collection), encoding="utf-8")

            with patch.object(oil_power, "FALLBACK_WEB_MANIFEST", manifest_path):
                rows = oil_power.fallback_rows_from_web_data()

        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["feature_id"], "pin_1")
        self.assertEqual(rows[0]["name"], "Alpha Facility")


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

    def test_compare_builds_reports_power_classification_changes(self):
        previous_feature = test_feature("same", "Alpha", "power_facilities", "power_station", 55.0, 37.0)
        current_feature = test_feature("same", "Alpha", "power_facilities", "power_station", 55.0, 37.0)
        previous_feature["properties"].update({
            "generation_type": "unknown",
            "is_nuclear": "unknown",
            "classification_confidence": "unknown",
        })
        current_feature["properties"].update({
            "generation_type": "nuclear",
            "is_nuclear": "true",
            "classification_confidence": "verified",
        })

        report = changes.compare_builds(
            {"type": "FeatureCollection", "features": [previous_feature]},
            {"type": "FeatureCollection", "features": [current_feature]},
            "2026-06-18T00:00:00Z",
            "2026-06-30T00:00:00Z",
        )

        self.assertEqual(report["summary"]["category_changes"], 1)
        changed_fields = report["category_changes"][0]["changed_fields"]
        self.assertIn("generation_type", changed_fields)
        self.assertIn("is_nuclear", changed_fields)
        self.assertIn("classification_confidence", changed_fields)


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


class PowerClassificationTests(unittest.TestCase):
    def test_name_patterns_classify_power_station_without_marking_unknown_false(self):
        row = power_test_row("rostov", "Rostov Nuclear Power Plant", "power_station")

        result = power.classify_power_row(row, [])

        self.assertEqual(result.fields["generation_type"], "nuclear")
        self.assertEqual(result.fields["is_nuclear"], "true")
        self.assertEqual(result.fields["radiological_risk"], "present")
        self.assertEqual(result.fields["classification_confidence"], "inferred")

    def test_unknown_power_station_remains_unknown(self):
        row = power_test_row("unknown", "Alpha Power Facility", "power_station")

        result = power.classify_power_row(row, [])

        self.assertEqual(result.fields["generation_type"], "unknown")
        self.assertEqual(result.fields["primary_fuel"], "unknown")
        self.assertEqual(result.fields["is_nuclear"], "unknown")
        self.assertEqual(result.fields["radiological_risk"], "unknown")

    def test_chp_sets_role_not_fuel(self):
        row = power_test_row("chp", "CHP-27", "power_station")

        result = power.classify_power_row(row, [])

        self.assertEqual(result.fields["generation_type"], "thermal")
        self.assertEqual(result.fields["plant_role"], "combined_heat_and_power")
        self.assertEqual(result.fields["primary_fuel"], "unknown")
        self.assertEqual(result.fields["is_nuclear"], "false")

    def test_false_positive_names_are_not_classified_as_power_generation(self):
        row = power_test_row("office", "Atomic Energy Corporation Office", "power_station")

        result = power.classify_power_row(row, [])

        self.assertEqual(result.fields["generation_type"], "unknown")
        self.assertEqual(result.fields["is_nuclear"], "unknown")

    def test_substation_is_non_nuclear_even_when_name_mentions_nuclear_connection(self):
        row = power_test_row("substation", "Rostov Nuclear Power Plant Substation", "substation")

        result = power.classify_power_row(row, [])

        self.assertEqual(result.fields["is_nuclear"], "false")
        self.assertEqual(result.fields["radiological_risk"], "not_present")
        self.assertEqual(result.fields["substation_type"], "unknown")

    def test_pris_reactors_aggregate_to_station_evidence(self):
        records = [
            power.cached_row_to_evidence({"reactor_name": "Balakovo-1", "reactor_id": "b1", "reactor_type": "VVER-1000", "status": "operating", "gross_electrical_capacity_mw": "1000"}, "iaea_pris", "1"),
            power.cached_row_to_evidence({"reactor_name": "Balakovo-2", "reactor_id": "b2", "reactor_type": "VVER-1000", "status": "operating", "gross_electrical_capacity_mw": "1000"}, "iaea_pris", "2"),
        ]

        aggregated = power.aggregate_pris_reactors([record for record in records if record is not None])

        self.assertEqual(len(aggregated), 1)
        self.assertEqual(aggregated[0].field_values["generation_type"], "nuclear")
        self.assertEqual(aggregated[0].field_values["reactor_count"], "2")
        self.assertEqual(aggregated[0].field_values["installed_capacity_mw"], "2000")
        self.assertEqual(json.loads(aggregated[0].field_values["nuclear_reference_ids"]), ["b1", "b2"])

    def test_cached_geojson_record_uses_tags_geometry_and_aliases(self):
        feature = {
            "type": "Feature",
            "id": "way/1",
            "geometry": {"type": "Point", "coordinates": [39.2, 47.3]},
            "properties": {
                "tags": {
                    "name": "Azov Wind Farm",
                    "name:ru": "Azovskaya VES",
                    "plant:source": "wind",
                    "operator": "Wind Operator",
                },
                "region": "Rostov Oblast",
            },
        }

        evidence = power.cached_row_to_evidence(feature, "osm", "feature.json:1")

        self.assertIsNotNone(evidence)
        assert evidence is not None
        self.assertEqual(evidence.source_record_id, "way/1")
        self.assertEqual(evidence.field_values["external_name"], "Azov Wind Farm")
        self.assertEqual(evidence.field_values["external_longitude"], "39.2")
        self.assertEqual(evidence.field_values["external_latitude"], "47.3")
        self.assertEqual(evidence.field_values["generation_type"], "wind")
        self.assertIn("Azovskaya VES", json.loads(evidence.field_values["external_aliases"]))

    def test_read_cached_json_accepts_feature_collection(self):
        payload = {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "id": "node/1",
                    "geometry": {"type": "Point", "coordinates": [58.0, 52.0]},
                    "properties": {"tags": {"name": "Orsk Solar Power Plant", "plant:source": "solar"}},
                },
            ],
        }
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "osm_power.json"
            path.write_text(json.dumps(payload), encoding="utf-8")

            records = power.read_cached_json(path, "osm")

        self.assertEqual(len(records), 1)
        self.assertEqual(records[0].field_values["generation_type"], "solar")

    def test_external_alias_match_classifies_station(self):
        row = power_test_row("rostov", "Rostov Nuclear Power Plant", "power_station", lat="47.6", lon="42.4")
        evidence = power.Evidence(
            source_id="global_energy_monitor",
            source_name="Global Energy Monitor",
            source_record_id="gem_1",
            field_values={
                "external_name": "Rostovskaya AES",
                "external_aliases": json.dumps(["Rostov NPP", "Rostov Nuclear Power Plant"]),
                "external_latitude": "47.6",
                "external_longitude": "42.4",
                "generation_type": "nuclear",
                "primary_fuel": "uranium",
            },
        )

        result = power.classify_power_row(row, [evidence])

        self.assertEqual(result.fields["generation_type"], "nuclear")
        self.assertEqual(result.fields["classification_confidence"], "verified")

    def test_enrich_rows_promotes_aliases_to_canonical_fields(self):
        row = power_test_row("rostov", "Rostov Nuclear Power Plant", "power_station", lat="47.6", lon="42.4")
        row["tags_json"] = json.dumps({"name:ru": "Rostovskaya AES"})
        evidence = power.Evidence(
            source_id="global_energy_monitor",
            source_name="Global Energy Monitor",
            source_record_id="gem_1",
            field_values={
                "external_name": "Rostovskaya AES",
                "external_aliases": json.dumps(["Rostov NPP", "Rostov Nuclear Power Plant"]),
                "external_latitude": "47.6",
                "external_longitude": "42.4",
                "generation_type": "nuclear",
                "primary_fuel": "uranium",
            },
        )
        with tempfile.TemporaryDirectory() as tmpdir:
            with patch.object(power, "REVIEW_DIR", Path(tmpdir) / "review"), \
                patch.object(power, "MANUAL_OBJECT_OVERRIDES_CSV", Path(tmpdir) / "missing.csv"):
                enriched_rows, _report = power.enrich_rows([row], [evidence])

        aliases = json.loads(enriched_rows[0]["alternate_names"])
        self.assertEqual(enriched_rows[0]["name_ru"], "Rostovskaya AES")
        self.assertIn("Rostov NPP", aliases)
        self.assertIn("Rostovskaya AES", enriched_rows[0]["search_text"])

    def test_power_reference_output_writes_classification_evidence_table(self):
        row = power_test_row("rostov", "Rostov Nuclear Power Plant", "power_station", lat="47.6", lon="42.4")
        evidence = power.Evidence(
            source_id="global_energy_monitor",
            source_name="Global Energy Monitor",
            source_record_id="gem_1",
            field_values={
                "external_name": "Rostov Nuclear Power Plant",
                "external_latitude": "47.6",
                "external_longitude": "42.4",
                "generation_type": "nuclear",
                "primary_fuel": "uranium",
            },
        )
        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = Path(tmpdir) / "power_refs.csv"
            with patch.object(power, "REVIEW_DIR", Path(tmpdir) / "review"), \
                patch.object(power, "POWER_REFERENCES_CSV", output_path), \
                patch.object(power, "MANUAL_OBJECT_OVERRIDES_CSV", Path(tmpdir) / "missing.csv"):
                enriched_rows, _report = power.enrich_rows([row], [evidence])
                power.write_power_reference_output(enriched_rows)
            with output_path.open(encoding="utf-8-sig") as handle:
                rows = list(csv.DictReader(handle))

        self.assertTrue(rows)
        generation_rows = [item for item in rows if item["field_supported"] == "generation_type"]
        self.assertEqual(generation_rows[0]["object_id"], "rostov")
        self.assertEqual(generation_rows[0]["value_supported"], "nuclear")
        self.assertEqual(generation_rows[0]["relationship"], "classification_evidence")

    def test_manual_overrides_apply_only_with_required_review_metadata(self):
        rows = [power_test_row("alpha", "Alpha Power Facility", "power_station")]
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            overrides_path = root / "object_overrides.csv"
            with overrides_path.open("w", newline="", encoding="utf-8") as handle:
                writer = csv.DictWriter(handle, fieldnames=["object_id", "field", "old_value", "new_value", "reason", "reviewer", "reviewed_at"])
                writer.writeheader()
                writer.writerow({
                    "object_id": "alpha",
                    "field": "generation_type",
                    "old_value": "unknown",
                    "new_value": "hydro",
                    "reason": "official review",
                    "reviewer": "analyst",
                    "reviewed_at": "2026-07-22",
                })
                writer.writerow({
                    "object_id": "alpha",
                    "field": "is_nuclear",
                    "old_value": "unknown",
                    "new_value": "false",
                    "reason": "",
                    "reviewer": "analyst",
                    "reviewed_at": "2026-07-22",
                })
            review_dir = root / "review"

            with patch.object(power, "REVIEW_DIR", review_dir), \
                patch.object(power, "MANUAL_OBJECT_OVERRIDES_CSV", overrides_path):
                enriched_rows, report = power.enrich_rows(rows, [])
                with (review_dir / "power_manual_override_issues.csv").open(encoding="utf-8-sig") as handle:
                    issue_rows = list(csv.DictReader(handle))

        self.assertEqual(enriched_rows[0]["generation_type"], "hydro")
        self.assertEqual(enriched_rows[0]["is_nuclear"], "unknown")
        self.assertEqual(enriched_rows[0]["review_status"], "reviewed")
        self.assertEqual(report["manual_overrides_applied"], 1)
        self.assertEqual(report["manual_override_issues"], 1)
        self.assertEqual(issue_rows[0]["issue_reason"], "missing_review_metadata")

    def test_low_confidence_external_matches_keep_candidate_metadata(self):
        row = power_test_row("alpha", "Alpha Power Facility", "power_station")
        candidate = power.Evidence(
            source_id="wri_global_power_plant_database",
            source_name="WRI Global Power Plant Database",
            source_record_id="wri_1",
            field_values={
                "external_name": "Alpha Hydro Station",
                "generation_type": "hydro",
                "primary_fuel": "water",
            },
            match_score=0.62,
            match_method="weighted_name_distance_match",
        )

        result = power.merge_evidence(row, power.classify_by_name(row), [candidate])
        queue_row = power.low_confidence_match_row(row, result.review_matches[0])

        self.assertEqual(result.fields["generation_type"], "unknown")
        self.assertEqual(result.nuclear_candidate_reason, "low_confidence_external_match")
        self.assertEqual(queue_row["classification_confidence"], "review_candidate")
        self.assertEqual(queue_row["candidate_source"], "wri_global_power_plant_database")
        self.assertEqual(queue_row["candidate_name"], "Alpha Hydro Station")

    def test_capacity_agreement_promotes_close_review_match(self):
        row = power_test_row("alpha", "Alpha Hydro 5 Power Plant", "power_station", lat="55.0", lon="37.0")
        row["region"] = "Test Region"
        row["installed_capacity_mw"] = "500"
        evidence = power.Evidence(
            source_id="wri_global_power_plant_database",
            source_name="WRI Global Power Plant Database",
            source_record_id="wri_1",
            field_values={
                "external_name": "Alpha Hydro 6 Plant",
                "external_latitude": "55.0",
                "external_longitude": "37.0",
                "external_region": "Test Region",
                "generation_type": "hydro",
                "primary_fuel": "water",
                "installed_capacity_mw": "505",
            },
        )

        result = power.classify_power_row(row, [evidence])

        self.assertEqual(result.fields["generation_type"], "hydro")
        self.assertEqual(result.fields["classification_confidence"], "corroborated")
        self.assertGreaterEqual(float(result.fields["match_score"]), 0.75)

    def test_cached_authoritative_match_overrides_inferred_confidence(self):
        row = power_test_row("balakovo", "Balakovo Nuclear Power Plant", "power_station", lat="52.091", lon="47.955")
        evidence = pris_evidence("Balakovo Nuclear Power Plant")

        result = power.classify_power_row(row, [evidence])

        self.assertEqual(result.fields["generation_type"], "nuclear")
        self.assertEqual(result.fields["classification_confidence"], "verified")
        self.assertEqual(result.fields["reactor_count"], "4")

    def test_pris_exact_name_match_is_verified_without_coordinates(self):
        row = power_test_row("balakovo", "Balakovo Nuclear Power Plant", "power_station", lat="52.091", lon="47.955")
        records = [
            power.cached_row_to_evidence({
                "station_name": "Balakovo Nuclear Power Plant",
                "reactor_name": "BALAKOVO-1",
                "reactor_id": "b1",
                "reactor_type": "PWR",
                "status": "operating",
                "gross_electrical_capacity_mw": "1000",
            }, "iaea_pris", "1"),
            power.cached_row_to_evidence({
                "station_name": "Balakovo Nuclear Power Plant",
                "reactor_name": "BALAKOVO-2",
                "reactor_id": "b2",
                "reactor_type": "PWR",
                "status": "operating",
                "gross_electrical_capacity_mw": "1000",
            }, "iaea_pris", "2"),
        ]

        result = power.classify_power_row(row, power.aggregate_pris_reactors([record for record in records if record]))

        self.assertEqual(result.fields["generation_type"], "nuclear")
        self.assertEqual(result.fields["classification_confidence"], "verified")
        self.assertEqual(result.fields["classification_method"], "authoritative_exact_name_match")
        self.assertEqual(result.fields["reactor_count"], "2")
        self.assertEqual(result.fields["installed_capacity_mw"], "2000")

    def test_pris_nuclear_conflict_preserves_nuclear_state_for_review(self):
        row = power_test_row("balakovo", "Balakovo Nuclear Power Plant", "power_station", lat="52.091", lon="47.955")
        hydro_evidence = power.Evidence(
            source_id="wri_global_power_plant_database",
            source_name="WRI Global Power Plant Database",
            source_record_id="wri_1",
            field_values={
                "external_name": "Balakovo Nuclear Power Plant",
                "external_latitude": "52.091",
                "external_longitude": "47.955",
                "generation_type": "hydro",
                "primary_fuel": "water",
            },
        )

        result = power.classify_power_row(row, [pris_evidence("Balakovo Nuclear Power Plant"), hydro_evidence])

        self.assertEqual(result.fields["classification_confidence"], "conflicting")
        self.assertEqual(result.fields["generation_type"], "nuclear")
        self.assertEqual(result.fields["is_nuclear"], "true")
        self.assertEqual(result.fields["radiological_risk"], "present")
        self.assertEqual(len(result.conflicts), 1)

    def test_enrich_rows_generates_power_review_report_counts(self):
        rows = [
            power_test_row("nuclear", "Rostov Nuclear Power Plant", "power_station"),
            power_test_row("hydro", "Tsimlyanskaya Hydroelectric Station", "power_station"),
            power_test_row("unknown", "Alpha Power Facility", "power_station"),
            power_test_row("sub", "Alpha Substation", "substation"),
        ]
        with tempfile.TemporaryDirectory() as tmpdir:
            review_dir = Path(tmpdir) / "review"
            with patch.object(power, "REVIEW_DIR", review_dir), \
                patch.object(power, "MANUAL_OBJECT_OVERRIDES_CSV", Path(tmpdir) / "missing.csv"):
                enriched_rows, report = power.enrich_rows(rows, [])
                unknown_review_exists = (review_dir / "power_station_unknown_type.csv").exists()

        by_uid = {row["uid"]: row for row in enriched_rows}
        self.assertEqual(by_uid["nuclear"]["derived_subcategory"], "nuclear_power_station")
        self.assertEqual(by_uid["hydro"]["derived_subcategory"], "hydro_power_station")
        self.assertEqual(by_uid["unknown"]["derived_subcategory"], "power_station_unknown_type")
        self.assertEqual(by_uid["sub"]["derived_subcategory"], "substation")
        self.assertEqual(report["total_power_stations"], 3)
        self.assertEqual(report["total_substations"], 1)
        self.assertEqual(report["unknown_power_stations"], 1)
        self.assertEqual(report["confirmed_non_nuclear_stations"], 0)
        self.assertTrue(unknown_review_exists)

    def test_power_enrichment_cache_import_copies_csv_and_rejects_other_formats(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            source = root / "pris.csv"
            source.write_text("reactor_name,reactor_id\nBalakovo-1,b1\n", encoding="utf-8")
            cache_dir = root / "cache"

            result = power_enrichment_cache.cache_source_main(cache_dir, "IAEA PRIS", ["--input", str(source)])

            self.assertEqual(result, 0)
            self.assertEqual((cache_dir / "pris.csv").read_text(encoding="utf-8"), source.read_text(encoding="utf-8"))

            bad = root / "pris.txt"
            bad.write_text("not csv", encoding="utf-8")
            with self.assertRaises(ValueError):
                power_enrichment_cache.cache_source_main(cache_dir, "IAEA PRIS", ["--input", str(bad)])

    def test_power_enrichment_cache_downloads_url_to_cache(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            source = root / "source.csv"
            source.write_text("plant_name,primary_fuel\nAlpha Solar,solar\n", encoding="utf-8")
            cache_dir = root / "cache"

            result = power_enrichment_cache.cache_source_main(
                cache_dir,
                "Test source",
                ["--url", source.as_uri(), "--output-name", "downloaded.csv"],
            )

            self.assertEqual(result, 0)
            self.assertEqual((cache_dir / "downloaded.csv").read_text(encoding="utf-8"), source.read_text(encoding="utf-8"))

    def test_wri_refresh_uses_default_dataset_url(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            cache_dir = Path(tmpdir) / "wri"
            downloaded = cache_dir / "global_power_plant_database.csv"
            with patch.object(wri_power, "CACHE_DIR", cache_dir), \
                patch.object(power_enrichment_cache, "download_url_to_cache", return_value=[downloaded]) as download:
                result = wri_power.main(["--refresh"])

        self.assertEqual(result, 0)
        self.assertEqual(download.call_args.args[0], wri_power.DEFAULT_URLS[0])

    def test_pris_country_page_parser_emits_station_level_reactor_rows(self):
        html = """
        <html><body>
        <h3>Reactors</h3>
        <table>
        <tr><th>Name</th><th>Type</th><th>Status</th><th>Location</th><th>Reference Unit Power [MW]</th><th>Gross Electrical Capacity [MW]</th><th>First Grid Connection</th></tr>
        <tr><td>BALAKOVO-1</td><td>PWR</td><td>Operational</td><td>BALAKOVO</td><td>950</td><td>1000</td><td>1985-12-24</td></tr>
        <tr><td>KURSK 2-2</td><td>PWR</td><td>Under Construction</td><td>KURCHATOV</td><td>1200</td><td>1255</td><td></td></tr>
        </table>
        Above data generated by the PRIS database.
        </body></html>
        """

        rows = pris.reactor_rows_from_country_page(html, pris.DEFAULT_RUSSIA_URL)

        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0]["reactor_name"], "BALAKOVO-1")
        self.assertEqual(rows[0]["station_name"], "Balakovo Nuclear Power Plant")
        self.assertEqual(rows[0]["status"], "operating")
        self.assertEqual(rows[1]["station_name"], "Kursk 2 Nuclear Power Plant")
        self.assertEqual(rows[1]["status"], "under_construction")

    def test_osm_geofabrik_feature_is_normalized_for_power_cache(self):
        extract = osm_power.EXTRACTS["russia"]
        feature = {
            "type": "Feature",
            "id": "way/123",
            "geometry": {
                "type": "Polygon",
                "coordinates": [[
                    [37.0, 55.0],
                    [37.2, 55.0],
                    [37.2, 55.2],
                    [37.0, 55.2],
                    [37.0, 55.0],
                ]],
            },
            "properties": {
                "power": "plant",
                "name": "Alpha Solar Power Plant",
                "plant:source": "solar",
                "voltage": "110000",
            },
        }

        normalized = osm_power.normalize_feature(feature, extract, 7)

        self.assertIsNotNone(normalized)
        assert normalized is not None
        props = normalized["properties"]
        self.assertEqual(normalized["id"], "way/123")
        self.assertEqual(props["source_url"], "https://download.geofabrik.de/russia-latest.osm.pbf")
        self.assertEqual(props["country_code"], "RU")
        self.assertEqual(props["tags"]["plant:source"], "solar")
        self.assertNotEqual(props["latitude"], "")
        self.assertNotEqual(props["longitude"], "")

    def test_enrich_file_reads_cached_sources_and_updates_package_manifest(self):
        rows = [
            power_test_row("balakovo", "Balakovo Nuclear Power Plant", "power_station", lat="52.091", lon="47.955"),
            power_test_row("orsk", "Orsk Solar Power Plant", "power_station", lat="52.0", lon="58.0"),
        ]
        rows[1]["installed_capacity_mw"] = "40"

        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            normalized_csv = root / "normalized.csv"
            normalized_geojson = root / "normalized.geojson"
            report_json = root / "power_report.json"
            refs_csv = root / "power_refs.csv"
            normal_report = root / "normalization_report.json"
            cache_root = root / "raw" / "power_enrichment"
            review_dir = root / "review"
            manifest_path = root / "data_package" / "manifest.json"
            manifest_path.parent.mkdir(parents=True)
            manifest_path.write_text(json.dumps({"files": {"objects_csv": "data/normalized_infrastructure.csv"}, "notes": []}), encoding="utf-8")
            normal_report.write_text(json.dumps({"outputs": {}}), encoding="utf-8")

            write_power_rows(normalized_csv, rows)
            normalized_geojson.write_text(json.dumps({
                "type": "FeatureCollection",
                "features": [power_feature_from_row(row) for row in rows],
            }), encoding="utf-8")

            pris_dir = cache_root / "iaea_pris"
            pris_dir.mkdir(parents=True)
            with (pris_dir / "pris.csv").open("w", newline="", encoding="utf-8") as handle:
                writer = csv.DictWriter(handle, fieldnames=["station_name", "reactor_name", "reactor_id", "reactor_type", "status", "latitude", "longitude"])
                writer.writeheader()
                writer.writerow({
                    "station_name": "Balakovo Nuclear Power Plant",
                    "reactor_name": "Balakovo-1",
                    "reactor_id": "b1",
                    "reactor_type": "VVER-1000",
                    "status": "operating",
                    "latitude": "52.091",
                    "longitude": "47.955",
                })

            wri_dir = cache_root / "wri"
            wri_dir.mkdir(parents=True)
            with (wri_dir / "wri.csv").open("w", newline="", encoding="utf-8") as handle:
                writer = csv.DictWriter(handle, fieldnames=["plant_name", "primary_fuel", "capacity_mw", "latitude", "longitude", "source_record_id"])
                writer.writeheader()
                writer.writerow({
                    "plant_name": "Orsk Solar Power Plant",
                    "primary_fuel": "solar",
                    "capacity_mw": "40",
                    "latitude": "52.0",
                    "longitude": "58.0",
                    "source_record_id": "wri_orsk",
                })

            osm_dir = cache_root / "osm"
            osm_dir.mkdir(parents=True)
            (osm_dir / "osm_power.json").write_text(json.dumps({
                "type": "FeatureCollection",
                "features": [
                    {
                        "type": "Feature",
                        "id": "node/unmatched",
                        "geometry": {"type": "Point", "coordinates": [60.0, 53.0]},
                        "properties": {"tags": {"name": "Unmatched Wind Farm", "plant:source": "wind"}},
                    },
                ],
            }), encoding="utf-8")

            with patch.object(power, "NORMALIZED_CSV", normalized_csv), \
                patch.object(power, "NORMALIZED_GEOJSON", normalized_geojson), \
                patch.object(power, "REPORT_JSON", report_json), \
                patch.object(power, "POWER_REFERENCES_CSV", refs_csv), \
                patch.object(power, "NORMALIZATION_REPORT_JSON", normal_report), \
                patch.object(power, "RAW_ENRICHMENT_DIR", cache_root), \
                patch.object(power, "REVIEW_DIR", review_dir), \
                patch.object(power, "MANUAL_OBJECT_OVERRIDES_CSV", root / "missing.csv"), \
                patch.object(power, "DATA_PACKAGE_MANIFEST", manifest_path):
                report = power.enrich_file()

            with normalized_csv.open(encoding="utf-8-sig") as handle:
                enriched = {row["uid"]: row for row in csv.DictReader(handle)}
            with (review_dir / "power_unmatched_external_records.csv").open(encoding="utf-8-sig") as handle:
                unmatched_rows = list(csv.DictReader(handle))
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))

        self.assertEqual(enriched["balakovo"]["generation_type"], "nuclear")
        self.assertEqual(enriched["balakovo"]["classification_confidence"], "verified")
        self.assertEqual(enriched["orsk"]["generation_type"], "solar")
        self.assertEqual(enriched["orsk"]["classification_confidence"], "corroborated")
        self.assertEqual(report["external_records_loaded"], 3)
        self.assertEqual(report["external_records_matched"], 2)
        self.assertEqual(unmatched_rows[0]["name"], "Unmatched Wind Farm")
        self.assertEqual(manifest["files"]["power_classification_report_json"], str(report_json))
        self.assertEqual(manifest["files"]["power_classification_references_csv"], str(refs_csv))


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

    def test_compact_feature_normalizes_country_codes_to_full_names(self):
        feature = {
            "type": "Feature",
            "id": "obj_1",
            "geometry": {"type": "Point", "coordinates": [21.0, 52.0]},
            "properties": {
                "uid": "obj_1",
                "country": "PL",
                "country_code": "PL",
                "source_country": "PL",
                "countries": ["PL", "Poland"],
            },
        }

        compact = prepare.compact_feature(feature)
        props = compact["properties"]

        self.assertEqual(props["country"], "Poland")
        self.assertEqual(props["countries"], ["Poland"])
        self.assertEqual(props["source_country"], "Poland")
        self.assertEqual(props["country_code"], "PL")


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


def power_test_row(uid, name, asset_type, lat="55.0", lon="37.0"):
    return {
        "uid": uid,
        "object_id": uid,
        "name": name,
        "name_en": "",
        "name_original": "",
        "display_label": name,
        "description": "",
        "name_translated": "",
        "description_translated": "",
        "asset_class": "power",
        "asset_type": asset_type,
        "asset_subtype": "",
        "map_layer": "power_facilities",
        "map_latitude": lat,
        "map_longitude": lon,
        "operator": "",
        "search_text": name,
        "references_json": "[]",
        "tags_json": "{}",
        "review_status": "unreviewed",
    }


def write_power_rows(path, rows):
    fieldnames = list(dict.fromkeys(key for row in rows for key in row))
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def power_feature_from_row(row):
    return {
        "type": "Feature",
        "id": row["uid"],
        "geometry": {
            "type": "Point",
            "coordinates": [float(row["map_longitude"]), float(row["map_latitude"])],
        },
        "properties": dict(row),
    }


def pris_evidence(name):
    return power.Evidence(
        source_id="iaea_pris",
        source_name="IAEA PRIS",
        source_record_id="b1;b2;b3;b4",
        field_values={
            "external_name": name,
            "external_latitude": "52.091",
            "external_longitude": "47.955",
            "generation_type": "nuclear",
            "primary_fuel": "uranium",
            "reactor_count": "4",
            "operating_reactor_count": "4",
            "reactor_types": json.dumps(["VVER-1000"]),
            "nuclear_reference_ids": json.dumps(["b1", "b2", "b3", "b4"]),
            "nuclear_status": "operating",
        },
    )


if __name__ == "__main__":
    unittest.main()
