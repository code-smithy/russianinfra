const DATA_DIR = "data/";
const STORAGE_KEY = "infrastructureExplorer.preferences.v1";
const LAYER_GROUPS = [
  { id: "military", label: "Military" },
  { id: "oil_gas", label: "Oil/Gas" },
  { id: "transport", label: "Transport" },
  { id: "power", label: "Power" },
  { id: "other", label: "Other" },
];

const state = {
  manifest: null,
  layers: new Map(),
  features: new Map(),
  subcategoryFilters: new Map(),
  layerControls: new Map(),
  layerSubcategoryControls: new Map(),
  layerCollapseControls: new Map(),
  countryFilters: new Set(),
  countryControls: new Map(),
  savedPreferences: loadSavedPreferences(),
  persistenceReady: false,
  saveTimer: null,
  activeSlot: "A",
  selections: { A: null, B: null },
  selectionMarkers: { A: null, B: null },
  radiusMode: false,
  radiusStart: null,
  radiusOrigin: null,
  radiusKm: null,
  radiusCircle: null,
  radiusLine: null,
  radiusLabel: null,
  radiusHighlightGroup: null,
  radiusResults: [],
};

const map = L.map("map", {
  preferCanvas: true,
  worldCopyJump: true,
  zoomControl: true,
}).setView([58.5, 58], 4);

const lightTiles = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 18,
  attribution: "&copy; OpenStreetMap",
});

const darkTiles = L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
  maxZoom: 20,
  subdomains: "abcd",
  attribution: "&copy; OpenStreetMap &copy; CARTO",
});

let activeBaseLayer = state.savedPreferences?.baseLayer === "dark" ? "dark" : "light";
(activeBaseLayer === "dark" ? darkTiles : lightTiles).addTo(map);
L.control.layers({ Light: lightTiles, Dark: darkTiles }, {}, { collapsed: true }).addTo(map);
state.radiusHighlightGroup = L.layerGroup().addTo(map);

const els = {
  datasetSummary: document.getElementById("datasetSummary"),
  layersList: document.getElementById("layersList"),
  loadedCount: document.getElementById("loadedCount"),
  searchInput: document.getElementById("searchInput"),
  searchResults: document.getElementById("searchResults"),
  selectionA: document.getElementById("selectionA"),
  selectionB: document.getElementById("selectionB"),
  distancePanel: document.getElementById("distancePanel"),
  loadingToast: document.getElementById("loadingToast"),
  countriesCount: document.getElementById("countriesCount"),
  countriesList: document.getElementById("countriesList"),
  layersPanel: document.getElementById("layersPanel"),
  layersPanelBody: document.getElementById("layersPanelBody"),
  layersPanelToggle: document.getElementById("layersPanelToggle"),
  slotABtn: document.getElementById("slotABtn"),
  slotBBtn: document.getElementById("slotBBtn"),
  clearSelectionBtn: document.getElementById("clearSelectionBtn"),
  clearLayersBtn: document.getElementById("clearLayersBtn"),
  fitLoadedBtn: document.getElementById("fitLoadedBtn"),
  nearestBtn: document.getElementById("nearestBtn"),
  nearestResults: document.getElementById("nearestResults"),
  manualToggleBtn: document.getElementById("manualToggleBtn"),
  manualPanel: document.getElementById("manualPanel"),
  manualALat: document.getElementById("manualALat"),
  manualALng: document.getElementById("manualALng"),
  manualBLat: document.getElementById("manualBLat"),
  manualBLng: document.getElementById("manualBLng"),
  manualASetBtn: document.getElementById("manualASetBtn"),
  manualBSetBtn: document.getElementById("manualBSetBtn"),
  radiusModeBtn: document.getElementById("radiusModeBtn"),
  radiusPanel: document.getElementById("radiusPanel"),
  radiusSummary: document.getElementById("radiusSummary"),
  radiusResults: document.getElementById("radiusResults"),
  exportRadiusBtn: document.getElementById("exportRadiusBtn"),
  resetRadiusBtn: document.getElementById("resetRadiusBtn"),
};

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[char]);
}

function loadSavedPreferences() {
  try {
    const raw = window.localStorage?.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (error) {
    console.warn("Could not read saved preferences.", error);
    return null;
  }
}

function storedPoint(value) {
  const lat = Number(value?.lat ?? value?.[0]);
  const lng = Number(value?.lng ?? value?.[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

function savedLayerVisible(layerInfo) {
  const layers = state.savedPreferences?.layers;
  if (layers && Object.prototype.hasOwnProperty.call(layers, layerInfo.id)) {
    return layers[layerInfo.id] === true;
  }
  return !!layerInfo.default_visible;
}

function savedSubcategorySet(layerInfo) {
  const subcategories = Array.isArray(layerInfo.subcategories) ? layerInfo.subcategories : [];
  const validIds = new Set(subcategories.map((item) => item.id));
  const saved = state.savedPreferences?.subcategories?.[layerInfo.id];
  if (Array.isArray(saved)) {
    return new Set(saved.filter((id) => validIds.has(id)));
  }
  return new Set(subcategories.map((item) => item.id));
}

function savedLayerCollapsed(layerId) {
  const collapsedLayers = state.savedPreferences?.collapsedLayers;
  return Array.isArray(collapsedLayers) && collapsedLayers.includes(layerId);
}

function savedCountrySet() {
  const countries = Array.isArray(state.manifest?.countries) ? state.manifest.countries : [];
  const validIds = new Set(countries.map((country) => country.id));
  const saved = state.savedPreferences?.countries;
  if (Array.isArray(saved)) {
    return new Set(saved.filter((country) => validIds.has(country)));
  }
  return new Set(countries.map((country) => country.id));
}

function serializeSelection(slot) {
  const selection = state.selections[slot];
  if (!selection?.point) return null;
  const point = { lat: selection.point.lat, lng: selection.point.lng };
  const p = selection.feature.properties || {};
  if (p.source_dataset === "Manual selection") {
    return { type: "manual", point };
  }
  return {
    type: "feature",
    id: selection.feature.id,
    layerId: p.map_layer || null,
    point,
  };
}

function serializeRadius() {
  if (!state.radiusOrigin || !Number.isFinite(state.radiusKm)) return null;
  return {
    origin: { lat: state.radiusOrigin.lat, lng: state.radiusOrigin.lng },
    radiusKm: state.radiusKm,
  };
}

function currentPreferences() {
  const center = map.getCenter();
  const layers = {};
  const subcategories = {};
  const collapsedLayers = [];
  for (const layerInfo of state.manifest?.layers || []) {
    const checkbox = state.layerControls.get(layerInfo.id);
    layers[layerInfo.id] = checkbox ? checkbox.checked || checkbox.indeterminate : !!state.layers.get(layerInfo.id)?.visible;
    const enabled = state.subcategoryFilters.get(layerInfo.id);
    if (enabled) subcategories[layerInfo.id] = [...enabled];
    const collapseButton = state.layerCollapseControls.get(layerInfo.id);
    if (collapseButton?.getAttribute("aria-expanded") === "false") collapsedLayers.push(layerInfo.id);
  }

  return {
    version: 1,
    activeSlot: state.activeSlot,
    baseLayer: activeBaseLayer,
    mapView: { lat: center.lat, lng: center.lng, zoom: map.getZoom() },
    layers,
    layersPanelCollapsed: els.layersPanelBody.hidden,
    collapsedLayers,
    countries: [...state.countryFilters],
    subcategories,
    search: els.searchInput.value,
    manualPanelOpen: !els.manualPanel.hidden,
    manualInputs: {
      aLat: els.manualALat.value,
      aLng: els.manualALng.value,
      bLat: els.manualBLat.value,
      bLng: els.manualBLng.value,
    },
    selections: {
      A: serializeSelection("A"),
      B: serializeSelection("B"),
    },
    radius: serializeRadius(),
  };
}

function savePreferencesNow() {
  if (!state.persistenceReady || !state.manifest) return;
  if (state.saveTimer) {
    window.clearTimeout(state.saveTimer);
    state.saveTimer = null;
  }
  try {
    window.localStorage?.setItem(STORAGE_KEY, JSON.stringify(currentPreferences()));
  } catch (error) {
    console.warn("Could not save preferences.", error);
  }
}

function queueSavePreferences() {
  if (!state.persistenceReady) return;
  if (state.saveTimer) window.clearTimeout(state.saveTimer);
  state.saveTimer = window.setTimeout(savePreferencesNow, 120);
}

function numberFmt(value, digits = 1) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function metersKm(a, b) {
  const radius = 6371.0088;
  const toRad = (deg) => deg * Math.PI / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * radius * Math.asin(Math.min(1, Math.sqrt(h)));
}

function bearing(a, b) {
  const toRad = (deg) => deg * Math.PI / 180;
  const toDeg = (rad) => rad * 180 / Math.PI;
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLng = toRad(b.lng - a.lng);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function iterGeometryPositions(geometry) {
  const positions = [];
  function walk(node) {
    if (Array.isArray(node) && node.length >= 2 && Number.isFinite(Number(node[0])) && Number.isFinite(Number(node[1]))) {
      positions.push({ lng: Number(node[0]), lat: Number(node[1]) });
      return;
    }
    if (Array.isArray(node)) node.forEach(walk);
  }
  if (geometry?.coordinates) walk(geometry.coordinates);
  return positions;
}

function featureDistanceToPointKm(feature, point) {
  const candidates = [];
  const p = featurePoint(feature);
  if (p) candidates.push(p);
  candidates.push(...iterGeometryPositions(feature.geometry));
  if (!candidates.length) return Infinity;
  let best = Infinity;
  for (const candidate of candidates) {
    best = Math.min(best, metersKm(point, candidate));
  }
  return best;
}

function featurePoint(feature, fallbackLatLng) {
  if (fallbackLatLng) return { lat: fallbackLatLng.lat, lng: fallbackLatLng.lng };
  const p = feature.properties || {};
  const lat = Number(p.map_latitude);
  const lng = Number(p.map_longitude);
  if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  return null;
}

function layerColor(properties) {
  return properties.map_color || "#999999";
}

function markerIcon(properties) {
  const color = layerColor(properties);
  return L.divIcon({
    className: "",
    html: `<span class="point-marker" style="background:${escapeHtml(color)}"></span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

function styleFeature(feature) {
  const p = feature.properties || {};
  return {
    color: layerColor(p),
    weight: p.asset_type === "railway" ? 1.5 : 2.4,
    opacity: p.asset_type === "railway" ? 0.55 : 0.8,
  };
}

function detailRows(properties) {
  const rows = [
    ["Type", [properties.asset_class, properties.asset_type].filter(Boolean).join(" / ")],
    ["Source", properties.source_dataset],
    ["Layer", properties.source_layer],
    ["Category", properties.derived_subcategory_label],
    ["Translated", properties.name_translated],
    ["Description", properties.description],
    ["Description EN", properties.description_translated],
    ["Operator", properties.operator],
    ["Product", properties.product],
    ["INN", properties.inn],
    ["Region", properties.region],
    ["Region EN", properties.region_translated],
    ["Sanctioned", properties.is_sanctioned],
    ["Location", properties.location_quality],
    ["Length", properties.length_km ? `${numberFmt(properties.length_km, 2)} km` : ""],
    ["Coords", properties.map_latitude && properties.map_longitude ? `${numberFmt(properties.map_latitude, 5)}, ${numberFmt(properties.map_longitude, 5)}` : ""],
  ].filter(([, value]) => value !== "" && value != null);
  return rows.map(([key, value]) => `<dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value)}</dd>`).join("");
}

function popupHtml(feature) {
  const p = feature.properties || {};
  const id = escapeHtml(feature.id);
  const source = p.source_url
    ? `<a href="${escapeHtml(p.source_url)}" target="_blank" rel="noopener">source</a>`
    : "";
  return `
    <h3 class="popup-title">${escapeHtml(p.display_label || p.name || "Unnamed feature")}</h3>
    <dl class="popup-table">${detailRows(p)}</dl>
    ${source ? `<div style="margin-top:8px;font-size:12px">${source}</div>` : ""}
    <div class="popup-actions">
      <button type="button" data-select-slot="A" data-feature-id="${id}">Set A</button>
      <button type="button" data-select-slot="B" data-feature-id="${id}">Set B</button>
    </div>
  `;
}

function rememberFeature(feature, latlng) {
  const point = featurePoint(feature, latlng);
  const stored = {
    id: feature.id,
    feature,
    point,
    layer: null,
  };
  state.features.set(feature.id, stored);
  return stored;
}

function wirePopupSelection(layer, feature) {
  layer.on("popupopen", (event) => {
    const node = event.popup.getElement();
    if (!node) return;
    node.querySelectorAll("[data-select-slot]").forEach((button) => {
      button.addEventListener("click", () => {
        const slot = button.getAttribute("data-select-slot");
        selectFeature(slot, feature, event.popup.getLatLng());
        map.closePopup();
      });
    });
  });
}

function onFeatureClick(feature, layer, event) {
  const latlng = event?.latlng || featurePoint(feature);
  selectFeature(state.activeSlot, feature, latlng);
  state.activeSlot = state.activeSlot === "A" ? "B" : "A";
  updateSlotButtons();
}

function createLeafletLayer(featureCollection) {
  const cluster = L.markerClusterGroup({
    disableClusteringAtZoom: 9,
    maxClusterRadius: 44,
    showCoverageOnHover: false,
  });
  const lines = L.geoJSON(null, {
    style: styleFeature,
    onEachFeature(feature, layer) {
      const stored = rememberFeature(feature);
      stored.layer = layer;
      layer.bindPopup(() => popupHtml(feature));
      wirePopupSelection(layer, feature);
      layer.on("click", (event) => onFeatureClick(feature, layer, event));
    },
  });
  const group = L.featureGroup([lines, cluster]);

  for (const feature of featureCollection.features || []) {
    const geometryType = feature.geometry?.type;
    if (geometryType === "Point") {
      const coords = feature.geometry.coordinates;
      const latlng = L.latLng(coords[1], coords[0]);
      const marker = L.marker(latlng, { icon: markerIcon(feature.properties || {}) });
      const stored = rememberFeature(feature, latlng);
      stored.layer = marker;
      marker.bindPopup(() => popupHtml(feature));
      wirePopupSelection(marker, feature);
      marker.on("click", (event) => onFeatureClick(feature, marker, event));
      cluster.addLayer(marker);
    } else if (feature.geometry) {
      lines.addData(feature);
    } else {
      rememberFeature(feature);
    }
  }
  return group;
}

function showLoading(text) {
  els.loadingToast.textContent = text;
  els.loadingToast.hidden = false;
}

function hideLoading() {
  els.loadingToast.hidden = true;
}

function featureSubcategory(feature) {
  const p = feature?.properties || {};
  return p.derived_subcategory || p.asset_type || "uncategorized";
}

function featureCountry(feature) {
  const p = feature?.properties || {};
  return (p.country || "Unknown").trim() || "Unknown";
}

function featureCountries(feature) {
  const p = feature?.properties || {};
  if (Array.isArray(p.countries) && p.countries.length) {
    return p.countries.map((country) => String(country).trim()).filter(Boolean);
  }
  return [featureCountry(feature)];
}

function isSubcategoryEnabled(layerId, subcategory) {
  const enabled = state.subcategoryFilters.get(layerId);
  return !enabled || enabled.has(subcategory);
}

function featurePassesCountryFilter(feature) {
  const p = feature?.properties || {};
  if (p.source_dataset === "Manual selection") return true;
  if (!Array.isArray(state.manifest?.countries) || !state.manifest.countries.length) return true;
  return featureCountries(feature).some((country) => state.countryFilters.has(country));
}

function featurePassesActiveFilters(feature) {
  const p = feature?.properties || {};
  return featurePassesCountryFilter(feature) && isSubcategoryEnabled(p.map_layer, featureSubcategory(feature));
}

function createFilteredLayer(record) {
  return createLeafletLayer({
    type: "FeatureCollection",
    features: record.features.filter(featurePassesActiveFilters),
  });
}

function refreshLayerFilters(layerInfo) {
  const record = state.layers.get(layerInfo.id);
  if (record?.loaded) {
    const wasVisible = record.visible;
    if (record.layer && map.hasLayer(record.layer)) {
      map.removeLayer(record.layer);
    }
    record.layer = createFilteredLayer(record);
    if (wasVisible) {
      record.layer.addTo(map);
    }
  }
  renderLoadedCount();
  renderSearch();
  syncOverlaysWithVisibleLayers();
}

function refreshAllLayerFilters() {
  for (const record of state.layers.values()) {
    if (!record?.loaded) continue;
    const wasVisible = record.visible;
    if (record.layer && map.hasLayer(record.layer)) {
      map.removeLayer(record.layer);
    }
    record.layer = createFilteredLayer(record);
    if (wasVisible) {
      record.layer.addTo(map);
    }
  }
  renderLoadedCount();
  renderSearch();
  syncOverlaysWithVisibleLayers();
}

async function loadLayer(layerInfo, checkbox, row) {
  let record = state.layers.get(layerInfo.id);
  if (record?.loaded) {
    map.addLayer(record.layer);
    record.visible = true;
    renderLoadedCount();
    renderSearch();
    syncOverlaysWithVisibleLayers();
    return;
  }

  row.classList.add("loading");
  const files = Array.isArray(layerInfo.files) && layerInfo.files.length ? layerInfo.files : [layerInfo.file];
  const features = [];
  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    showLoading(files.length > 1 ? `Loading ${layerInfo.label} (${index + 1}/${files.length})...` : `Loading ${layerInfo.label}...`);
    const response = await fetch(DATA_DIR + file);
    if (!response.ok) throw new Error(`Failed to load ${file}`);
    const data = await response.json();
    features.push(...(data.features || []));
  }
  record = { ...layerInfo, features, loaded: true, visible: true };
  const layer = createFilteredLayer(record);
  layer.addTo(map);
  record.layer = layer;
  state.layers.set(layerInfo.id, record);
  row.classList.remove("loading");
  hideLoading();
  renderLoadedCount();
  renderSearch();
  syncOverlaysWithVisibleLayers();
}

function unloadLayer(layerInfo) {
  const record = state.layers.get(layerInfo.id);
  if (!record?.loaded) return;
  map.removeLayer(record.layer);
  record.visible = false;
  renderLoadedCount();
  renderSearch();
  syncOverlaysWithVisibleLayers();
}

function layerGroupId(layerInfo) {
  if (layerInfo.id.startsWith("military")) return "military";
  if (layerInfo.id.startsWith("energy")) return "oil_gas";
  if (layerInfo.id.startsWith("transport")) return "transport";
  if (layerInfo.id.startsWith("power")) return "power";
  return "other";
}

function isLineLayer(layerInfo) {
  return Number(layerInfo.line_count || 0) > 0 && Number(layerInfo.point_count || 0) === 0;
}

function groupedLayerInfos() {
  const groups = LAYER_GROUPS.map((group) => ({ ...group, layers: [] }));
  const groupMap = new Map(groups.map((group) => [group.id, group]));
  for (const layerInfo of state.manifest.layers) {
    const group = groupMap.get(layerGroupId(layerInfo)) || groupMap.get("other");
    group.layers.push(layerInfo);
  }
  for (const group of groups) {
    group.layers.sort((a, b) => {
      const lineDelta = Number(isLineLayer(a)) - Number(isLineLayer(b));
      if (lineDelta) return lineDelta;
      return a.label.localeCompare(b.label);
    });
  }
  return groups.filter((group) => group.layers.length);
}

function layerHasEnabledSubcategories(layerInfo) {
  const controls = state.layerSubcategoryControls.get(layerInfo.id) || [];
  if (!controls.length) return savedLayerVisible(layerInfo);
  return controls.some((control) => control.checked);
}

function updateLayerCheckboxState(layerInfo) {
  const checkbox = state.layerControls.get(layerInfo.id);
  if (!checkbox) return;
  const controls = state.layerSubcategoryControls.get(layerInfo.id) || [];
  if (!controls.length) {
    checkbox.indeterminate = false;
    return;
  }

  const checkedCount = controls.filter((control) => control.checked).length;
  checkbox.checked = checkedCount === controls.length;
  checkbox.indeterminate = checkedCount > 0 && checkedCount < controls.length;
}

function syncSubcategoriesToLayer(layerInfo, enabled) {
  const controls = state.layerSubcategoryControls.get(layerInfo.id) || [];
  if (!controls.length) return;
  const active = new Set();
  for (const control of controls) {
    control.checked = enabled;
    if (enabled) active.add(control.dataset.subcategoryId);
  }
  state.subcategoryFilters.set(layerInfo.id, active);
  updateLayerCheckboxState(layerInfo);
}

async function handleSubcategoryChange(layerInfo, row) {
  const enabled = new Set();
  for (const control of state.layerSubcategoryControls.get(layerInfo.id) || []) {
    if (control.checked) enabled.add(control.dataset.subcategoryId);
  }
  state.subcategoryFilters.set(layerInfo.id, enabled);
  updateLayerCheckboxState(layerInfo);

  const checkbox = state.layerControls.get(layerInfo.id);
  try {
    if (enabled.size) {
      await loadLayer(layerInfo, checkbox, row);
      refreshLayerFilters(layerInfo);
    } else {
      unloadLayer(layerInfo);
    }
    savePreferencesNow();
  } catch (error) {
    row.classList.remove("loading");
    hideLoading();
    alert(error.message);
  }
}

async function renderLayers() {
  els.layersList.innerHTML = "";
  state.layerControls.clear();
  state.layerSubcategoryControls.clear();
  state.layerCollapseControls.clear();
  const initialLoads = [];
  for (const group of groupedLayerInfos()) {
    const groupHeading = document.createElement("div");
    groupHeading.className = "layer-group-heading";
    groupHeading.dataset.groupId = group.id;
    groupHeading.textContent = group.label;
    els.layersList.appendChild(groupHeading);

    for (const layerInfo of group.layers) {
    const subcategories = Array.isArray(layerInfo.subcategories) ? layerInfo.subcategories : [];
    if (subcategories.length) {
      state.subcategoryFilters.set(layerInfo.id, savedSubcategorySet(layerInfo));
    }

    const row = document.createElement("div");
    row.className = "layer-row";
    row.dataset.layerId = layerInfo.id;
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    state.layerControls.set(layerInfo.id, checkbox);
    const hasSubcategories = subcategories.length > 1;
    row.classList.toggle("leaf-layer-row", !hasSubcategories);
    const subcategoryControls = [];
    state.layerSubcategoryControls.set(layerInfo.id, subcategoryControls);

    const toggleButton = document.createElement("button");
    toggleButton.type = "button";
    toggleButton.className = "layer-collapse-btn";
    toggleButton.setAttribute("aria-label", `${savedLayerCollapsed(layerInfo.id) ? "Expand" : "Collapse"} ${layerInfo.label}`);
    toggleButton.setAttribute("aria-expanded", savedLayerCollapsed(layerInfo.id) ? "false" : "true");
    toggleButton.innerHTML = `<span aria-hidden="true">▾</span>`;
    if (!hasSubcategories) {
      toggleButton.hidden = true;
      toggleButton.tabIndex = -1;
    }
    state.layerCollapseControls.set(layerInfo.id, toggleButton);

    const swatch = document.createElement("span");
    swatch.className = "layer-swatch";
    swatch.style.background = colorForLayer(layerInfo.id);
    const name = document.createElement("span");
    name.className = "layer-name";
    name.innerHTML = `<strong>${escapeHtml(layerInfo.label)}</strong><span>${layerInfo.count.toLocaleString()} records</span>`;
    row.append(toggleButton, checkbox, name, swatch);
    els.layersList.appendChild(row);

    let subcategoryList = null;
    if (subcategories.length > 1) {
      subcategoryList = document.createElement("div");
      subcategoryList.className = "subcategory-list";
      subcategoryList.id = `subcategories-${layerInfo.id}`;
      subcategoryList.hidden = savedLayerCollapsed(layerInfo.id);
      row.classList.toggle("collapsed", subcategoryList.hidden);
      for (const subcategory of subcategories) {
        const subRow = document.createElement("label");
        subRow.className = "subcategory-row";
        const subCheckbox = document.createElement("input");
        subCheckbox.type = "checkbox";
        subCheckbox.checked = state.subcategoryFilters.get(layerInfo.id)?.has(subcategory.id) ?? true;
        subCheckbox.dataset.subcategoryId = subcategory.id;
        subcategoryControls.push(subCheckbox);
        const subName = document.createElement("span");
        subName.textContent = `${subcategory.label} (${subcategory.count.toLocaleString()})`;
        subRow.append(subCheckbox, subName);
        subcategoryList.appendChild(subRow);
        subCheckbox.addEventListener("change", () => handleSubcategoryChange(layerInfo, row));
      }
      els.layersList.appendChild(subcategoryList);
    }

    updateLayerCheckboxState(layerInfo);
    if (!hasSubcategories && !checkbox.checked) checkbox.checked = savedLayerVisible(layerInfo);

    toggleButton.addEventListener("click", () => {
      if (!subcategoryList) return;
      const expanded = toggleButton.getAttribute("aria-expanded") === "true";
      toggleButton.setAttribute("aria-expanded", expanded ? "false" : "true");
      toggleButton.setAttribute("aria-label", `${expanded ? "Expand" : "Collapse"} ${layerInfo.label}`);
      subcategoryList.hidden = expanded;
      row.classList.toggle("collapsed", expanded);
      queueSavePreferences();
    });

    checkbox.addEventListener("change", async () => {
      try {
        syncSubcategoriesToLayer(layerInfo, checkbox.checked);
        if (checkbox.checked) {
          await loadLayer(layerInfo, checkbox, row);
        } else {
          unloadLayer(layerInfo);
        }
        savePreferencesNow();
      } catch (error) {
        checkbox.checked = false;
        row.classList.remove("loading");
        hideLoading();
        savePreferencesNow();
        alert(error.message);
      }
    });

    if (checkbox.checked || checkbox.indeterminate || layerHasEnabledSubcategories(layerInfo)) {
      initialLoads.push(loadLayer(layerInfo, checkbox, row).catch((error) => {
        checkbox.checked = false;
        checkbox.indeterminate = false;
        row.classList.remove("loading");
        hideLoading();
        console.error(error);
      }));
    }
    }
  }
  await Promise.allSettled(initialLoads);
  renderLoadedCount();
  renderSearch();
}

function renderCountries() {
  const countries = Array.isArray(state.manifest.countries) ? state.manifest.countries : [];
  state.countryControls.clear();
  state.countryFilters = savedCountrySet();
  els.countriesList.innerHTML = "";
  els.countriesCount.textContent = `${countries.length.toLocaleString()} ${countries.length === 1 ? "country" : "countries"}`;

  if (!countries.length) {
    els.countriesList.innerHTML = `<div class="muted">No country metadata.</div>`;
    return;
  }

  for (const country of countries) {
    const row = document.createElement("label");
    row.className = "country-row";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = state.countryFilters.has(country.id);
    const name = document.createElement("span");
    name.className = "country-name";
    name.innerHTML = `<strong>${escapeHtml(country.label)}</strong><span>${country.count.toLocaleString()} records &bull; ${Number(country.point_count || 0).toLocaleString()} points</span>`;
    row.append(checkbox, name);
    els.countriesList.appendChild(row);
    state.countryControls.set(country.id, checkbox);

    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        state.countryFilters.add(country.id);
      } else {
        state.countryFilters.delete(country.id);
      }
      refreshAllLayerFilters();
      savePreferencesNow();
    });
  }
}

function colorForLayer(layerId) {
  const colors = {
    energy_oil: "#993d1f",
    energy_gas: "#e07b39",
    energy_facilities: "#d62728",
    power_lines: "#ffd200",
    power_facilities: "#d4a600",
    transport_rail: "#8a8a8a",
    transport_other: "#2a93d5",
    military_industrial: "#4f7cff",
    military_sites: "#d4472f",
    military_boundaries: "#ff6b4a",
    other_infrastructure: "#2a93d5",
  };
  return colors[layerId] || "#999999";
}

function loadedVisibleFeatures() {
  const visibleLayerIds = new Set(
    [...state.layers.values()].filter((record) => record.visible).map((record) => record.id)
  );
  return [...state.features.values()].filter((stored) => {
    const p = stored.feature.properties || {};
    return visibleLayerIds.has(p.map_layer) && featurePassesActiveFilters(stored.feature) && stored.point;
  });
}

function isFeatureVisible(feature) {
  const p = feature?.properties || {};
  if (!p.map_layer) return p.source_dataset === "Manual selection";
  const record = state.layers.get(p.map_layer);
  return !!record?.visible && featurePassesActiveFilters(feature);
}

function syncOverlaysWithVisibleLayers() {
  let changedSelections = false;
  for (const slot of ["A", "B"]) {
    const selection = state.selections[slot];
    if (!selection || isFeatureVisible(selection.feature)) continue;
    state.selections[slot] = null;
    changedSelections = true;
    if (state.selectionMarkers[slot]) {
      map.removeLayer(state.selectionMarkers[slot]);
      state.selectionMarkers[slot] = null;
    }
  }
  renderSelections();
  renderDistance();

  if (state.radiusOrigin && Number.isFinite(state.radiusKm)) {
    renderRadiusResults(state.radiusOrigin, state.radiusKm);
  }
  if (changedSelections) queueSavePreferences();
}

function renderLoadedCount() {
  const loaded = [...state.features.values()].filter((stored) => stored.point).length;
  const visible = loadedVisibleFeatures().length;
  els.loadedCount.textContent = `${visible.toLocaleString()} visible / ${loaded.toLocaleString()} loaded`;
}

function renderSearch() {
  const query = els.searchInput.value.trim().casefold?.() || els.searchInput.value.trim().toLowerCase();
  els.searchResults.innerHTML = "";
  if (!query) return;
  const terms = query.split(/\s+/).filter(Boolean);
  const results = [];
  for (const stored of loadedVisibleFeatures()) {
    const p = stored.feature.properties || {};
    const haystack = String(p.search_text || "").toLowerCase();
    if (terms.every((term) => haystack.includes(term))) {
      results.push(stored);
      if (results.length >= 40) break;
    }
  }
  if (!results.length) {
    els.searchResults.innerHTML = `<div class="muted">No loaded matches.</div>`;
    return;
  }
  for (const stored of results) {
    els.searchResults.appendChild(resultButton(stored, false));
  }
}

function resultButton(stored, includeDistance, distanceKm = null) {
  const p = stored.feature.properties || {};
  const button = document.createElement("button");
  button.className = "result-btn";
  button.type = "button";
  const distance = includeDistance && Number.isFinite(distanceKm) ? ` • ${numberFmt(distanceKm, 1)} km` : "";
  button.innerHTML = `
    <strong>${escapeHtml(p.display_label || p.name || "Unnamed")}</strong>
    <span>${escapeHtml(p.asset_type || "")}${distance} • ${escapeHtml(p.region || p.source_dataset || "")}</span>
  `;
  button.addEventListener("click", () => {
    if (stored.point) {
      map.setView(stored.point, Math.max(map.getZoom(), 9));
    }
    if (stored.layer?.openPopup) stored.layer.openPopup();
    selectFeature(state.activeSlot, stored.feature, stored.point);
  });
  return button;
}

function selectFeature(slot, feature, latlng) {
  const point = featurePoint(feature, latlng);
  state.selections[slot] = { feature, point };
  if (point) {
    if (slot === "A") {
      els.manualALat.value = point.lat.toFixed(6);
      els.manualALng.value = point.lng.toFixed(6);
    } else {
      els.manualBLat.value = point.lat.toFixed(6);
      els.manualBLng.value = point.lng.toFixed(6);
    }
  }
  drawSelectionMarker(slot);
  renderSelections();
  renderDistance();
  queueSavePreferences();
}

function drawSelectionMarker(slot) {
  const selection = state.selections[slot];
  if (state.selectionMarkers[slot]) {
    map.removeLayer(state.selectionMarkers[slot]);
    state.selectionMarkers[slot] = null;
  }
  if (!selection?.point) return;
  const className = slot === "A" ? "selection-halo-a" : "selection-halo-b";
  const icon = L.divIcon({ className, iconSize: [26, 26], iconAnchor: [13, 13] });
  state.selectionMarkers[slot] = L.marker(selection.point, {
    icon,
    interactive: false,
    zIndexOffset: 2000,
  }).addTo(map);
}

function renderSelections() {
  renderSelectionCard("A", els.selectionA);
  renderSelectionCard("B", els.selectionB);
}

function renderSelectionCard(slot, element) {
  const selection = state.selections[slot];
  if (!selection) {
    element.className = "selection-card empty";
    element.textContent = `Selection ${slot}`;
    return;
  }
  const p = selection.feature.properties || {};
  element.className = "selection-card";
  element.innerHTML = `
    <h3>${slot}: ${escapeHtml(p.display_label || p.name || "Unnamed")}</h3>
    <dl>
      ${detailRows(p)}
    </dl>
  `;
}

function renderDistance() {
  const a = state.selections.A?.point;
  const b = state.selections.B?.point;
  if (!a || !b) {
    els.distancePanel.className = "distance-panel muted";
    els.distancePanel.textContent = "Select two features to calculate distance.";
    return;
  }
  const km = metersKm(a, b);
  const miles = km * 0.621371;
  const brg = bearing(a, b);
  els.distancePanel.className = "distance-panel";
  els.distancePanel.innerHTML = `
    <div><strong>${numberFmt(km, 1)} km</strong> <span class="muted">(${numberFmt(miles, 1)} mi)</span></div>
    <div class="muted">Straight-line distance • bearing ${numberFmt(brg, 0)}° from A to B</div>
  `;
}

function updateSlotButtons() {
  els.slotABtn.classList.toggle("active", state.activeSlot === "A");
  els.slotBBtn.classList.toggle("active", state.activeSlot === "B");
}

function fitLoadedLayers() {
  const bounds = L.latLngBounds([]);
  for (const record of state.layers.values()) {
    if (!record.visible || !record.layer?.getBounds) continue;
    const layerBounds = record.layer.getBounds();
    if (layerBounds.isValid()) bounds.extend(layerBounds);
  }
  for (const stored of loadedVisibleFeatures()) {
    bounds.extend(stored.point);
  }
  if (bounds.isValid()) map.fitBounds(bounds.pad(0.08));
}

function clearSelection() {
  state.selections.A = null;
  state.selections.B = null;
  for (const slot of ["A", "B"]) {
    if (state.selectionMarkers[slot]) {
      map.removeLayer(state.selectionMarkers[slot]);
      state.selectionMarkers[slot] = null;
    }
  }
  els.nearestResults.innerHTML = "";
  renderSelections();
  renderDistance();
  queueSavePreferences();
}

function renderNearest() {
  const originSlot = state.selections[state.activeSlot] ? state.activeSlot : (state.selections.A ? "A" : (state.selections.B ? "B" : state.activeSlot));
  const origin = state.selections[originSlot]?.point;
  els.nearestResults.innerHTML = "";
  if (!origin) {
    els.nearestResults.innerHTML = `<div class="muted">Select a feature first.</div>`;
    return;
  }
  const candidates = loadedVisibleFeatures()
    .filter((stored) => stored.point && stored.id !== state.selections[originSlot]?.feature.id)
    .map((stored) => ({ stored, distance: metersKm(origin, stored.point) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 12);
  if (!candidates.length) {
    els.nearestResults.innerHTML = `<div class="muted">No visible loaded candidates.</div>`;
    return;
  }
  for (const item of candidates) {
    els.nearestResults.appendChild(resultButton(item.stored, true, item.distance));
  }
}

function manualFeature(slot, lat, lng) {
  return {
    type: "Feature",
    id: `manual_${slot}_${Date.now()}`,
    geometry: { type: "Point", coordinates: [lng, lat] },
    properties: {
      uid: `manual_${slot}`,
      display_label: `Manual ${slot}`,
      name: `Manual ${slot}`,
      asset_class: "manual",
      asset_type: "coordinate",
      source_dataset: "Manual selection",
      source_layer: "manual",
      map_latitude: String(lat),
      map_longitude: String(lng),
      latitude: String(lat),
      longitude: String(lng),
      location_quality: "manual",
      has_point_location: "true",
      search_text: `Manual ${slot} ${lat} ${lng}`,
      map_color: slot === "A" ? "#e0a72f" : "#5a8bff",
    },
  };
}

function setManualSelection(slot) {
  const latInput = slot === "A" ? els.manualALat : els.manualBLat;
  const lngInput = slot === "A" ? els.manualALng : els.manualBLng;
  const lat = Number(latInput.value);
  const lng = Number(lngInput.value);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    alert("Enter a valid latitude and longitude.");
    return;
  }
  const point = { lat, lng };
  selectFeature(slot, manualFeature(slot, lat, lng), point);
  map.setView(point, Math.max(map.getZoom(), 7));
}

function applySavedInterfaceState() {
  const prefs = state.savedPreferences;
  if (!prefs) {
    updateSlotButtons();
    setLayersPanelCollapsed(false, false);
    return;
  }

  state.activeSlot = prefs.activeSlot === "B" ? "B" : "A";
  updateSlotButtons();
  setLayersPanelCollapsed(prefs.layersPanelCollapsed === true, false);
  if (typeof prefs.search === "string") els.searchInput.value = prefs.search;
  els.manualPanel.hidden = prefs.manualPanelOpen !== true;

  const manual = prefs.manualInputs || {};
  els.manualALat.value = manual.aLat || "";
  els.manualALng.value = manual.aLng || "";
  els.manualBLat.value = manual.bLat || "";
  els.manualBLng.value = manual.bLng || "";

  const center = storedPoint(prefs.mapView);
  const zoom = Number(prefs.mapView?.zoom);
  if (center && Number.isFinite(zoom)) {
    map.setView(center, zoom);
  }
}

function setLayersPanelCollapsed(collapsed, persist = true) {
  els.layersPanel.classList.toggle("collapsed", collapsed);
  els.layersPanelBody.hidden = collapsed;
  els.layersPanelToggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
  els.layersPanelToggle.setAttribute("aria-label", `${collapsed ? "Expand" : "Collapse"} Layers`);
  if (persist) queueSavePreferences();
}

function restoreSavedSelections() {
  const selections = state.savedPreferences?.selections;
  if (!selections) return;
  for (const slot of ["A", "B"]) {
    const saved = selections[slot];
    if (!saved) continue;
    const point = storedPoint(saved.point);
    if (saved.type === "manual" && point) {
      selectFeature(slot, manualFeature(slot, point.lat, point.lng), point);
    } else if (saved.type === "feature" && typeof saved.id === "string") {
      const stored = state.features.get(saved.id);
      if (stored) selectFeature(slot, stored.feature, stored.point || point);
    }
  }
}

function drawStoredRadius(origin, radiusKm) {
  if (state.radiusCircle) map.removeLayer(state.radiusCircle);
  if (state.radiusLine) map.removeLayer(state.radiusLine);
  if (state.radiusLabel) map.removeLayer(state.radiusLabel);
  state.radiusCircle = L.circle(origin, {
    radius: radiusKm * 1000,
    color: "#e0a72f",
    weight: 2,
    fillColor: "#e0a72f",
    fillOpacity: 0.12,
  }).addTo(map);
  state.radiusLine = null;
  state.radiusLabel = L.marker(origin, {
    interactive: false,
    icon: L.divIcon({
      className: "radius-distance-label",
      html: `${numberFmt(radiusKm, 1)} km`,
      iconSize: [82, 28],
      iconAnchor: [-8, 14],
    }),
  }).addTo(map);
}

function restoreSavedRadius() {
  const saved = state.savedPreferences?.radius;
  const origin = storedPoint(saved?.origin);
  const radiusKm = Number(saved?.radiusKm);
  if (!origin || !Number.isFinite(radiusKm) || radiusKm <= 0) return;
  drawStoredRadius(origin, radiusKm);
  renderRadiusResults(origin, radiusKm);
}

function setRadiusMode(enabled) {
  state.radiusMode = enabled;
  els.radiusModeBtn.classList.toggle("radius-mode-active", enabled);
  map.getContainer().style.cursor = enabled ? "crosshair" : "";
}

function resetRadius() {
  if (state.radiusCircle) {
    map.removeLayer(state.radiusCircle);
    state.radiusCircle = null;
  }
  if (state.radiusLine) {
    map.removeLayer(state.radiusLine);
    state.radiusLine = null;
  }
  if (state.radiusLabel) {
    map.removeLayer(state.radiusLabel);
    state.radiusLabel = null;
  }
  state.radiusStart = null;
  state.radiusOrigin = null;
  state.radiusKm = null;
  state.radiusResults = [];
  state.radiusHighlightGroup.clearLayers();
  els.radiusPanel.hidden = true;
  els.radiusResults.innerHTML = "";
  els.radiusSummary.textContent = "0 objects";
  queueSavePreferences();
}

function renderRadiusResults(origin, radiusKm) {
  state.radiusHighlightGroup.clearLayers();
  state.radiusOrigin = origin;
  state.radiusKm = radiusKm;
  const activeFeatures = loadedVisibleFeatures();
  const results = activeFeatures
    .map((stored) => ({ stored, distance: featureDistanceToPointKm(stored.feature, origin) }))
    .filter((item) => item.distance <= radiusKm)
    .sort((a, b) => a.distance - b.distance);
  state.radiusResults = results;
  els.radiusPanel.hidden = false;
  els.radiusSummary.textContent = `${results.length.toLocaleString()} objects • ${numberFmt(radiusKm, 1)} km • active layers only`;
  els.radiusResults.innerHTML = "";

  for (const item of results) {
    if (item.stored.point) {
      L.circleMarker(item.stored.point, {
        radius: 5,
        color: "#ffffff",
        weight: 1,
        fillColor: "#d4472f",
        fillOpacity: 0.9,
        interactive: false,
      }).addTo(state.radiusHighlightGroup);
    }
  }

  const renderLimit = 500;
  for (const item of results.slice(0, renderLimit)) {
    els.radiusResults.appendChild(resultButton(item.stored, true, item.distance));
  }
  if (results.length > renderLimit) {
    const note = document.createElement("div");
    note.className = "muted";
    note.textContent = `Showing first ${renderLimit.toLocaleString()} here. CSV export includes all ${results.length.toLocaleString()}.`;
    els.radiusResults.appendChild(note);
  }
  queueSavePreferences();
}

function onRadiusMouseDown(event) {
  if (!state.radiusMode) return;
  event.originalEvent?.preventDefault();
  resetRadius();
  state.radiusStart = event.latlng;
  map.dragging.disable();
  state.radiusCircle = L.circle(state.radiusStart, {
    radius: 1,
    color: "#e0a72f",
    weight: 2,
    fillColor: "#e0a72f",
    fillOpacity: 0.12,
  }).addTo(map);
  state.radiusLine = L.polyline([state.radiusStart, state.radiusStart], {
    color: "#e0a72f",
    weight: 2,
    opacity: 0.95,
    dashArray: "6,6",
    interactive: false,
  }).addTo(map);
  state.radiusLabel = L.marker(state.radiusStart, {
    interactive: false,
    icon: L.divIcon({
      className: "radius-distance-label",
      html: "0.0 km",
      iconSize: [82, 28],
      iconAnchor: [-8, 14],
    }),
  }).addTo(map);
}

function onRadiusMouseMove(event) {
  if (!state.radiusMode || !state.radiusStart || !state.radiusCircle) return;
  const radiusKm = metersKm(state.radiusStart, event.latlng);
  state.radiusCircle.setRadius(radiusKm * 1000);
  if (state.radiusLine) {
    state.radiusLine.setLatLngs([state.radiusStart, event.latlng]);
  }
  if (state.radiusLabel) {
    state.radiusLabel.setLatLng(event.latlng);
    state.radiusLabel.setIcon(L.divIcon({
      className: "radius-distance-label",
      html: `${numberFmt(radiusKm, 1)} km`,
      iconSize: [82, 28],
      iconAnchor: [-8, 14],
    }));
  }
}

async function onRadiusMouseUp(event) {
  if (!state.radiusMode || !state.radiusStart || !state.radiusCircle) return;
  const radiusKm = metersKm(state.radiusStart, event.latlng);
  state.radiusCircle.setRadius(radiusKm * 1000);
  if (state.radiusLine) {
    state.radiusLine.setLatLngs([state.radiusStart, event.latlng]);
  }
  if (state.radiusLabel) {
    state.radiusLabel.setLatLng(event.latlng);
    state.radiusLabel.setIcon(L.divIcon({
      className: "radius-distance-label",
      html: `${numberFmt(radiusKm, 1)} km`,
      iconSize: [82, 28],
      iconAnchor: [-8, 14],
    }));
  }
  try {
    renderRadiusResults(state.radiusStart, radiusKm);
  } catch (error) {
    alert(error.message);
    hideLoading();
  } finally {
    map.dragging.enable();
    state.radiusStart = null;
    setRadiusMode(false);
  }
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function exportRadiusCsv() {
  if (!state.radiusResults.length) {
    alert("No radius results to export.");
    return;
  }
  const fields = [
    "distance_km",
    "uid",
    "name",
    "asset_class",
    "asset_type",
    "source_dataset",
    "source_layer",
    "operator",
    "product",
    "inn",
    "region",
    "map_latitude",
    "map_longitude",
    "location_quality",
    "source_url",
  ];
  const lines = [fields.join(",")];
  for (const item of state.radiusResults) {
    const p = item.stored.feature.properties || {};
    const row = {
      distance_km: item.distance.toFixed(6),
      uid: p.uid || item.stored.feature.id,
      name: p.display_label || p.name || "",
      asset_class: p.asset_class || "",
      asset_type: p.asset_type || "",
      source_dataset: p.source_dataset || "",
      source_layer: p.source_layer || "",
      operator: p.operator || "",
      product: p.product || "",
      inn: p.inn || "",
      region: p.region || "",
      map_latitude: p.map_latitude || "",
      map_longitude: p.map_longitude || "",
      location_quality: p.location_quality || "",
      source_url: p.source_url || "",
    };
    lines.push(fields.map((field) => csvEscape(row[field])).join(","));
  }
  const blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `radius_results_${new Date().toISOString().replace(/[:.]/g, "-")}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function init() {
  const manifestResponse = await fetch(DATA_DIR + "manifest.json");
  state.manifest = await manifestResponse.json();
  els.datasetSummary.textContent = `${state.manifest.total_features.toLocaleString()} normalized records across ${state.manifest.layers.length} layers`;
  applySavedInterfaceState();
  renderCountries();
  await renderLayers();
  restoreSavedSelections();
  restoreSavedRadius();
  renderSearch();
  renderSelections();
  renderDistance();
  state.persistenceReady = true;
  savePreferencesNow();
}

els.searchInput.addEventListener("input", () => {
  renderSearch();
  queueSavePreferences();
});
els.slotABtn.addEventListener("click", () => {
  state.activeSlot = "A";
  updateSlotButtons();
  queueSavePreferences();
});
els.slotBBtn.addEventListener("click", () => {
  state.activeSlot = "B";
  updateSlotButtons();
  queueSavePreferences();
});
els.clearSelectionBtn.addEventListener("click", clearSelection);
els.nearestBtn.addEventListener("click", renderNearest);
els.fitLoadedBtn.addEventListener("click", fitLoadedLayers);
els.layersPanelToggle.addEventListener("click", () => {
  setLayersPanelCollapsed(!els.layersPanelBody.hidden);
});
els.manualToggleBtn.addEventListener("click", () => {
  els.manualPanel.hidden = !els.manualPanel.hidden;
  queueSavePreferences();
});
for (const input of [els.manualALat, els.manualALng, els.manualBLat, els.manualBLng]) {
  input.addEventListener("input", queueSavePreferences);
}
els.manualASetBtn.addEventListener("click", () => setManualSelection("A"));
els.manualBSetBtn.addEventListener("click", () => setManualSelection("B"));
els.radiusModeBtn.addEventListener("click", () => setRadiusMode(!state.radiusMode));
els.resetRadiusBtn.addEventListener("click", () => {
  resetRadius();
  setRadiusMode(false);
  map.dragging.enable();
});
els.exportRadiusBtn.addEventListener("click", exportRadiusCsv);
els.clearLayersBtn.addEventListener("click", () => {
  els.layersList.querySelectorAll("input[type='checkbox']").forEach((checkbox) => {
    if (checkbox.checked) checkbox.click();
  });
});

map.on("mousedown", onRadiusMouseDown);
map.on("mousemove", onRadiusMouseMove);
map.on("mouseup", onRadiusMouseUp);
map.on("baselayerchange", (event) => {
  activeBaseLayer = event.name === "Dark" ? "dark" : "light";
  queueSavePreferences();
});
map.on("moveend", queueSavePreferences);
window.addEventListener("beforeunload", savePreferencesNow);

init().catch((error) => {
  console.error(error);
  els.datasetSummary.textContent = "Failed to load app data.";
  alert(error.message);
});
