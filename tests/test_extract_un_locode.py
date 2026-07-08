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

from russianinfra import extract_un_locode as locode
from russianinfra import normalize_infrastructure_data as normalize
from russianinfra import prepare_web_data as prepare


class UnLocodeCoordinateTests(unittest.TestCase):
    def test_parse_northern_eastern_coordinates(self):
        lon, lat = locode.parse_un_locode_coordinates("5956N 03019E")
        self.assertAlmostEqual(lon, 30.316667, places=6)
        self.assertAlmostEqual(lat, 59.933333, places=6)

    def test_parse_southern_western_coordinates(self):
        lon, lat = locode.parse_un_locode_coordinates("3456S 05822W")
        self.assertAlmostEqual(lon, -58.366667, places=6)
        self.assertAlmostEqual(lat, -34.933333, places=6)

    def test_parse_rejects_missing_malformed_and_impossible_coordinates(self):
        self.assertIsNone(locode.parse_un_locode_coordinates(""))
        self.assertIsNone(locode.parse_un_locode_coordinates("not coordinates"))
        self.assertIsNone(locode.parse_un_locode_coordinates("9061N 18100E"))


class UnLocodeFunctionTests(unittest.TestCase):
    def test_classifies_supported_transport_functions(self):
        self.assertEqual(locode.classify_un_locode_functions("1-------"), ["seaport"])
        self.assertEqual(locode.classify_un_locode_functions("-------8"), ["inland_port"])
        self.assertEqual(
            locode.classify_un_locode_functions("1234----"),
            ["seaport", "rail_terminal", "road_terminal", "airport"],
        )
        self.assertEqual(locode.classify_un_locode_functions("-----6--"), ["inland_clearance_depot"])
        self.assertEqual(locode.classify_un_locode_functions("------B-"), ["border_crossing"])
        self.assertEqual(locode.classify_un_locode_functions("-----5--"), [])


class UnLocodeExtractionTests(unittest.TestCase):
    def test_country_filtering_and_object_mapping(self):
        rows = [
            source_row("RU", "LED", "St Petersburg", "123-----", "5956N 03019E"),
            source_row("US", "NYC", "New York", "1-------", "4042N 07400W"),
        ]

        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "code-list.csv"
            write_source(path, rows)
            records = locode.iter_un_locode_records(path)

        self.assertEqual(len(records), 1)
        record = records[0]
        self.assertEqual(record["feature_id"], "un_locode:RULED")
        self.assertEqual(record["country_code"], "RU")
        self.assertEqual(record["country_source"], "un_locode")
        self.assertEqual(record["subcategory"], "seaport")
        self.assertEqual(record["transport_functions"], "seaport,rail_terminal,road_terminal")
        self.assertEqual(record["un_locode"], "RU LED")

    def test_normalized_geojson_properties_preserve_locode_country_and_functions(self):
        row = locode.normalize_raw_row(source_row("RU", "LED", "St Petersburg", "1234----", "5956N 03019E"), 2, Path("code-list.csv"))
        self.assertIsNotNone(row)

        normalized, feature, _reference, object_reference = normalize.normalize_row(
            row,
            "2026-07-08T00:00:00Z",
            {},
        )

        self.assertEqual(normalized["uid"], "un_locode_RU_LED")
        self.assertEqual(normalized["object_id"], "un_locode_RU_LED")
        self.assertEqual(normalized["source"], "un_locode")
        self.assertEqual(normalized["source_id"], "un_locode:RULED")
        self.assertEqual(normalized["country"], "Russia")
        self.assertEqual(normalized["country_code"], "RU")
        self.assertEqual(normalized["country_source"], "un_locode")
        self.assertEqual(normalized["asset_class"], "transport")
        self.assertEqual(normalized["asset_type"], "seaport")
        self.assertEqual(normalized["transport_functions"], "seaport,rail_terminal,road_terminal,airport")
        self.assertEqual(normalized["coordinate_precision"], "location_centroid")
        self.assertEqual(object_reference["object_id"], "un_locode_RU_LED")
        self.assertEqual(feature["type"], "Feature")
        self.assertEqual(feature["geometry"]["type"], "Point")
        self.assertAlmostEqual(feature["geometry"]["coordinates"][0], 30.316667, places=6)
        self.assertAlmostEqual(feature["geometry"]["coordinates"][1], 59.933333, places=6)
        for key in ["un_locode", "country_code", "transport_functions", "coordinate_precision", "coordinate_source"]:
            self.assertIn(key, feature["properties"])

    def test_absent_source_writes_empty_extracted_csv_without_failure(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            output = Path(tmpdir) / "un_locode_locations.csv"
            missing = Path(tmpdir) / "missing-code-list.csv"
            with patch.object(sys, "argv", ["extract_un_locode", "--input", str(missing), "--output", str(output)]):
                result = locode.main()
            with output.open(encoding="utf-8-sig") as handle:
                rows = list(csv.DictReader(handle))

        self.assertEqual(result, 0)
        self.assertEqual(rows, [])

    def test_prepare_web_data_writes_ports_logistics_layer_when_source_present(self):
        feature = {
            "type": "Feature",
            "id": "un_locode_RU_LED",
            "geometry": {"type": "Point", "coordinates": [30.316667, 59.933333]},
            "properties": {
                "uid": "un_locode_RU_LED",
                "object_id": "un_locode_RU_LED",
                "source": "un_locode",
                "source_id": "un_locode:RULED",
                "source_dataset": "UN/LOCODE Codelist",
                "source_name": "UN/LOCODE Codelist",
                "name": "St Petersburg",
                "display_label": "St Petersburg",
                "asset_class": "transport",
                "asset_type": "seaport",
                "derived_subcategory": "seaport",
                "derived_subcategory_label": "Seaport",
                "country": "RU",
                "countries": ["RU"],
                "country_code": "RU",
                "country_source": "un_locode",
                "map_layer": "transport_ports_logistics",
                "map_latitude": "59.933333",
                "map_longitude": "30.316667",
                "coordinate_precision": "location_centroid",
                "coordinate_source": "un_locode",
                "transport_functions": "seaport,rail_terminal",
                "un_locode": "RU LED",
            },
        }

        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            normalized_path = root / "normalized.geojson"
            web_data = root / "web" / "data"
            normalized_path.write_text(json.dumps({"type": "FeatureCollection", "features": [feature]}), encoding="utf-8")
            with patch.object(prepare, "NORMALIZED_GEOJSON", normalized_path), \
                patch.object(prepare, "CHANGE_REPORT_JSON", root / "missing_change_report.json"), \
                patch.object(prepare, "WEB_DATA_DIR", web_data):
                prepare.main()
            layer_path = web_data / "transport_ports_logistics.geojson"
            manifest = json.loads((web_data / "manifest.json").read_text(encoding="utf-8"))
            layer = next(item for item in manifest["layers"] if item["id"] == "transport_ports_logistics")
            self.assertTrue(layer_path.exists())

        self.assertEqual(layer["label"], "Ports & Logistics Nodes")
        self.assertFalse(layer["default_visible"])
        self.assertEqual(manifest["countries"][0]["id"], "Russia")


def source_row(country, location, name, function, coordinates):
    return {
        "Country": country,
        "Location": location,
        "Name": name,
        "NameWoDiacritics": name,
        "Subdivision": "SPE",
        "Status": "AI",
        "Function": function,
        "Date": "2301",
        "IATA": "",
        "Coordinates": coordinates,
        "Remarks": "Test remarks",
    }


def write_source(path, rows):
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(source_row("", "", "", "", "").keys()))
        writer.writeheader()
        writer.writerows(rows)


if __name__ == "__main__":
    unittest.main()
