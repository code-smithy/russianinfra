import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const STORAGE_KEY = "infrastructureExplorer.preferences.v1";

const appSource = fs.readFileSync("web/app.js", "utf8").replace(
  /init\(\)\.catch\(\(error\) => \{[\s\S]*?\n\}\);\s*$/,
  `globalThis.__initPromise = init().catch((error) => {
  console.error(error);
  els.datasetSummary.textContent = "Failed to load app data.";
  alert(error.message);
  throw error;
});
globalThis.__api = {
  colorForLayer,
  state,
  els,
  clearAllCountries,
  buildEstimatorCsv,
  buildEstimatorAggregates,
  currentPreferences,
  estimatorDetailRows,
  estimatorExportRows,
  estimateUnits,
  featureDistanceToPointKm,
  featurePassesActiveFilters,
  groupedLayerInfos,
  handleSubcategoryChange,
  importEstimatorAssumptionsFromText,
  markerIcon,
  metersKm,
  map,
  onRadiusMouseDown,
  renderEstimatorResults,
  renderRadiusResults,
  resetRadius,
  resetEstimatorAssumptions,
  savePreferencesNow,
  setCountriesPanelCollapsed,
  setEstimatorBlockCollapsed,
  setLayersPanelCollapsed,
  setMenuWidth,
  summarizeEstimatorResults,
  validateEstimatorAggregates,
};`
);

const manifest = {
  total_features: 3,
  countries: [
    { id: "Russia", label: "Russia", count: 2, point_count: 2 },
    { id: "Ukraine", label: "Ukraine", count: 1, point_count: 1 },
  ],
  layers: [
    {
      id: "energy_facilities",
      label: "Oil/Gas Facilities",
      file: "energy_facilities.geojson",
      files: ["energy_facilities.geojson"],
      count: 2,
      subcategories: [
        { id: "energy_oil_facility", label: "Oil facility", count: 2 },
        { id: "energy_gas_facility", label: "Gas facility", count: 0 },
      ],
      default_visible: true,
    },
    {
      id: "military_sites",
      label: "Military Sites",
      file: "military_sites.geojson",
      files: ["military_sites.geojson"],
      count: 1,
      subcategories: [{ id: "military_other", label: "Military other", count: 1 }],
      default_visible: false,
    },
  ],
};

const fixtures = {
  "data/manifest.json": manifest,
  "deepstate-layer-config.json": {
    enabled: true,
    type: "geojson",
    url: "https://example.test/deepstate.json",
    refreshMinutes: 15,
    sourceLabel: "DeepStateMap.Live",
    defaultCountry: "Ukraine",
    defaultSubcategory: "deepstate",
    defaultSubcategoryLabel: "DeepState",
  },
  "https://example.test/deepstate.json": {
    id: 123,
    map: {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: {
            type: "Polygon",
            coordinates: [[
              [37.75, 48.48, 0],
              [37.9, 48.48, 0],
              [37.9, 48.62, 0],
              [37.75, 48.62, 0],
              [37.75, 48.48, 0],
            ]],
          },
          properties: {
            name: "Occupied area",
            stroke: "#d83a34",
            fill: "#d83a34",
            "fill-opacity": 0.3,
          },
        },
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: [37.82, 48.52, 0] },
          properties: {
            name: "Enemy unit /// geoJSON.units.brigade.test",
            icon: "enemy",
          },
        },
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: [37.83, 48.53, 0] },
          properties: {
            name: "Airport /// geoJSON.airfield.test",
            icon: "images/icon-6.png",
          },
        },
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: [37.835, 48.535, 0] },
          properties: {
            name: "Army HQ /// geoJSON.units.army.test",
            icon: "images/icon-4.png",
          },
        },
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: [37.84, 48.54, 0] },
          properties: {
            name: "Direction of attack /// geoJSON.status.attack_direction",
            icon: "images/icon-2.png",
          },
        },
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: [37.85, 48.55, 0] },
          properties: {
            name: "Another direction /// geoJSON.status.attack_direction",
            icon: "images/icon-2.png",
          },
        },
      ],
    },
  },
  "data/energy_facilities.geojson": {
    type: "FeatureCollection",
    features: [
      feature(
        "fixture_energy_1",
        "Alpha Refinery",
        "energy_facilities",
        "energy_oil_facility",
        55.2,
        59.1,
        "Russia"
      ),
      feature(
        "fixture_energy_2",
        "Charlie Terminal",
        "energy_facilities",
        "energy_oil_facility",
        65.2,
        80.1,
        "Russia"
      ),
    ],
  },
  "data/military_sites.geojson": {
    type: "FeatureCollection",
    features: [
      feature("fixture_military_1", "Bravo Site", "military_sites", "military_other", 56.2, 60.1, "Ukraine"),
    ],
  },
};

test("persists UI choices without removed measurement state and restores them on the next app load", async () => {
  const first = createAppContext();
  await first.__initPromise;

  const api = first.__api;
  api.state.layerControls.get("military_sites").checked = true;
  api.els.searchInput.value = "Alpha";
  api.savePreferencesNow();

  const savedRaw = first.localStorage.getItem(STORAGE_KEY);
  const saved = JSON.parse(savedRaw);

  assert.equal(saved.layers.military_sites, true);
  assert.equal(saved.search, "Alpha");
  assert.equal(Object.hasOwn(saved, "activeSlot"), false);
  assert.equal(Object.hasOwn(saved, "manualPanelOpen"), false);
  assert.equal(Object.hasOwn(saved, "manualInputs"), false);
  assert.equal(Object.hasOwn(saved, "selections"), false);

  const second = createAppContext({ [STORAGE_KEY]: savedRaw });
  await second.__initPromise;

  const restored = second.__api;
  assert.equal(restored.els.searchInput.value, "Alpha");
  assert.equal(restored.state.layerControls.get("military_sites").checked, true);
});

test("syncs category checkboxes with subcategories and saves collapsed state", async () => {
  const app = createAppContext();
  await app.__initPromise;

  const api = app.__api;
  const parent = api.state.layerControls.get("energy_facilities");
  const subcategories = api.state.layerSubcategoryControls.get("energy_facilities");
  const collapseButton = api.state.layerCollapseControls.get("energy_facilities");
  assert.equal(collapseButton.innerHTML, `<span aria-hidden="true"></span>`);
  assert.equal(api.els.layersCount.textContent, "1 of 3 selected");

  subcategories[1].checked = false;
  await api.handleSubcategoryChange(manifest.layers[0], new FakeElement("row"));

  assert.equal(parent.checked, false);
  assert.equal(parent.indeterminate, true);
  assert.equal(api.els.layersCount.textContent, "1 of 3 selected");
  assert.deepEqual([...api.state.subcategoryFilters.get("energy_facilities")], ["energy_oil_facility"]);
  assert.equal(api.currentPreferences().layers.energy_facilities, true);

  parent.checked = true;
  parent.listeners.change[0]();

  assert.equal(parent.checked, true);
  assert.equal(parent.indeterminate, false);
  assert.equal(api.els.layersCount.textContent, "1 of 3 selected");
  assert.equal(subcategories[0].checked, true);
  assert.equal(subcategories[1].checked, true);

  collapseButton.listeners.click[0]();

  assert.equal(api.currentPreferences().collapsedLayers.length, 1);
  assert.equal(api.currentPreferences().collapsedLayers[0], "energy_facilities");
});

test("saves and restores the collapsed Layers panel", async () => {
  const first = createAppContext();
  await first.__initPromise;

  first.__api.setLayersPanelCollapsed(true);
  first.__api.savePreferencesNow();

  const savedRaw = first.localStorage.getItem(STORAGE_KEY);
  const saved = JSON.parse(savedRaw);
  assert.equal(saved.layersPanelCollapsed, true);

  const second = createAppContext({ [STORAGE_KEY]: savedRaw });
  await second.__initPromise;

  assert.equal(second.__api.els.layersPanelBody.hidden, true);
  assert.equal(second.__api.els.layersPanel.classList.contains("collapsed"), true);
  assert.equal(second.__api.els.layersPanelToggle.getAttribute("aria-expanded"), "false");
});

test("saves and restores the collapsed Countries panel", async () => {
  const first = createAppContext();
  await first.__initPromise;

  first.__api.setCountriesPanelCollapsed(true);
  first.__api.savePreferencesNow();

  const savedRaw = first.localStorage.getItem(STORAGE_KEY);
  const saved = JSON.parse(savedRaw);
  assert.equal(saved.countriesPanelCollapsed, true);

  const second = createAppContext({ [STORAGE_KEY]: savedRaw });
  await second.__initPromise;

  assert.equal(second.__api.els.countriesPanelBody.hidden, true);
  assert.equal(second.__api.els.countriesPanel.classList.contains("collapsed"), true);
  assert.equal(second.__api.els.countriesPanelToggle.getAttribute("aria-expanded"), "false");
});

test("saves and restores resized menu widths", async () => {
  const first = createAppContext();
  await first.__initPromise;

  first.__api.setMenuWidth("left", 410);
  first.__api.setMenuWidth("right", 430);
  first.__api.savePreferencesNow();

  const savedRaw = first.localStorage.getItem(STORAGE_KEY);
  const saved = JSON.parse(savedRaw);
  assert.deepEqual(saved.menuWidths, { left: 410, right: 430 });

  const second = createAppContext({ [STORAGE_KEY]: savedRaw });
  await second.__initPromise;

  assert.deepEqual(JSON.parse(JSON.stringify(second.__api.state.menuWidths)), { left: 410, right: 430 });
  assert.equal(second.__api.els.leftResizeHandle.getAttribute("aria-valuenow"), "410");
  assert.equal(second.__api.els.rightResizeHandle.getAttribute("aria-valuenow"), "430");
});

test("saves and restores collapsed estimator assumption sections", async () => {
  const first = createAppContext();
  await first.__initPromise;

  first.__api.setEstimatorBlockCollapsed("rangeBands", true);
  first.__api.setEstimatorBlockCollapsed("categoryAssumptions", true);
  first.__api.savePreferencesNow();

  const savedRaw = first.localStorage.getItem(STORAGE_KEY);
  const saved = JSON.parse(savedRaw);
  assert.deepEqual(saved.collapsedEstimatorBlocks, ["rangeBands", "categoryAssumptions"]);

  const second = createAppContext({ [STORAGE_KEY]: savedRaw });
  await second.__initPromise;

  assert.equal(second.__api.els.rangeBandsBody.hidden, true);
  assert.equal(second.__api.els.rangeBandsBlock.classList.contains("collapsed"), true);
  assert.equal(second.__api.els.rangeBandsToggle.getAttribute("aria-expanded"), "false");
  assert.equal(second.__api.els.resourceTypesBody.hidden, false);
  assert.equal(second.__api.els.categoryAssumptionsBody.hidden, true);
});

test("saves country selections and applies them to active filters", async () => {
  const first = createAppContext();
  await first.__initPromise;

  const api = first.__api;
  const russiaControl = api.state.countryControls.get("Russia");
  russiaControl.checked = false;
  russiaControl.listeners.change[0]();

  const saved = api.currentPreferences();
  assert.equal(saved.countries.length, 1);
  assert.equal(saved.countries[0], "Ukraine");
  assert.equal(api.featurePassesActiveFilters(fixtures["data/energy_facilities.geojson"].features[0]), false);
  assert.equal(api.featurePassesActiveFilters(fixtures["data/military_sites.geojson"].features[0]), true);

  const second = createAppContext({ [STORAGE_KEY]: JSON.stringify(saved) });
  await second.__initPromise;

  assert.equal(second.__api.state.countryControls.get("Russia").checked, false);
  assert.equal(second.__api.state.countryControls.get("Ukraine").checked, true);
});

test("clears all country filters from the Countries panel button", async () => {
  const app = createAppContext();
  await app.__initPromise;

  assert.equal(app.__api.els.countriesCount.textContent, "2 of 2 selected");
  app.__api.els.clearCountriesBtn.listeners.click[0]();

  assert.equal(app.__api.currentPreferences().countries.length, 0);
  assert.equal(app.__api.els.countriesCount.textContent, "0 of 2 selected");
  assert.equal(app.__api.state.countryControls.get("Russia").checked, false);
  assert.equal(app.__api.state.countryControls.get("Ukraine").checked, false);
  assert.equal(app.__api.featurePassesActiveFilters(fixtures["data/energy_facilities.geojson"].features[0]), false);
  assert.equal(app.__api.featurePassesActiveFilters(fixtures["data/military_sites.geojson"].features[0]), false);
});

test("groups layers by domain and puts line layers last inside each group", async () => {
  const app = createAppContext();
  await app.__initPromise;

  app.__api.state.manifest.layers = [
    layerInfo("transport_rail", "Railway Lines", 0, 10),
    layerInfo("energy_gas", "Gas Pipelines", 0, 10),
    layerInfo("power_facilities", "Power Plants & Substations", 10, 0),
    layerInfo("military_boundaries", "Military Boundaries & Paths", 0, 10),
    layerInfo("other_infrastructure", "Other Infrastructure", 1, 0),
    layerInfo("transport_other", "Transport Structures", 10, 0),
    layerInfo("energy_facilities", "Oil/Gas Facilities", 10, 0),
    layerInfo("power_lines", "HV Transmission Lines", 0, 10),
    layerInfo("military_sites", "Military Sites", 10, 0),
  ];

  const grouped = JSON.parse(JSON.stringify(app.__api.groupedLayerInfos().map((group) => ({
    id: group.id,
    layers: group.layers.map((layer) => layer.id),
  }))));

  assert.deepEqual(grouped.map((group) => group.id), ["military", "oil_gas", "transport", "power", "other"]);
  assert.deepEqual(grouped[0].layers, ["military_sites", "military_boundaries"]);
  assert.deepEqual(grouped[1].layers, ["energy_facilities", "energy_gas"]);
  assert.deepEqual(grouped[2].layers, ["transport_other", "transport_rail"]);
  assert.deepEqual(grouped[3].layers, ["power_facilities", "power_lines"]);
});

test("puts beta live overlays first and discovers DeepState icon subcategories", async () => {
  const app = createAppContext();
  await app.__initPromise;

  const api = app.__api;
  const groups = api.groupedLayerInfos();
  const deepstate = api.state.manifest.layers.find((layer) => layer.id === "deepstate_live");

  assert.equal(groups[0].id, "live");
  assert.equal(groups[0].label, "Live Overlays (Beta)");
  assert.deepEqual(
    JSON.parse(JSON.stringify(deepstate.subcategories.map((subcategory) => [subcategory.id, subcategory.count]))),
    [
      ["attack_arrows", 2],
      ["headquarters", 1],
      ["enemy_units", 1],
      ["airports_airfields", 1],
      ["areas", 1],
    ]
  );
  assert.equal(api.state.layerControls.get("deepstate_live").checked, false);
  assert.equal(api.state.layerSubcategoryControls.get("deepstate_live").every((control) => !control.checked), true);
});

test("harmonizes layer colors by category family", async () => {
  const app = createAppContext();
  await app.__initPromise;

  assert.equal(app.__api.colorForLayer("military_sites"), "#2f78ff");
  assert.equal(app.__api.colorForLayer("military_boundaries"), "#9ac4ff");
  assert.equal(app.__api.colorForLayer("power_facilities"), "#ffd34d");
  assert.equal(app.__api.colorForLayer("power_lines"), "#ffac12");
});

test("loads DeepState-style live GeoJSON and applies country filters from feature coordinates", async () => {
  const app = createAppContext();
  await app.__initPromise;

  const api = app.__api;
  const control = api.state.layerControls.get("deepstate_live");
  control.checked = true;
  await control.listeners.change[0]();

  const stored = api.state.features.get("deepstate_live_0");
  const enemy = api.state.features.get("deepstate_live_1");
  const airport = api.state.features.get("deepstate_live_2");
  assert.ok(stored);
  assert.ok(enemy);
  assert.ok(airport);
  assert.deepEqual(JSON.parse(JSON.stringify(stored.feature.properties.countries)), ["Ukraine"]);
  assert.equal(api.featurePassesActiveFilters(stored.feature), true);
  assert.equal(enemy.feature.properties.icon_key, "enemy");
  assert.match(enemy.layer.options.icon.html, /tactical-hostile/);
  assert.match(airport.layer.options.icon.html, /tactical-airport-hostile/);

  api.state.countryControls.get("Ukraine").checked = false;
  api.state.countryControls.get("Ukraine").listeners.change[0]();

  assert.equal(api.state.layers.get("deepstate_live").features.length, 6);
  assert.equal(api.featurePassesActiveFilters(stored.feature), false);
});

test("distance helpers handle points and geometry vertices", async () => {
  const app = createAppContext();
  await app.__initPromise;

  const api = app.__api;
  const oneDegreeAtEquator = api.metersKm({ lat: 0, lng: 0 }, { lat: 0, lng: 1 });
  const lineFeature = {
    type: "Feature",
    geometry: {
      type: "LineString",
      coordinates: [
        [30, 50],
        [31, 51],
      ],
    },
    properties: {},
  };

  assert.ok(oneDegreeAtEquator > 111 && oneDegreeAtEquator < 112);
  assert.equal(api.featureDistanceToPointKm(lineFeature, { lat: 50, lng: 30 }), 0);
});

test("dims visible datapoints outside the drawn radius and restores them on reset", async () => {
  const app = createAppContext();
  await app.__initPromise;

  const api = app.__api;
  api.renderRadiusResults({ lat: 55.2, lng: 59.1 }, 20);

  const inside = api.state.features.get("fixture_energy_1");
  const outside = api.state.features.get("fixture_energy_2");
  assert.equal(inside.layer.opacity, 1);
  assert.equal(outside.layer.opacity, 0.5);
  assert.equal(outside.radiusDimmed, true);

  api.resetRadius();

  assert.equal(outside.layer.opacity, 1);
  assert.equal(outside.radiusDimmed, false);
});

test("radius panel shows center and applies manual radius edits", async () => {
  const app = createAppContext();
  await app.__initPromise;

  const api = app.__api;
  api.renderRadiusResults({ lat: 55.2, lng: 59.1 }, 746.3);

  assert.equal(api.els.radiusCenterLabel.textContent, "55.20000, 59.10000");
  assert.equal(api.els.radiusKmInput.value, "746.3");
  assert.ok(api.state.radiusLine);
  assert.ok(api.state.radiusLabel);
  assert.ok(api.metersKm(api.state.radiusOrigin, api.state.radiusEdge) > 746);
  assert.ok(api.metersKm(api.state.radiusOrigin, api.state.radiusEdge) < 747);

  api.els.radiusKmInput.value = "750";
  api.els.radiusKmInput.listeners.change[0]();

  assert.equal(api.state.radiusKm, 750);
  assert.equal(api.els.radiusKmInput.value, "750");
  assert.equal(api.currentPreferences().radius.radiusKm, 750);
  assert.ok(api.currentPreferences().radius.edge);
  assert.ok(api.metersKm(api.state.radiusOrigin, api.state.radiusEdge) > 749.9);
  assert.ok(api.metersKm(api.state.radiusOrigin, api.state.radiusEdge) < 750.1);
  assert.deepEqual(JSON.parse(JSON.stringify(api.state.radiusLine.latlngs[1])), JSON.parse(JSON.stringify(api.state.radiusEdge)));
  assert.deepEqual(JSON.parse(JSON.stringify(api.state.radiusLabel.latlng)), JSON.parse(JSON.stringify(api.state.radiusEdge)));
  assert.match(api.els.radiusSummary.textContent, /750 km/);
});

test("restores radius measurement line and distance tag away from the center", async () => {
  const first = createAppContext();
  await first.__initPromise;

  const api = first.__api;
  api.renderRadiusResults({ lat: 55.2, lng: 59.1 }, 300);
  api.savePreferencesNow();

  const savedRaw = first.localStorage.getItem(STORAGE_KEY);
  const second = createAppContext({ [STORAGE_KEY]: savedRaw });
  await second.__initPromise;

  const restored = second.__api;
  assert.ok(restored.state.radiusLine);
  assert.ok(restored.state.radiusLabel);
  assert.ok(restored.state.radiusEdge);
  assert.ok(restored.metersKm(restored.state.radiusOrigin, restored.state.radiusEdge) > 299.9);
  assert.ok(restored.metersKm(restored.state.radiusOrigin, restored.state.radiusEdge) < 300.1);
  assert.notDeepEqual(JSON.parse(JSON.stringify(restored.state.radiusLabel.latlng)), JSON.parse(JSON.stringify(restored.state.radiusOrigin)));
  assert.deepEqual(JSON.parse(JSON.stringify(restored.state.radiusLine.latlngs)), [
    JSON.parse(JSON.stringify(restored.state.radiusOrigin)),
    JSON.parse(JSON.stringify(restored.state.radiusEdge)),
  ]);
});

test("starting a radius draw does not leave orphan measurement labels after reset", async () => {
  const app = createAppContext();
  await app.__initPromise;

  const api = app.__api;
  const before = api.map.layerCount();
  api.state.radiusMode = true;
  api.onRadiusMouseDown({
    latlng: { lat: 55.2, lng: 59.1 },
    originalEvent: { preventDefault() {} },
  });

  assert.equal(api.map.layerCount(), before + 4);
  api.resetRadius();
  assert.equal(api.map.layerCount(), before);
});

test("radius overlay draws colored range-band circles", async () => {
  const app = createAppContext();
  await app.__initPromise;

  const api = app.__api;
  api.state.estimator.rangeBands = [
    { id: "near", maxKm: 100 },
    { id: "mid", maxKm: 200 },
    { id: "band_open", maxKm: null },
  ];

  api.renderRadiusResults({ lat: 55.2, lng: 59.1 }, 250);

  assert.equal(api.state.radiusBandCircles.length, 3);
  assert.deepEqual(JSON.parse(JSON.stringify(api.state.radiusBandCircles.map((circle) => circle.rangeBandSegment.upperKm))), [100, 200, 250]);

  api.els.radiusKmInput.value = "150";
  api.els.radiusKmInput.listeners.change[0]();

  assert.equal(api.state.radiusBandCircles.length, 2);
  assert.deepEqual(JSON.parse(JSON.stringify(api.state.radiusBandCircles.map((circle) => circle.rangeBandSegment.upperKm))), [100, 150]);
});

test("scenario estimator groups active radius results and calculates resource totals", async () => {
  const app = createAppContext();
  await app.__initPromise;

  const api = app.__api;
  api.state.estimator.categoryRequirements.energy_facilities = 2;
  api.state.estimator.resources[0].completionRate = 50;
  api.renderRadiusResults({ lat: 55.2, lng: 59.1 }, 20);

  const groups = api.summarizeEstimatorResults();
  assert.equal(groups.length, 1);
  assert.equal(groups[0].layerId, "energy_facilities");
  assert.equal(groups[0].count, 1);
  assert.equal(groups[0].subcategories.get("energy_oil_facility"), 1);
  assert.equal(api.estimateUnits(1, 2, 50), 4);

  const rows = api.estimatorExportRows();
  assert.equal(rows[0].row_type, "detail");
  assert.equal(rows[0].layer_id, "energy_facilities");
  assert.equal(rows[0].resource_label, "Resource A");
  assert.equal(rows[0].estimated_units, 4);
  assert.ok(rows.some((row) => row.row_type === "resource_total"));
  assert.ok(rows.some((row) => row.row_type === "grand_total"));
  assert.match(api.buildEstimatorCsv().split("\r\n")[0], /^row_type,layer_id/);
  assert.match(api.buildEstimatorCsv(), /energy_facilities/);
});

test("scenario estimator builds range-band resource totals from detail rows", async () => {
  const app = createAppContext();
  await app.__initPromise;

  const api = app.__api;
  api.state.estimator.rangeBands = [
    { id: "near", maxKm: 20 },
    { id: "mid", maxKm: 150 },
    { id: "band_open", maxKm: null },
  ];
  api.state.estimator.categoryRequirements.energy_facilities = 2;
  api.state.estimator.categoryRequirements.military_sites = 1;
  api.state.estimator.resources[0].completionRate = 50;
  api.state.estimator.resources[1].completionRate = 100;
  api.state.estimator.resources[2].completionRate = 100;

  const militaryControl = api.state.layerControls.get("military_sites");
  militaryControl.checked = true;
  await militaryControl.listeners.change[0]();
  api.renderRadiusResults({ lat: 55.2, lng: 59.1 }, 2500);

  const detailRows = api.estimatorDetailRows();
  const aggregate = api.buildEstimatorAggregates(detailRows);
  assert.equal(api.validateEstimatorAggregates(detailRows, aggregate), true);
  assert.equal(detailRows.length, 9);
  assert.equal(aggregate.totalByResource.get("resource_a"), 10);
  assert.equal(aggregate.totalByResource.get("resource_b"), 5);
  assert.equal(aggregate.totalByResource.get("resource_c"), 5);
  assert.equal(aggregate.grandTotal, 20);
  assert.equal(aggregate.rangeBands.has("Over 150 km"), true);

  const rows = api.estimatorExportRows();
  assert.equal(rows.filter((row) => row.row_type === "range_band_total").length, 9);
  assert.equal(rows.filter((row) => row.row_type === "resource_total").length, 3);
  assert.equal(rows.at(-1).row_type, "grand_total");
  assert.equal(rows.at(-1).estimated_units, 20);
});

test("scenario estimator aggregate totals handle zero completion rates", async () => {
  const app = createAppContext();
  await app.__initPromise;

  const api = app.__api;
  api.state.estimator.resources[0].completionRate = 0;
  api.renderRadiusResults({ lat: 55.2, lng: 59.1 }, 20);

  const detailRows = api.estimatorDetailRows();
  const aggregate = api.buildEstimatorAggregates(detailRows);
  assert.equal(api.validateEstimatorAggregates(detailRows, aggregate), true);
  assert.equal(aggregate.totalByResource.get("resource_a"), Infinity);
  assert.equal(aggregate.grandTotal, Infinity);
});

test("scenario estimator totals respect active layer filters", async () => {
  const app = createAppContext();
  await app.__initPromise;

  const api = app.__api;
  api.renderRadiusResults({ lat: 55.2, lng: 59.1 }, 2500);
  assert.ok(api.estimatorDetailRows().some((row) => row.layer_id === "energy_facilities"));

  const energyControl = api.state.layerControls.get("energy_facilities");
  energyControl.checked = false;
  await energyControl.listeners.change[0]();

  assert.equal(api.state.radiusResults.length, 0);
  assert.equal(api.estimatorDetailRows().length, 0);
  assert.match(api.els.estimatorResults.innerHTML, /No active-layer items/);
});

test("scenario estimator keeps range matrix visible when detailed breakdown is enabled", async () => {
  const app = createAppContext();
  await app.__initPromise;

  const api = app.__api;
  const militaryControl = api.state.layerControls.get("military_sites");
  militaryControl.checked = true;
  await militaryControl.listeners.change[0]();
  api.renderRadiusResults({ lat: 55.2, lng: 59.1 }, 2500);

  api.state.estimator.summaryDisplay.compactTotals = false;
  api.state.estimator.summaryDisplay.rangeBandMatrix = true;
  api.state.estimator.summaryDisplay.detailedBreakdown = false;
  api.renderEstimatorResults();
  assert.equal(api.els.estimatorSummaryResults.children[0].className, "estimate-matrix-wrap");
  assert.equal(api.els.estimatorResults.hidden, true);

  api.els.estimatorResults.scrollTop = 500;
  api.state.estimator.summaryDisplay.detailedBreakdown = true;
  api.renderEstimatorResults();

  assert.equal(api.els.estimatorSummaryResults.children[0].className, "estimate-matrix-wrap");
  assert.ok(api.els.estimatorResults.children.some((child) => child.className === "estimate-card"));
  assert.equal(api.els.estimatorSummaryResults.hidden, false);
  assert.equal(api.els.estimatorResults.hidden, false);
  assert.equal(api.els.estimatorResults.scrollTop, 0);
});

test("scenario estimator persists summary display preferences", async () => {
  const first = createAppContext();
  await first.__initPromise;

  first.__api.state.estimator.summaryDisplay.compactTotals = false;
  first.__api.state.estimator.summaryDisplay.rangeBandMatrix = true;
  first.__api.state.estimator.summaryDisplay.detailedBreakdown = false;
  first.__api.savePreferencesNow();

  const savedRaw = first.localStorage.getItem(STORAGE_KEY);
  const saved = JSON.parse(savedRaw);
  assert.deepEqual(saved.estimator.summaryDisplay, {
    compactTotals: false,
    rangeBandMatrix: true,
    detailedBreakdown: false,
  });

  const second = createAppContext({ [STORAGE_KEY]: savedRaw });
  await second.__initPromise;

  assert.equal(second.__api.state.estimator.summaryDisplay.compactTotals, false);
  assert.equal(second.__api.state.estimator.summaryDisplay.rangeBandMatrix, true);
  assert.equal(second.__api.state.estimator.summaryDisplay.detailedBreakdown, false);
});

test("scenario estimator normalizes legacy summary preferences to one summary view", async () => {
  const app = createAppContext({
    [STORAGE_KEY]: JSON.stringify({
      estimator: {
        summaryDisplay: {
          compactTotals: true,
          rangeBandMatrix: true,
          detailedBreakdown: true,
        },
      },
    }),
  });
  await app.__initPromise;

  assert.equal(app.__api.state.estimator.summaryDisplay.compactTotals, false);
  assert.equal(app.__api.state.estimator.summaryDisplay.rangeBandMatrix, true);
  assert.equal(app.__api.state.estimator.summaryDisplay.detailedBreakdown, true);
});

test("scenario estimator imports and persists editable assumptions", async () => {
  const app = createAppContext();
  await app.__initPromise;

  const api = app.__api;
  api.importEstimatorAssumptionsFromText(JSON.stringify({
    estimator: {
      rangeBands: [
        { id: "short", maxKm: 100 },
        { id: "medium", maxKm: 900 },
      ],
      resources: [
        { id: "resource_a", label: "Planning Resource", completionRate: 75 },
      ],
      categoryRequirements: {
        energy_facilities: 3,
      },
    },
  }));

  const saved = api.currentPreferences().estimator;
  assert.deepEqual(JSON.parse(JSON.stringify(saved.rangeBands.map((band) => band.maxKm))), [100, 900, null]);
  assert.equal(saved.resources[0].label, "Planning Resource");
  assert.equal(saved.resources[0].completionRate, 75);
  assert.equal(saved.categoryRequirements.energy_facilities, 3);
});

test("scenario estimator clear all restores default assumptions", async () => {
  const app = createAppContext();
  await app.__initPromise;

  const api = app.__api;
  api.state.estimator.rangeBands = [{ id: "custom", maxKm: 100 }, { id: "band_open", maxKm: null }];
  api.state.estimator.resources[0].label = "Changed";
  api.state.estimator.resources[0].completionRate = 10;
  api.state.estimator.categoryRequirements.energy_facilities = 9;

  api.els.resetEstimatorBtn.listeners.click[0]();

  const saved = api.currentPreferences().estimator;
  assert.deepEqual(JSON.parse(JSON.stringify(saved.rangeBands.map((band) => band.maxKm))), [500, 2500, null]);
  assert.equal(saved.resources[0].label, "Resource A");
  assert.equal(saved.resources[0].completionRate, 80);
  assert.equal(saved.categoryRequirements.energy_facilities, 1);
});

test("scenario estimator saves loads and deletes range/resource profiles", async () => {
  const app = createAppContext();
  await app.__initPromise;

  const api = app.__api;
  api.state.estimator.rangeBands = [
    { id: "profile_band", maxKm: 750 },
    { id: "band_open", maxKm: null },
  ];
  api.state.estimator.resources[0].label = "Effector Alpha";
  api.state.estimator.resources[0].completionRate = 70;
  api.state.estimator.categoryRequirements.energy_facilities = 4;
  api.state.estimator.categoryRequirements.military_sites = 2;
  app.prompt = () => "Strike profile";

  api.els.saveEstimatorProfileBtn.listeners.click[0]();

  assert.equal(api.state.estimator.profiles.length, 1);
  assert.equal(api.els.estimatorProfileSelect.value, "strike_profile");
  assert.equal(api.currentPreferences().estimator.profiles[0].name, "Strike profile");

  api.state.estimator.rangeBands = [
    { id: "changed_band", maxKm: 1200 },
    { id: "band_open", maxKm: null },
  ];
  api.state.estimator.resources[0].label = "Changed";
  api.state.estimator.resources[0].completionRate = 25;
  api.state.estimator.categoryRequirements.energy_facilities = 1;
  api.state.estimator.categoryRequirements.military_sites = 1;
  api.els.loadEstimatorProfileBtn.listeners.click[0]();

  assert.deepEqual(JSON.parse(JSON.stringify(api.state.estimator.rangeBands.map((band) => band.maxKm))), [750, null]);
  assert.equal(api.state.estimator.resources[0].label, "Effector Alpha");
  assert.equal(api.state.estimator.resources[0].completionRate, 70);
  assert.equal(api.state.estimator.categoryRequirements.energy_facilities, 4);
  assert.equal(api.state.estimator.categoryRequirements.military_sites, 2);
  assert.equal(api.currentPreferences().estimator.profiles[0].categoryRequirements.energy_facilities, 4);

  api.els.resetEstimatorBtn.listeners.click[0]();
  assert.equal(api.state.estimator.profiles.length, 1);

  api.els.estimatorProfileSelect.value = "strike_profile";
  api.els.deleteEstimatorProfileBtn.listeners.click[0]();
  assert.equal(api.state.estimator.profiles.length, 0);
  assert.equal(api.els.estimatorProfileSelect.disabled, true);
});

test("range band edits update one band without adding extra bands", async () => {
  const app = createAppContext();
  await app.__initPromise;

  const api = app.__api;
  api.els.addRangeBandBtn.listeners.click[0]();

  assert.deepEqual(JSON.parse(JSON.stringify(api.currentPreferences().estimator.rangeBands.map((band) => band.maxKm))), [500, 2500, 3000, null]);

  const firstRow = api.els.rangeBandsList.children[0];
  const input = firstRow.children[1];
  const applyButton = firstRow.children[2];
  input.value = "650";
  applyButton.listeners.click[0]();

  assert.deepEqual(JSON.parse(JSON.stringify(api.currentPreferences().estimator.rangeBands.map((band) => band.maxKm))), [650, 2500, 3000, null]);
  assert.equal(api.els.rangeBandsList.children.length, 4);
});

function feature(id, label, layerId, subcategory, lat, lng, country = "Russia") {
  return {
    type: "Feature",
    id,
    geometry: { type: "Point", coordinates: [lng, lat] },
    properties: {
      display_label: label,
      name: label,
      asset_class: "test",
      asset_type: subcategory,
      country,
      source_dataset: "Fixture",
      source_layer: layerId,
      map_layer: layerId,
      map_latitude: String(lat),
      map_longitude: String(lng),
      derived_subcategory: subcategory,
      derived_subcategory_label: subcategory,
      search_text: `${label} ${subcategory}`,
      map_color: "#d4472f",
    },
  };
}

function layerInfo(id, label, pointCount, lineCount) {
  return {
    id,
    label,
    point_count: pointCount,
    line_count: lineCount,
    count: pointCount + lineCount,
    subcategories: [],
  };
}

function createAppContext(savedStorage = {}) {
  const document = createDocument();
  const localStorage = createLocalStorage(savedStorage);
  const context = {
    Blob: class {},
    URL: {
      createObjectURL() {
        return "blob:test";
      },
      revokeObjectURL() {},
    },
    alert(message) {
      throw new Error(`alert: ${message}`);
    },
    clearTimeout,
    console,
    document,
    fetch: fetchFixture,
    localStorage,
    setTimeout,
  };
  context.window = Object.assign(context, { addEventListener() {} });
  context.L = createLeafletStub(document);

  vm.createContext(context);
  vm.runInContext(appSource, context, { filename: "web/app.js" });
  return context;
}

function createLocalStorage(seed) {
  const storage = new Map(Object.entries(seed));
  return {
    getItem(key) {
      return storage.has(key) ? storage.get(key) : null;
    },
    setItem(key, value) {
      storage.set(key, String(value));
    },
    removeItem(key) {
      storage.delete(key);
    },
  };
}

async function fetchFixture(url) {
  const data = fixtures[url];
  if (!data) return { ok: false, json: async () => ({}) };
  return { ok: true, json: async () => JSON.parse(JSON.stringify(data)) };
}

function createDocument() {
  const elements = new Map();
  const document = {
    body: new FakeElement("body"),
    createElement(tagName) {
      return new FakeElement(tagName);
    },
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, new FakeElement(id));
      return elements.get(id);
    },
  };
  document.getElementById("map");
  return document;
}

class FakeElement {
  constructor(id = "") {
    this.id = id;
    this.children = [];
    this.classList = new FakeClassList();
    this.dataset = {};
    this.hidden = false;
    this.indeterminate = false;
    this.listeners = {};
    this.style = {};
    this.type = "";
    this.value = "";
    this.checked = false;
    this.attributes = new Map();
    this._className = "";
    this._innerHTML = "";
    this._textContent = "";
  }

  set className(value) {
    this._className = String(value);
  }

  get className() {
    return this._className;
  }

  set innerHTML(value) {
    this._innerHTML = String(value);
    this.children = [];
  }

  get innerHTML() {
    return this._innerHTML;
  }

  set textContent(value) {
    this._textContent = String(value);
  }

  get textContent() {
    return this._textContent;
  }

  addEventListener(name, callback) {
    if (!this.listeners[name]) this.listeners[name] = [];
    this.listeners[name].push(callback);
  }

  append(...items) {
    this.children.push(...items);
  }

  appendChild(item) {
    this.children.push(item);
    return item;
  }

  querySelectorAll() {
    return [];
  }

  getAttribute(name) {
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }
}

class FakeClassList {
  constructor() {
    this.items = new Set();
  }

  add(name) {
    this.items.add(name);
  }

  remove(name) {
    this.items.delete(name);
  }

  toggle(name, force) {
    const shouldAdd = force === undefined ? !this.items.has(name) : Boolean(force);
    if (shouldAdd) this.items.add(name);
    else this.items.delete(name);
    return shouldAdd;
  }

  contains(name) {
    return this.items.has(name);
  }
}

function createLeafletStub(document) {
  function bounds() {
    return {
      valid: false,
      extend() {
        this.valid = true;
        return this;
      },
      isValid() {
        return this.valid;
      },
      pad() {
        return this;
      },
    };
  }

  function layer(initial = {}) {
    return {
      opacity: 1,
      style: {},
      ...initial,
      addTo(target) {
        if (target?.addLayer) target.addLayer(this);
        return this;
      },
      bindPopup() {
        return this;
      },
      getBounds: bounds,
      on() {
        return this;
      },
      openPopup() {
        return this;
      },
      setIcon(icon) {
        this.options = { ...(this.options || {}), icon };
        return this;
      },
      setOpacity(value) {
        this.opacity = value;
        return this;
      },
      setStyle(value) {
        this.style = { ...this.style, ...value };
        return this;
      },
      setLatLng(value) {
        this.latlng = value;
        return this;
      },
      setLatLngs(value) {
        this.latlngs = value;
        return this;
      },
      setRadius() {
        return this;
      },
    };
  }

  function map() {
    const handlers = {};
    const layers = new Set();
    return {
      center: { lat: 58.5, lng: 58 },
      zoom: 4,
      addLayer(item) {
        layers.add(item);
        return this;
      },
      closePopup() {},
      dragging: {
        disable() {},
        enable() {},
      },
      fitBounds() {
        return this;
      },
      getCenter() {
        return this.center;
      },
      getContainer() {
        return document.getElementById("map");
      },
      getZoom() {
        return this.zoom;
      },
      hasLayer(item) {
        return layers.has(item);
      },
      layerCount() {
        return layers.size;
      },
      on(name, callback) {
        if (!handlers[name]) handlers[name] = [];
        handlers[name].push(callback);
        return this;
      },
      removeLayer(item) {
        layers.delete(item);
        return this;
      },
      setView(point, zoom) {
        this.center = Array.isArray(point) ? { lat: point[0], lng: point[1] } : { lat: point.lat, lng: point.lng };
        if (zoom !== undefined) this.zoom = zoom;
        for (const callback of handlers.moveend || []) callback({});
        return this;
      },
    };
  }

  return {
    circle: layer,
    circleMarker: layer,
    control: { layers: () => ({ addTo() { return this; } }) },
    divIcon: (options) => options,
    featureGroup: () => Object.assign(layer(), { getBounds: bounds }),
    geoJSON: (_data, options) => Object.assign(layer(), {
      addData(item) {
        if (options?.onEachFeature) options.onEachFeature(item, layer());
        return this;
      },
    }),
    latLng: (lat, lng) => ({ lat, lng }),
    latLngBounds: bounds,
    layerGroup: () => Object.assign(layer(), {
      addLayer() {},
      clearLayers() {},
    }),
    map,
    marker: (latlng, options = {}) => layer({ latlng, options }),
    markerClusterGroup: () => Object.assign(layer(), { addLayer() {} }),
    polyline: (latlngs, options = {}) => layer({ latlngs, options }),
    tileLayer: layer,
  };
}
