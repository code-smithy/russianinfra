# Russian Infrastructure Explorer

Russian Infrastructure Explorer is a local OSINT data pipeline and static web map for exploring infrastructure-related datasets across Russia and nearby countries. It combines extracted source data, normalizes records into CSV and GeoJSON, prepares browser-sized map layers, and serves an interactive Leaflet-based viewer.

The current generated web dataset contains energy, power, transport, military, military-industrial, and other infrastructure layers, with country filters, search, radius analysis, CSV export, and a scenario estimator.

## Repository Layout

```text
.
|-- build_data_pipeline.py                  # Runs the local data build steps
|-- extract_russia_oil_power_map.py         # Fetches Russia Oil & Power map layers
|-- extract_osint_varta_archive.py          # Fetches archived OSINT Varta points
|-- extract_military_kml_text.py            # Parses the local KML text archive export
|-- combine_infrastructure_sources.py       # Combines extracted CSV sources
|-- normalize_infrastructure_data.py        # Normalizes combined records
|-- enrich_translations_and_categories.py   # Adds offline translations/categories
|-- generate_change_report.py               # Compares the current build to the previous snapshot
|-- prepare_web_data.py                     # Splits normalized GeoJSON for the web app
|-- derive_countries_from_boundaries.py     # Optional country derivation helper
|-- data/                                   # Raw, intermediate, and normalized data
|-- scripts/test.ps1                        # Node test runner wrapper
`-- web/
    |-- index.html
    |-- app.js
    |-- styles.css
    |-- server.mjs
    |-- data/                               # Generated static GeoJSON layers
    `-- test/
```

## Requirements

- Python 3.10 or newer.
- Node.js 20 or newer for the local static server and tests.
- A modern browser.
- Network access only when refreshing remote sources or loading browser CDN assets/live overlays.

The Python pipeline currently uses the standard library only. The checked-in `package.json` has no npm dependencies; the browser app loads Leaflet, Leaflet.markercluster, and milsymbol from CDN script tags.

## Quick Start

Run the local pipeline from the repository root:

```powershell
python build_data_pipeline.py
```

Start the static web server:

```powershell
node web/server.mjs
```

Open the app at:

```text
http://127.0.0.1:8000/
```

Use `PORT` or `HOST` to override the default server binding:

```powershell
$env:PORT = "8080"
node web/server.mjs
```

## Refreshing Source Data

By default, `build_data_pipeline.py` rebuilds from the local/cached source files already present under `data/`.

To re-fetch remote and archived sources before rebuilding:

```powershell
python build_data_pipeline.py --refresh-remote
```

Remote refresh currently fetches from:

- `russiaoilpowermap.com`
- Internet Archive captures for OSINT Varta map data

The military KML text archive is read from `data/raw/20260618052118-00000-data.txt`.

## Generated Data

The pipeline produces normalized outputs under `data/`, including:

- `data/combined_infrastructure_sources.csv`
- `data/normalized_infrastructure.csv`
- `data/normalized_infrastructure.geojson`
- `data/normalization_report.json`
- `data/source_catalog.csv`
- `data/references.csv`
- `data/object_references.csv`
- `data/quality_report.json`
- `data/change_report.json`
- `data/build_history/latest_normalized_infrastructure.geojson`
- `data/review/review_queue.csv`
- `data/review/duplicate_candidates.csv`
- `data/review/possible_aliases.csv`
- `data/review/conflicts.csv`
- `data_package/manifest.json`

`generate_change_report.py` compares `data/normalized_infrastructure.geojson` with the previous snapshot under `data/build_history/`, annotates current objects with first/last-seen and latest-build status fields, writes `data/change_report.json`, and then updates the latest snapshot for the next build.

`prepare_web_data.py` writes browser-ready files to `web/data/`. Large layers are split into numbered parts so individual static files stay below the web data size threshold used by the app. When available, the change report is copied to `web/data/diff_report.json` for the Build comparison panel.

## Provenance and Quality

Normalization keeps source provenance as first-class data. Each normalized object has confidence fields for source reliability, coordinate precision, entity confidence, evidence freshness, cross-source support, review status, and a derived A-E confidence grade. Source references are written into `references.csv` and linked to objects through `object_references.csv`; the GeoJSON also carries a compact `references` property for the web popup and radius CSV export.

Manual corrections should be added as overlays rather than by editing generated files:

- `data/manual/object_overrides.csv` with `object_id,field,old_value,new_value,reason,reviewer,reviewed_at`
- `data/manual/source_overrides.csv` with `source_id,reliability,reason,reviewed_at`

The pipeline applies these overlays during normalization and records applied object overrides in the build report. Review queues under `data/review/` identify low-confidence records, approximate or missing coordinates, duplicate candidates, possible aliases, and coordinate/category conflicts.

## Tests

Run the test suite with:

```powershell
npm test
```

This runs `scripts/test.ps1`, which looks for local Node.js and Python installs, falling back to the Codex bundled runtimes when available. It executes:

```powershell
node --test "web/test/*.test.mjs"
python -m unittest discover -s tests -p "test_*.py"
```

## Web App Notes

The viewer includes:

- Layer and subcategory selection.
- Country filtering.
- Search across loaded records.
- Timeline filters for source/archive date, first seen, last seen, new objects, and changed objects.
- Build comparison summaries from `web/data/diff_report.json`.
- Radius drawing and CSV export.
- Scenario estimator profiles and assumptions.
- A beta live DeepState overlay configured by `web/deepstate-layer-config.json`.

The static server in `web/server.mjs` is intended for local development and review. It serves files from the `web/` directory, applies no-store cache headers, and does not implement authentication, TLS, or production hardening.

## Data Handling

This project works with infrastructure, military, company, and geospatial records. Treat generated data and exports as sensitive analytical material even when the upstream sources are public or archived.

Do not commit secrets, private credentials, classified material, non-public personal data, or unverified operational observations. See `SECURITY.md` for vulnerability reporting and data safety guidance.
