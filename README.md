# Russian Infrastructure Explorer

Russian Infrastructure Explorer is a local OSINT data pipeline and static web map for exploring infrastructure-related datasets across Russia and nearby countries. It combines extracted source data, normalizes records into CSV and GeoJSON, prepares browser-sized map layers, and serves an interactive Leaflet-based viewer.

The current generated web dataset contains energy, power, transport, military, military-industrial, and other infrastructure layers, with country filters, search, radius analysis, CSV export, and a scenario estimator.

## Repository Layout

```text
.
|-- pyproject.toml                          # Python package metadata and CLI entry points
|-- src/russianinfra/                       # Python data pipeline package
|   |-- build_data_pipeline.py              # Runs the local data build steps
|   |-- extract_russia_oil_power_map.py     # Fetches Russia Oil & Power map layers
|   |-- extract_osint_varta_archive.py      # Fetches archived OSINT Varta points
|   |-- extract_nightwatch_map.py           # Fetches/parses public Nightwatch map placemarks
|   |-- combine_infrastructure_sources.py   # Combines extracted CSV sources
|   |-- normalize_infrastructure_data.py    # Normalizes combined records
|   |-- enrich_translations_and_categories.py
|   |                                      # Adds offline translations/categories
|   |-- generate_change_report.py           # Compares the current build to the previous snapshot
|   |-- prepare_web_data.py                 # Splits normalized GeoJSON for the web app
|   `-- derive_countries_from_boundaries.py # Optional country derivation helper
|-- data/                                   # Raw, intermediate, and normalized data
|-- tests/                                  # Python pipeline tests
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

Install the local Python package in editable mode from the repository root:

```powershell
python -m pip install -e .
```

Run the local pipeline:

```powershell
russianinfra-build
```

You can also run it without the console script after installation:

```powershell
python -m russianinfra.build_data_pipeline
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

By default, `russianinfra-build` rebuilds from the local/cached source files already present under `data/`.

To re-fetch remote and archived sources before rebuilding:

```powershell
russianinfra-build --refresh-remote
```

Remote refresh currently fetches from:

- `russiaoilpowermap.com`
- Internet Archive captures for OSINT Varta map data
- Public server-rendered map data from `nightwatch.services/map`

Nightwatch map data is cached in `data/raw/nightwatch_map_placemarks.json` so local rebuilds do not require a network request.

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

`russianinfra.generate_change_report` compares `data/normalized_infrastructure.geojson` with the previous snapshot under `data/build_history/`, annotates current objects with first/last-seen and latest-build status fields, writes `data/change_report.json`, and then updates the latest snapshot for the next build.

`russianinfra.prepare_web_data` writes browser-ready files to `web/data/`. Large layers are split into numbered parts so individual static files stay below the web data size threshold used by the app. When available, the change report is copied to `web/data/diff_report.json` for the Build comparison panel.

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

The test wrapper sets `PYTHONPATH=src` for local test discovery, so tests work even before an editable install. For normal pipeline use, prefer `python -m pip install -e .` and the `russianinfra-*` console scripts declared in `pyproject.toml`.

## Python Commands

The pipeline modules live under `src/russianinfra/` and can be run either through console scripts after editable install or with `python -m`:

```powershell
russianinfra-extract-russia-oil-power
russianinfra-extract-osint-varta
russianinfra-extract-nightwatch --refresh
russianinfra-combine-sources
russianinfra-normalize
russianinfra-enrich
russianinfra-derive-countries --input data/normalized_infrastructure.geojson --write
russianinfra-change-report
russianinfra-prepare-web-data
```

Equivalent module invocation:

```powershell
python -m russianinfra.prepare_web_data
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
