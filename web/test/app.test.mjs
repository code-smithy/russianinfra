import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import zlib from "node:zlib";

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
  attackArrowBearing,
  colorForLayer,
  state,
  els,
  clearAllCountries,
  clearTemporalFilters,
  buildEstimatorCsv,
  buildCampaignTimelineCsv,
  buildCampaignTimelineJson,
  buildSequentialLayerQuotas,
  buildWeightedLayerQuotas,
  campaignLayerSummaries,
  campaignBandIds,
  campaignBandMetadata,
  campaignScopeEntries,
  buildEstimatorAggregates,
  countryForPosition,
  currentPreferences,
  estimatorDetailRows,
  estimatorExportRows,
  estimateUnits,
  demandForLayerCount,
  dailyProductionForDate,
  daysInMonth,
  featureDistanceToPointKm,
  featurePassesActiveFilters,
  featurePassesTemporalFilters,
  groupedLayerInfos,
  handleSubcategoryChange,
  importEstimatorAssumptionsFromText,
  importCampaignProfileFromText,
  normalizeBandResourceMap,
  normalizeCampaignSettings,
  loadDataJson,
  markerIcon,
  metersKm,
  map,
  onRadiusMouseDown,
  renderEstimatorResults,
  renderRadiusResults,
  recalculateCampaign,
  renderCampaignMapStatus,
  resetRadius,
  resetEstimatorAssumptions,
  savePreferencesNow,
  setCampaignDay,
  setSelectedTab,
  simulateCampaign,
  stepCampaign,
  playCampaign,
  pauseCampaign,
  resetCampaignPlayback,
  setCampaignBlockCollapsed,
  setCountriesPanelCollapsed,
  setChangeReportPanelCollapsed,
  setEstimatorBlockCollapsed,
  setEstimatorPanelCollapsed,
  setLayersPanelCollapsed,
  setRadiusMenuPanelCollapsed,
  setSearchPanelCollapsed,
  setTemporalPanelCollapsed,
  setMenuWidth,
  summarizeEstimatorResults,
  validateEstimatorAggregates,
};`
);

const manifest = {
  change_report_file: "diff_report.json",
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
  "data/diff_report.json": {
    schema_version: 1,
    summary: {
      compare_available: true,
      previous_build_id: "2026-06-18T00:00:00Z",
      current_build_id: "2026-06-30T00:00:00Z",
      new_objects: 1,
      removed_objects: 1,
      changed_objects: 1,
      moved_objects: 1,
      suspicious_coordinate_shifts: 1,
    },
    new_objects: [{ uid: "fixture_energy_1", name: "Alpha Refinery", map_layer: "energy_facilities", asset_type: "energy_oil_facility", country: "Russia" }],
    removed_objects: [{ uid: "old_1", name: "Removed object", map_layer: "power_facilities", asset_type: "substation", country: "Russia" }],
    moved_objects: [{ uid: "fixture_energy_2", name: "Charlie Terminal", map_layer: "energy_facilities", asset_type: "energy_oil_facility", distance_km: 24.5 }],
    category_changes: [],
    name_changes: [],
    confidence_changes: [],
    source_changes: [],
  },
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
    id: 1782729914,
    datetime: "29.06 o 12:45",
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
            icon: "images/arrows/arrow_2.png",
          },
        },
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: [37.85, 48.55, 0] },
          properties: {
            name: "Another direction /// geoJSON.status.attack_direction",
            icon: "images/arrows/arrow_12.png",
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
  "data/compressed_only.geojson.gz": zlib.gzipSync(JSON.stringify({
    type: "FeatureCollection",
    features: [feature("fixture_gzip_1", "Compressed Site", "military_sites", "military_other", 57.2, 61.1, "Russia")],
  })),
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

test("saves and restores collapsed Timeline and Build comparison panels", async () => {
  const first = createAppContext();
  await first.__initPromise;

  first.__api.setTemporalPanelCollapsed(true);
  first.__api.setChangeReportPanelCollapsed(true);
  first.__api.savePreferencesNow();

  const savedRaw = first.localStorage.getItem(STORAGE_KEY);
  const saved = JSON.parse(savedRaw);
  assert.equal(saved.temporalPanelCollapsed, true);
  assert.equal(saved.changeReportPanelCollapsed, true);

  const second = createAppContext({ [STORAGE_KEY]: savedRaw });
  await second.__initPromise;

  assert.equal(second.__api.els.temporalPanelBody.hidden, true);
  assert.equal(second.__api.els.temporalPanel.classList.contains("collapsed"), true);
  assert.equal(second.__api.els.temporalPanelToggle.getAttribute("aria-expanded"), "false");
  assert.equal(second.__api.els.changeReportPanelBody.hidden, true);
  assert.equal(second.__api.els.changeReportPanel.classList.contains("collapsed"), true);
  assert.equal(second.__api.els.changeReportPanelToggle.getAttribute("aria-expanded"), "false");
});

test("saves and restores collapsed Search, Radius, Estimator, and Estimate menus", async () => {
  const first = createAppContext();
  await first.__initPromise;

  first.__api.setSearchPanelCollapsed(true);
  first.__api.setRadiusMenuPanelCollapsed(true);
  first.__api.setEstimatorPanelCollapsed(true);
  first.__api.setEstimatorBlockCollapsed("estimate", true);
  first.__api.savePreferencesNow();

  const savedRaw = first.localStorage.getItem(STORAGE_KEY);
  const saved = JSON.parse(savedRaw);
  assert.equal(saved.searchPanelCollapsed, true);
  assert.equal(saved.radiusMenuPanelCollapsed, true);
  assert.equal(saved.estimatorPanelCollapsed, true);
  assert.deepEqual(saved.collapsedEstimatorBlocks, ["estimate"]);

  const second = createAppContext({ [STORAGE_KEY]: savedRaw });
  await second.__initPromise;

  assert.equal(second.__api.els.searchPanelBody.hidden, true);
  assert.equal(second.__api.els.searchPanel.classList.contains("collapsed"), true);
  assert.equal(second.__api.els.radiusMenuPanelBody.hidden, true);
  assert.equal(second.__api.els.radiusMenuPanelToggle.getAttribute("aria-expanded"), "false");
  assert.equal(second.__api.els.estimatorPanelBody.hidden, true);
  assert.equal(second.__api.els.estimatorPanel.classList.contains("collapsed"), true);
  assert.equal(second.__api.els.estimateBody.hidden, true);
  assert.equal(second.__api.els.estimateToggle.getAttribute("aria-expanded"), "false");
});

test("places Timeline and Build comparison at the bottom of their sidebars", () => {
  const html = fs.readFileSync("web/index.html", "utf8");
  assert.ok(html.indexOf('id="temporalPanel"') > html.indexOf('id="radiusPanel"'));
  assert.ok(html.indexOf('id="changeReportPanel"') > html.indexOf('id="estimatorPanel"'));
});

test("feedback prompt links to GitHub issues instead of a local form", () => {
  const html = fs.readFileSync("web/index.html", "utf8");
  assert.match(html, /Feedback: <a href="https:\/\/github\.com\/code-smithy\/russianinfra\/issues\/new"/);
  assert.match(html, /target="_blank"/);
  assert.match(html, /rel="noopener noreferrer"/);
  assert.doesNotMatch(html, /id="feedbackDialog"/);
  assert.doesNotMatch(html, /id="feedbackForm"/);
  assert.doesNotMatch(html, /id="feedbackMessage"/);
  assert.doesNotMatch(html, /mailto:/i);
});

test("campaign input masks have matching information explanations", () => {
  const html = fs.readFileSync("web/index.html", "utf8");
  const js = fs.readFileSync("web/app.js", "utf8");
  const campaignSections = [
    ["campaignSettings", "campaignSettingsInfoBtn"],
    ["campaignLayerAllocation", "campaignLayerAllocationInfoBtn"],
    ["campaignCapacity", "campaignCapacityInfoBtn"],
    ["campaignSupply", "campaignSupplyInfoBtn"],
    ["campaignCosts", "campaignCostsInfoBtn"],
    ["campaignPlayer", "campaignPlayerInfoBtn"],
    ["campaignDashboard", "campaignDashboardInfoBtn"],
    ["campaignDailyTimeline", "campaignDailyTimelineInfoBtn"],
  ];

  for (const [topic, buttonId] of campaignSections) {
    assert.match(html, new RegExp(`id="${buttonId}"[^>]+data-info-topic="${topic}"`));
    assert.match(js, new RegExp(`${topic}: \\{[\\s\\S]*?paragraphs:`));
    assert.match(js, new RegExp(`"${buttonId}"`));
  }

  assert.match(html, /id="campaignSettings"/);
  assert.match(html, /id="campaignLayerAllocation"/);
  assert.match(html, /id="campaignCapacity"/);
  assert.match(html, /id="campaignSupply"/);
  assert.match(html, /id="campaignCosts"/);
  assert.match(html, /id="campaignPlayer"/);
  assert.match(html, /id="campaignDashboard"/);
  assert.match(html, /id="campaignDailyTable"/);
});

test("version metadata includes the campaign hardness and penetration release", () => {
  const html = fs.readFileSync("web/index.html", "utf8");
  const js = fs.readFileSync("web/app.js", "utf8");
  const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));

  assert.equal(packageJson.version, "0.15.0");
  assert.match(js, /const APP_VERSION = "0\.15\.0"/);
  assert.match(html, /id="appVersion"[^>]*>v0\.15\.0</);
  assert.match(js, /version: "0\.15\.0"[\s\S]*Adds resource penetration and category hardness inputs/);
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

test("saves and restores collapsed campaign left column groups", async () => {
  const first = createAppContext();
  await first.__initPromise;

  first.__api.setCampaignBlockCollapsed("campaignCapacity", true);
  first.__api.setCampaignBlockCollapsed("campaignSupply", true);
  first.__api.setCampaignBlockCollapsed("campaignProfiles", true);
  first.__api.savePreferencesNow();

  const savedRaw = first.localStorage.getItem(STORAGE_KEY);
  const saved = JSON.parse(savedRaw);
  assert.deepEqual(saved.collapsedCampaignBlocks, ["campaignCapacity", "campaignSupply", "campaignProfiles"]);

  const second = createAppContext({ [STORAGE_KEY]: savedRaw });
  await second.__initPromise;

  assert.equal(second.__api.els.campaignCapacityBody.hidden, true);
  assert.equal(second.__api.els.campaignCapacityBlock.classList.contains("collapsed"), true);
  assert.equal(second.__api.els.campaignCapacityToggle.getAttribute("aria-expanded"), "false");
  assert.equal(second.__api.els.campaignSupplyBody.hidden, true);
  assert.equal(second.__api.els.campaignProfilesBody.hidden, true);
  assert.equal(second.__api.els.campaignSettingsBody.hidden, false);
  assert.equal(second.__api.els.campaignCostsBody.hidden, false);
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

test("loads build comparison report and renders summary counts", async () => {
  const app = createAppContext();
  await app.__initPromise;

  assert.equal(app.__api.els.changeReportBuilds.textContent, "2026-06-18 -> 2026-06-30");
  assert.match(app.__api.els.changeReportSummary.innerHTML, /new objects/);
  assert.match(app.__api.els.changeReportSummary.innerHTML, /suspicious shifts/);
  assert.match(app.__api.els.changeReportDetails.innerHTML, /Alpha Refinery/);
  assert.match(app.__api.els.changeReportDetails.innerHTML, /Removed object/);
});

test("timeline filters apply status and date constraints to active features", async () => {
  const app = createAppContext();
  await app.__initPromise;

  const api = app.__api;
  const first = fixtures["data/energy_facilities.geojson"].features[0];
  const second = fixtures["data/energy_facilities.geojson"].features[1];

  api.els.showNewOnlyInput.checked = true;
  api.els.showNewOnlyInput.listeners.change[0]();
  assert.equal(api.featurePassesActiveFilters(first), true);
  assert.equal(api.featurePassesActiveFilters(second), false);
  assert.equal(api.els.temporalSummary.textContent, "new");

  api.clearTemporalFilters();
  api.els.timeFieldSelect.value = "source";
  api.els.timeAfterInput.value = "2026-06-29";
  api.els.timeAfterInput.listeners.change[0]();
  assert.equal(api.featurePassesTemporalFilters(first), true);
  assert.equal(api.featurePassesTemporalFilters(second), false);
  assert.equal(api.els.temporalSummary.textContent, "after 2026-06-29");
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

test("loads gzipped GeoJSON when the raw layer file is absent", async () => {
  const app = createAppContext();
  await app.__initPromise;

  const data = await app.__api.loadDataJson("compressed_only.geojson");

  assert.equal(data.features.length, 1);
  assert.equal(data.features[0].id, "fixture_gzip_1");
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
  const row = api.els.layersList.children.find((child) => child.dataset?.layerId === "deepstate_live");
  assert.match(row.children[2].innerHTML, /Date: 29\.06\.2026 12:45/);
  assert.doesNotMatch(row.children[2].innerHTML, /configured live source/);
});

test("loads a DeepState history version for a configured date", async () => {
  const originalConfig = fixtures["deepstate-layer-config.json"];
  fixtures["deepstate-layer-config.json"] = {
    ...originalConfig,
    url: "",
    historyDate: "2026-06-28",
    historyIndexUrl: "https://example.test/history-public.json",
    historyGeoJsonUrlTemplate: "https://example.test/history/{id}/geojson",
  };
  fixtures["https://example.test/history-public.json"] = [
    { id: "early", createdAt: "2026-06-28T10:00:00.000Z", datetime: "28.06 o 13:00" },
    { id: "late", createdAt: "2026-06-28T18:30:00.000Z", datetime: "28.06 o 21:30" },
    { id: "other", createdAt: "2026-06-27T18:30:00.000Z", datetime: "27.06 o 21:30" },
  ];
  fixtures["https://example.test/history/late/geojson"] = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: [37.9, 48.6, 0] },
        properties: { name: "Historical object", icon: "enemy" },
      },
    ],
  };

  try {
    const app = createAppContext();
    await app.__initPromise;

    const api = app.__api;
    const deepstate = api.state.manifest.layers.find((layer) => layer.id === "deepstate_live");
    assert.equal(deepstate.count, 1);
    assert.equal(deepstate.externalData.id, "late");
    assert.equal(deepstate.externalData.datetime, "28.06 o 21:30");
    const row = api.els.layersList.children.find((child) => child.dataset?.layerId === "deepstate_live");
    assert.match(row.children[2].innerHTML, /Date: 28\.06\.2026 21:30/);
  } finally {
    fixtures["deepstate-layer-config.json"] = originalConfig;
    delete fixtures["https://example.test/history-public.json"];
    delete fixtures["https://example.test/history/late/geojson"];
  }
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
  const arrow45 = api.state.features.get("deepstate_live_4");
  const arrow270 = api.state.features.get("deepstate_live_5");
  assert.ok(stored);
  assert.ok(enemy);
  assert.ok(airport);
  assert.deepEqual(JSON.parse(JSON.stringify(stored.feature.properties.countries)), ["Ukraine"]);
  assert.equal(api.featurePassesActiveFilters(stored.feature), true);
  assert.equal(enemy.feature.properties.icon_key, "enemy");
  assert.match(enemy.layer.options.icon.html, /tactical-hostile/);
  assert.match(airport.layer.options.icon.html, /tactical-airport-hostile/);
  assert.match(arrow45.layer.options.icon.html, /attack-arrow-marker/);
  assert.match(arrow45.layer.options.icon.html, /rotate\(45deg\)/);
  assert.match(arrow270.layer.options.icon.html, /rotate\(270deg\)/);

  api.state.countryControls.get("Ukraine").checked = false;
  api.state.countryControls.get("Ukraine").listeners.change[0]();

  assert.equal(api.state.layers.get("deepstate_live").features.length, 6);
  assert.equal(api.featurePassesActiveFilters(stored.feature), false);
});

test("infers Crimea as Ukraine and does not put Black Sea points in Russia", async () => {
  const app = createAppContext();
  await app.__initPromise;

  const api = app.__api;
  assert.equal(api.countryForPosition({ lng: 34.1, lat: 44.95 }), "Ukraine");
  assert.notEqual(api.countryForPosition({ lng: 37.0, lat: 44.8 }), "Russia");
  assert.equal(api.countryForPosition({ lng: 34.0, lat: 43.8 }), null);
  assert.equal(api.countryForPosition({ lng: 39.7, lat: 43.6 }), "Russia");
});

test("maps DeepState attack arrow icons to equal compass bearings", async () => {
  const app = createAppContext();
  await app.__initPromise;

  const bearing = app.__api.attackArrowBearing;
  assert.equal(bearing({ icon: "images/arrows/arrow_16.png" }), 0);
  assert.equal(bearing({ icon: "images/arrows/arrow_12.png" }), 270);
  assert.equal(bearing({ icon: "images/arrows/arrow_2.png" }), 45);
  assert.equal(bearing({ icon: "images/arrows/arrow_1.png" }), 22.5);
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

test("uses pointer events for radius drawing when the browser supports them", async () => {
  const app = createAppContext({}, { pointerEvents: true });
  await app.__initPromise;

  const api = app.__api;
  const mapElement = app.document.getElementById("map");
  assert.equal(mapElement.listeners.pointerdown.length, 1);
  assert.equal(mapElement.listeners.pointermove.length, 1);
  assert.equal(mapElement.listeners.pointerup.length, 1);
  assert.equal(mapElement.listeners.pointercancel.length, 1);
  assert.equal(api.map._handlers.mousedown, undefined);
  assert.equal(api.map._handlers.mousemove, undefined);
  assert.equal(api.map._handlers.mouseup, undefined);

  api.els.radiusModeBtn.listeners.click[0]();
  mapElement.listeners.pointerdown[0]({
    isPrimary: true,
    button: 0,
    pointerId: 42,
    target: mapElement,
    latlng: { lat: 58, lng: 58 },
    preventDefault() {},
  });
  assert.equal(api.state.radiusPointerId, 42);
  assert.deepEqual(api.state.radiusStart, { lat: 58, lng: 58 });

  mapElement.listeners.pointermove[0]({
    isPrimary: true,
    pointerId: 42,
    target: mapElement,
    latlng: { lat: 58.25, lng: 58.25 },
  });
  assert.deepEqual(api.state.radiusEdge, { lat: 58.25, lng: 58.25 });

  await mapElement.listeners.pointerup[0]({
    isPrimary: true,
    pointerId: 42,
    target: mapElement,
    latlng: { lat: 58.5, lng: 58.5 },
  });
  assert.equal(api.state.radiusPointerId, null);
  assert.equal(api.state.radiusMode, false);
  assert.equal(mapElement.capturedPointerId, null);
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
        { id: "resource_a", label: "Planning Resource", completionRate: 75, penetration: 8 },
      ],
      categoryRequirements: {
        energy_facilities: 3,
      },
      categoryHardness: {
        energy_facilities: 5,
      },
    },
  }));

  const saved = api.currentPreferences().estimator;
  assert.deepEqual(JSON.parse(JSON.stringify(saved.rangeBands.map((band) => band.maxKm))), [100, 900, null]);
  assert.equal(saved.resources[0].label, "Planning Resource");
  assert.equal(saved.resources[0].completionRate, 75);
  assert.equal(saved.resources[0].penetration, 8);
  assert.equal(saved.categoryRequirements.energy_facilities, 3);
  assert.equal(saved.categoryHardness.energy_facilities, 5);
});

test("scenario estimator preserves imported resource lists beyond the defaults", async () => {
  const app = createAppContext();
  await app.__initPromise;

  const api = app.__api;
  api.importEstimatorAssumptionsFromText(JSON.stringify({
    estimator: {
      resources: [
        { id: "resource_alpha", label: "Alpha", completionRate: 90 },
        { id: "resource_beta", label: "Beta", completionRate: 80 },
        { id: "resource_gamma", label: "Gamma", completionRate: 70 },
        { id: "resource_delta", label: "Delta", completionRate: 60 },
      ],
    },
  }));

  assert.deepEqual(JSON.parse(JSON.stringify(api.state.estimator.resources.map((resource) => resource.id))), [
    "resource_alpha",
    "resource_beta",
    "resource_gamma",
    "resource_delta",
  ]);
  assert.equal(api.currentPreferences().estimator.resources.length, 4);
  const firstBandId = api.campaignBandIds()[0];
  assert.equal(api.state.campaign.initialStockByBand[firstBandId].resource_delta, 0);
  assert.equal(api.state.campaign.fireCapacityPerDayByBand[firstBandId].resource_delta, 0);
});

test("scenario estimator clear all restores default assumptions", async () => {
  const app = createAppContext();
  await app.__initPromise;

  const api = app.__api;
  api.state.estimator.rangeBands = [{ id: "custom", maxKm: 100 }, { id: "band_open", maxKm: null }];
  api.state.estimator.resources[0].label = "Changed";
  api.state.estimator.resources[0].completionRate = 10;
  api.state.estimator.resources[0].penetration = 9;
  api.state.estimator.categoryRequirements.energy_facilities = 9;
  api.state.estimator.categoryHardness.energy_facilities = 8;

  api.els.resetEstimatorBtn.listeners.click[0]();

  const saved = api.currentPreferences().estimator;
  assert.deepEqual(JSON.parse(JSON.stringify(saved.rangeBands.map((band) => band.maxKm))), [500, 2500, null]);
  assert.equal(saved.resources[0].label, "Resource A");
  assert.equal(saved.resources[0].completionRate, 80);
  assert.equal(saved.resources[0].penetration, 0);
  assert.equal(saved.categoryRequirements.energy_facilities, 1);
  assert.equal(saved.categoryHardness.energy_facilities, 0);
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
  api.state.estimator.resources[0].penetration = 12;
  api.state.estimator.categoryRequirements.energy_facilities = 4;
  api.state.estimator.categoryRequirements.military_sites = 2;
  api.state.estimator.categoryHardness.energy_facilities = 6;
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
  api.state.estimator.resources[0].penetration = 1;
  api.state.estimator.categoryRequirements.energy_facilities = 1;
  api.state.estimator.categoryRequirements.military_sites = 1;
  api.state.estimator.categoryHardness.energy_facilities = 1;
  api.els.loadEstimatorProfileBtn.listeners.click[0]();

  assert.deepEqual(JSON.parse(JSON.stringify(api.state.estimator.rangeBands.map((band) => band.maxKm))), [750, null]);
  assert.equal(api.state.estimator.resources[0].label, "Effector Alpha");
  assert.equal(api.state.estimator.resources[0].completionRate, 70);
  assert.equal(api.state.estimator.resources[0].penetration, 12);
  assert.equal(api.state.estimator.categoryRequirements.energy_facilities, 4);
  assert.equal(api.state.estimator.categoryRequirements.military_sites, 2);
  assert.equal(api.state.estimator.categoryHardness.energy_facilities, 6);
  assert.equal(api.currentPreferences().estimator.profiles[0].categoryRequirements.energy_facilities, 4);
  assert.equal(api.currentPreferences().estimator.profiles[0].categoryHardness.energy_facilities, 6);

  api.els.resetEstimatorBtn.listeners.click[0]();
  assert.equal(api.state.estimator.profiles.length, 1);

  api.els.estimatorProfileSelect.value = "strike_profile";
  api.els.deleteEstimatorProfileBtn.listeners.click[0]();
  assert.equal(api.state.estimator.profiles.length, 0);
  assert.equal(api.els.estimatorProfileSelect.disabled, true);
});

test("resource type controls add remove and re-shape campaign settings", async () => {
  const app = createAppContext();
  await app.__initPromise;

  const api = app.__api;
  const firstBandId = api.campaignBandIds()[0];
  api.state.campaign.initialStockByBand[firstBandId].resource_b = 22;
  api.state.campaign.resourceUnitCostByBand[firstBandId].resource_b = 44;
  api.state.campaign.resourceSubstitution = api.normalizeCampaignSettings({
    resourceSubstitution: {
      enabled: true,
      mode: "priority",
      preserveRangeBand: true,
      substitutePriorityOrder: ["resource_b", "resource_c"],
      substituteWeights: {},
    },
  }).resourceSubstitution;

  api.els.addResourceTypeBtn.listeners.click[0]();

  assert.equal(api.state.estimator.resources.length, 4);
  const added = api.state.estimator.resources[3];
  assert.equal(added.id, "resource_d");
  assert.equal(api.state.campaign.initialStockByBand[firstBandId].resource_d, 0);
  assert.equal(api.state.campaign.resourceUnitCostByBand[firstBandId].resource_d, 0);
  assert.deepEqual(JSON.parse(JSON.stringify(api.state.campaign.resourceSubstitution.substitutePriorityOrder)), [
    "resource_b",
    "resource_c",
    "resource_a",
    "resource_d",
  ]);

  const addedRow = api.els.resourceTypesList.children[3];
  addedRow.children[0].value = "Drone";
  addedRow.children[0].listeners.input[0]();
  addedRow.children[1].value = "88";
  addedRow.children[1].listeners.input[0]();
  addedRow.children[2].value = "4";
  addedRow.children[2].listeners.input[0]();
  assert.equal(api.state.estimator.resources[3].label, "Drone");
  assert.equal(api.state.estimator.resources[3].completionRate, 88);
  assert.equal(api.state.estimator.resources[3].penetration, 4);
  assert.equal(api.state.campaignRun.stale, true);

  const secondRow = api.els.resourceTypesList.children[1];
  secondRow.children[3].listeners.click[0]();

  assert.deepEqual(JSON.parse(JSON.stringify(api.state.estimator.resources.map((resource) => resource.id))), [
    "resource_a",
    "resource_c",
    "resource_d",
  ]);
  assert.equal(api.state.campaign.initialStockByBand[firstBandId].resource_b, undefined);
  assert.equal(api.state.campaign.initialStockByBand[firstBandId].resource_d, 0);
  assert.equal(api.state.campaign.resourceUnitCostByBand[firstBandId].resource_b, undefined);
  assert.equal(api.state.campaign.resourceUnitCostByBand[firstBandId].resource_d, 0);
  assert.deepEqual(JSON.parse(JSON.stringify(api.state.campaign.resourceSubstitution.substitutePriorityOrder)), [
    "resource_c",
    "resource_a",
    "resource_d",
  ]);
});

test("category assumptions use number inputs", async () => {
  const app = createAppContext();
  await app.__initPromise;

  const api = app.__api;
  const row = api.els.categoryAssumptionsList.children.find((child) => child.children[0].innerHTML.includes("Oil/Gas Facilities"));
  assert.ok(row);
  assert.equal(row.children.length, 3);

  const input = row.children[1];
  assert.equal(input.type, "number");
  assert.equal(input.min, "0");
  assert.equal(input.step, "1");
  assert.equal(input.value, "1");
  const hardnessInput = row.children[2];
  assert.equal(hardnessInput.type, "number");
  assert.equal(hardnessInput.min, "0");
  assert.equal(hardnessInput.step, "1");
  assert.equal(hardnessInput.value, "0");

  input.value = "4";
  input.listeners.input[0]();
  assert.equal(api.state.estimator.categoryRequirements.energy_facilities, 4);
  hardnessInput.value = "7";
  hardnessInput.listeners.input[0]();
  assert.equal(api.state.estimator.categoryHardness.energy_facilities, 7);
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
  const temporal = {
    fixture_energy_1: {
      source_archive_date: "2026-06-30T00:00:00Z",
      first_seen_build: "2026-06-30T00:00:00Z",
      last_seen_build: "2026-06-30T00:00:00Z",
      change_status: "new",
      change_types: ["new"],
      new_in_latest_build: "true",
      changed_since_previous_build: "false",
    },
    fixture_energy_2: {
      source_archive_date: "2026-06-18T00:00:00Z",
      first_seen_build: "2026-06-18T00:00:00Z",
      last_seen_build: "2026-06-30T00:00:00Z",
      change_status: "changed",
      change_types: ["moved"],
      new_in_latest_build: "false",
      changed_since_previous_build: "true",
    },
  }[id] || {
    source_archive_date: "2026-06-18T00:00:00Z",
    first_seen_build: "2026-06-18T00:00:00Z",
    last_seen_build: "2026-06-30T00:00:00Z",
    change_status: "unchanged",
    change_types: [],
    new_in_latest_build: "false",
    changed_since_previous_build: "false",
  };
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
      ...temporal,
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

function createAppContext(savedStorage = {}, options = {}) {
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
    DecompressionStream,
    document,
    fetch: fetchFixture,
    localStorage,
    Response,
    setTimeout,
  };
  if (options.pointerEvents) {
    context.PointerEvent = class PointerEvent {};
  }
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
  if (url.endsWith(".gz")) return new Response(data, { status: 200 });
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

  setPointerCapture(pointerId) {
    this.capturedPointerId = pointerId;
  }

  releasePointerCapture(pointerId) {
    if (this.capturedPointerId === pointerId) this.capturedPointerId = null;
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
      _handlers: handlers,
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
      mouseEventToLatLng(event) {
        return event.latlng;
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
    layerGroup: () => { const children = []; return Object.assign(layer(), {
      addLayer(item) { children.push(item); return this; },
      clearLayers() { children.length = 0; return this; },
      getLayers() { return children.slice(); },
    }); },
    map,
    marker: (latlng, options = {}) => layer({ latlng, options }),
    markerClusterGroup: () => Object.assign(layer(), { addLayer() {} }),
    polyline: (latlngs, options = {}) => layer({ latlngs, options }),
    tileLayer: layer,
  };
}

function configureSingleTargetCampaign(api, { requirement = 1, resourceSubstitution = undefined, distance = 100 } = {}) {
  const [bandId] = api.campaignBandIds();
  api.state.radiusResults = [
    { stored: { id: "target_1", feature: feature("target_1", "Target 1", "energy_facilities", "energy_oil_facility", 55.2, 59.1) }, distance },
  ];
  api.state.estimator.categoryRequirements.energy_facilities = requirement;
  for (const resource of api.state.estimator.resources) resource.completionRate = 100;
  api.state.campaign = api.normalizeCampaignSettings({
    startDate: "2026-07-01",
    maxSimulationDays: 1,
    allocationMode: "sequential",
    commandCapacityPerDay: 1,
    resourceSubstitution,
  });
  api.state.campaign.layerPriorityOrder = ["energy_facilities"];
  return bandId;
}

function setCampaignBandResource(api, bandId, resourceId, stock, fireCapacity = stock) {
  api.state.campaign.initialStockByBand[bandId][resourceId] = stock;
  api.state.campaign.fireCapacityPerDayByBand[bandId][resourceId] = fireCapacity;
}

test("campaign settings normalize persist and calendar production uses real month lengths", async () => {
  const first = createAppContext();
  await first.__initPromise;
  const api = first.__api;
  api.state.campaign.startDate = "2026-02-01";
  api.state.campaign.allocationMode = "sequential";
  api.state.campaign.commandCapacityPerDay = 7;
  const firstBandId = api.campaignBandIds()[0];
  api.state.campaign.fireCapacityPerDayByBand[firstBandId].resource_a = 11;
  api.state.campaign.initialStockByBand[firstBandId].resource_a = 22;
  api.state.campaign.productionMonthlyByBand[firstBandId].resource_a = 280;
  api.state.campaign.resourceUnitCostByBand[firstBandId].resource_a = 123.45;
  api.savePreferencesNow();
  assert.equal(api.dailyProductionForDate(firstBandId, "resource_a", "2026-02-01"), 10);
  api.state.campaign.productionMonthlyByBand[firstBandId].resource_a = 290;
  assert.equal(api.dailyProductionForDate(firstBandId, "resource_a", "2028-02-01"), 10);
  api.state.campaign.productionMonthlyByBand[firstBandId].resource_a = 310;
  assert.equal(api.dailyProductionForDate(firstBandId, "resource_a", "2026-07-01"), 10);

  const saved = api.currentPreferences().campaign;
  assert.equal(saved.startDate, "2026-02-01");
  assert.equal(saved.initialStockByBand[firstBandId].resource_a, 22);
  assert.equal(saved.resourceUnitCostByBand[firstBandId].resource_a, 123.45);
  assert.deepEqual(JSON.parse(JSON.stringify(saved.resourceSubstitution)), {
    enabled: false,
    mode: "off",
    preserveRangeBand: true,
    substitutePriorityOrder: [],
    substituteWeights: {},
  });
  const second = createAppContext({ [STORAGE_KEY]: JSON.stringify(api.currentPreferences()) });
  await second.__initPromise;
  assert.equal(second.__api.state.campaign.startDate, "2026-02-01");
  assert.equal(second.__api.state.campaign.initialStockByBand[firstBandId].resource_a, 22);
  assert.equal(second.__api.state.campaign.resourceUnitCostByBand[firstBandId].resource_a, 123.45);
});

test("campaign band-resource normalization migrates legacy flat settings and prunes stale keys", async () => {
  const app = createAppContext();
  await app.__initPromise;
  const api = app.__api;
  const [firstBandId, secondBandId] = api.campaignBandIds();

  const normalized = api.normalizeBandResourceMap({
    resource_a: 12,
    stale_resource: 99,
    stale_band: { resource_a: 88 },
  });

  assert.equal(normalized[firstBandId].resource_a, 12);
  assert.equal(normalized[secondBandId].resource_a, 0);
  assert.equal(normalized.stale_band, undefined);
  assert.equal(normalized[firstBandId].stale_resource, undefined);

  const nested = api.normalizeCampaignSettings({
    initialStockByBand: {
      [firstBandId]: { resource_a: 3 },
      stale_band: { resource_a: 90 },
    },
    productionMonthlyByBand: {
      [secondBandId]: { resource_a: 31 },
    },
    resourceUnitCostByBand: {
      [secondBandId]: { resource_a: 500 },
    },
  });

  assert.equal(nested.initialStockByBand[firstBandId].resource_a, 3);
  assert.equal(nested.initialStockByBand.stale_band, undefined);
  assert.equal(nested.productionMonthlyByBand[secondBandId].resource_a, 31);
  assert.equal(nested.resourceUnitCostByBand[secondBandId].resource_a, 500);
});

test("campaign scope comes only from radius results and demand reuses estimator formula", async () => {
  const app = createAppContext();
  await app.__initPromise;
  const api = app.__api;
  assert.equal(api.campaignScopeEntries().length, 0);
  api.renderRadiusResults({ lat: 55.75, lng: 37.61 }, 5000);
  assert.equal(api.campaignScopeEntries().length, api.state.radiusResults.length);
  assert.deepEqual(api.campaignLayerSummaries().map((row) => row.total).reduce((a, b) => a + b, 0), api.state.radiusResults.length);
  api.state.estimator.categoryRequirements.energy_facilities = 2;
  api.state.estimator.resources[0].completionRate = 50;
  assert.equal(api.demandForLayerCount("energy_facilities", 3).resource_a, api.estimateUnits(3, 2, 50));
  api.state.estimator.resources[0].completionRate = 0;
  assert.equal(api.demandForLayerCount("energy_facilities", 1).resource_a, Infinity);
});

test("campaign layer allocation uses numeric priority and allocation inputs", async () => {
  const app = createAppContext();
  await app.__initPromise;
  const api = app.__api;

  const militaryControl = api.state.layerControls.get("military_sites");
  militaryControl.checked = true;
  await militaryControl.listeners.change[0]();
  api.renderRadiusResults({ lat: 55.75, lng: 37.61 }, 5000);

  const rows = api.els.campaignLayerAllocation.children;
  assert.equal(rows.length, 2);
  assert.equal(rows[0].children.length, 3);
  const priorityInput = rows[0].children[1].children[0];
  const allocationInput = rows[0].children[2].children[0];
  assert.equal(priorityInput.type, "number");
  assert.equal(priorityInput.value, "1");
  assert.equal(allocationInput.type, "number");
  assert.equal(allocationInput.value, "1");
  assert.deepEqual(JSON.parse(JSON.stringify(api.campaignLayerSummaries().map((layer) => layer.id))), ["energy_facilities", "military_sites"]);

  priorityInput.value = "2";
  priorityInput.listeners.change[0]({ target: priorityInput });

  assert.deepEqual(JSON.parse(JSON.stringify(api.state.campaign.layerPriorityOrder)), ["military_sites", "energy_facilities"]);
  assert.deepEqual(JSON.parse(JSON.stringify(api.campaignLayerSummaries().map((layer) => layer.id))), ["military_sites", "energy_facilities"]);

  const updatedRows = api.els.campaignLayerAllocation.children;
  const updatedAllocationInput = updatedRows[1].children[2].children[0];
  updatedAllocationInput.value = "7";
  updatedAllocationInput.listeners.change[0]({ target: updatedAllocationInput });
  assert.equal(api.state.campaign.layerWeights.energy_facilities, 7);
});

test("campaign allocation, deferral, stock production and exports are deterministic", async () => {
  const app = createAppContext();
  await app.__initPromise;
  const api = app.__api;
  assert.equal(api.els.exportCampaignTimelineCsvBtn.disabled, true);
  assert.equal(api.els.exportCampaignTimelineJsonBtn.disabled, true);
  api.renderRadiusResults({ lat: 55.75, lng: 37.61 }, 5000);
  api.state.campaign.layerPriorityOrder = ["energy_facilities", "military_sites"];
  api.state.campaign.layerWeights = { energy_facilities: 75, military_sites: 25 };
  api.state.campaign.commandCapacityPerDay = 4;
  assert.deepEqual(JSON.parse(JSON.stringify(api.buildWeightedLayerQuotas({ energy_facilities: 10, military_sites: 10 }, api.state.campaign))), { energy_facilities: 3, military_sites: 1 });
  assert.deepEqual(JSON.parse(JSON.stringify(api.buildSequentialLayerQuotas({ energy_facilities: 2, military_sites: 10 }, api.state.campaign))), { energy_facilities: 2, military_sites: 2 });

  const firstBandId = api.campaignBandIds()[0];
  for (const resource of api.state.estimator.resources) {
    resource.completionRate = 100;
    api.state.campaign.fireCapacityPerDayByBand[firstBandId][resource.id] = 1;
    api.state.campaign.initialStockByBand[firstBandId][resource.id] = 1;
    api.state.campaign.productionMonthlyByBand[firstBandId][resource.id] = 31;
  }
  api.state.campaign.startDate = "2026-07-01";
  api.state.campaign.maxSimulationDays = 5;
  api.state.campaign.allocationMode = "sequential";
  api.state.campaign.commandCapacityPerDay = 2;
  const run = api.recalculateCampaign();
  assert.ok(run.days.length >= 1);
  assert.equal(api.els.exportCampaignTimelineCsvBtn.disabled, false);
  assert.equal(api.els.exportCampaignTimelineJsonBtn.disabled, false);
  assert.equal(run.days[0].startingStockByResource.resource_a, 1);
  assert.equal(run.days[0].startingStockByBandResource[firstBandId].resource_a, 1);
  assert.equal(run.days[0].productionByResource.resource_a, 1);
  assert.equal(run.days[0].productionByBandResource[firstBandId].resource_a, 1);
  assert.ok(run.days[0].endingStockByResource.resource_a >= 0);
  assert.ok(Object.values(run.days[0].deferredTargetsByLayer).reduce((a, b) => a + b, 0) >= 1);
  assert.ok(run.days[0].deferredFeatureIds.length >= 1);
  assert.match(api.els.campaignDashboard.innerHTML, /Resources/);
  assert.match(api.els.campaignDashboard.innerHTML, /Layers/);
  assert.match(api.els.campaignDailyTable.innerHTML, /Requested delta/);
  assert.match(api.buildCampaignTimelineCsv(), /day_index,date,range_band_id,range_band_label,layer_id,layer_label/);
  const timelineJson = api.buildCampaignTimelineJson();
  assert.equal(timelineJson.dailySnapshots.length, run.days.length);
  assert.ok(timelineJson.rangeBandMetadata.length >= 1);
  assert.ok(timelineJson.settings.initialStockByBand[firstBandId]);
});

test("campaign simulation consumes stock only from the matching range band", async () => {
  const app = createAppContext();
  await app.__initPromise;
  const api = app.__api;
  const [shortBandId, midBandId] = api.campaignBandIds();
  api.state.radiusResults = [
    { stored: { id: "short_target", feature: feature("short_target", "Short target", "energy_facilities", "energy_oil_facility", 55.2, 59.1) }, distance: 100 },
    { stored: { id: "mid_target", feature: feature("mid_target", "Mid target", "energy_facilities", "energy_oil_facility", 55.2, 59.2) }, distance: 1000 },
  ];
  api.state.campaign = api.normalizeCampaignSettings({
    startDate: "2026-07-01",
    maxSimulationDays: 1,
    allocationMode: "sequential",
    commandCapacityPerDay: 2,
  });
  api.state.campaign.layerPriorityOrder = ["energy_facilities"];
  for (const resource of api.state.estimator.resources) {
    resource.completionRate = 100;
    api.state.campaign.initialStockByBand[shortBandId][resource.id] = 0;
    api.state.campaign.initialStockByBand[midBandId][resource.id] = 10;
    api.state.campaign.fireCapacityPerDayByBand[shortBandId][resource.id] = 10;
    api.state.campaign.fireCapacityPerDayByBand[midBandId][resource.id] = 10;
  }

  const run = api.recalculateCampaign();
  const day = run.days[0];

  assert.equal(day.deferredTargetsByBand[shortBandId], 1);
  assert.equal(day.executedTargetsByBand[midBandId], 1);
  assert.equal(day.endingStockByBandResource[shortBandId].resource_a, 0);
  assert.equal(day.endingStockByBandResource[midBandId].resource_a, 9);
});

test("campaign simulation applies fire capacity per range band", async () => {
  const app = createAppContext();
  await app.__initPromise;
  const api = app.__api;
  const [shortBandId, midBandId] = api.campaignBandIds();
  api.state.radiusResults = [
    { stored: { id: "short_target", feature: feature("short_target", "Short target", "energy_facilities", "energy_oil_facility", 55.2, 59.1) }, distance: 100 },
  ];
  api.state.campaign = api.normalizeCampaignSettings({
    startDate: "2026-07-01",
    maxSimulationDays: 1,
    allocationMode: "sequential",
    commandCapacityPerDay: 1,
  });
  api.state.campaign.layerPriorityOrder = ["energy_facilities"];
  for (const resource of api.state.estimator.resources) {
    resource.completionRate = 100;
    api.state.campaign.initialStockByBand[shortBandId][resource.id] = 10;
    api.state.campaign.fireCapacityPerDayByBand[shortBandId][resource.id] = 0;
    api.state.campaign.fireCapacityPerDayByBand[midBandId][resource.id] = 10;
  }

  const run = api.recalculateCampaign();
  const day = run.days[0];

  assert.equal(day.executedTargetsByLayer.energy_facilities || 0, 0);
  assert.equal(day.deferredTargetsByBand[shortBandId], 1);
  assert.equal(day.fireCapacityRemainingByBandResource[midBandId].resource_a, 10);
});

test("campaign simulation defers targets when resource penetration is below category hardness", async () => {
  const app = createAppContext();
  await app.__initPromise;
  const api = app.__api;
  const bandId = configureSingleTargetCampaign(api);
  api.state.estimator.categoryHardness.energy_facilities = 5;
  for (const resource of api.state.estimator.resources) {
    resource.penetration = resource.id === "resource_a" ? 4 : 6;
    setCampaignBandResource(api, bandId, resource.id, 10, 10);
  }

  const day = api.recalculateCampaign().days[0];

  assert.equal(day.executedTargetsByLayer.energy_facilities || 0, 0);
  assert.equal(day.deferredTargetsByLayer.energy_facilities, 1);
  assert.equal(day.expendedByBandResource[bandId].resource_a, 0);
  assert.equal(day.endingStockByBandResource[bandId].resource_a, 10);
});

test("campaign substitution only uses resources that meet target hardness", async () => {
  const app = createAppContext();
  await app.__initPromise;
  const api = app.__api;
  const bandId = configureSingleTargetCampaign(api, {
    resourceSubstitution: {
      enabled: true,
      mode: "priority",
      preserveRangeBand: true,
      substitutePriorityOrder: ["resource_b", "resource_c"],
      substituteWeights: {},
    },
  });
  api.state.estimator.categoryHardness.energy_facilities = 5;
  api.state.estimator.resources.find((resource) => resource.id === "resource_a").penetration = 4;
  api.state.estimator.resources.find((resource) => resource.id === "resource_b").penetration = 3;
  api.state.estimator.resources.find((resource) => resource.id === "resource_c").penetration = 6;
  setCampaignBandResource(api, bandId, "resource_a", 10, 10);
  setCampaignBandResource(api, bandId, "resource_b", 10, 10);
  setCampaignBandResource(api, bandId, "resource_c", 10, 10);

  const day = api.recalculateCampaign().days[0];

  assert.equal(day.executedTargetsByLayer.energy_facilities, 1);
  assert.equal(day.expendedByBandResource[bandId].resource_a, 0);
  assert.equal(day.expendedByBandResource[bandId].resource_b, 0);
  assert.equal(day.expendedByBandResource[bandId].resource_c, 3);
  assert.equal(day.substitutionByBandResource[bandId].resource_a.substitutedOut, 1);
  assert.equal(day.substitutionByBandResource[bandId].resource_b.substitutedOut, 1);
  assert.equal(day.substitutionByBandResource[bandId].resource_c.substitutedIn, 2);
});

test("campaign substitution disabled preserves strict resource availability behavior", async () => {
  const app = createAppContext();
  await app.__initPromise;
  const api = app.__api;
  const bandId = configureSingleTargetCampaign(api);
  setCampaignBandResource(api, bandId, "resource_a", 0, 10);
  setCampaignBandResource(api, bandId, "resource_b", 10, 10);
  setCampaignBandResource(api, bandId, "resource_c", 10, 10);

  const run = api.recalculateCampaign();
  const day = run.days[0];

  assert.equal(day.executedTargetsByLayer.energy_facilities || 0, 0);
  assert.equal(day.deferredTargetsByLayer.energy_facilities, 1);
  assert.equal(day.endingStockByBandResource[bandId].resource_b, 10);
  assert.equal(day.substitutionByBandResource[bandId].resource_a.substitutedOut, 0);
});

test("campaign daily timeline requested delta only displays deficits", async () => {
  const app = createAppContext();
  await app.__initPromise;
  const api = app.__api;
  const bandId = configureSingleTargetCampaign(api);
  setCampaignBandResource(api, bandId, "resource_a", 10, 10);
  setCampaignBandResource(api, bandId, "resource_b", 0, 10);
  setCampaignBandResource(api, bandId, "resource_c", 10, 10);

  const day = api.recalculateCampaign().days[0];

  assert.equal(day.requestedSupplyDeltaByBandResource[bandId].resource_a, 9);
  assert.equal(day.requestedSupplyDeltaByBandResource[bandId].resource_b, -1);
  assert.equal(day.requestedSupplyDeltaByBandResource[bandId].resource_c, 9);
  assert.match(api.els.campaignDailyTable.innerHTML, /Resource B: -1/);
  assert.doesNotMatch(api.els.campaignDailyTable.innerHTML, /Resource A: 9/);
  assert.doesNotMatch(api.els.campaignDailyTable.innerHTML, /Resource C: 9/);
});

test("campaign dashboard requested delta nullifies positive surpluses", async () => {
  const app = createAppContext();
  await app.__initPromise;
  const api = app.__api;
  const bandId = configureSingleTargetCampaign(api);
  setCampaignBandResource(api, bandId, "resource_a", 10, 10);
  setCampaignBandResource(api, bandId, "resource_b", 0, 10);
  setCampaignBandResource(api, bandId, "resource_c", 10, 10);

  const day = api.recalculateCampaign().days[0];

  assert.equal(day.requestedSupplyDeltaByBandResource[bandId].resource_a, 9);
  assert.equal(day.requestedSupplyDeltaByBandResource[bandId].resource_b, -1);
  assert.equal(day.requestedSupplyDeltaByBandResource[bandId].resource_c, 9);

  const requestedDeltaByResource = Object.fromEntries(
    [...api.els.campaignDashboard.innerHTML.matchAll(/<tr><td>[^<]+<br><small>([^<]+)<\/small><\/td><td>(Resource [ABC])<\/td><td>[^<]*<\/td><td>[^<]*<\/td><td>[^<]*<\/td><td>[^<]*<\/td><td>[^<]*<\/td><td>[^<]*<\/td><td>([^<]*)<\/td>/g)]
      .filter(([, rowBandId]) => rowBandId === bandId)
      .map(([, , resource, requestedDelta]) => [resource, requestedDelta])
  );

  assert.equal(requestedDeltaByResource["Resource A"], "0");
  assert.equal(requestedDeltaByResource["Resource B"], "-1");
  assert.equal(requestedDeltaByResource["Resource C"], "0");
});

test("campaign priority substitution executes with substitute stock and tracks notes", async () => {
  const app = createAppContext();
  await app.__initPromise;
  const api = app.__api;
  const bandId = configureSingleTargetCampaign(api, {
    resourceSubstitution: {
      enabled: true,
      mode: "priority",
      preserveRangeBand: true,
      substitutePriorityOrder: ["resource_b", "resource_c"],
      substituteWeights: {},
    },
  });
  setCampaignBandResource(api, bandId, "resource_a", 0, 10);
  setCampaignBandResource(api, bandId, "resource_b", 2, 2);
  setCampaignBandResource(api, bandId, "resource_c", 1, 1);

  const run = api.recalculateCampaign();
  const day = run.days[0];

  assert.equal(day.executedTargetsByLayer.energy_facilities, 1);
  assert.equal(day.endingStockByBandResource[bandId].resource_a, 0);
  assert.equal(day.endingStockByBandResource[bandId].resource_b, 0);
  assert.equal(day.substitutionByBandResource[bandId].resource_a.substitutedOut, 1);
  assert.equal(day.substitutionByBandResource[bandId].resource_b.substitutedIn, 1);
  assert.match(day.notes.join("\n"), /Substituted 1 Resource A demand with Resource B/);
});

test("campaign costs charge actual expended substituted resources", async () => {
  const app = createAppContext();
  await app.__initPromise;
  const api = app.__api;
  const bandId = configureSingleTargetCampaign(api, {
    resourceSubstitution: {
      enabled: true,
      mode: "priority",
      preserveRangeBand: true,
      substitutePriorityOrder: ["resource_b", "resource_c"],
      substituteWeights: {},
    },
  });
  setCampaignBandResource(api, bandId, "resource_a", 0, 10);
  setCampaignBandResource(api, bandId, "resource_b", 2, 2);
  setCampaignBandResource(api, bandId, "resource_c", 1, 1);
  api.state.campaign.resourceUnitCostByBand[bandId].resource_a = 100;
  api.state.campaign.resourceUnitCostByBand[bandId].resource_b = 5;

  const run = api.recalculateCampaign();
  const json = api.buildCampaignTimelineJson();
  const csv = api.buildCampaignTimelineCsv();

  assert.equal(run.days[0].expendedByBandResource[bandId].resource_a, 0);
  assert.equal(run.days[0].expendedByBandResource[bandId].resource_b, 2);
  assert.equal(json.dailySnapshots[0].costByBandResource[bandId].resource_a, 0);
  assert.equal(json.dailySnapshots[0].costByBandResource[bandId].resource_b, 10);
  assert.equal(json.summary.totalCost, 10);
  assert.match(api.els.campaignDashboard.innerHTML, /Total cost/);
  assert.match(api.els.campaignDashboard.innerHTML, />10<\/td>/);
  assert.match(api.els.campaignDailyTable.innerHTML, /Range\/resource cost/);
  assert.match(csv, /unit_cost,cost/);
  assert.match(csv, /resource_b,Resource B,[^\r\n]*,5,10,/);
});

test("campaign weighted substitution distributes and redistributes by capacity", async () => {
  const app = createAppContext();
  await app.__initPromise;
  const api = app.__api;
  let bandId = configureSingleTargetCampaign(api, {
    requirement: 10,
    resourceSubstitution: {
      enabled: true,
      mode: "weighted",
      preserveRangeBand: true,
      substitutePriorityOrder: [],
      substituteWeights: { resource_b: 70, resource_c: 30 },
    },
  });
  setCampaignBandResource(api, bandId, "resource_a", 0, 10);
  setCampaignBandResource(api, bandId, "resource_b", 17, 17);
  setCampaignBandResource(api, bandId, "resource_c", 13, 13);

  let day = api.recalculateCampaign().days[0];
  assert.equal(day.executedTargetsByLayer.energy_facilities, 1);
  assert.equal(day.substitutionByBandResource[bandId].resource_b.substitutedIn, 7);
  assert.equal(day.substitutionByBandResource[bandId].resource_c.substitutedIn, 3);
  assert.equal(day.substitutionByBandResource[bandId].resource_a.substitutedOut, 10);

  bandId = configureSingleTargetCampaign(api, {
    requirement: 10,
    resourceSubstitution: {
      enabled: true,
      mode: "weighted",
      preserveRangeBand: true,
      substitutePriorityOrder: [],
      substituteWeights: { resource_b: 70, resource_c: 30 },
    },
  });
  setCampaignBandResource(api, bandId, "resource_a", 0, 10);
  setCampaignBandResource(api, bandId, "resource_b", 15, 15);
  setCampaignBandResource(api, bandId, "resource_c", 25, 25);

  day = api.recalculateCampaign().days[0];
  assert.equal(day.substitutionByBandResource[bandId].resource_b.substitutedIn, 5);
  assert.equal(day.substitutionByBandResource[bandId].resource_c.substitutedIn, 5);
  const totalIn = day.substitutionByBandResource[bandId].resource_b.substitutedIn + day.substitutionByBandResource[bandId].resource_c.substitutedIn;
  assert.equal(totalIn, day.substitutionByBandResource[bandId].resource_a.substitutedOut);
});

test("campaign split-evenly substitution spreads deficit without exceeding capacity", async () => {
  const app = createAppContext();
  await app.__initPromise;
  const api = app.__api;
  const bandId = configureSingleTargetCampaign(api, {
    requirement: 5,
    resourceSubstitution: {
      enabled: true,
      mode: "split_evenly",
      preserveRangeBand: true,
      substitutePriorityOrder: [],
      substituteWeights: {},
    },
  });
  setCampaignBandResource(api, bandId, "resource_a", 0, 5);
  setCampaignBandResource(api, bandId, "resource_b", 8, 8);
  setCampaignBandResource(api, bandId, "resource_c", 8, 8);

  const day = api.recalculateCampaign().days[0];
  const bIn = day.substitutionByBandResource[bandId].resource_b.substitutedIn;
  const cIn = day.substitutionByBandResource[bandId].resource_c.substitutedIn;

  assert.equal(day.executedTargetsByLayer.energy_facilities, 1);
  assert.equal(bIn, 2.5);
  assert.equal(cIn, 2.5);
  assert.equal(bIn + cIn, day.substitutionByBandResource[bandId].resource_a.substitutedOut);
  assert.ok(day.endingStockByBandResource[bandId].resource_b >= 0);
  assert.ok(day.fireCapacityRemainingByBandResource[bandId].resource_c >= 0);
});

test("campaign substitution deferral is atomic when substitutes cannot cover deficit", async () => {
  const app = createAppContext();
  await app.__initPromise;
  const api = app.__api;
  const bandId = configureSingleTargetCampaign(api, {
    requirement: 5,
    resourceSubstitution: {
      enabled: true,
      mode: "priority",
      preserveRangeBand: true,
      substitutePriorityOrder: ["resource_b", "resource_c"],
      substituteWeights: {},
    },
  });
  setCampaignBandResource(api, bandId, "resource_a", 0, 5);
  setCampaignBandResource(api, bandId, "resource_b", 7, 7);
  setCampaignBandResource(api, bandId, "resource_c", 7, 7);

  const day = api.recalculateCampaign().days[0];

  assert.equal(day.executedTargetsByLayer.energy_facilities || 0, 0);
  assert.equal(day.deferredTargetsByLayer.energy_facilities, 1);
  assert.equal(day.endingStockByBandResource[bandId].resource_a, 0);
  assert.equal(day.endingStockByBandResource[bandId].resource_b, 7);
  assert.equal(day.endingStockByBandResource[bandId].resource_c, 7);
  assert.equal(day.fireCapacityRemainingByBandResource[bandId].resource_b, 7);
  assert.equal(day.expendedByBandResource[bandId].resource_b, 0);
  assert.equal(day.substitutionByBandResource[bandId].resource_b.substitutedIn, 0);
});

test("campaign substitution preserves range band supply by default", async () => {
  const app = createAppContext();
  await app.__initPromise;
  const api = app.__api;
  const [shortBandId, midBandId] = api.campaignBandIds();
  configureSingleTargetCampaign(api, {
    resourceSubstitution: {
      enabled: true,
      mode: "priority",
      preserveRangeBand: true,
      substitutePriorityOrder: ["resource_b", "resource_c"],
      substituteWeights: {},
    },
  });
  setCampaignBandResource(api, shortBandId, "resource_a", 0, 1);
  setCampaignBandResource(api, shortBandId, "resource_b", 0, 1);
  setCampaignBandResource(api, shortBandId, "resource_c", 1, 1);
  setCampaignBandResource(api, midBandId, "resource_b", 10, 10);

  const day = api.recalculateCampaign().days[0];

  assert.equal(day.executedTargetsByLayer.energy_facilities || 0, 0);
  assert.equal(day.deferredTargetsByBand[shortBandId], 1);
  assert.equal(day.endingStockByBandResource[midBandId].resource_b, 10);
});

test("campaign timeline exports include substitution data and settings", async () => {
  const app = createAppContext();
  await app.__initPromise;
  const api = app.__api;
  const bandId = configureSingleTargetCampaign(api, {
    resourceSubstitution: {
      enabled: true,
      mode: "priority",
      preserveRangeBand: true,
      substitutePriorityOrder: ["resource_b", "resource_c"],
      substituteWeights: {},
    },
  });
  setCampaignBandResource(api, bandId, "resource_a", 0, 10);
  setCampaignBandResource(api, bandId, "resource_b", 2, 2);
  setCampaignBandResource(api, bandId, "resource_c", 1, 1);
  api.recalculateCampaign();

  const csv = api.buildCampaignTimelineCsv();
  const json = api.buildCampaignTimelineJson();

  assert.match(csv, /substituted_in,substituted_out/);
  assert.ok(json.dailySnapshots[0].substitutionByBandResource);
  assert.ok(json.dailySnapshots[0].substitutionByLayerBandResource);
  assert.equal(json.settings.resourceSubstitution.enabled, true);
});

test("campaign profile import validates payloads and accepts wrapped settings", async () => {
  const app = createAppContext();
  await app.__initPromise;
  const api = app.__api;
  const originalStartDate = api.state.campaign.startDate;
  assert.throws(() => api.importCampaignProfileFromText(JSON.stringify({ notCampaign: true })), /campaign settings/);
  assert.equal(api.state.campaign.startDate, originalStartDate);
  api.importCampaignProfileFromText(JSON.stringify({ campaign: { startDate: "2026-07-01", commandCapacityPerDay: 12 } }));
  assert.equal(api.state.campaign.startDate, "2026-07-01");
  assert.equal(api.state.campaign.commandCapacityPerDay, 12);
  const firstBandId = api.campaignBandIds()[0];
  api.importCampaignProfileFromText(JSON.stringify({ campaign: { initialStock: { resource_a: 44 }, productionMonthly: { resource_a: 31 }, fireCapacityPerDay: { resource_a: 3 } } }));
  assert.equal(api.state.campaign.initialStockByBand[firstBandId].resource_a, 44);
  assert.equal(api.state.campaign.productionMonthlyByBand[firstBandId].resource_a, 31);
  assert.equal(api.state.campaign.fireCapacityPerDayByBand[firstBandId].resource_a, 3);
  api.importCampaignProfileFromText(JSON.stringify({ campaign: { resourceUnitCost: { resource_a: 99 } } }));
  assert.equal(api.state.campaign.resourceUnitCostByBand[firstBandId].resource_a, 99);
  api.importCampaignProfileFromText(JSON.stringify({ campaign: { resourceSubstitution: { enabled: true, mode: "priority", preserveRangeBand: true, substitutePriorityOrder: ["resource_b"] } } }));
  assert.equal(api.state.campaign.resourceSubstitution.enabled, true);
  assert.equal(api.state.campaign.resourceSubstitution.mode, "priority");
  assert.deepEqual(JSON.parse(JSON.stringify(api.state.campaign.resourceSubstitution.substitutePriorityOrder)), ["resource_b", "resource_a", "resource_c"]);
});

test("campaign player tab switching and map status overlay update run state", async () => {
  const app = createAppContext();
  await app.__initPromise;
  const api = app.__api;
  api.renderRadiusResults({ lat: 55.75, lng: 37.61 }, 5000);
  const firstBandId = api.campaignBandIds()[0];
  for (const resource of api.state.estimator.resources) {
    resource.completionRate = 100;
    api.state.campaign.fireCapacityPerDayByBand[firstBandId][resource.id] = 100;
    api.state.campaign.initialStockByBand[firstBandId][resource.id] = 100;
  }
  api.state.campaign.commandCapacityPerDay = 1;
  api.recalculateCampaign();
  api.stepCampaign(1);
  assert.equal(api.state.campaignRun.currentDayIndex, Math.min(1, api.state.campaignRun.days.length - 1));
  api.stepCampaign(-1);
  assert.equal(api.state.campaignRun.currentDayIndex, 0);
  api.playCampaign();
  assert.equal(api.state.campaignRun.playing, true);
  assert.match(api.els.campaignPlayer.innerHTML, />Pause<\/button>/);
  api.setSelectedTab("map");
  assert.equal(api.state.campaignRun.playing, false);
  assert.match(api.els.campaignPlayer.innerHTML, />Play<\/button>/);
  api.setCampaignDay(0);
  assert.ok(api.state.campaignStatusGroup.getLayers().length > 0);
  api.resetCampaignPlayback();
  assert.equal(api.state.campaignRun.days.length, 0);
  assert.equal(api.state.campaignRun.currentDayIndex, -1);
  assert.match(api.els.campaignDailyTable.innerHTML, /Run simulation to build the daily timeline/);
  assert.match(api.els.campaignDashboard.innerHTML, /Run simulation to see the campaign dashboard/);
  assert.equal(api.els.exportCampaignTimelineCsvBtn.disabled, true);
  api.renderCampaignMapStatus();
  assert.equal(api.state.campaignStatusGroup.getLayers().length, 0);
});
