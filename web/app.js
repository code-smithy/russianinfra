const DATA_DIR = "data/";
const STORAGE_KEY = "infrastructureExplorer.preferences.v1";
const OUT_OF_RADIUS_POINT_OPACITY = 0.5;
const OUT_OF_RADIUS_LINE_OPACITY = 0.38;
const LAYER_GROUPS = [
  { id: "military", label: "Military" },
  { id: "oil_gas", label: "Oil/Gas" },
  { id: "transport", label: "Transport" },
  { id: "power", label: "Power" },
  { id: "other", label: "Other" },
];
const DEFAULT_ESTIMATOR_ASSUMPTIONS = {
  rangeBands: [
    { id: "band_500", maxKm: 500 },
    { id: "band_2500", maxKm: 2500 },
    { id: "band_open", maxKm: null },
  ],
  resources: [
    { id: "resource_a", label: "Resource A", completionRate: 80 },
    { id: "resource_b", label: "Resource B", completionRate: 65 },
    { id: "resource_c", label: "Resource C", completionRate: 50 },
  ],
  categoryRequirements: {},
  profiles: [],
  summaryDisplay: {
    compactTotals: false,
    rangeBandMatrix: true,
    detailedBreakdown: true,
  },
};
const SUMMARY_DISPLAY_OPTIONS = [
  { key: "compactTotals", label: "Totals" },
  { key: "rangeBandMatrix", label: "Range matrix" },
];
const ESTIMATOR_BLOCKS = [
  { key: "rangeBands", label: "Range bands" },
  { key: "resourceTypes", label: "Resource types" },
  { key: "categoryAssumptions", label: "Category assumptions" },
];
const INFO_TOPICS = {
  layers: {
    title: "Layers",
    paragraphs: [
      "Loads and shows the selected infrastructure and military data layers on the map.",
      "Layer and subcategory selections define which records are active for Search Loaded, Radius Results, and the Scenario Estimator.",
    ],
  },
  countries: {
    title: "Countries",
    paragraphs: [
      "Filters loaded records by country.",
      "Unchecked countries are excluded from the map view, search, radius results, and estimator calculations.",
    ],
  },
  search: {
    title: "Search Loaded",
    paragraphs: [
      "Searches only records already loaded through Layers and still active after country and subcategory filters.",
      "Selecting a result opens that object on the map.",
    ],
  },
  radius: {
    title: "Radius",
    paragraphs: [
      "Draws a distance radius from a selected map point.",
      "The radius collects active-layer objects inside the circle and sends those objects to Radius Results and the Scenario Estimator.",
    ],
  },
  radiusResults: {
    title: "Radius Results",
    paragraphs: [
      "Lists active-layer objects inside the drawn radius, ordered by distance from the radius origin.",
      "Export CSV writes the matching objects and their source fields.",
    ],
  },
  estimator: {
    title: "Scenario Estimator",
    paragraphs: [
      "Uses Radius Results to estimate required effectors by target category, range band, and effector type.",
      "This is an assumption calculator. It does not edit the map data.",
    ],
  },
  rangeBands: {
    title: "Range bands",
    paragraphs: [
      "Defines distance bands in kilometers from the radius origin.",
      "Each radius result is assigned to the first upper bound it fits, with an open band above the last bound.",
      "When a radius is drawn, the circle is split into matching colored rings. The colors are generated from the current band list.",
    ],
  },
  resourceTypes: {
    title: "Resource types",
    paragraphs: [
      "Defines the effector types used in the estimate.",
      "The text field is the effector type label. The percent field is the assumed survivability of that effector; lower survivability increases the required count.",
    ],
  },
  categoryAssumptions: {
    title: "Category assumptions",
    paragraphs: [
      "Defines the assumption for how many effectors are needed per target in each layer/category.",
      "This factor is multiplied by the number of targets in the radius before the survivability correction is applied.",
    ],
  },
  estimate: {
    title: "Estimate",
    paragraphs: [
      "Shows the calculated effector demand from the current radius results and estimator assumptions.",
      "Per row, the calculation is: targets x effectors per target / survivability, rounded up to a whole effector count.",
    ],
  },
};

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
  radiusMode: false,
  radiusStart: null,
  radiusOrigin: null,
  radiusKm: null,
  radiusCircle: null,
  radiusBandCircles: [],
  radiusLine: null,
  radiusLabel: null,
  radiusHighlightGroup: null,
  radiusResults: [],
  estimator: normalizeEstimatorAssumptions(loadSavedPreferences()?.estimator),
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
  loadingToast: document.getElementById("loadingToast"),
  countriesCount: document.getElementById("countriesCount"),
  countriesList: document.getElementById("countriesList"),
  countriesPanel: document.getElementById("countriesPanel"),
  countriesPanelBody: document.getElementById("countriesPanelBody"),
  countriesPanelToggle: document.getElementById("countriesPanelToggle"),
  layersPanel: document.getElementById("layersPanel"),
  layersPanelBody: document.getElementById("layersPanelBody"),
  layersPanelToggle: document.getElementById("layersPanelToggle"),
  clearCountriesBtn: document.getElementById("clearCountriesBtn"),
  clearLayersBtn: document.getElementById("clearLayersBtn"),
  fitLoadedBtn: document.getElementById("fitLoadedBtn"),
  radiusModeBtn: document.getElementById("radiusModeBtn"),
  radiusPanel: document.getElementById("radiusPanel"),
  radiusSummary: document.getElementById("radiusSummary"),
  radiusCenterLabel: document.getElementById("radiusCenterLabel"),
  radiusKmInput: document.getElementById("radiusKmInput"),
  radiusResults: document.getElementById("radiusResults"),
  exportRadiusBtn: document.getElementById("exportRadiusBtn"),
  resetRadiusBtn: document.getElementById("resetRadiusBtn"),
  estimatorSummary: document.getElementById("estimatorSummary"),
  estimatorRadiusLabel: document.getElementById("estimatorRadiusLabel"),
  rangeBandsBlock: document.getElementById("rangeBandsBlock"),
  rangeBandsBody: document.getElementById("rangeBandsBody"),
  rangeBandsToggle: document.getElementById("rangeBandsToggle"),
  rangeBandsList: document.getElementById("rangeBandsList"),
  addRangeBandBtn: document.getElementById("addRangeBandBtn"),
  resourceTypesBlock: document.getElementById("resourceTypesBlock"),
  resourceTypesBody: document.getElementById("resourceTypesBody"),
  resourceTypesToggle: document.getElementById("resourceTypesToggle"),
  resourceTypesList: document.getElementById("resourceTypesList"),
  categoryAssumptionsBlock: document.getElementById("categoryAssumptionsBlock"),
  categoryAssumptionsBody: document.getElementById("categoryAssumptionsBody"),
  categoryAssumptionsToggle: document.getElementById("categoryAssumptionsToggle"),
  categoryAssumptionsList: document.getElementById("categoryAssumptionsList"),
  summaryDisplayControls: document.getElementById("summaryDisplayControls"),
  estimatorSummaryResults: document.getElementById("estimatorSummaryResults"),
  estimatorResults: document.getElementById("estimatorResults"),
  exportAssumptionsBtn: document.getElementById("exportAssumptionsBtn"),
  importAssumptionsBtn: document.getElementById("importAssumptionsBtn"),
  importAssumptionsInput: document.getElementById("importAssumptionsInput"),
  exportEstimateBtn: document.getElementById("exportEstimateBtn"),
  resetEstimatorBtn: document.getElementById("resetEstimatorBtn"),
  estimatorProfileSelect: document.getElementById("estimatorProfileSelect"),
  saveEstimatorProfileBtn: document.getElementById("saveEstimatorProfileBtn"),
  loadEstimatorProfileBtn: document.getElementById("loadEstimatorProfileBtn"),
  deleteEstimatorProfileBtn: document.getElementById("deleteEstimatorProfileBtn"),
  infoPopover: document.getElementById("infoPopover"),
  infoPopoverTitle: document.getElementById("infoPopoverTitle"),
  infoPopoverBody: document.getElementById("infoPopoverBody"),
};

let activeInfoButton = null;

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[char]);
}

function setInfoButtonExpanded(button, expanded) {
  button?.setAttribute("aria-expanded", expanded ? "true" : "false");
}

function positionInfoPopover(anchor) {
  const anchorRect = anchor?.getBoundingClientRect?.();
  const popoverRect = els.infoPopover?.getBoundingClientRect?.();
  if (!anchorRect || !popoverRect) return;

  const gutter = 8;
  const viewportWidth = Number(window.innerWidth) || 1280;
  const viewportHeight = Number(window.innerHeight) || 720;
  let left = anchorRect.right + gutter;
  let top = anchorRect.top;

  if (left + popoverRect.width > viewportWidth - gutter) {
    left = anchorRect.left - popoverRect.width - gutter;
  }
  left = Math.max(gutter, Math.min(left, viewportWidth - popoverRect.width - gutter));
  top = Math.max(gutter, Math.min(top, viewportHeight - popoverRect.height - gutter));

  els.infoPopover.classList.toggle("placed-left", left < anchorRect.left);
  els.infoPopover.style.left = `${left}px`;
  els.infoPopover.style.top = `${top}px`;
}

function openInfoPopover(topicKey, anchor) {
  const topic = INFO_TOPICS[topicKey];
  if (!topic) return;
  setInfoButtonExpanded(activeInfoButton, false);
  activeInfoButton = anchor || null;
  setInfoButtonExpanded(activeInfoButton, true);
  els.infoPopoverTitle.textContent = topic.title;
  els.infoPopoverBody.innerHTML = topic.paragraphs
    .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
    .join("");
  els.infoPopover.hidden = false;
  positionInfoPopover(anchor);
}

function closeInfoPopover() {
  els.infoPopover.hidden = true;
  els.infoPopover.classList.remove("placed-left");
  setInfoButtonExpanded(activeInfoButton, false);
  activeInfoButton = null;
}

function setupInfoButtons() {
  const buttonIds = [
    "layersInfoBtn",
    "countriesInfoBtn",
    "searchInfoBtn",
    "radiusInfoBtn",
    "radiusResultsInfoBtn",
    "estimatorInfoBtn",
    "rangeBandsInfoBtn",
    "resourceTypesInfoBtn",
    "categoryAssumptionsInfoBtn",
    "estimateInfoBtn",
  ];
  for (const id of buttonIds) {
    const button = document.getElementById(id);
    button?.addEventListener("click", (event) => {
      event?.stopPropagation?.();
      if (activeInfoButton === button && !els.infoPopover.hidden) {
        closeInfoPopover();
        return;
      }
      openInfoPopover(button.dataset.infoTopic, button);
    });
  }
  document.addEventListener?.("click", (event) => {
    if (els.infoPopover.hidden) return;
    const target = event.target;
    if (els.infoPopover.contains?.(target) || target?.closest?.(".info-btn")) return;
    closeInfoPopover();
  });
  document.addEventListener?.("keydown", (event) => {
    if (event.key === "Escape") closeInfoPopover();
  });
  window.addEventListener("resize", closeInfoPopover);
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

function savedCountriesPanelCollapsed() {
  return state.savedPreferences?.countriesPanelCollapsed === true;
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

function savedEstimatorBlockSet() {
  const validKeys = new Set(ESTIMATOR_BLOCKS.map((block) => block.key));
  const saved = state.savedPreferences?.collapsedEstimatorBlocks;
  return new Set(Array.isArray(saved) ? saved.filter((key) => validKeys.has(key)) : []);
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
    baseLayer: activeBaseLayer,
    mapView: { lat: center.lat, lng: center.lng, zoom: map.getZoom() },
    layers,
    layersPanelCollapsed: els.layersPanelBody.hidden,
    countriesPanelCollapsed: els.countriesPanelBody.hidden,
    collapsedLayers,
    collapsedEstimatorBlocks: ESTIMATOR_BLOCKS
      .filter((block) => els[`${block.key}Body`]?.hidden)
      .map((block) => block.key),
    countries: [...state.countryFilters],
    subcategories,
    search: els.searchInput.value,
    radius: serializeRadius(),
    estimator: serializeEstimatorAssumptions(),
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

function coordinateFmt(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(5) : "";
}

function boundedNumber(value, fallback, min = 0, max = Infinity) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function positiveNumber(value, fallback, min = 0.1, max = Infinity) {
  if (value === null || value === "") return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function positiveFiniteNumber(value, fallback, min = 0.1, max = Infinity) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function isFiniteRangeMax(value) {
  return value !== null && value !== "" && Number.isFinite(Number(value));
}

function profileId(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48) || `profile_${Date.now()}`;
}

function estimatorProfileSnapshot(name) {
  return {
    id: profileId(name),
    name: String(name || "").trim().slice(0, 60),
    rangeBands: state.estimator.rangeBands.map((band) => ({ id: band.id, maxKm: band.maxKm })),
    resources: state.estimator.resources.map((resource) => ({
      id: resource.id,
      label: resource.label,
      completionRate: resource.completionRate,
    })),
    categoryRequirements: { ...state.estimator.categoryRequirements },
  };
}

function normalizeEstimatorProfiles(savedProfiles) {
  const profiles = [];
  const seen = new Set();
  for (const item of Array.isArray(savedProfiles) ? savedProfiles : []) {
    const name = String(item?.name || "").trim().slice(0, 60);
    if (!name) continue;
    const id = profileId(item?.id || name);
    if (seen.has(id)) continue;
    const normalized = normalizeEstimatorAssumptions({
      rangeBands: item?.rangeBands,
      resources: item?.resources,
      categoryRequirements: item?.categoryRequirements,
    });
    profiles.push({
      id,
      name,
      rangeBands: normalized.rangeBands.map((band) => ({ id: band.id, maxKm: band.maxKm })),
      resources: normalized.resources.map((resource) => ({
        id: resource.id,
        label: resource.label,
        completionRate: resource.completionRate,
      })),
      categoryRequirements: { ...normalized.categoryRequirements },
    });
    seen.add(id);
  }
  return profiles.sort((a, b) => a.name.localeCompare(b.name));
}

function normalizeEstimatorAssumptions(saved) {
  const defaults = DEFAULT_ESTIMATOR_ASSUMPTIONS;
  const savedBands = Array.isArray(saved?.rangeBands) ? saved.rangeBands : [];
  const finiteBands = savedBands
    .map((band, index) => ({
      id: typeof band?.id === "string" && band.id ? band.id : `band_${Date.now()}_${index}`,
      maxKm: positiveNumber(band?.maxKm, NaN, 0.1),
    }))
    .filter((band) => Number.isFinite(band.maxKm))
    .sort((a, b) => a.maxKm - b.maxKm);
  const rangeBands = finiteBands.length ? finiteBands : defaults.rangeBands.filter((band) => Number.isFinite(band.maxKm));
  rangeBands.push({ id: "band_open", maxKm: null });

  const savedResources = Array.isArray(saved?.resources) ? saved.resources : [];
  const savedById = new Map(savedResources.map((resource) => [resource?.id, resource]));
  const resources = defaults.resources.map((resource) => {
    const savedResource = savedById.get(resource.id) || {};
    return {
      id: resource.id,
      label: String(savedResource.label || resource.label).trim().slice(0, 60) || resource.label,
      completionRate: boundedNumber(savedResource.completionRate, resource.completionRate, 0, 100),
    };
  });

  const categoryRequirements = {};
  const savedRequirements = saved?.categoryRequirements && typeof saved.categoryRequirements === "object"
    ? saved.categoryRequirements
    : {};
  for (const [layerId, value] of Object.entries(savedRequirements)) {
    categoryRequirements[layerId] = boundedNumber(value, 1, 0, 1000000);
  }

  const savedSummaryDisplay = saved?.summaryDisplay && typeof saved.summaryDisplay === "object"
    ? saved.summaryDisplay
    : {};
  const summaryDisplay = {};
  for (const option of SUMMARY_DISPLAY_OPTIONS) {
    const defaultValue = defaults.summaryDisplay[option.key] !== false;
    summaryDisplay[option.key] = typeof savedSummaryDisplay[option.key] === "boolean"
      ? savedSummaryDisplay[option.key]
      : defaultValue;
  }
  summaryDisplay.detailedBreakdown = typeof savedSummaryDisplay.detailedBreakdown === "boolean"
    ? savedSummaryDisplay.detailedBreakdown
    : defaults.summaryDisplay.detailedBreakdown;
  if (summaryDisplay.rangeBandMatrix) {
    summaryDisplay.compactTotals = false;
  } else if (!summaryDisplay.compactTotals) {
    summaryDisplay.compactTotals = true;
  }

  return {
    rangeBands,
    resources,
    categoryRequirements,
    profiles: normalizeEstimatorProfiles(saved?.profiles),
    summaryDisplay,
  };
}

function serializeEstimatorAssumptions() {
  enforceSummaryDisplaySelection();
  return {
    rangeBands: state.estimator.rangeBands.map((band) => ({ id: band.id, maxKm: band.maxKm })),
    resources: state.estimator.resources.map((resource) => ({
      id: resource.id,
      label: resource.label,
      completionRate: resource.completionRate,
    })),
    categoryRequirements: { ...state.estimator.categoryRequirements },
    profiles: state.estimator.profiles.map((profile) => ({
      id: profile.id,
      name: profile.name,
      rangeBands: profile.rangeBands.map((band) => ({ id: band.id, maxKm: band.maxKm })),
      resources: profile.resources.map((resource) => ({
        id: resource.id,
        label: resource.label,
        completionRate: resource.completionRate,
      })),
      categoryRequirements: { ...profile.categoryRequirements },
    })),
    summaryDisplay: { ...state.estimator.summaryDisplay },
  };
}

function enforceSummaryDisplaySelection() {
  if (!state.estimator.summaryDisplay || typeof state.estimator.summaryDisplay !== "object") {
    state.estimator.summaryDisplay = { ...DEFAULT_ESTIMATOR_ASSUMPTIONS.summaryDisplay };
  }
  if (state.estimator.summaryDisplay.rangeBandMatrix) {
    state.estimator.summaryDisplay.compactTotals = false;
  } else if (!state.estimator.summaryDisplay.compactTotals) {
    state.estimator.summaryDisplay.compactTotals = true;
  }
  if (typeof state.estimator.summaryDisplay.detailedBreakdown !== "boolean") {
    state.estimator.summaryDisplay.detailedBreakdown = true;
  }
}

function finiteRangeBands() {
  return state.estimator.rangeBands.filter((band) => isFiniteRangeMax(band.maxKm));
}

function sortedRangeBands() {
  const bands = finiteRangeBands()
    .map((band) => ({ ...band, maxKm: Number(band.maxKm) }))
    .sort((a, b) => a.maxKm - b.maxKm);
  return [...bands, { id: "band_open", maxKm: null }];
}

function rangeBandLabel(band, index, bands = sortedRangeBands()) {
  if (!isFiniteRangeMax(band.maxKm)) {
    const previous = bands[index - 1];
    return previous ? `Over ${numberFmt(previous.maxKm, 0)} km` : "All distances";
  }
  const previous = bands[index - 1];
  if (!previous || !isFiniteRangeMax(previous.maxKm)) return `0-${numberFmt(band.maxKm, 0)} km`;
  return `${numberFmt(previous.maxKm, 0)}-${numberFmt(band.maxKm, 0)} km`;
}

function rangeBandColor(index, total) {
  if (total <= 1) return "#e0a72f";
  const hue = (42 + index * 137.508) % 360;
  return `hsl(${Math.round(hue)}, 78%, 55%)`;
}

function radiusBandSegments(radiusKm) {
  const radius = Number(radiusKm);
  if (!Number.isFinite(radius) || radius <= 0) return [];
  const bands = sortedRangeBands();
  const segments = [];
  let lower = 0;
  for (let index = 0; index < bands.length; index += 1) {
    const band = bands[index];
    const upper = isFiniteRangeMax(band.maxKm)
      ? Math.min(Number(band.maxKm), radius)
      : radius;
    if (upper > lower) {
      segments.push({
        id: band.id,
        label: rangeBandLabel(band, index, bands),
        lowerKm: lower,
        upperKm: upper,
        color: rangeBandColor(index, bands.length),
      });
    }
    if (radius <= upper) break;
    lower = upper;
  }
  return segments;
}

function bandForDistance(distanceKm) {
  const bands = sortedRangeBands();
  return bands.find((band) => !isFiniteRangeMax(band.maxKm) || distanceKm <= Number(band.maxKm)) || bands[bands.length - 1];
}

function layerInfoById(layerId) {
  return state.manifest?.layers?.find((layer) => layer.id === layerId) || null;
}

function layerLabel(layerId) {
  return layerInfoById(layerId)?.label || layerId || "Unknown layer";
}

function categoryRequirement(layerId) {
  return boundedNumber(state.estimator.categoryRequirements[layerId], 1, 0, 1000000);
}

function setCategoryRequirement(layerId, value) {
  state.estimator.categoryRequirements[layerId] = boundedNumber(value, 1, 0, 1000000);
}

function summarizeEstimatorResults() {
  const groups = new Map();
  for (const item of state.radiusResults) {
    const feature = item.stored.feature;
    const p = feature.properties || {};
    const layerId = p.map_layer || p.source_layer || "unknown";
    if (!groups.has(layerId)) {
      groups.set(layerId, {
        layerId,
        label: layerLabel(layerId),
        count: 0,
        subcategories: new Map(),
        bands: new Map(),
      });
    }
    const group = groups.get(layerId);
    const subcategoryLabel = p.derived_subcategory_label || p.asset_type || featureSubcategory(feature);
    const band = bandForDistance(item.distance);
    const bandKey = band.id;
    group.count += 1;
    group.subcategories.set(subcategoryLabel, (group.subcategories.get(subcategoryLabel) || 0) + 1);
    group.bands.set(bandKey, {
      band,
      count: (group.bands.get(bandKey)?.count || 0) + 1,
    });
  }
  return [...groups.values()].sort((a, b) => a.label.localeCompare(b.label));
}

function estimateUnits(count, unitsPerItem, completionRate) {
  if (count <= 0 || unitsPerItem <= 0) return 0;
  if (completionRate <= 0) return Infinity;
  return Math.ceil((count * unitsPerItem) / (completionRate / 100));
}

function formatEstimatedUnits(value) {
  return Number.isFinite(value) ? value.toLocaleString() : "n/a";
}

function addEstimatedUnits(current, value) {
  if (!Number.isFinite(current) || !Number.isFinite(value)) return Infinity;
  return current + value;
}

function estimatedUnitsEqual(a, b) {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return !Number.isFinite(a) && !Number.isFinite(b);
  return a === b;
}

function estimatorDetailRows() {
  const rows = [];
  const groups = summarizeEstimatorResults();
  const bands = sortedRangeBands();
  for (const group of groups) {
    const unitsPerItem = categoryRequirement(group.layerId);
    for (let bandIndex = 0; bandIndex < bands.length; bandIndex += 1) {
      const band = bands[bandIndex];
      const bandSummary = group.bands.get(band.id);
      if (!bandSummary) continue;
      const bandLabel = rangeBandLabel(bandSummary.band, bandIndex);
      for (const resource of state.estimator.resources) {
        rows.push({
          row_type: "detail",
          layer_id: group.layerId,
          layer_label: group.label,
          range_band: bandLabel,
          item_count: bandSummary.count,
          units_per_item: unitsPerItem,
          resource_id: resource.id,
          resource_label: resource.label,
          completion_rate_percent: resource.completionRate,
          estimated_units: estimateUnits(bandSummary.count, unitsPerItem, resource.completionRate),
        });
      }
    }
  }
  return rows;
}

function buildEstimatorAggregates(detailRows = estimatorDetailRows()) {
  const resources = state.estimator.resources.map((resource) => ({
    id: resource.id,
    label: resource.label,
  }));
  const resourceKeys = resources.map((resource) => resource.id);
  const totalByResource = new Map(resourceKeys.map((key) => [key, 0]));
  const rangeBands = new Map();
  const rangeBandOrder = [];
  const grandTotal = { value: 0 };

  function emptyResourceMap() {
    return new Map(resourceKeys.map((key) => [key, 0]));
  }

  for (const row of detailRows) {
    const resourceKey = row.resource_id || row.resource_label;
    if (!totalByResource.has(resourceKey)) totalByResource.set(resourceKey, 0);
    if (!rangeBands.has(row.range_band)) {
      rangeBands.set(row.range_band, {
        label: row.range_band,
        resources: emptyResourceMap(),
        layers: new Map(),
        rowTotal: 0,
      });
      rangeBandOrder.push(row.range_band);
    }

    const band = rangeBands.get(row.range_band);
    if (!band.layers.has(row.layer_id)) {
      band.layers.set(row.layer_id, {
        id: row.layer_id,
        label: row.layer_label,
        resources: emptyResourceMap(),
        rowTotal: 0,
      });
    }

    const layer = band.layers.get(row.layer_id);
    totalByResource.set(resourceKey, addEstimatedUnits(totalByResource.get(resourceKey) || 0, row.estimated_units));
    band.resources.set(resourceKey, addEstimatedUnits(band.resources.get(resourceKey) || 0, row.estimated_units));
    band.rowTotal = addEstimatedUnits(band.rowTotal, row.estimated_units);
    layer.resources.set(resourceKey, addEstimatedUnits(layer.resources.get(resourceKey) || 0, row.estimated_units));
    layer.rowTotal = addEstimatedUnits(layer.rowTotal, row.estimated_units);
    grandTotal.value = addEstimatedUnits(grandTotal.value, row.estimated_units);
  }

  return {
    resources,
    totalByResource,
    rangeBands,
    rangeBandOrder,
    grandTotal: grandTotal.value,
  };
}

function validateEstimatorAggregates(detailRows, aggregate) {
  const detailGrandTotal = detailRows.reduce((sum, row) => addEstimatedUnits(sum, row.estimated_units), 0);
  const resourceGrandTotal = [...aggregate.totalByResource.values()]
    .reduce((sum, value) => addEstimatedUnits(sum, value), 0);
  const rangeBandGrandTotal = [...aggregate.rangeBands.values()]
    .reduce((sum, band) => addEstimatedUnits(sum, band.rowTotal), 0);
  const valid = estimatedUnitsEqual(detailGrandTotal, aggregate.grandTotal)
    && estimatedUnitsEqual(resourceGrandTotal, aggregate.grandTotal)
    && estimatedUnitsEqual(rangeBandGrandTotal, aggregate.grandTotal);
  if (!valid) {
    console.warn("Estimator aggregate mismatch.", {
      detailGrandTotal,
      resourceGrandTotal,
      rangeBandGrandTotal,
      aggregateGrandTotal: aggregate.grandTotal,
    });
  }
  return valid;
}

function estimatorExportRows() {
  const detailRows = estimatorDetailRows();
  const aggregate = buildEstimatorAggregates(detailRows);
  validateEstimatorAggregates(detailRows, aggregate);
  const rows = [...detailRows];

  for (const bandLabel of aggregate.rangeBandOrder) {
    const band = aggregate.rangeBands.get(bandLabel);
    for (const resource of aggregate.resources) {
      rows.push({
        row_type: "range_band_total",
        layer_id: "",
        layer_label: "",
        range_band: band.label,
        item_count: "",
        units_per_item: "",
        resource_id: resource.id,
        resource_label: resource.label,
        completion_rate_percent: "",
        estimated_units: band.resources.get(resource.id) || 0,
      });
    }
  }

  for (const resource of aggregate.resources) {
    rows.push({
      row_type: "resource_total",
      layer_id: "",
      layer_label: "",
      range_band: "",
      item_count: "",
      units_per_item: "",
      resource_id: resource.id,
      resource_label: resource.label,
      completion_rate_percent: "",
      estimated_units: aggregate.totalByResource.get(resource.id) || 0,
    });
  }

  rows.push({
    row_type: "grand_total",
    layer_id: "",
    layer_label: "",
    range_band: "",
    item_count: "",
    units_per_item: "",
    resource_id: "",
    resource_label: "",
    completion_rate_percent: "",
    estimated_units: aggregate.grandTotal,
  });

  return rows;
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
  return colorForLayer(properties.map_layer || properties.source_layer, properties.map_color);
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
  const source = p.source_url
    ? `<a href="${escapeHtml(p.source_url)}" target="_blank" rel="noopener">source</a>`
    : "";
  return `
    <h3 class="popup-title">${escapeHtml(p.display_label || p.name || "Unnamed feature")}</h3>
    <dl class="popup-table">${detailRows(p)}</dl>
    ${source ? `<div style="margin-top:8px;font-size:12px">${source}</div>` : ""}
  `;
}

function rememberFeature(feature, latlng) {
  const point = featurePoint(feature, latlng);
  const stored = {
    id: feature.id,
    feature,
    point,
    layer: null,
    radiusDimmed: false,
  };
  state.features.set(feature.id, stored);
  return stored;
}

function createLeafletLayer(featureCollection) {
  const cluster = L.markerClusterGroup({
    disableClusteringAtZoom: 9,
    maxClusterRadius: 24,
    showCoverageOnHover: false,
  });
  const lines = L.geoJSON(null, {
    style: styleFeature,
    onEachFeature(feature, layer) {
      const stored = rememberFeature(feature);
      stored.layer = layer;
      layer.bindPopup(() => popupHtml(feature));
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

function setStoredFeatureRadiusDimmed(stored, dimmed) {
  if (!stored?.layer || stored.radiusDimmed === dimmed) return;
  stored.radiusDimmed = dimmed;
  if (typeof stored.layer.setOpacity === "function") {
    stored.layer.setOpacity(dimmed ? OUT_OF_RADIUS_POINT_OPACITY : 1);
  }
  if (typeof stored.layer.setStyle === "function") {
    const normalStyle = styleFeature(stored.feature);
    const stylePatch = { opacity: dimmed ? OUT_OF_RADIUS_LINE_OPACITY : normalStyle.opacity };
    if (normalStyle.fillOpacity !== undefined || dimmed) {
      stylePatch.fillOpacity = dimmed ? OUT_OF_RADIUS_LINE_OPACITY : normalStyle.fillOpacity;
    }
    stored.layer.setStyle(stylePatch);
  }
  stored.layer.getElement?.()?.classList?.toggle("radius-outside", dimmed);
}

function clearRadiusDimming() {
  for (const stored of state.features.values()) {
    setStoredFeatureRadiusDimmed(stored, false);
  }
}

function applyRadiusDimming(activeFeatures, radiusResults) {
  const activeIds = new Set(activeFeatures.map((stored) => stored.id));
  const insideIds = new Set(radiusResults.map((item) => item.stored.id));
  for (const stored of state.features.values()) {
    setStoredFeatureRadiusDimmed(stored, activeIds.has(stored.id) && !insideIds.has(stored.id));
  }
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
    toggleButton.innerHTML = `<span aria-hidden="true"></span>`;
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
  els.clearCountriesBtn.disabled = countries.length === 0;

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

function clearAllCountries() {
  for (const checkbox of state.countryControls.values()) {
    checkbox.checked = false;
  }
  state.countryFilters.clear();
  refreshAllLayerFilters();
  savePreferencesNow();
}

function clearAllLayers() {
  for (const [layerId, checkbox] of state.layerControls.entries()) {
    if (!checkbox.checked && !checkbox.indeterminate) continue;
    for (const control of state.layerSubcategoryControls.get(layerId) || []) {
      control.checked = false;
    }
    state.subcategoryFilters.set(layerId, new Set());
    checkbox.checked = false;
    checkbox.indeterminate = false;
    unloadLayer({ id: layerId });
  }
  savePreferencesNow();
}

function colorForLayer(layerId, fallbackColor = null) {
  const colors = {
    military_industrial: "#1247b8",
    military_sites: "#2f78ff",
    military_boundaries: "#9ac4ff",
    energy_oil: "#7b2d12",
    energy_gas: "#b4461b",
    energy_facilities: "#e46a25",
    power_facilities: "#ffd34d",
    power_lines: "#ffac12",
    transport_rail: "#0f8f9a",
    transport_other: "#19b7a5",
    other_infrastructure: "#7a8899",
  };
  return colors[layerId] || fallbackColor || "#999999";
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

function syncOverlaysWithVisibleLayers() {
  if (state.radiusOrigin && Number.isFinite(state.radiusKm)) {
    renderRadiusResults(state.radiusOrigin, state.radiusKm);
  }
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
  });
  return button;
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

function applySavedInterfaceState() {
  const prefs = state.savedPreferences;
  const collapsedEstimatorBlocks = savedEstimatorBlockSet();
  for (const block of ESTIMATOR_BLOCKS) {
    setEstimatorBlockCollapsed(block.key, collapsedEstimatorBlocks.has(block.key), false);
  }
  if (!prefs) {
    setLayersPanelCollapsed(false, false);
    setCountriesPanelCollapsed(false, false);
    return;
  }

  setLayersPanelCollapsed(prefs.layersPanelCollapsed === true, false);
  setCountriesPanelCollapsed(savedCountriesPanelCollapsed(), false);
  if (typeof prefs.search === "string") els.searchInput.value = prefs.search;

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

function setCountriesPanelCollapsed(collapsed, persist = true) {
  els.countriesPanel.classList.toggle("collapsed", collapsed);
  els.countriesPanelBody.hidden = collapsed;
  els.countriesPanelToggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
  els.countriesPanelToggle.setAttribute("aria-label", `${collapsed ? "Expand" : "Collapse"} Countries`);
  if (persist) queueSavePreferences();
}

function setEstimatorBlockCollapsed(key, collapsed, persist = true) {
  const block = ESTIMATOR_BLOCKS.find((item) => item.key === key);
  if (!block) return;
  const blockElement = els[`${key}Block`];
  const body = els[`${key}Body`];
  const toggle = els[`${key}Toggle`];
  blockElement.classList.toggle("collapsed", collapsed);
  body.hidden = collapsed;
  toggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
  toggle.setAttribute("aria-label", `${collapsed ? "Expand" : "Collapse"} ${block.label}`);
  if (persist) queueSavePreferences();
}

function clearRadiusBandCircles() {
  for (const circle of state.radiusBandCircles) {
    map.removeLayer(circle);
  }
  state.radiusBandCircles = [];
}

function drawRadiusBandCircles(origin, radiusKm) {
  clearRadiusBandCircles();
  if (!origin || !Number.isFinite(radiusKm) || radiusKm <= 0) return;
  const segments = radiusBandSegments(radiusKm);
  for (const segment of [...segments].reverse()) {
    const circle = L.circle(origin, {
      radius: segment.upperKm * 1000,
      color: segment.color,
      weight: 2,
      opacity: 0.82,
      fillColor: segment.color,
      fillOpacity: 0.28,
      interactive: false,
    }).addTo(map);
    circle.rangeBandSegment = segment;
    state.radiusBandCircles.unshift(circle);
  }
}

function drawStoredRadius(origin, radiusKm) {
  if (state.radiusCircle) map.removeLayer(state.radiusCircle);
  if (state.radiusLine) map.removeLayer(state.radiusLine);
  if (state.radiusLabel) map.removeLayer(state.radiusLabel);
  clearRadiusBandCircles();
  drawRadiusBandCircles(origin, radiusKm);
  state.radiusCircle = L.circle(origin, {
    radius: radiusKm * 1000,
    color: "#f3d46b",
    weight: 3,
    opacity: 0.98,
    fillOpacity: 0,
    interactive: false,
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

function updateRadiusOverlay(radiusKm, origin = state.radiusOrigin || state.radiusStart) {
  if (!Number.isFinite(radiusKm) || radiusKm <= 0) return;
  drawRadiusBandCircles(origin, radiusKm);
  if (state.radiusCircle) {
    state.radiusCircle.setRadius(radiusKm * 1000);
  }
  if (state.radiusLabel) {
    state.radiusLabel.setIcon(L.divIcon({
      className: "radius-distance-label",
      html: `${numberFmt(radiusKm, 1)} km`,
      iconSize: [82, 28],
      iconAnchor: [-8, 14],
    }));
  }
}

function updateRadiusPanelDetails(origin, radiusKm) {
  if (!origin || !Number.isFinite(radiusKm)) {
    els.radiusCenterLabel.textContent = "No radius";
    els.radiusKmInput.value = "";
    return;
  }
  els.radiusCenterLabel.textContent = `${coordinateFmt(origin.lat)}, ${coordinateFmt(origin.lng)}`;
  if (document.activeElement !== els.radiusKmInput) {
    els.radiusKmInput.value = String(Number(radiusKm.toFixed(1)));
  }
}

function applyRadiusInputValue() {
  if (!state.radiusOrigin || !Number.isFinite(state.radiusKm)) return;
  const radiusKm = positiveFiniteNumber(els.radiusKmInput.value, state.radiusKm, 0.1);
  els.radiusKmInput.value = String(Number(radiusKm.toFixed(1)));
  updateRadiusOverlay(radiusKm);
  renderRadiusResults(state.radiusOrigin, radiusKm);
}

function refreshRadiusRangeOverlay() {
  if (!state.radiusOrigin || !Number.isFinite(state.radiusKm)) return;
  updateRadiusOverlay(state.radiusKm);
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

function renderRangeBands() {
  els.rangeBandsList.innerHTML = "";
  const bands = sortedRangeBands();
  for (let index = 0; index < bands.length; index += 1) {
    const band = bands[index];
    const row = document.createElement("div");
    row.className = "estimator-row range-band-row";
    const label = document.createElement("span");
    label.className = "estimator-label";
    label.innerHTML = `
      <strong class="range-band-label">
        <i class="range-band-swatch" style="background: ${rangeBandColor(index, bands.length)}" aria-hidden="true"></i>
        <span>${escapeHtml(rangeBandLabel(band, index, bands))}</span>
      </strong>
      <span>Upper bound in km</span>
    `;
    const input = document.createElement("input");
    input.type = "number";
    input.min = "1";
    input.step = "1";
    input.value = isFiniteRangeMax(band.maxKm) ? String(band.maxKm) : "";
    input.placeholder = "Open";
    input.disabled = !isFiniteRangeMax(band.maxKm);
    const applyButton = document.createElement("button");
    applyButton.type = "button";
    applyButton.className = "icon-btn";
    applyButton.innerHTML = `<span aria-hidden="true">&#10003;</span>`;
    applyButton.setAttribute("aria-label", `Apply ${rangeBandLabel(band, index, bands)} upper bound`);
    applyButton.hidden = input.disabled;
    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "icon-btn";
    removeButton.innerHTML = `<span aria-hidden="true">&times;</span>`;
    removeButton.setAttribute("aria-label", `Remove ${rangeBandLabel(band, index, bands)}`);
    removeButton.hidden = input.disabled || finiteRangeBands().length <= 1;
    row.append(label, input, applyButton, removeButton);
    els.rangeBandsList.appendChild(row);

    const applyValue = () => {
      const updated = state.estimator.rangeBands.map((item) => (
        item.id === band.id ? { ...item, maxKm: positiveNumber(input.value, band.maxKm, 1) } : item
      ));
      state.estimator.rangeBands = normalizeEstimatorAssumptions({
        ...state.estimator,
        rangeBands: updated,
      }).rangeBands;
      renderRangeBands();
      refreshRadiusRangeOverlay();
      renderEstimatorResults();
      savePreferencesNow();
    };

    applyButton.addEventListener("click", applyValue);
    input.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      applyValue();
    });

    removeButton.addEventListener("click", () => {
      state.estimator.rangeBands = normalizeEstimatorAssumptions({
        ...state.estimator,
        rangeBands: state.estimator.rangeBands.filter((item) => item.id !== band.id),
      }).rangeBands;
      renderRangeBands();
      refreshRadiusRangeOverlay();
      renderEstimatorResults();
      savePreferencesNow();
    });
  }
}

function renderResourceTypes() {
  els.resourceTypesList.innerHTML = "";
  for (const resource of state.estimator.resources) {
    const row = document.createElement("div");
    row.className = "estimator-row";
    const labelInput = document.createElement("input");
    labelInput.type = "text";
    labelInput.value = resource.label;
    labelInput.setAttribute("aria-label", `${resource.label} label`);
    const rateInput = document.createElement("input");
    rateInput.type = "number";
    rateInput.min = "0";
    rateInput.max = "100";
    rateInput.step = "1";
    rateInput.value = String(resource.completionRate);
    rateInput.setAttribute("aria-label", `${resource.label} completion rate percent`);
    row.append(labelInput, rateInput);
    els.resourceTypesList.appendChild(row);

    labelInput.addEventListener("input", () => {
      resource.label = labelInput.value.trim().slice(0, 60) || resource.label;
      renderEstimatorResults();
      queueSavePreferences();
    });
    rateInput.addEventListener("input", () => {
      resource.completionRate = boundedNumber(rateInput.value, resource.completionRate, 0, 100);
      renderEstimatorResults();
      queueSavePreferences();
    });
  }
}

function renderCategoryAssumptions() {
  els.categoryAssumptionsList.innerHTML = "";
  const layers = groupedLayerInfos().flatMap((group) => group.layers);
  for (const layerInfo of layers) {
    if (!Object.prototype.hasOwnProperty.call(state.estimator.categoryRequirements, layerInfo.id)) {
      state.estimator.categoryRequirements[layerInfo.id] = 1;
    }
    const row = document.createElement("div");
    row.className = "estimator-row";
    const label = document.createElement("span");
    label.className = "estimator-label";
    label.innerHTML = `<strong>${escapeHtml(layerInfo.label)}</strong><span>Units per item</span>`;
    const input = document.createElement("input");
    input.type = "number";
    input.min = "0";
    input.step = "0.1";
    input.value = String(categoryRequirement(layerInfo.id));
    input.setAttribute("aria-label", `${layerInfo.label} units per item`);
    row.append(label, input);
    els.categoryAssumptionsList.appendChild(row);

    input.addEventListener("input", () => {
      setCategoryRequirement(layerInfo.id, input.value);
      renderEstimatorResults();
      queueSavePreferences();
    });
  }
}

function renderEstimatorProfiles(selectedId = els.estimatorProfileSelect.value) {
  els.estimatorProfileSelect.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = state.estimator.profiles.length ? "Select profile..." : "No saved profiles";
  els.estimatorProfileSelect.appendChild(placeholder);

  for (const profile of state.estimator.profiles) {
    const option = document.createElement("option");
    option.value = profile.id;
    option.textContent = profile.name;
    els.estimatorProfileSelect.appendChild(option);
  }

  if (state.estimator.profiles.some((profile) => profile.id === selectedId)) {
    els.estimatorProfileSelect.value = selectedId;
  } else {
    els.estimatorProfileSelect.value = "";
  }
  const hasSelection = !!els.estimatorProfileSelect.value;
  els.estimatorProfileSelect.disabled = !state.estimator.profiles.length;
  els.loadEstimatorProfileBtn.disabled = !hasSelection;
  els.deleteEstimatorProfileBtn.disabled = !hasSelection;
}

function selectedEstimatorProfile() {
  const profileIdValue = els.estimatorProfileSelect.value;
  return state.estimator.profiles.find((profile) => profile.id === profileIdValue) || null;
}

function saveEstimatorProfile() {
  const suggested = selectedEstimatorProfile()?.name || "New profile";
  const name = window.prompt?.("Profile name", suggested);
  if (name === null || name === undefined) return;
  const profile = estimatorProfileSnapshot(name);
  if (!profile.name) return;
  const existingIndex = state.estimator.profiles.findIndex((item) => item.id === profile.id);
  if (existingIndex >= 0) {
    state.estimator.profiles[existingIndex] = profile;
  } else {
    state.estimator.profiles.push(profile);
  }
  state.estimator.profiles.sort((a, b) => a.name.localeCompare(b.name));
  renderEstimatorProfiles(profile.id);
  savePreferencesNow();
}

function loadEstimatorProfile() {
  const profile = selectedEstimatorProfile();
  if (!profile) return;
  const normalized = normalizeEstimatorAssumptions({
    ...state.estimator,
    rangeBands: profile.rangeBands,
    resources: profile.resources,
    categoryRequirements: profile.categoryRequirements,
  });
  state.estimator.rangeBands = normalized.rangeBands;
  state.estimator.resources = normalized.resources;
  state.estimator.categoryRequirements = normalized.categoryRequirements;
  renderRangeBands();
  refreshRadiusRangeOverlay();
  renderResourceTypes();
  renderCategoryAssumptions();
  renderEstimatorResults();
  savePreferencesNow();
}

function deleteEstimatorProfile() {
  const profile = selectedEstimatorProfile();
  if (!profile) return;
  state.estimator.profiles = state.estimator.profiles.filter((item) => item.id !== profile.id);
  renderEstimatorProfiles();
  savePreferencesNow();
}

function renderSummaryDisplayControls() {
  enforceSummaryDisplaySelection();
  els.summaryDisplayControls.innerHTML = "";
  const fieldset = document.createElement("fieldset");
  fieldset.className = "summary-view-group";
  const legend = document.createElement("legend");
  legend.textContent = "Summary view";
  fieldset.appendChild(legend);
  for (const option of SUMMARY_DISPLAY_OPTIONS) {
    const label = document.createElement("label");
    label.className = "summary-toggle";
    const input = document.createElement("input");
    input.type = "radio";
    input.name = "summaryView";
    input.value = option.key;
    input.checked = state.estimator.summaryDisplay[option.key] !== false;
    const text = document.createElement("span");
    text.textContent = option.label;
    label.append(input, text);
    fieldset.appendChild(label);

    input.addEventListener("change", () => {
      if (!input.checked) return;
      state.estimator.summaryDisplay.compactTotals = option.key === "compactTotals";
      state.estimator.summaryDisplay.rangeBandMatrix = option.key === "rangeBandMatrix";
      renderEstimatorResults();
      queueSavePreferences();
    });
  }
  els.summaryDisplayControls.appendChild(fieldset);

  const detailsLabel = document.createElement("label");
  detailsLabel.className = "summary-toggle summary-detail-toggle";
  const detailsInput = document.createElement("input");
  detailsInput.type = "checkbox";
  detailsInput.checked = state.estimator.summaryDisplay.detailedBreakdown !== false;
  const detailsText = document.createElement("span");
  detailsText.textContent = "Show detailed breakdown";
  detailsLabel.append(detailsInput, detailsText);
  els.summaryDisplayControls.appendChild(detailsLabel);

  detailsInput.addEventListener("change", () => {
    state.estimator.summaryDisplay.detailedBreakdown = detailsInput.checked;
    renderEstimatorResults();
    queueSavePreferences();
  });
}

function resourceValueCells(resources, values) {
  return resources
    .map((resource) => `<td>${formatEstimatedUnits(values.get(resource.id) || 0)}</td>`)
    .join("");
}

function renderCompactResourceTotals(aggregate, target = els.estimatorResults) {
  const card = document.createElement("article");
  card.className = "estimate-summary-card";
  const totalLines = aggregate.resources.map((resource) => `
    <div class="estimate-line">
      <span>${escapeHtml(resource.label)}</span>
      <b>${formatEstimatedUnits(aggregate.totalByResource.get(resource.id) || 0)}</b>
    </div>
  `).join("");
  card.innerHTML = `
    <div class="estimate-card-header">
      <strong>Total by resource type</strong>
      <span class="estimate-count">${formatEstimatedUnits(aggregate.grandTotal)}</span>
    </div>
    <div class="estimate-lines">${totalLines}</div>
  `;
  target.appendChild(card);
}

function renderRangeBandMatrix(aggregate, target = els.estimatorResults) {
  const wrapper = document.createElement("div");
  wrapper.className = "estimate-matrix-wrap";
  const resourceHeaders = aggregate.resources
    .map((resource) => `<th scope="col">${escapeHtml(resource.label)}</th>`)
    .join("");
  const rows = [];
  for (const bandLabel of aggregate.rangeBandOrder) {
    const band = aggregate.rangeBands.get(bandLabel);
    rows.push(`
      <tr class="matrix-total-row">
        <th scope="row">${escapeHtml(band.label)}</th>
        ${resourceValueCells(aggregate.resources, band.resources)}
        <td>${formatEstimatedUnits(band.rowTotal)}</td>
      </tr>
    `);
    for (const layer of [...band.layers.values()].sort((a, b) => a.label.localeCompare(b.label))) {
      rows.push(`
        <tr>
          <th scope="row"><span>${escapeHtml(layer.label)}</span></th>
          ${resourceValueCells(aggregate.resources, layer.resources)}
          <td>${formatEstimatedUnits(layer.rowTotal)}</td>
        </tr>
      `);
    }
  }
  rows.push(`
    <tr class="matrix-grand-row">
      <th scope="row">Grand total</th>
      ${resourceValueCells(aggregate.resources, aggregate.totalByResource)}
      <td>${formatEstimatedUnits(aggregate.grandTotal)}</td>
    </tr>
  `);
  wrapper.innerHTML = `
    <table class="estimate-matrix">
      <thead>
        <tr>
          <th scope="col">Range band / layer</th>
          ${resourceHeaders}
          <th scope="col">Total</th>
        </tr>
      </thead>
      <tbody>${rows.join("")}</tbody>
    </table>
  `;
  target.appendChild(wrapper);
}

function renderDetailedEstimatorCards(detailRows) {
  const bands = sortedRangeBands();
  for (const group of summarizeEstimatorResults()) {
    const unitsPerItem = categoryRequirement(group.layerId);
    const layerRows = detailRows.filter((row) => row.layer_id === group.layerId);
    const layerResourceTotals = new Map(state.estimator.resources.map((resource) => [resource.id, 0]));
    for (const row of layerRows) {
      layerResourceTotals.set(
        row.resource_id,
        addEstimatedUnits(layerResourceTotals.get(row.resource_id) || 0, row.estimated_units)
      );
    }
    const card = document.createElement("article");
    card.className = "estimate-card";
    const subcategories = [...group.subcategories.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([label, count]) => `${label}: ${count.toLocaleString()}`)
      .join(" / ");
    const resourceLines = state.estimator.resources.map((resource) => `
      <div class="estimate-line">
        <span>${escapeHtml(resource.label)} at ${numberFmt(resource.completionRate, 0)}%</span>
        <b>${formatEstimatedUnits(layerResourceTotals.get(resource.id) || 0)}</b>
      </div>
    `).join("");
    const bandLines = bands
      .map((band, index) => {
        const summary = group.bands.get(band.id);
        if (!summary) return "";
        return `${escapeHtml(rangeBandLabel(band, index, bands))}: ${summary.count.toLocaleString()}`;
      })
      .filter(Boolean)
      .join(" / ");
    card.innerHTML = `
      <div class="estimate-card-header">
        <strong>${escapeHtml(group.label)}</strong>
        <span class="estimate-count">${group.count.toLocaleString()}</span>
      </div>
      <span>Category factor: ${numberFmt(unitsPerItem, 2)} per item</span>
      <div class="estimate-lines">${resourceLines}</div>
      <div class="estimate-subcategories">${escapeHtml(bandLines || "No range-band split")}</div>
      ${subcategories ? `<div class="estimate-subcategories">${escapeHtml(subcategories)}</div>` : ""}
    `;
    els.estimatorResults.appendChild(card);
  }
}

function renderEstimatorResults() {
  enforceSummaryDisplaySelection();
  const total = state.radiusResults.length;
  els.estimatorSummary.textContent = total
    ? `${total.toLocaleString()} items`
    : "Draw a radius";
  els.estimatorRadiusLabel.textContent = state.radiusOrigin && Number.isFinite(state.radiusKm)
    ? `${numberFmt(state.radiusKm, 1)} km radius`
    : "Active layers only";
  els.estimatorSummaryResults.innerHTML = "";
  els.estimatorResults.innerHTML = "";
  renderSummaryDisplayControls();

  if (!total) {
    els.estimatorSummaryResults.hidden = true;
    els.estimatorResults.hidden = false;
    els.estimatorResults.innerHTML = `<div class="muted">No active-layer items inside the current radius.</div>`;
    return;
  }

  const detailRows = estimatorDetailRows();
  const aggregate = buildEstimatorAggregates(detailRows);
  validateEstimatorAggregates(detailRows, aggregate);
  if (state.estimator.summaryDisplay.compactTotals) renderCompactResourceTotals(aggregate, els.estimatorSummaryResults);
  if (state.estimator.summaryDisplay.rangeBandMatrix) renderRangeBandMatrix(aggregate, els.estimatorSummaryResults);
  els.estimatorSummaryResults.hidden = !els.estimatorSummaryResults.children.length;
  if (state.estimator.summaryDisplay.detailedBreakdown) renderDetailedEstimatorCards(detailRows);
  els.estimatorResults.hidden = !state.estimator.summaryDisplay.detailedBreakdown;
  els.estimatorSummaryResults.scrollTop = 0;
  els.estimatorResults.scrollTop = 0;
}

function renderEstimator() {
  if (!state.manifest) return;
  renderEstimatorProfiles();
  renderRangeBands();
  refreshRadiusRangeOverlay();
  renderResourceTypes();
  renderCategoryAssumptions();
  renderEstimatorResults();
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
  clearRadiusBandCircles();
  state.radiusStart = null;
  state.radiusOrigin = null;
  state.radiusKm = null;
  state.radiusResults = [];
  state.radiusHighlightGroup.clearLayers();
  clearRadiusDimming();
  els.radiusPanel.hidden = true;
  els.radiusResults.innerHTML = "";
  els.radiusSummary.textContent = "0 objects";
  updateRadiusPanelDetails(null, null);
  renderEstimatorResults();
  queueSavePreferences();
}

function renderRadiusResults(origin, radiusKm) {
  const normalizedRadiusKm = positiveFiniteNumber(radiusKm, 0, 0.1);
  if (!Number.isFinite(normalizedRadiusKm) || normalizedRadiusKm <= 0) return;
  state.radiusHighlightGroup.clearLayers();
  state.radiusOrigin = origin;
  state.radiusKm = normalizedRadiusKm;
  updateRadiusOverlay(normalizedRadiusKm);
  updateRadiusPanelDetails(origin, normalizedRadiusKm);
  const activeFeatures = loadedVisibleFeatures();
  const results = activeFeatures
    .map((stored) => ({ stored, distance: featureDistanceToPointKm(stored.feature, origin) }))
    .filter((item) => item.distance <= normalizedRadiusKm)
    .sort((a, b) => a.distance - b.distance);
  state.radiusResults = results;
  applyRadiusDimming(activeFeatures, results);
  els.radiusPanel.hidden = false;
  els.radiusSummary.textContent = `${results.length.toLocaleString()} objects • ${numberFmt(normalizedRadiusKm, 1)} km • active layers only`;
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
  renderEstimatorResults();
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
    color: "#f3d46b",
    weight: 3,
    opacity: 0.98,
    fillOpacity: 0,
    interactive: false,
  }).addTo(map);
  updateRadiusOverlay(0.1, state.radiusStart);
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
  updateRadiusOverlay(radiusKm, state.radiusStart);
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
  updateRadiusOverlay(radiusKm, state.radiusStart);
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

function downloadTextFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function exportEstimatorAssumptions() {
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    estimator: serializeEstimatorAssumptions(),
  };
  downloadTextFile(
    `scenario_estimator_settings_${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
    JSON.stringify(payload, null, 2),
    "application/json;charset=utf-8"
  );
}

function importEstimatorAssumptionsFromText(text) {
  const parsed = JSON.parse(text);
  const assumptions = parsed?.estimator || parsed;
  state.estimator = normalizeEstimatorAssumptions({
    ...assumptions,
    profiles: Array.isArray(assumptions?.profiles) ? assumptions.profiles : state.estimator.profiles,
  });
  renderEstimator();
  savePreferencesNow();
}

function resetEstimatorAssumptions() {
  state.estimator = normalizeEstimatorAssumptions({
    profiles: state.estimator.profiles,
  });
  renderEstimator();
  savePreferencesNow();
}

function buildEstimatorCsv() {
  const fields = [
    "row_type",
    "layer_id",
    "layer_label",
    "range_band",
    "item_count",
    "units_per_item",
    "resource_id",
    "resource_label",
    "completion_rate_percent",
    "estimated_units",
  ];
  const lines = [fields.join(",")];
  for (const row of estimatorExportRows()) {
    lines.push(fields.map((field) => csvEscape(row[field])).join(","));
  }
  return lines.join("\r\n");
}

function exportEstimatorCsv() {
  if (!state.radiusResults.length) {
    alert("No estimate to export. Draw a radius first.");
    return;
  }
  downloadTextFile(
    `scenario_estimate_${new Date().toISOString().replace(/[:.]/g, "-")}.csv`,
    buildEstimatorCsv(),
    "text/csv;charset=utf-8"
  );
}

async function init() {
  const manifestResponse = await fetch(DATA_DIR + "manifest.json");
  state.manifest = await manifestResponse.json();
  els.datasetSummary.textContent = `${state.manifest.total_features.toLocaleString()} normalized records across ${state.manifest.layers.length} layers`;
  applySavedInterfaceState();
  renderCountries();
  await renderLayers();
  restoreSavedRadius();
  renderEstimator();
  renderSearch();
  state.persistenceReady = true;
  savePreferencesNow();
}

setupInfoButtons();
els.searchInput.addEventListener("input", () => {
  renderSearch();
  queueSavePreferences();
});
els.fitLoadedBtn.addEventListener("click", fitLoadedLayers);
els.layersPanelToggle.addEventListener("click", () => {
  setLayersPanelCollapsed(!els.layersPanelBody.hidden);
});
els.countriesPanelToggle.addEventListener("click", () => {
  setCountriesPanelCollapsed(!els.countriesPanelBody.hidden);
});
els.radiusModeBtn.addEventListener("click", () => setRadiusMode(!state.radiusMode));
els.resetRadiusBtn.addEventListener("click", () => {
  resetRadius();
  setRadiusMode(false);
  map.dragging.enable();
});
els.radiusKmInput.addEventListener("change", applyRadiusInputValue);
els.radiusKmInput.addEventListener("blur", applyRadiusInputValue);
els.radiusKmInput.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  applyRadiusInputValue();
});
els.exportRadiusBtn.addEventListener("click", exportRadiusCsv);
els.addRangeBandBtn.addEventListener("click", () => {
  const bands = finiteRangeBands();
  const last = bands[bands.length - 1]?.maxKm || 500;
  const nextMax = Math.round(Number(last) + 500);
  state.estimator.rangeBands = normalizeEstimatorAssumptions({
    ...state.estimator,
    rangeBands: [
      ...bands,
      { id: `band_${Date.now()}`, maxKm: nextMax },
    ],
  }).rangeBands;
  renderRangeBands();
  refreshRadiusRangeOverlay();
  renderEstimatorResults();
  savePreferencesNow();
});
els.exportAssumptionsBtn.addEventListener("click", exportEstimatorAssumptions);
els.importAssumptionsBtn.addEventListener("click", () => {
  els.importAssumptionsInput.value = "";
  els.importAssumptionsInput.click();
});
els.importAssumptionsInput.addEventListener("change", async () => {
  const file = els.importAssumptionsInput.files?.[0];
  if (!file) return;
  try {
    importEstimatorAssumptionsFromText(await file.text());
  } catch (error) {
    alert(`Could not import settings: ${error.message}`);
  }
});
els.resetEstimatorBtn.addEventListener("click", resetEstimatorAssumptions);
els.exportEstimateBtn.addEventListener("click", exportEstimatorCsv);
els.estimatorProfileSelect.addEventListener("change", () => renderEstimatorProfiles());
els.saveEstimatorProfileBtn.addEventListener("click", saveEstimatorProfile);
els.loadEstimatorProfileBtn.addEventListener("click", loadEstimatorProfile);
els.deleteEstimatorProfileBtn.addEventListener("click", deleteEstimatorProfile);
for (const block of ESTIMATOR_BLOCKS) {
  els[`${block.key}Toggle`].addEventListener("click", () => {
    setEstimatorBlockCollapsed(block.key, !els[`${block.key}Body`].hidden);
  });
}
els.clearCountriesBtn.addEventListener("click", clearAllCountries);
els.clearLayersBtn.addEventListener("click", clearAllLayers);

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
