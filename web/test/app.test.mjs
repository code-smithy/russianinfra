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
  currentPreferences,
  featureDistanceToPointKm,
  featurePassesActiveFilters,
  groupedLayerInfos,
  handleSubcategoryChange,
  manualFeature,
  metersKm,
  savePreferencesNow,
  setCountriesPanelCollapsed,
  setLayersPanelCollapsed,
  selectFeature
};`
);

const manifest = {
  total_features: 2,
  countries: [
    { id: "Russia", label: "Russia", count: 1, point_count: 1 },
    { id: "Ukraine", label: "Ukraine", count: 1, point_count: 1 },
  ],
  layers: [
    {
      id: "energy_facilities",
      label: "Oil/Gas Facilities",
      file: "energy_facilities.geojson",
      files: ["energy_facilities.geojson"],
      count: 1,
      subcategories: [
        { id: "energy_oil_facility", label: "Oil facility", count: 1 },
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
    ],
  },
  "data/military_sites.geojson": {
    type: "FeatureCollection",
    features: [
      feature("fixture_military_1", "Bravo Site", "military_sites", "military_other", 56.2, 60.1, "Ukraine"),
    ],
  },
};

test("persists UI choices and restores them on the next app load", async () => {
  const first = createAppContext();
  await first.__initPromise;

  const api = first.__api;
  api.state.layerControls.get("military_sites").checked = true;
  api.state.activeSlot = "B";
  api.els.searchInput.value = "Alpha";
  api.els.manualPanel.hidden = false;
  api.selectFeature("A", api.manualFeature("A", 55.1, 59.2), { lat: 55.1, lng: 59.2 });
  api.savePreferencesNow();

  const savedRaw = first.localStorage.getItem(STORAGE_KEY);
  const saved = JSON.parse(savedRaw);

  assert.equal(saved.activeSlot, "B");
  assert.equal(saved.layers.military_sites, true);
  assert.equal(saved.search, "Alpha");
  assert.equal(saved.manualPanelOpen, true);
  assert.equal(saved.selections.A.type, "manual");

  const second = createAppContext({ [STORAGE_KEY]: savedRaw });
  await second.__initPromise;

  const restored = second.__api;
  assert.equal(restored.state.activeSlot, "B");
  assert.equal(restored.els.searchInput.value, "Alpha");
  assert.equal(restored.els.manualPanel.hidden, false);
  assert.equal(restored.state.layerControls.get("military_sites").checked, true);
  assert.equal(restored.state.selections.A.feature.properties.source_dataset, "Manual selection");
  assert.equal(restored.state.selections.A.point.lat, 55.1);
  assert.equal(restored.state.selections.A.point.lng, 59.2);
});

test("restores saved feature selections after their layers load", async () => {
  const savedPreferences = {
    version: 1,
    activeSlot: "A",
    baseLayer: "dark",
    mapView: { lat: 54, lng: 58, zoom: 6 },
    layers: {
      energy_facilities: true,
      military_sites: true,
    },
    subcategories: {
      energy_facilities: ["energy_oil_facility", "unknown_subcategory"],
      military_sites: ["military_other"],
    },
    search: "Bravo",
    manualPanelOpen: false,
    manualInputs: {},
    selections: {
      A: {
        type: "feature",
        id: "fixture_energy_1",
        layerId: "energy_facilities",
        point: { lat: 55.2, lng: 59.1 },
      },
      B: null,
    },
    radius: null,
  };

  const app = createAppContext({ [STORAGE_KEY]: JSON.stringify(savedPreferences) });
  await app.__initPromise;

  const api = app.__api;
  const energySubcategories = [...api.state.subcategoryFilters.get("energy_facilities")];

  assert.equal(api.currentPreferences().baseLayer, "dark");
  assert.equal(api.state.selections.A.feature.id, "fixture_energy_1");
  assert.equal(api.state.selections.A.point.lat, 55.2);
  assert.deepEqual(energySubcategories, ["energy_oil_facility"]);
  assert.equal(api.els.searchInput.value, "Bravo");
});

test("syncs category checkboxes with subcategories and saves collapsed state", async () => {
  const app = createAppContext();
  await app.__initPromise;

  const api = app.__api;
  const parent = api.state.layerControls.get("energy_facilities");
  const subcategories = api.state.layerSubcategoryControls.get("energy_facilities");
  const collapseButton = api.state.layerCollapseControls.get("energy_facilities");
  assert.equal(collapseButton.innerHTML, `<span aria-hidden="true"></span>`);

  subcategories[1].checked = false;
  await api.handleSubcategoryChange(manifest.layers[0], new FakeElement("row"));

  assert.equal(parent.checked, false);
  assert.equal(parent.indeterminate, true);
  assert.deepEqual([...api.state.subcategoryFilters.get("energy_facilities")], ["energy_oil_facility"]);
  assert.equal(api.currentPreferences().layers.energy_facilities, true);

  parent.checked = true;
  parent.listeners.change[0]();

  assert.equal(parent.checked, true);
  assert.equal(parent.indeterminate, false);
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

  app.__api.els.clearCountriesBtn.listeners.click[0]();

  assert.equal(app.__api.currentPreferences().countries.length, 0);
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

test("harmonizes layer colors by category family", async () => {
  const app = createAppContext();
  await app.__initPromise;

  assert.equal(app.__api.colorForLayer("military_sites"), "#2f78ff");
  assert.equal(app.__api.colorForLayer("military_boundaries"), "#9ac4ff");
  assert.equal(app.__api.colorForLayer("power_facilities"), "#ffd34d");
  assert.equal(app.__api.colorForLayer("power_lines"), "#ffac12");
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

  function layer() {
    return {
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
      setIcon() {
        return this;
      },
      setLatLng() {
        return this;
      },
      setLatLngs() {
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
    marker: layer,
    markerClusterGroup: () => Object.assign(layer(), { addLayer() {} }),
    polyline: layer,
    tileLayer: layer,
  };
}
