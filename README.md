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

The default local build skips the Geofabrik OSM road import and excludes the road
CSV from the combined build, which keeps non-road rebuilds fast. Use an explicit
road build when you need that layer:

```powershell
russianinfra-build --include-road-osm
russianinfra-build --refresh-road-osm
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

To add major road geometry from OpenStreetMap for Russia, Ukraine, and Belarus, install
`osmium-tool` and run:

```powershell
russianinfra-build --refresh-road-osm
```

This downloads the current Geofabrik PBF extracts into `data/raw/osm/geofabrik/`,
filters strategic road classes with `osmium`, and writes
`data/extracted/osm_roads/geofabrik_osm_roads.csv` for the normal pipeline. The
configured download URLs are:

- `https://download.geofabrik.de/russia-latest.osm.pbf`
- `https://download.geofabrik.de/europe/ukraine-latest.osm.pbf`
- `https://download.geofabrik.de/europe/belarus-latest.osm.pbf`

Fast local builds skip the road extractor. Full road builds preserve an existing
non-empty road CSV when the PBF files or `osmium` are unavailable. If no prior
road CSV is available, the extractor fails closed so generated web data cannot
silently drop the road layer. Use `russianinfra-extract-osm-roads --allow-empty`
only for an intentional no-road build.

The default road profile includes `motorway`, `trunk`, `primary`, and their link
classes. Use `russianinfra-extract-osm-roads --road-profile regional` only when
you have enough memory for a much larger secondary/tertiary-road dataset.

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
- `data/power_classification_report.json`
- `data/power_classification_references.csv`
- `data/build_history/latest_normalized_infrastructure.geojson`
- `data/review/review_queue.csv`
- `data/review/duplicate_candidates.csv`
- `data/review/possible_aliases.csv`
- `data/review/conflicts.csv`
- `data_package/manifest.json`

`russianinfra.generate_change_report` compares `data/normalized_infrastructure.geojson` with the previous snapshot under `data/build_history/`, annotates current objects with first/last-seen and latest-build status fields, writes `data/change_report.json`, and then updates the latest snapshot for the next build.

`russianinfra.prepare_web_data` writes browser-ready files to `web/data/`. Large layers are split into numbered parts so individual static files stay below the web data size threshold used by the app. When available, the change report is copied to `web/data/diff_report.json` for the Build comparison panel.

## Power Classification

Power stations and substations remain one canonical `power_facilities` layer with
`asset_type=power_station` or `asset_type=substation`. Generation technology is
stored separately in fields such as `generation_type`, `primary_fuel`,
`plant_role`, `is_nuclear`, `radiological_risk`, and
`classification_confidence`.

Power enrichment is offline-first. Cached source files are read from
`data/raw/power_enrichment/` under `gem/`, `iaea_pris/`, `wri/`, `osm/`, and
`official/`; normal builds do not make remote classification requests. Downloaded
CSV or JSON source files can be copied into the cache with:

```powershell
russianinfra-extract-iaea-pris --input path\to\pris.csv
russianinfra-extract-gem-power-plants --input path\to\gem.csv
russianinfra-extract-wri-power-plants --input path\to\wri.csv
russianinfra-extract-osm-power-facilities --input path\to\osm_power.json
```

Explicit remote refresh hooks are available through the same commands and
`russianinfra-build --refresh-remote`:

```powershell
# WRI has a default public CSV fallback from the official GitHub dataset repo.
russianinfra-extract-wri-power-plants --refresh

# PRIS parses the Russian Federation country reactor table into cache CSV.
russianinfra-extract-iaea-pris --refresh

# GEM downloads a supplied export URL or a URL in RUSSIANINFRA_GEM_POWER_URL.
russianinfra-extract-gem-power-plants --refresh --url "https://..."

# OSM power facilities are pulled from Geofabrik PBF and require osmium-tool.
russianinfra-extract-osm-power-facilities --refresh --extract russia
```

GEM currently uses the Global Integrated Power Tracker download flow, so the
pipeline accepts a supplied CSV/JSON/ZIP export URL instead of assuming a stable
anonymous file endpoint. WRI/GEM/PRIS downloaders also accept repeated `--input`
arguments for manually downloaded source files, and repeated `--url` arguments
for remote CSV/JSON/ZIP files. The OSM downloader writes cache-ready GeoJSON from
Geofabrik PBFs to `data/raw/power_enrichment/osm/`.

Nuclear classification precedence is IAEA PRIS, Global Energy Monitor, official
operator or government data, WRI Global Power Plant Database, OpenStreetMap,
current source metadata, then conservative name patterns. Non-nuclear generation
uses Global Energy Monitor first, followed by official data, WRI, OSM, current
source metadata, and name patterns. PRIS reactor rows are aggregated to station
level, so multiple reactor records support one canonical plant point.

`is_nuclear` is tri-state: `true`, `false`, or `unknown`. A missing PRIS match
does not prove a station is non-nuclear; unmatched or weakly supported power
stations remain `generation_type=unknown`, `primary_fuel=unknown`, and
`is_nuclear=unknown`. Confirmed hydro, thermal, solar, wind, and other
positively identified non-nuclear technologies set `is_nuclear=false`. CHP is
represented as `plant_role=combined_heat_and_power` and does not imply a fuel.

Classification confidence is `verified`, `corroborated`, `inferred`, `unknown`,
or `conflicting`. Name-pattern matches can only be `inferred`; unresolved source
disagreements are written to `data/review/power_classification_conflicts.csv`
and keep nuclear risk conservative unless an authoritative nuclear source
confirms the facility.

Generated review/report outputs include:

- `data/power_classification_report.json`
- `data/power_classification_references.csv`
- `data/review/power_station_unknown_type.csv`
- `data/review/power_nuclear_candidates.csv`
- `data/review/power_classification_conflicts.csv`
- `data/review/power_unmatched_external_records.csv`
- `data/review/power_low_confidence_matches.csv`
- `data/review/power_manual_override_issues.csv`

OpenStreetMap enrichment data, when used, is cached under
`data/raw/power_enrichment/osm/`. Review ODbL attribution and redistribution
obligations before distributing raw OSM records or derived outputs that include
OSM-supported classifications.

## Provenance and Quality

Normalization keeps source provenance as first-class data. Each normalized object has confidence fields for source reliability, coordinate precision, entity confidence, evidence freshness, cross-source support, review status, and a derived A-E confidence grade. Source references are written into `references.csv` and linked to objects through `object_references.csv`; the GeoJSON also carries a compact `references` property for the web popup and radius CSV export.

Manual corrections should be added as overlays rather than by editing generated files:

- `data/manual/object_overrides.csv` with `object_id,field,old_value,new_value,reason,reviewer,reviewed_at`
- `data/manual/source_overrides.csv` with `source_id,reliability,reason,reviewed_at`

The pipeline applies these overlays during normalization and records applied object overrides in the build report. Power-classification overrides also require `reason`, `reviewer`, and `reviewed_at`; unsupported or incomplete power override rows are written to `data/review/power_manual_override_issues.csv`. Review queues under `data/review/` identify low-confidence records, approximate or missing coordinates, duplicate candidates, possible aliases, and coordinate/category conflicts.

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

Road extractor unit checks and the expensive Geofabrik import/download path are
separate:

```powershell
npm run test:roads
npm run test:roads:import
```

`test:roads` runs only the road extractor unit tests. `test:roads:import`
explicitly runs the Geofabrik importer with `--refresh`; expect it to take much
longer and require `osmium-tool`.

## Python Commands

The pipeline modules live under `src/russianinfra/` and can be run either through console scripts after editable install or with `python -m`:

```powershell
russianinfra-extract-russia-oil-power
russianinfra-extract-osm-roads --refresh
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

<!-- Dummy change for commit generation. -->
