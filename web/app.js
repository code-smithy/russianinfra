const DATA_DIR = "data/";
const APP_VERSION = "0.9.0";
const APP_VERSION_LABEL = `v${APP_VERSION}`;
const STORAGE_KEY = "infrastructureExplorer.preferences.v1";
const OUT_OF_RADIUS_POINT_OPACITY = 0.5;
const OUT_OF_RADIUS_LINE_OPACITY = 0.38;
const MENU_WIDTH_LIMITS = {
  left: { defaultValue: 390, min: 280, max: 620 },
  right: { defaultValue: 420, min: 300, max: 680 },
};
const LAYER_GROUPS = [
  { id: "live", label: "Live Overlays (Beta)" },
  { id: "military", label: "Military" },
  { id: "oil_gas", label: "Oil/Gas" },
  { id: "transport", label: "Transport" },
  { id: "power", label: "Power" },
  { id: "other", label: "Other" },
];
const EXTERNAL_LAYER_DEFINITIONS = [
  {
    id: "deepstate_live",
    label: "DeepState Map Overlay",
    count: 0,
    point_count: 0,
    line_count: 0,
    subcategories: [{ id: "deepstate", label: "DeepState", count: 0 }],
    default_visible: false,
    external: {
      group: "live",
      configUrl: "deepstate-layer-config.json",
      sourceUrl: "https://deepstatemap.live/en",
    },
  },
];
const COUNTRY_BOUNDS = {
  Armenia: [[43.4, 38.8, 46.8, 41.4]],
  Azerbaijan: [[44.7, 38.3, 50.7, 42.1]],
  Belarus: [[23.1, 51.1, 32.8, 56.3]],
  China: [[73.4, 18.1, 135.1, 53.7]],
  Estonia: [[21.6, 57.5, 28.3, 59.8]],
  Finland: [[19.0, 59.7, 31.7, 70.2]],
  Georgia: [[39.8, 41.0, 46.8, 43.8]],
  Kazakhstan: [[46.4, 40.5, 87.4, 55.6]],
  Kyrgyzstan: [[69.1, 39.0, 80.4, 43.4]],
  Latvia: [[20.7, 55.5, 28.3, 58.1]],
  Lithuania: [[20.9, 53.8, 26.9, 56.5]],
  Moldova: [[26.5, 45.2, 30.2, 48.7]],
  Mongolia: [[87.7, 41.5, 119.9, 52.3]],
  Norway: [[4.0, 57.8, 31.3, 71.4]],
  Poland: [[14.0, 49.0, 24.2, 54.9]],
  Russia: [
    [19.4, 54.2, 22.9, 55.4],
    [27.2, 41.0, 180.0, 82.1],
    [-180.0, 41.0, -168.0, 72.0],
  ],
  Syria: [[35.5, 32.0, 42.4, 37.4]],
  Ukraine: [[22.0, 44.0, 40.4, 52.5]],
};
const COUNTRY_INFERENCE_PRIORITY = [
  "Ukraine",
  "Belarus",
  "Moldova",
  "Georgia",
  "Armenia",
  "Azerbaijan",
  "Kazakhstan",
  "Kyrgyzstan",
  "Mongolia",
  "China",
  "Poland",
  "Lithuania",
  "Latvia",
  "Estonia",
  "Finland",
  "Norway",
  "Syria",
  "Russia",
];
const EXTERNAL_SUBCATEGORY_ORDER = [
  "attack_arrows",
  "headquarters",
  "enemy_units",
  "airports_airfields",
  "naval",
  "reference_points",
  "areas",
  "lines",
  "other_live",
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
const TEMPORAL_DATE_FIELDS = [
  { id: "source", label: "Source/archive date" },
  { id: "first_seen", label: "First seen" },
  { id: "last_seen", label: "Last seen" },
];
const ESTIMATOR_BLOCKS = [
  { key: "rangeBands", label: "Range bands" },
  { key: "resourceTypes", label: "Resource types" },
  { key: "categoryAssumptions", label: "Category assumptions" },
  { key: "estimate", label: "Estimate" },
];
const CAMPAIGN_ALLOCATION_MODES = ["weighted", "sequential"];
const DEFAULT_CAMPAIGN_SETTINGS = { startDate: "", maxSimulationDays: 365, allocationMode: "weighted", playbackSpeedMs: 700, commandCapacityPerDay: 25, layerPriorityOrder: [], layerWeights: {}, fireCapacityPerDay: {}, initialStock: {}, productionMonthly: {}, profiles: [] };

const COLLAPSIBLE_PANELS = [
  { key: "layers", label: "Layers", preferenceKey: "layersPanelCollapsed" },
  { key: "countries", label: "Countries", preferenceKey: "countriesPanelCollapsed" },
  { key: "search", label: "Search Loaded", preferenceKey: "searchPanelCollapsed" },
  { key: "radiusMenu", label: "Radius", preferenceKey: "radiusMenuPanelCollapsed" },
  { key: "temporal", label: "Timeline", preferenceKey: "temporalPanelCollapsed" },
  { key: "estimator", label: "Scenario Estimator", preferenceKey: "estimatorPanelCollapsed" },
  { key: "changeReport", label: "Build comparison", preferenceKey: "changeReportPanelCollapsed" },
];
const INFO_TOPICS = {
  app: {
    title: `Infrastructure Explorer ${APP_VERSION_LABEL}`,
    paragraphs: [
      "Version 0.9.0 adds a Campaign Timeline Planner over current radius results. Version 0.8.0 hardens the data collection pipeline for GitHub Actions and replaces the local military KML archive with public Nightwatch map extraction.",
      "Highlights include Nightwatch military map scraping, resilient OSINT Varta archive capture selection, automatic country-boundary bootstrapping, and a durable compressed comparison baseline for scheduled builds.",
    ],
    history: [
      { version: "0.9.0", date: "2026-07-01", notes: ["Adds Campaign Timeline Planner tab.", "Supports weighted or strict layer allocation from current radius results.", "Adds daily command capacity, per-resource fire capacity, initial stock, monthly production, calendar-aware daily production, demand/supply deltas, playback, map status styling, and CSV/JSON export."] },
      { version: "0.8.0", date: "2026-06-30", notes: ["Replaces the local Military KML archive with public Nightwatch map placemark extraction.", "Retries OSINT Varta archive captures from newest to oldest and falls back to committed compact web data when Archive.org is unavailable.", "Downloads missing Natural Earth country boundaries in clean GitHub runners and stores the build comparison baseline under data_package/build_history.", "Updates the daily collection workflow to commit tracked data_package and web/data outputs without trying to add ignored data/ caches."] },
      { version: "0.7.0", date: "2026-06-30", notes: ["Generates data/change_report.json and web/data/diff_report.json from the previous build snapshot.", "Adds first_seen_build, last_seen_build, change_status, changed_since_previous_build, and new_in_latest_build metadata to current objects.", "Adds Build comparison and Timeline filters to the web app."] },
      { version: "0.6.0", date: "2026-06-30", notes: ["Adds source_catalog, references, object_references, quality_report, review queue, and data package manifest outputs.", "Shows source references and confidence dimensions in object popups and radius CSV exports.", "Adds standard-library Python unit tests for pipeline provenance, review, and web data helpers."] },
      { version: "0.5.0", date: "2026-06-29", notes: ["Replaces generic attack markers with local SVG arrows rotated from DeepState arrow_1 through arrow_16 icon names.", "Maps the 16 arrow icons evenly around the compass at 22.5 degree intervals, with arrow_16 wrapping to 0 degrees."] },
      { version: "0.4.0", date: "2026-06-29", notes: ["Shows the DeepState API response date in a normalized Date: DD.MM.YYYY HH:mm format.", "Adds optional DeepState historyDate support by selecting the latest public history version for a configured day.", "Keeps the 0.3.x SHA-256 UID hardening and DeepState HQ subcategory refinement."] },
      { version: "0.3.2", date: "2026-06-29", notes: ["Uses SHA-256 for stable UID generation while preserving the infra_<16 hex chars> output format.", "Carries forward the previous pull request that split DeepState HQ features into a dedicated subcategory."] },
      { version: "0.3.1", date: "2026-06-25", notes: ["Split DeepState HQ features into a dedicated HQs subcategory instead of grouping them with regular enemy units.", "Keeps HQ detection based on geoJSON.units army tokens and DeepState icon-4 markers while preserving the existing marker rendering."] },
      { version: "0.3.0", date: "2026-06-25", notes: ["Added Live Overlays (Beta) with DeepStateMap live GeoJSON support.", "Discovers live subcategories from feed icons and tokens, including attack arrows, enemy units, airports and airfields, naval, reference points, areas, and lines.", "Applies coordinate-derived country filters to live features.", "Uses APP-6 / MIL-STD-2525 style hostile symbols through milsymbol with local fallback markers."] },
      { version: "0.2.0", date: "2026-06-25", notes: ["Added visible versioning and version history.", "Includes recent radius, menu resizing, scenario profile, clustering, range matrix, and onboarding improvements."] },
      { version: "0.1.0", date: "Initial app baseline", notes: ["Baseline infrastructure map explorer with layers, country filters, search, radius results, and scenario estimator."] },
    ],
  },
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
  changeReport: null,
  layers: new Map(),
  features: new Map(),
  subcategoryFilters: new Map(),
  layerControls: new Map(),
  layerSubcategoryControls: new Map(),
  layerCollapseControls: new Map(),
  countryFilters: new Set(),
  countryControls: new Map(),
  externalFeatureCache: new Map(),
  savedPreferences: loadSavedPreferences(),
  persistenceReady: false,
  saveTimer: null,
  radiusMode: false,
  radiusStart: null,
  radiusOrigin: null,
  radiusEdge: null,
  radiusKm: null,
  radiusPointerId: null,
  radiusCircle: null,
  radiusBandCircles: [],
  radiusLine: null,
  radiusLabel: null,
  radiusHighlightGroup: null,
  radiusResults: [],
  menuWidths: {
    left: MENU_WIDTH_LIMITS.left.defaultValue,
    right: MENU_WIDTH_LIMITS.right.defaultValue,
  },
  temporalFilters: normalizeTemporalFilters(loadSavedPreferences()?.temporalFilters),
  activeMenuResize: null,
  estimator: normalizeEstimatorAssumptions(loadSavedPreferences()?.estimator),
  selectedTab: loadSavedPreferences()?.selectedTab === "campaign" ? "campaign" : "map",
  campaign: null,
  campaignRun: { stale: true, currentDayIndex: -1, playing: false, playbackTimer: null, days: [], summary: null },
  campaignStatusGroup: null,
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
state.campaignStatusGroup = L.layerGroup().addTo(map);

const els = {
  appShell: document.querySelector?.(".app-shell"),
  sidebar: document.querySelector?.(".sidebar"),
  estimatorSidebar: document.querySelector?.(".estimator-sidebar"),
  leftResizeHandle: document.getElementById("leftResizeHandle"),
  rightResizeHandle: document.getElementById("rightResizeHandle"),
  appVersion: document.getElementById("appVersion"),
  datasetSummary: document.getElementById("datasetSummary"),
  layersCount: document.getElementById("layersCount"),
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
  searchPanel: document.getElementById("searchPanel"),
  searchPanelBody: document.getElementById("searchPanelBody"),
  searchPanelToggle: document.getElementById("searchPanelToggle"),
  radiusMenuPanel: document.getElementById("radiusMenuPanel"),
  radiusMenuPanelBody: document.getElementById("radiusMenuPanelBody"),
  radiusMenuPanelToggle: document.getElementById("radiusMenuPanelToggle"),
  temporalPanel: document.getElementById("temporalPanel"),
  temporalPanelBody: document.getElementById("temporalPanelBody"),
  temporalPanelToggle: document.getElementById("temporalPanelToggle"),
  estimatorPanel: document.getElementById("estimatorPanel"),
  estimatorPanelBody: document.getElementById("estimatorPanelBody"),
  estimatorPanelToggle: document.getElementById("estimatorPanelToggle"),
  clearCountriesBtn: document.getElementById("clearCountriesBtn"),
  clearLayersBtn: document.getElementById("clearLayersBtn"),
  temporalSummary: document.getElementById("temporalSummary"),
  timeFieldSelect: document.getElementById("timeFieldSelect"),
  timeAfterInput: document.getElementById("timeAfterInput"),
  timeBeforeInput: document.getElementById("timeBeforeInput"),
  showNewOnlyInput: document.getElementById("showNewOnlyInput"),
  showChangedOnlyInput: document.getElementById("showChangedOnlyInput"),
  clearTemporalBtn: document.getElementById("clearTemporalBtn"),
  changeReportPanel: document.getElementById("changeReportPanel"),
  changeReportPanelBody: document.getElementById("changeReportPanelBody"),
  changeReportPanelToggle: document.getElementById("changeReportPanelToggle"),
  changeReportBuilds: document.getElementById("changeReportBuilds"),
  changeReportSummary: document.getElementById("changeReportSummary"),
  changeReportDetails: document.getElementById("changeReportDetails"),
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
  estimateBlock: document.getElementById("estimateBlock"),
  estimateBody: document.getElementById("estimateBody"),
  estimateToggle: document.getElementById("estimateToggle"),
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
  mapView: document.getElementById("mapView"),
  campaignView: document.getElementById("campaignView"),
  tabMapBtn: document.getElementById("tabMapBtn"),
  tabCampaignBtn: document.getElementById("tabCampaignBtn"),
  campaignScopeSummary: document.getElementById("campaignScopeSummary"),
  campaignStatus: document.getElementById("campaignStatus"),
  campaignSettings: document.getElementById("campaignSettings"),
  campaignLayerAllocation: document.getElementById("campaignLayerAllocation"),
  campaignCapacity: document.getElementById("campaignCapacity"),
  campaignSupply: document.getElementById("campaignSupply"),
  campaignPlayer: document.getElementById("campaignPlayer"),
  campaignDashboard: document.getElementById("campaignDashboard"),
  campaignDailyTable: document.getElementById("campaignDailyTable"),
  campaignProfileSelect: document.getElementById("campaignProfileSelect"),
  campaignImportInput: document.getElementById("campaignImportInput"),
  saveCampaignProfileBtn: document.getElementById("saveCampaignProfileBtn"),
  loadCampaignProfileBtn: document.getElementById("loadCampaignProfileBtn"),
  deleteCampaignProfileBtn: document.getElementById("deleteCampaignProfileBtn"),
  exportCampaignProfileBtn: document.getElementById("exportCampaignProfileBtn"),
  importCampaignProfileBtn: document.getElementById("importCampaignProfileBtn"),
  exportCampaignTimelineCsvBtn: document.getElementById("exportCampaignTimelineCsvBtn"),
  exportCampaignTimelineJsonBtn: document.getElementById("exportCampaignTimelineJsonBtn"),
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
  const paragraphsHtml = topic.paragraphs
    .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
    .join("");
  const historyHtml = Array.isArray(topic.history)
    ? `<div class="version-history" aria-label="Version history">${topic.history.map((entry) => `
      <section class="version-history-entry">
        <h3>${escapeHtml(`v${entry.version}`)} <span>${escapeHtml(entry.date)}</span></h3>
        <ul>${entry.notes.map((note) => `<li>${escapeHtml(note)}</li>`).join("")}</ul>
      </section>`).join("")}
    </div>`
    : "";
  els.infoPopoverBody.innerHTML = paragraphsHtml + historyHtml;
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
    "appInfoBtn",
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

function viewportWidth() {
  return Number(window.innerWidth) || 1280;
}

function isStackedLayout() {
  return viewportWidth() <= 900;
}

function isRightOverlayLayout() {
  const width = viewportWidth();
  return width > 900 && width <= 1240;
}

function savedMenuWidth(preferences, side) {
  const limits = MENU_WIDTH_LIMITS[side];
  const value = Number(preferences?.menuWidths?.[side]);
  return Number.isFinite(value) ? value : limits.defaultValue;
}

function dynamicMenuMax(side) {
  const limits = MENU_WIDTH_LIMITS[side];
  if (isStackedLayout()) return limits.max;

  const handleSpace = 16;
  const mapMinimum = isRightOverlayLayout() ? 360 : 420;
  const viewport = viewportWidth();
  if (side === "left") {
    const rightSpace = isRightOverlayLayout() ? 0 : state.menuWidths.right;
    return Math.min(limits.max, viewport - rightSpace - mapMinimum - handleSpace);
  }

  const sideClearance = isRightOverlayLayout() ? 120 : mapMinimum + handleSpace;
  return Math.min(limits.max, viewport - state.menuWidths.left - sideClearance);
}

function clampMenuWidth(side, width) {
  const limits = MENU_WIDTH_LIMITS[side];
  const max = Math.max(limits.min, dynamicMenuMax(side));
  const numericWidth = Number(width);
  const fallback = state.menuWidths[side] || limits.defaultValue;
  const candidate = Number.isFinite(numericWidth) ? numericWidth : fallback;
  return Math.round(Math.min(max, Math.max(limits.min, candidate)));
}

function setStyleProperty(element, name, value) {
  if (element?.style?.setProperty) {
    element.style.setProperty(name, value);
  } else if (element?.style) {
    element.style[name] = value;
  }
}

function updateResizeHandleA11y(side) {
  const handle = side === "left" ? els.leftResizeHandle : els.rightResizeHandle;
  const limits = MENU_WIDTH_LIMITS[side];
  handle?.setAttribute("aria-valuemin", String(limits.min));
  handle?.setAttribute("aria-valuemax", String(Math.max(limits.min, dynamicMenuMax(side))));
  handle?.setAttribute("aria-valuenow", String(state.menuWidths[side]));
}

function setMenuWidth(side, width, persist = true) {
  if (!MENU_WIDTH_LIMITS[side]) return;
  const clamped = clampMenuWidth(side, width);
  state.menuWidths[side] = clamped;
  setStyleProperty(els.appShell, `--${side}-menu-width`, `${clamped}px`);
  updateResizeHandleA11y(side);
  updateResizeHandleA11y(side === "left" ? "right" : "left");
  map.invalidateSize?.({ pan: false });
  if (persist) queueSavePreferences();
}

function applySavedMenuWidths() {
  const prefs = state.savedPreferences;
  setMenuWidth("left", savedMenuWidth(prefs, "left"), false);
  setMenuWidth("right", savedMenuWidth(prefs, "right"), false);
}

function refreshMenuWidthsAfterViewportChange() {
  setMenuWidth("left", state.menuWidths.left, false);
  setMenuWidth("right", state.menuWidths.right, false);
}

function onMenuResizeMove(event) {
  const resize = state.activeMenuResize;
  if (!resize) return;
  const delta = Number(event.clientX) - resize.startX;
  const nextWidth = resize.side === "left"
    ? resize.startWidth + delta
    : resize.startWidth - delta;
  setMenuWidth(resize.side, nextWidth, false);
}

function finishMenuResize() {
  if (!state.activeMenuResize) return;
  els.appShell?.classList.remove(`resizing-${state.activeMenuResize.side}`);
  state.activeMenuResize = null;
  document.removeEventListener?.("pointermove", onMenuResizeMove);
  document.removeEventListener?.("pointerup", finishMenuResize);
  document.removeEventListener?.("pointercancel", finishMenuResize);
  savePreferencesNow();
}

function startMenuResize(side, event) {
  if (isStackedLayout() || !Number.isFinite(Number(event.clientX))) return;
  event.preventDefault?.();
  closeInfoPopover();
  state.activeMenuResize = {
    side,
    startX: Number(event.clientX),
    startWidth: state.menuWidths[side],
  };
  els.appShell?.classList.add(`resizing-${side}`);
  event.currentTarget?.setPointerCapture?.(event.pointerId);
  document.addEventListener?.("pointermove", onMenuResizeMove);
  document.addEventListener?.("pointerup", finishMenuResize);
  document.addEventListener?.("pointercancel", finishMenuResize);
}

function resizeMenuWithKeyboard(side, event) {
  const keySteps = {
    ArrowLeft: -16,
    ArrowRight: 16,
    PageDown: -64,
    PageUp: 64,
  };
  if (event.key === "Home") {
    event.preventDefault?.();
    setMenuWidth(side, MENU_WIDTH_LIMITS[side].min);
    return;
  }
  if (event.key === "End") {
    event.preventDefault?.();
    setMenuWidth(side, dynamicMenuMax(side));
    return;
  }
  if (!Object.prototype.hasOwnProperty.call(keySteps, event.key)) return;
  event.preventDefault?.();
  const direction = side === "left" ? 1 : -1;
  setMenuWidth(side, state.menuWidths[side] + keySteps[event.key] * direction);
}

function setupResizableMenus() {
  applySavedMenuWidths();
  els.leftResizeHandle?.addEventListener("pointerdown", (event) => startMenuResize("left", event));
  els.rightResizeHandle?.addEventListener("pointerdown", (event) => startMenuResize("right", event));
  els.leftResizeHandle?.addEventListener("keydown", (event) => resizeMenuWithKeyboard("left", event));
  els.rightResizeHandle?.addEventListener("keydown", (event) => resizeMenuWithKeyboard("right", event));
  window.addEventListener("resize", refreshMenuWidthsAfterViewportChange);
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

function normalizeTemporalFilters(value = {}) {
  const validFieldIds = new Set(TEMPORAL_DATE_FIELDS.map((field) => field.id));
  const dateField = validFieldIds.has(value?.dateField) ? value.dateField : "source";
  return {
    dateField,
    after: typeof value?.after === "string" ? value.after : "",
    before: typeof value?.before === "string" ? value.before : "",
    newOnly: value?.newOnly === true,
    changedOnly: value?.changedOnly === true,
  };
}

function temporalDateValue(feature, fieldId = state.temporalFilters.dateField) {
  const p = feature?.properties || {};
  if (fieldId === "first_seen") return p.first_seen_build || "";
  if (fieldId === "last_seen") return p.last_seen_build || "";
  return p.source_archive_date || p.source_capture_date || "";
}

function parseTemporalDate(value, endOfDay = false) {
  const text = String(value || "").trim();
  if (!text) return null;
  const compact = text.match(/^(\d{4})(\d{2})(\d{2})(\d{2})?(\d{2})?(\d{2})?/);
  if (compact) {
    const [, year, month, day, hour = "00", minute = "00", second = "00"] = compact;
    const timestamp = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
    return Number.isFinite(timestamp) ? timestamp : null;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const suffix = endOfDay ? "T23:59:59.999Z" : "T00:00:00.000Z";
    const timestamp = Date.parse(`${text}${suffix}`);
    return Number.isFinite(timestamp) ? timestamp : null;
  }
  const timestamp = Date.parse(text);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function featurePassesTemporalFilters(feature) {
  const filters = state.temporalFilters;
  const p = feature?.properties || {};
  const wantsNew = filters.newOnly;
  const wantsChanged = filters.changedOnly;
  if (wantsNew || wantsChanged) {
    const isNew = p.new_in_latest_build === true || p.new_in_latest_build === "true";
    const isChanged = p.changed_since_previous_build === true || p.changed_since_previous_build === "true";
    if (wantsNew && wantsChanged) {
      if (!isNew && !isChanged) return false;
    } else if (wantsNew && !isNew) {
      return false;
    } else if (wantsChanged && !isChanged) {
      return false;
    }
  }

  const after = parseTemporalDate(filters.after);
  const before = parseTemporalDate(filters.before, true);
  if (after === null && before === null) return true;
  const value = parseTemporalDate(temporalDateValue(feature), true);
  if (value === null) return false;
  if (after !== null && value < after) return false;
  if (before !== null && value > before) return false;
  return true;
}

function temporalFiltersActive() {
  const filters = state.temporalFilters;
  return Boolean(filters.after || filters.before || filters.newOnly || filters.changedOnly);
}

function syncTemporalControlsFromState() {
  const filters = state.temporalFilters;
  if (els.timeFieldSelect) els.timeFieldSelect.value = filters.dateField;
  if (els.timeAfterInput) els.timeAfterInput.value = filters.after;
  if (els.timeBeforeInput) els.timeBeforeInput.value = filters.before;
  if (els.showNewOnlyInput) els.showNewOnlyInput.checked = filters.newOnly;
  if (els.showChangedOnlyInput) els.showChangedOnlyInput.checked = filters.changedOnly;
  renderTemporalSummary();
}

function updateTemporalFiltersFromControls() {
  state.temporalFilters = normalizeTemporalFilters({
    dateField: els.timeFieldSelect?.value,
    after: els.timeAfterInput?.value,
    before: els.timeBeforeInput?.value,
    newOnly: els.showNewOnlyInput?.checked,
    changedOnly: els.showChangedOnlyInput?.checked,
  });
  renderTemporalSummary();
  refreshAllLayerFilters();
  queueSavePreferences();
}

function clearTemporalFilters() {
  state.temporalFilters = normalizeTemporalFilters();
  syncTemporalControlsFromState();
  refreshAllLayerFilters();
  queueSavePreferences();
}

function renderTemporalSummary() {
  if (!els.temporalSummary) return;
  const filters = state.temporalFilters;
  const parts = [];
  if (filters.after) parts.push(`after ${filters.after}`);
  if (filters.before) parts.push(`before ${filters.before}`);
  if (filters.newOnly) parts.push("new");
  if (filters.changedOnly) parts.push("changed");
  els.temporalSummary.textContent = parts.length ? parts.join(" / ") : "All builds";
}

function shortBuildLabel(value) {
  const text = String(value || "").trim();
  if (!text) return "n/a";
  const parsed = parseTemporalDate(text);
  if (parsed !== null) return new Date(parsed).toISOString().slice(0, 10);
  return text.slice(0, 16);
}

async function loadChangeReport(manifest) {
  const file = manifest?.change_report_file;
  if (!file) return null;
  try {
    const response = await fetch(DATA_DIR + file, { cache: "no-store" });
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.warn("Could not load change report.", error);
    return null;
  }
}

function changeStat(label, value, className = "") {
  return `
    <div class="change-stat ${className}">
      <strong>${Number(value || 0).toLocaleString()}</strong>
      <span>${escapeHtml(label)}</span>
    </div>
  `;
}

function changeList(title, items, formatter = null) {
  if (!Array.isArray(items) || !items.length) return "";
  const rows = items.slice(0, 5).map((item) => {
    const detail = formatter ? formatter(item) : [item.map_layer, item.asset_type, item.country].filter(Boolean).join(" / ");
    return `
      <li>
        <strong>${escapeHtml(item.name || item.uid || "Unnamed")}</strong>
        <span>${escapeHtml(detail)}</span>
      </li>
    `;
  }).join("");
  return `
    <section class="change-list">
      <h3>${escapeHtml(title)}</h3>
      <ul>${rows}</ul>
    </section>
  `;
}

function renderChangeReport() {
  if (!els.changeReportSummary || !els.changeReportDetails || !els.changeReportBuilds) return;
  const report = state.changeReport;
  if (!report?.summary) {
    els.changeReportBuilds.textContent = "No report";
    els.changeReportSummary.innerHTML = `<div class="muted">Run the pipeline to generate a build comparison.</div>`;
    els.changeReportDetails.innerHTML = "";
    return;
  }

  const summary = report.summary;
  els.changeReportBuilds.textContent = `${shortBuildLabel(summary.previous_build_id)} -> ${shortBuildLabel(summary.current_build_id)}`;
  els.changeReportSummary.innerHTML = `
    ${changeStat("new objects", summary.new_objects, "positive")}
    ${changeStat("removed", summary.removed_objects, "negative")}
    ${changeStat("changed", summary.changed_objects, "changed")}
    ${changeStat("suspicious shifts", summary.suspicious_coordinate_shifts, "warning")}
  `;

  if (!summary.compare_available) {
    els.changeReportDetails.innerHTML = `<div class="muted">Baseline snapshot initialized. The next build will show object changes.</div>`;
    return;
  }

  els.changeReportDetails.innerHTML = [
    changeList("New objects", report.new_objects),
    changeList("Removed objects", report.removed_objects),
    changeList("Moved objects", report.moved_objects, (item) => `${numberFmt(item.distance_km, 1)} km shift / ${item.map_layer || ""}`),
    changeList("Category changes", report.category_changes, (item) => `${(item.changed_fields || []).join(", ")} / ${item.map_layer || ""}`),
    changeList("Name changes", report.name_changes, (item) => (item.changed_fields || []).join(", ")),
    changeList("Confidence changes", report.confidence_changes, (item) => (item.changed_fields || []).join(", ")),
    changeList("Source changes", report.source_changes, (item) => (item.changed_fields || []).join(", ")),
  ].filter(Boolean).join("") || `<div class="muted">No object-level differences detected.</div>`;
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
    edge: state.radiusEdge ? { lat: state.radiusEdge.lat, lng: state.radiusEdge.lng } : null,
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
    menuWidths: { ...state.menuWidths },
    layers,
    ...Object.fromEntries(COLLAPSIBLE_PANELS.map((panel) => [
      panel.preferenceKey,
      els[`${panel.key}PanelBody`]?.hidden === true,
    ])),
    collapsedLayers,
    collapsedEstimatorBlocks: ESTIMATOR_BLOCKS
      .filter((block) => els[`${block.key}Body`]?.hidden)
      .map((block) => block.key),
    countries: [...state.countryFilters],
    subcategories,
    temporalFilters: { ...state.temporalFilters },
    search: els.searchInput.value,
    radius: serializeRadius(),
    estimator: serializeEstimatorAssumptions(),
    selectedTab: state.selectedTab,
    campaign: serializeCampaignSettings(),
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

function radiusBearingDegrees(origin, edge) {
  if (!origin || !edge || metersKm(origin, edge) < 0.001) return 90;
  const toRad = (deg) => deg * Math.PI / 180;
  const toDeg = (rad) => rad * 180 / Math.PI;
  const lat1 = toRad(origin.lat);
  const lat2 = toRad(edge.lat);
  const dLng = toRad(edge.lng - origin.lng);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function radiusDestinationPoint(origin, bearingDegrees, distanceKm) {
  const earthRadiusKm = 6371.0088;
  const toRad = (deg) => deg * Math.PI / 180;
  const toDeg = (rad) => rad * 180 / Math.PI;
  const angularDistance = distanceKm / earthRadiusKm;
  const bearing = toRad(bearingDegrees);
  const lat1 = toRad(origin.lat);
  const lng1 = toRad(origin.lng);
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angularDistance) +
      Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearing)
  );
  const lng2 = lng1 + Math.atan2(
    Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(lat1),
    Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2)
  );
  const lng = ((toDeg(lng2) + 540) % 360) - 180;
  return { lat: toDeg(lat2), lng };
}

function radiusEdgeFor(origin, radiusKm, preferredEdge = state.radiusEdge) {
  const bearing = radiusBearingDegrees(origin, preferredEdge);
  return radiusDestinationPoint(origin, bearing, radiusKm);
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

function countryForPosition(position) {
  const lat = Number(position?.lat);
  const lng = Number(position?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const manifestCountries = new Set((state.manifest?.countries || []).map((country) => country.id));
  const orderedCountries = [
    ...COUNTRY_INFERENCE_PRIORITY.filter((country) => manifestCountries.has(country)),
    ...[...manifestCountries].filter((country) => !COUNTRY_INFERENCE_PRIORITY.includes(country)),
  ];
  for (const country of orderedCountries) {
    const boundsList = COUNTRY_BOUNDS[country];
    if (!boundsList) continue;
    if (boundsList.some(([minLng, minLat, maxLng, maxLat]) => (
      lng >= minLng && lng <= maxLng && lat >= minLat && lat <= maxLat
    ))) {
      return country;
    }
  }
  return null;
}

function inferredFeatureCountries(feature, fallbackCountry) {
  const countries = new Set();
  const point = featurePoint(feature);
  if (point) {
    const country = countryForPosition(point);
    if (country) countries.add(country);
  }
  for (const position of iterGeometryPositions(feature.geometry)) {
    const country = countryForPosition(position);
    if (country) countries.add(country);
  }
  if (!countries.size && fallbackCountry) countries.add(fallbackCountry);
  return [...countries];
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

function isExternalLayerInfo(layerInfo) {
  return !!layerInfo?.external;
}

function mergeExternalLayerDefinitions(manifest) {
  const existingIds = new Set((manifest.layers || []).map((layerInfo) => layerInfo.id));
  const externalLayers = EXTERNAL_LAYER_DEFINITIONS.filter((layerInfo) => !existingIds.has(layerInfo.id));
  manifest.layers = [...(manifest.layers || []), ...externalLayers];
  return manifest;
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

function normalizedIconKey(value) {
  return String(value || "").trim().toLowerCase();
}

function attackArrowNumber(properties) {
  const haystack = [
    properties.icon_key,
    properties.icon,
    properties["marker-symbol"],
    properties.name,
    properties.description,
    properties.semantic_token,
  ].filter(Boolean).join(" ");
  const match = haystack.match(/arrow[_-]?(\d{1,2})/i);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isInteger(value) && value >= 1 && value <= 16 ? value : null;
}

function attackArrowBearing(properties) {
  const number = attackArrowNumber(properties);
  return number == null ? null : (number % 16) * 22.5;
}

function geoJsonSemanticToken(properties) {
  const haystack = [
    properties.geojson_token,
    properties.semantic_token,
    properties.name,
    properties.description,
  ].filter(Boolean).join(" ");
  const match = haystack.match(/geoJSON\.[\w.-]+/i);
  return match ? match[0].toLowerCase() : "";
}

function tacticalMarkerSpec(properties) {
  const iconKey = normalizedIconKey(properties.icon_key || properties.icon || properties["marker-symbol"]);
  const token = geoJsonSemanticToken(properties);
  const arrowBearing = attackArrowBearing(properties);
  if (
    iconKey === "airport" ||
    iconKey === "airfield" ||
    iconKey === "aerodrome" ||
    token.includes("geojson.airfield.") ||
    token.includes("geojson.airport.") ||
    iconKey.endsWith("icon-6.png")
  ) {
    return { affiliation: "airport-hostile", label: "AIR", sidc: "SHGPUCF----K" };
  }
  if (iconKey === "enemy" || iconKey === "hostile" || token.includes("geojson.units.") || iconKey.endsWith("icon-3.png")) {
    return { affiliation: "hostile", label: token.includes(".army.") || iconKey.endsWith("icon-4.png") ? "HQ" : "EN", sidc: "SHGPU-----K" };
  }
  if (iconKey === "friendly" || iconKey === "friend") {
    return { affiliation: "friendly", label: "FR" };
  }
  if (iconKey === "neutral") {
    return { affiliation: "neutral", label: "N" };
  }
  if (iconKey === "unknown" || token.includes("unknown")) {
    return { affiliation: "unknown", label: "?" };
  }
  if (arrowBearing != null || iconKey === "attack" || token.includes("attack_direction")) {
    return { affiliation: "attack-arrow", label: "Attack arrow", bearing: arrowBearing ?? 0 };
  }
  if (token.includes("moskow_cruiser") || token.includes("mosk")) {
    return { affiliation: "hostile", label: "NAV" };
  }
  return null;
}

function milsymbolLibrary() {
  if (typeof window !== "undefined" && window.ms?.Symbol) return window.ms;
  if (typeof globalThis !== "undefined" && globalThis.ms?.Symbol) return globalThis.ms;
  return null;
}

function milsymbolIcon(spec) {
  const msLibrary = milsymbolLibrary();
  if (!msLibrary || !spec?.sidc) return null;
  try {
    const symbol = new msLibrary.Symbol(spec.sidc, {
      size: spec.affiliation === "airport-hostile" ? 30 : 32,
      fill: true,
      frame: true,
      icon: true,
      uniqueDesignation: spec.label,
    });
    const size = symbol.getSize?.() || { width: 40, height: 40 };
    const anchor = symbol.getAnchor?.() || { x: size.width / 2, y: size.height / 2 };
    return L.divIcon({
      className: "milsymbol-marker",
      html: symbol.asSVG(),
      iconSize: [size.width, size.height],
      iconAnchor: [anchor.x, anchor.y],
    });
  } catch (error) {
    console.warn("Could not render milsymbol marker.", error);
    return null;
  }
}

function markerIcon(properties) {
  const tacticalSpec = tacticalMarkerSpec(properties);
  if (tacticalSpec) {
    if (tacticalSpec.affiliation === "attack-arrow") {
      const bearing = Number.isFinite(tacticalSpec.bearing) ? tacticalSpec.bearing : 0;
      return L.divIcon({
        className: "",
        html: `<span class="attack-arrow-marker" style="transform:rotate(${bearing}deg)" title="${escapeHtml(tacticalSpec.label)}"><svg viewBox="0 0 32 32" aria-hidden="true" focusable="false"><path d="M16 2 27 16h-6v12H11V16H5L16 2Z"></path></svg></span>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });
    }
    const standardIcon = milsymbolIcon(tacticalSpec);
    if (standardIcon) return standardIcon;
    return L.divIcon({
      className: "",
      html: `<span class="tactical-marker tactical-${escapeHtml(tacticalSpec.affiliation)}"><span>${escapeHtml(tacticalSpec.label)}</span></span>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });
  }
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
  const isPolygon = feature.geometry?.type === "Polygon" || feature.geometry?.type === "MultiPolygon";
  const fillOpacity = Number(p.map_fill_opacity ?? p["fill-opacity"]);
  return {
    color: p.stroke || layerColor(p),
    weight: p.asset_type === "railway" ? 1.5 : 2.4,
    opacity: Number.isFinite(Number(p["stroke-opacity"])) ? Number(p["stroke-opacity"]) : (p.asset_type === "railway" ? 0.55 : 0.8),
    fillColor: p.map_fill_color || p.fill || layerColor(p),
    fillOpacity: isPolygon ? (Number.isFinite(fillOpacity) ? fillOpacity : 0.28) : undefined,
  };
}

function detailRows(properties) {
  const rows = [
    ["Type", [properties.asset_class, properties.asset_type].filter(Boolean).join(" / ")],
    ["Source", properties.source_name || properties.source_dataset],
    ["Layer", properties.source_layer],
    ["Category", properties.derived_subcategory_label],
    ["Confidence", properties.confidence],
    ["Source reliability", properties.source_reliability],
    ["Coordinate precision", properties.coordinate_precision || properties.location_quality],
    ["Entity confidence", properties.entity_confidence],
    ["Freshness", properties.freshness],
    ["Cross-source support", properties.cross_source_support],
    ["Review", properties.review_status],
    ["Change status", properties.change_status],
    ["Change types", Array.isArray(properties.change_types) ? properties.change_types.join(", ") : properties.change_types],
    ["First seen", properties.first_seen_build],
    ["Last seen", properties.last_seen_build],
    ["Source/archive date", properties.source_archive_date || properties.source_capture_date],
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

function featureReferences(properties) {
  if (Array.isArray(properties.references)) return properties.references;
  if (typeof properties.references_json === "string" && properties.references_json.trim()) {
    try {
      const parsed = JSON.parse(properties.references_json);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function referencesHtml(properties) {
  const references = featureReferences(properties);
  if (!references.length) return "";
  const items = references.slice(0, 6).map((reference) => {
    const label = reference.source_name || reference.source_id || "Source";
    const retrieved = reference.retrieved_at ? `, retrieved ${reference.retrieved_at}` : "";
    const record = reference.source_record_id ? `, record ${reference.source_record_id}` : "";
    const text = `${label}${retrieved}${record}`;
    const url = reference.url || reference.archive_url;
    const content = url
      ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(text)}</a>`
      : escapeHtml(text);
    return `<li>${content}</li>`;
  }).join("");
  return `
    <section class="popup-references">
      <h4>References</h4>
      <ol>${items}</ol>
    </section>
  `;
}

function popupHtml(feature) {
  const p = feature.properties || {};
  const source = p.source_url
    ? `<a href="${escapeHtml(p.source_url)}" target="_blank" rel="noopener">source</a>`
    : "";
  return `
    <h3 class="popup-title">${escapeHtml(p.display_label || p.name || "Unnamed feature")}</h3>
    <dl class="popup-table">${detailRows(p)}</dl>
    ${referencesHtml(p)}
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
  return featurePassesCountryFilter(feature)
    && isSubcategoryEnabled(p.map_layer, featureSubcategory(feature))
    && featurePassesTemporalFilters(feature);
}

function createFilteredLayer(record) {
  return createLeafletLayer({
    type: "FeatureCollection",
    features: record.features.filter(featurePassesActiveFilters),
  });
}

function forgetLayerFeatures(layerId) {
  for (const [featureId, stored] of state.features.entries()) {
    if (stored.feature?.properties?.map_layer === layerId) {
      state.features.delete(featureId);
    }
  }
}

function externalLayerConfigUrl(layerInfo) {
  return layerInfo.external?.configUrl || `${layerInfo.id}.json`;
}

function externalLayerSourceUrl(layerInfo) {
  return layerInfo.external?.sourceUrl || "";
}

function externalLayerError(layerInfo, message) {
  const source = externalLayerSourceUrl(layerInfo);
  const suffix = source ? ` Source: ${source}` : "";
  return new Error(`${message}${suffix}`);
}

async function fetchExternalLayerConfig(layerInfo) {
  const configUrl = externalLayerConfigUrl(layerInfo);
  const response = await fetch(configUrl, { cache: "no-store" });
  if (!response.ok) {
    throw externalLayerError(
      layerInfo,
      `Configure ${layerInfo.label} in ${configUrl} before enabling this live layer.`
    );
  }
  const config = await response.json();
  if (!config || typeof config !== "object") {
    throw externalLayerError(layerInfo, `${configUrl} must contain a JSON object.`);
  }
  if (config.enabled === false) {
    throw externalLayerError(layerInfo, `${layerInfo.label} is present but disabled in ${configUrl}.`);
  }
  return config;
}

function externalLayerFormat(config) {
  return String(config.type || config.format || (config.urlTemplate ? "tile" : "geojson")).toLowerCase();
}

function externalLayerRefreshSeconds(config) {
  if (config.historyDate || config.date || config.historyVersionId || config.historyId) return 0;
  const seconds = Number(config.refreshSeconds ?? config.refresh_interval_seconds);
  const minutes = Number(config.refreshMinutes ?? config.refresh_interval_minutes);
  const value = Number.isFinite(seconds) ? seconds : minutes * 60;
  return Number.isFinite(value) && value >= 30 ? value : 0;
}

function externalHistoryDate(config) {
  return String(config.historyDate || config.date || "").trim();
}

function externalHistoryVersionId(config) {
  return String(config.historyVersionId || config.historyId || "").trim();
}

function externalHistoryIndexUrl(config) {
  return config.historyIndexUrl || config.historyVersionsUrl || config.historyUrl || "";
}

function externalHistoryGeoJsonUrl(config, id) {
  const template = config.historyGeoJsonUrlTemplate || config.historyGeojsonUrlTemplate || "";
  if (template) return template.replace("{id}", encodeURIComponent(id));
  const base = String(config.historyBaseUrl || "https://deepstatemap.live/api/history").replace(/\/+$/, "");
  return `${base}/${encodeURIComponent(id)}/geojson`;
}

function dateOnly(value) {
  if (!value) return "";
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
}

function historyRecordTimestamp(record) {
  const parsed = Date.parse(record?.createdAt || record?.updatedAt || "");
  if (Number.isFinite(parsed)) return parsed;
  const idNumber = Number(record?.id);
  return Number.isFinite(idNumber) ? idNumber * 1000 : 0;
}

async function selectedExternalHistoryRecord(layerInfo, config) {
  const requestedId = externalHistoryVersionId(config);
  if (requestedId) return { id: requestedId };

  const requestedDate = dateOnly(externalHistoryDate(config));
  if (!requestedDate) return null;

  const indexUrl = externalHistoryIndexUrl(config);
  if (!indexUrl) {
    throw externalLayerError(layerInfo, `${externalLayerConfigUrl(layerInfo)} needs historyIndexUrl to load historyDate.`);
  }

  const response = await fetch(indexUrl, { cache: "no-store" });
  if (!response.ok) throw externalLayerError(layerInfo, `Failed to load ${layerInfo.label} history index.`);
  const records = await response.json();
  if (!Array.isArray(records)) throw externalLayerError(layerInfo, `${indexUrl} must return a history array.`);

  const matches = records
    .filter((record) => dateOnly(record?.createdAt || record?.updatedAt) === requestedDate)
    .sort((a, b) => historyRecordTimestamp(b) - historyRecordTimestamp(a));

  if (!matches.length) throw externalLayerError(layerInfo, `${layerInfo.label} has no public history version for ${requestedDate}.`);
  return matches[0];
}

function externalResponseMetadata(data, historyRecord = null, url = "") {
  const id = data?.id ?? historyRecord?.id ?? "";
  const timestampFromId = Number.isFinite(Number(id))
    ? new Date(Number(id) * 1000).toISOString()
    : "";
  return {
    id,
    url,
    datetime: data?.datetime || historyRecord?.datetime || "",
    createdAt: data?.createdAt || historyRecord?.createdAt || timestampFromId,
    updatedAt: data?.updatedAt || historyRecord?.updatedAt || "",
    description: data?.description || historyRecord?.descriptionEn || historyRecord?.description || "",
  };
}

function padDatePart(value) {
  return String(value).padStart(2, "0");
}

function yearFromMetadata(metadata) {
  const source = metadata.createdAt || metadata.updatedAt || "";
  const year = dateOnly(source).slice(0, 4);
  if (year) return year;
  const idNumber = Number(metadata.id);
  return Number.isFinite(idNumber) ? String(new Date(idNumber * 1000).getUTCFullYear()) : "";
}

function formattedIsoDateTime(value) {
  const parsed = new Date(value || "");
  if (Number.isNaN(parsed.getTime())) return "";
  const day = padDatePart(parsed.getUTCDate());
  const month = padDatePart(parsed.getUTCMonth() + 1);
  const year = parsed.getUTCFullYear();
  const hour = padDatePart(parsed.getUTCHours());
  const minute = padDatePart(parsed.getUTCMinutes());
  return `${day}.${month}.${year} ${hour}:${minute}`;
}

function formattedExternalDate(metadata) {
  const datetime = String(metadata.datetime || "").trim();
  const match = datetime.match(/^(\d{1,2})\.(\d{1,2})(?:\.(\d{2,4}))?\s*(?:[o\u043E]|at)?\s*(\d{1,2}):(\d{2})/i);
  if (match) {
    const year = match[3]
      ? (match[3].length === 2 ? `20${match[3]}` : match[3])
      : yearFromMetadata(metadata);
    if (year) {
      return `${padDatePart(match[1])}.${padDatePart(match[2])}.${year} ${padDatePart(match[4])}:${match[5]}`;
    }
  }
  return formattedIsoDateTime(metadata.createdAt) || formattedIsoDateTime(metadata.updatedAt);
}

function applyExternalResponseMetadata(layerInfo, metadata) {
  layerInfo.externalData = metadata;
  layerInfo.source_capture_date = metadata.createdAt || metadata.datetime || "";
  layerInfo.source_record_id = metadata.id || "";
}

function externalLayerMeta(layerInfo) {
  const metadata = layerInfo.externalData || {};
  const dateLabel = formattedExternalDate(metadata);
  const parts = [dateLabel ? `Date: ${dateLabel}` : "Date unavailable"];
  if (Number.isFinite(Number(layerInfo.count)) && Number(layerInfo.count) > 0) {
    parts.push(`${Number(layerInfo.count).toLocaleString()} records`);
  }
  return parts.join(" | ");
}

function externalTileLayer(layerInfo, config) {
  const urlTemplate = config.urlTemplate || config.url;
  if (!urlTemplate) {
    throw externalLayerError(layerInfo, `${externalLayerConfigUrl(layerInfo)} needs a urlTemplate for tile mode.`);
  }
  return L.tileLayer(urlTemplate, {
    attribution: config.attribution || `<a href="${externalLayerSourceUrl(layerInfo)}" target="_blank" rel="noopener">${layerInfo.label}</a>`,
    opacity: Number.isFinite(Number(config.opacity)) ? Number(config.opacity) : 0.72,
    maxZoom: Number.isFinite(Number(config.maxZoom)) ? Number(config.maxZoom) : 18,
    minZoom: Number.isFinite(Number(config.minZoom)) ? Number(config.minZoom) : 0,
    subdomains: config.subdomains || undefined,
    tms: config.tms === true,
  });
}

function externalFeatureCategory(layerInfo, config, feature) {
  const properties = feature.properties || {};
  const iconKey = normalizedIconKey(properties.icon_key || properties.icon || properties["marker-symbol"]);
  const token = geoJsonSemanticToken(properties);
  const geometryType = feature.geometry?.type || "";

  if (attackArrowNumber(properties) != null || token.includes("geojson.status.attack_direction") || iconKey === "attack") {
    return { id: "attack_arrows", label: "Attack arrows" };
  }
  if (
    iconKey === "airport" ||
    iconKey === "airfield" ||
    iconKey === "aerodrome" ||
    token.includes("geojson.airfield.") ||
    token.includes("geojson.airport.") ||
    iconKey.endsWith("icon-6.png")
  ) {
    return { id: "airports_airfields", label: "Airports & airfields" };
  }
  if (token.includes(".army.") || iconKey.endsWith("icon-4.png")) {
    return { id: "headquarters", label: "HQs" };
  }
  if (iconKey === "enemy" || iconKey === "hostile" || token.includes("geojson.units.") || iconKey.endsWith("icon-3.png")) {
    return { id: "enemy_units", label: "Enemy units" };
  }
  if (token.includes("geojson.moskow_cruiser") || token.includes("geojson.moskva") || iconKey.endsWith("icon-1.png")) {
    return { id: "naval", label: "Naval" };
  }
  if (token.includes("geojson.territories.") || geometryType === "Point") {
    return { id: "reference_points", label: "Reference points" };
  }
  if (geometryType.includes("Polygon")) {
    return { id: "areas", label: "Areas" };
  }
  if (geometryType.includes("LineString")) {
    return { id: "lines", label: "Lines" };
  }
  return {
    id: config.defaultSubcategory || layerInfo.subcategories?.[0]?.id || "other_live",
    label: config.defaultSubcategoryLabel || layerInfo.subcategories?.[0]?.label || "Other live objects",
  };
}

function externalFeatureProperties(layerInfo, config, feature, index, metadata = {}) {
  const properties = feature.properties || {};
  const semanticToken = geoJsonSemanticToken(properties);
  const label = properties.display_label || properties.name || properties.title || properties.label || `${layerInfo.label} ${index + 1}`;
  const category = externalFeatureCategory(layerInfo, config, feature);
  const subcategory = properties.derived_subcategory || category.id;
  const subcategoryLabel = properties.derived_subcategory_label || properties.asset_type_label || category.label;
  const sourceLabel = config.sourceLabel || layerInfo.label;
  const color = properties.stroke || properties.fill || properties.map_color || config.color || colorForLayer(layerInfo.id);
  const countries = Array.isArray(properties.countries) && properties.countries.length
    ? properties.countries.map((country) => String(country).trim()).filter(Boolean)
    : inferredFeatureCountries(feature, properties.country || config.defaultCountry || "Ukraine");
  const normalized = {
    ...properties,
    display_label: label,
    name: properties.name || label,
    asset_class: properties.asset_class || config.defaultAssetClass || "live_overlay",
    asset_type: properties.asset_type || subcategory,
    country: properties.country || countries[0] || config.defaultCountry || "Ukraine",
    countries,
    derived_subcategory: subcategory,
    derived_subcategory_label: subcategoryLabel,
    map_color: color,
    map_fill_color: properties.map_fill_color || properties.fill || color,
    map_fill_opacity: properties.map_fill_opacity ?? properties["fill-opacity"] ?? config.fillOpacity,
    map_layer: layerInfo.id,
    icon_key: properties.icon_key || properties.icon || properties["marker-symbol"] || semanticToken,
    semantic_token: semanticToken,
    source_dataset: properties.source_dataset || sourceLabel,
    source_layer: properties.source_layer || layerInfo.label,
    source_record_id: properties.source_record_id || metadata.id || "",
    source_capture_date: properties.source_capture_date || metadata.createdAt || metadata.datetime || "",
    source_url: properties.source_url || externalLayerSourceUrl(layerInfo),
  };
  normalized.search_text = properties.search_text || Object.values(normalized).filter(Boolean).join(" ");
  return normalized;
}

function updateExternalLayerMetadata(layerInfo, features) {
  const subcategoryMap = new Map();
  let pointCount = 0;
  let lineCount = 0;
  for (const feature of features) {
    const geometryType = feature.geometry?.type || "";
    if (geometryType === "Point" || geometryType === "MultiPoint") pointCount += 1;
    if (geometryType.includes("LineString")) lineCount += 1;
    const id = featureSubcategory(feature);
    const label = feature.properties?.derived_subcategory_label || id;
    const entry = subcategoryMap.get(id) || { id, label, count: 0 };
    entry.count += 1;
    subcategoryMap.set(id, entry);
  }
  layerInfo.count = features.length;
  layerInfo.point_count = pointCount;
  layerInfo.line_count = lineCount;
  layerInfo.subcategories = [...subcategoryMap.values()].sort((a, b) => {
    const orderDelta = EXTERNAL_SUBCATEGORY_ORDER.indexOf(a.id) - EXTERNAL_SUBCATEGORY_ORDER.indexOf(b.id);
    if (orderDelta && EXTERNAL_SUBCATEGORY_ORDER.includes(a.id) && EXTERNAL_SUBCATEGORY_ORDER.includes(b.id)) return orderDelta;
    if (EXTERNAL_SUBCATEGORY_ORDER.includes(a.id) && !EXTERNAL_SUBCATEGORY_ORDER.includes(b.id)) return -1;
    if (!EXTERNAL_SUBCATEGORY_ORDER.includes(a.id) && EXTERNAL_SUBCATEGORY_ORDER.includes(b.id)) return 1;
    if (b.count !== a.count) return b.count - a.count;
    return a.label.localeCompare(b.label);
  });
}

async function fetchExternalGeoJsonFeatures(layerInfo, config) {
  const historyRecord = await selectedExternalHistoryRecord(layerInfo, config);
  const url = historyRecord
    ? externalHistoryGeoJsonUrl(config, historyRecord.id)
    : config.geojsonUrl || config.url;
  if (!url) {
    throw externalLayerError(layerInfo, `${externalLayerConfigUrl(layerInfo)} needs a url for GeoJSON mode.`);
  }
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw externalLayerError(layerInfo, `Failed to load ${layerInfo.label} from configured GeoJSON URL.`);
  const data = await response.json();
  const metadata = externalResponseMetadata(data, historyRecord, url);
  applyExternalResponseMetadata(layerInfo, metadata);
  const collection = Array.isArray(data?.features) ? data : data?.map;
  const features = Array.isArray(collection?.features) ? collection.features : [];
  return features.map((feature, index) => ({
    ...feature,
    id: feature.id || `${layerInfo.id}_${index}`,
    properties: externalFeatureProperties(layerInfo, config, feature, index, metadata),
  }));
}

async function prepareExternalLayer(layerInfo) {
  if (!isExternalLayerInfo(layerInfo)) return;
  try {
    const config = await fetchExternalLayerConfig(layerInfo);
    const format = externalLayerFormat(config);
    if (!["geojson", "json"].includes(format)) return;
    const features = await fetchExternalGeoJsonFeatures(layerInfo, config);
    updateExternalLayerMetadata(layerInfo, features);
    state.externalFeatureCache.set(layerInfo.id, { config, features });
  } catch (error) {
    console.warn(error);
  }
}

async function prepareExternalLayers(manifest) {
  await Promise.all((manifest.layers || []).filter(isExternalLayerInfo).map(prepareExternalLayer));
}

function stopExternalRefresh(record) {
  if (record?.refreshTimer && typeof window.clearInterval === "function") {
    window.clearInterval(record.refreshTimer);
    record.refreshTimer = null;
  }
}

async function refreshExternalGeoJsonLayer(record) {
  if (!record?.visible || record.externalType !== "geojson") return;
  showLoading(`Refreshing ${record.label}...`);
  const features = await fetchExternalGeoJsonFeatures(record, record.externalConfig || {});
  if (record.layer && map.hasLayer(record.layer)) {
    map.removeLayer(record.layer);
  }
  forgetLayerFeatures(record.id);
  record.features = features;
  record.count = features.length;
  updateExternalLayerMetadata(record, features);
  record.layer = createFilteredLayer(record);
  if (record.visible) record.layer.addTo(map);
  hideLoading();
  renderLoadedCount();
  renderSearch();
  syncOverlaysWithVisibleLayers();
}

function startExternalRefresh(record) {
  stopExternalRefresh(record);
  if (record?.externalType !== "geojson" || typeof window.setInterval !== "function") return;
  const seconds = externalLayerRefreshSeconds(record.externalConfig || {});
  if (!seconds) return;
  record.refreshTimer = window.setInterval(() => {
    refreshExternalGeoJsonLayer(record).catch((error) => {
      hideLoading();
      console.warn(error);
    });
  }, seconds * 1000);
}

async function loadExternalLayer(layerInfo, checkbox, row) {
  const cached = state.externalFeatureCache.get(layerInfo.id);
  const config = cached?.config || await fetchExternalLayerConfig(layerInfo);
  const format = externalLayerFormat(config);
  if (!["geojson", "json", "tile", "xyz"].includes(format)) {
    throw externalLayerError(layerInfo, `Unsupported external layer type "${format}". Use geojson or tile.`);
  }

  showLoading(`Loading ${layerInfo.label}...`);
  let record = { ...layerInfo, features: [], loaded: true, visible: true, externalConfig: config };
  if (format === "tile" || format === "xyz") {
    record.externalType = "tile";
    record.layer = externalTileLayer(layerInfo, config);
  } else {
    record.externalType = "geojson";
    record.features = cached?.features || await fetchExternalGeoJsonFeatures(layerInfo, config);
    record.count = record.features.length;
    updateExternalLayerMetadata(record, record.features);
    record.layer = createFilteredLayer(record);
  }
  record.layer.addTo(map);
  state.layers.set(layerInfo.id, record);
  row.classList.remove("loading");
  hideLoading();
  startExternalRefresh(record);
  renderLoadedCount();
  renderSearch();
  syncOverlaysWithVisibleLayers();
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
    if (record.externalType === "tile") return;
    const wasVisible = record.visible;
    if (record.layer && map.hasLayer(record.layer)) {
      map.removeLayer(record.layer);
    }
    forgetLayerFeatures(record.id);
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
    if (record.externalType === "tile") continue;
    const wasVisible = record.visible;
    if (record.layer && map.hasLayer(record.layer)) {
      map.removeLayer(record.layer);
    }
    forgetLayerFeatures(record.id);
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
    startExternalRefresh(record);
    renderLoadedCount();
    renderSearch();
    syncOverlaysWithVisibleLayers();
    return;
  }

  row.classList.add("loading");
  if (isExternalLayerInfo(layerInfo)) {
    await loadExternalLayer(layerInfo, checkbox, row);
    return;
  }
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
  stopExternalRefresh(record);
  renderLoadedCount();
  renderSearch();
  syncOverlaysWithVisibleLayers();
}

function layerGroupId(layerInfo) {
  if (layerInfo.external?.group) return layerInfo.external.group;
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

function renderSelectionCounts() {
  const layers = Array.isArray(state.manifest?.layers) ? state.manifest.layers : [];
  const selectedLayers = layers.filter((layerInfo) => {
    const checkbox = state.layerControls.get(layerInfo.id);
    return checkbox?.checked || checkbox?.indeterminate;
  }).length;
  els.layersCount.textContent = `${selectedLayers.toLocaleString()} of ${layers.length.toLocaleString()} selected`;

  const countries = Array.isArray(state.manifest?.countries) ? state.manifest.countries : [];
  els.countriesCount.textContent = `${state.countryFilters.size.toLocaleString()} of ${countries.length.toLocaleString()} selected`;
}

function updateLayerCheckboxState(layerInfo) {
  const checkbox = state.layerControls.get(layerInfo.id);
  if (!checkbox) return;
  const controls = state.layerSubcategoryControls.get(layerInfo.id) || [];
  if (!controls.length) {
    checkbox.indeterminate = false;
    renderSelectionCounts();
    return;
  }

  const checkedCount = controls.filter((control) => control.checked).length;
  checkbox.checked = checkedCount === controls.length;
  checkbox.indeterminate = checkedCount > 0 && checkedCount < controls.length;
  renderSelectionCounts();
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
    const initiallyVisible = savedLayerVisible(layerInfo);
    const hasSubcategories = subcategories.length > 1;
    if (subcategories.length) {
      state.subcategoryFilters.set(layerInfo.id, initiallyVisible || !hasSubcategories ? savedSubcategorySet(layerInfo) : new Set());
    }

    const row = document.createElement("div");
    row.className = "layer-row";
    row.dataset.layerId = layerInfo.id;
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    state.layerControls.set(layerInfo.id, checkbox);
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
    const layerMeta = isExternalLayerInfo(layerInfo)
      ? externalLayerMeta(layerInfo)
      : `${layerInfo.count.toLocaleString()} records`;
    name.innerHTML = `<strong>${escapeHtml(layerInfo.label)}</strong><span>${escapeHtml(layerMeta)}</span>`;
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
        subCheckbox.checked = state.subcategoryFilters.get(layerInfo.id)?.has(subcategory.id) ?? initiallyVisible;
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
        renderSelectionCounts();
        savePreferencesNow();
      } catch (error) {
        checkbox.checked = false;
        renderSelectionCounts();
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
  renderSelectionCounts();
  renderLoadedCount();
  renderSearch();
}

function renderCountries() {
  const countries = Array.isArray(state.manifest.countries) ? state.manifest.countries : [];
  state.countryControls.clear();
  state.countryFilters = savedCountrySet();
  els.countriesList.innerHTML = "";
  els.clearCountriesBtn.disabled = countries.length === 0;

  if (!countries.length) {
    els.countriesList.innerHTML = `<div class="muted">No country metadata.</div>`;
    renderSelectionCounts();
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
      renderSelectionCounts();
      refreshAllLayerFilters();
      savePreferencesNow();
    });
  }
  renderSelectionCounts();
}

function clearAllCountries() {
  for (const checkbox of state.countryControls.values()) {
    checkbox.checked = false;
  }
  state.countryFilters.clear();
  renderSelectionCounts();
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
  renderSelectionCounts();
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
    deepstate_live: "#d83a34",
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
  for (const panel of COLLAPSIBLE_PANELS) {
    setCollapsiblePanelCollapsed(panel.key, prefs?.[panel.preferenceKey] === true, false);
  }
  if (!prefs) return;

  if (typeof prefs.search === "string") els.searchInput.value = prefs.search;

  const center = storedPoint(prefs.mapView);
  const zoom = Number(prefs.mapView?.zoom);
  if (center && Number.isFinite(zoom)) {
    map.setView(center, zoom);
  }
}

function setCollapsiblePanelCollapsed(key, collapsed, persist = true) {
  const panel = COLLAPSIBLE_PANELS.find((item) => item.key === key);
  if (!panel) return;
  const panelElement = els[`${key}Panel`];
  const body = els[`${key}PanelBody`];
  const toggle = els[`${key}PanelToggle`];
  panelElement?.classList.toggle("collapsed", collapsed);
  if (body) body.hidden = collapsed;
  toggle?.setAttribute("aria-expanded", collapsed ? "false" : "true");
  toggle?.setAttribute("aria-label", `${collapsed ? "Expand" : "Collapse"} ${panel.label}`);
  if (persist) queueSavePreferences();
}

function setLayersPanelCollapsed(collapsed, persist = true) {
  setCollapsiblePanelCollapsed("layers", collapsed, persist);
}

function setCountriesPanelCollapsed(collapsed, persist = true) {
  setCollapsiblePanelCollapsed("countries", collapsed, persist);
}

function setSearchPanelCollapsed(collapsed, persist = true) {
  setCollapsiblePanelCollapsed("search", collapsed, persist);
}

function setRadiusMenuPanelCollapsed(collapsed, persist = true) {
  setCollapsiblePanelCollapsed("radiusMenu", collapsed, persist);
}

function setTemporalPanelCollapsed(collapsed, persist = true) {
  setCollapsiblePanelCollapsed("temporal", collapsed, persist);
}

function setEstimatorPanelCollapsed(collapsed, persist = true) {
  setCollapsiblePanelCollapsed("estimator", collapsed, persist);
}

function setChangeReportPanelCollapsed(collapsed, persist = true) {
  setCollapsiblePanelCollapsed("changeReport", collapsed, persist);
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

function setRadiusMeasurementOverlay(origin, edge, radiusKm) {
  if (!origin || !edge || !Number.isFinite(radiusKm) || radiusKm <= 0) return;
  if (state.radiusLine) {
    state.radiusLine.setLatLngs([origin, edge]);
  } else {
    state.radiusLine = L.polyline([origin, edge], {
      color: "#e0a72f",
      weight: 2,
      opacity: 0.95,
      dashArray: "6,6",
      interactive: false,
    }).addTo(map);
  }
  if (state.radiusLabel) {
    state.radiusLabel.setLatLng(edge);
    state.radiusLabel.setIcon(L.divIcon({
      className: "radius-distance-label",
      html: `${numberFmt(radiusKm, 1)} km`,
      iconSize: [82, 28],
      iconAnchor: [-8, 14],
    }));
  } else {
    state.radiusLabel = L.marker(edge, {
      interactive: false,
      icon: L.divIcon({
        className: "radius-distance-label",
        html: `${numberFmt(radiusKm, 1)} km`,
        iconSize: [82, 28],
        iconAnchor: [-8, 14],
      }),
    }).addTo(map);
  }
}

function drawStoredRadius(origin, radiusKm, edge = null) {
  if (state.radiusCircle) map.removeLayer(state.radiusCircle);
  if (state.radiusLine) map.removeLayer(state.radiusLine);
  if (state.radiusLabel) map.removeLayer(state.radiusLabel);
  clearRadiusBandCircles();
  state.radiusLine = null;
  state.radiusLabel = null;
  state.radiusEdge = edge || radiusEdgeFor(origin, radiusKm, null);
  drawRadiusBandCircles(origin, radiusKm);
  state.radiusCircle = L.circle(origin, {
    radius: radiusKm * 1000,
    color: "#f3d46b",
    weight: 3,
    opacity: 0.98,
    fillOpacity: 0,
    interactive: false,
  }).addTo(map);
  setRadiusMeasurementOverlay(origin, state.radiusEdge, radiusKm);
}

function updateRadiusOverlay(radiusKm, origin = state.radiusOrigin || state.radiusStart, edge = null) {
  if (!origin || !Number.isFinite(radiusKm) || radiusKm <= 0) return;
  state.radiusEdge = edge || radiusEdgeFor(origin, radiusKm);
  drawRadiusBandCircles(origin, radiusKm);
  if (state.radiusCircle) {
    state.radiusCircle.setRadius(radiusKm * 1000);
  }
  setRadiusMeasurementOverlay(origin, state.radiusEdge, radiusKm);
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
  renderRadiusResults(state.radiusOrigin, radiusKm);
}

function refreshRadiusRangeOverlay() {
  if (!state.radiusOrigin || !Number.isFinite(state.radiusKm)) return;
  updateRadiusOverlay(state.radiusKm);
}

function restoreSavedRadius() {
  const saved = state.savedPreferences?.radius;
  const origin = storedPoint(saved?.origin);
  const edge = storedPoint(saved?.edge);
  const radiusKm = Number(saved?.radiusKm);
  if (!origin || !Number.isFinite(radiusKm) || radiusKm <= 0) return;
  drawStoredRadius(origin, radiusKm, edge ? radiusEdgeFor(origin, radiusKm, edge) : null);
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
  state.radiusEdge = null;
  state.radiusKm = null;
  state.radiusResults = [];
  state.radiusHighlightGroup.clearLayers();
  clearRadiusDimming();
  els.radiusPanel.hidden = true;
  els.radiusResults.innerHTML = "";
  els.radiusSummary.textContent = "0 objects";
  updateRadiusPanelDetails(null, null);
  renderEstimatorResults();
  syncCampaignLayersFromScope();
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
  syncCampaignLayersFromScope();
  queueSavePreferences();
}

function onRadiusMouseDown(event) {
  if (!state.radiusMode) return;
  event.originalEvent?.preventDefault();
  resetRadius();
  state.radiusStart = event.latlng;
  state.radiusEdge = event.latlng;
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
}

function onRadiusMouseMove(event) {
  if (!state.radiusMode || !state.radiusStart || !state.radiusCircle) return;
  const radiusKm = metersKm(state.radiusStart, event.latlng);
  state.radiusEdge = event.latlng;
  updateRadiusOverlay(radiusKm, state.radiusStart, event.latlng);
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

function resetRadiusPointer(event) {
  if (state.radiusPointerId === null) return;
  event?.target?.releasePointerCapture?.(state.radiusPointerId);
  state.radiusPointerId = null;
}

function radiusEventFromPointer(event) {
  const latlng = typeof map.mouseEventToLatLng === "function"
    ? map.mouseEventToLatLng(event)
    : event.latlng;
  if (!latlng) return null;
  return { latlng, originalEvent: event };
}

function onRadiusPointerDown(event) {
  if (!state.radiusMode || event.isPrimary === false || event.button !== 0) return;
  const radiusEvent = radiusEventFromPointer(event);
  if (!radiusEvent) return;
  state.radiusPointerId = event.pointerId ?? null;
  if (state.radiusPointerId !== null) {
    event.target?.setPointerCapture?.(state.radiusPointerId);
  }
  onRadiusMouseDown(radiusEvent);
}

function onRadiusPointerMove(event) {
  if (!state.radiusMode || event.isPrimary === false) return;
  if (state.radiusPointerId !== null && event.pointerId !== state.radiusPointerId) return;
  const radiusEvent = radiusEventFromPointer(event);
  if (!radiusEvent) return;
  onRadiusMouseMove(radiusEvent);
}

async function onRadiusMouseUp(event) {
  if (!state.radiusMode || !state.radiusStart || !state.radiusCircle) return;
  const radiusKm = metersKm(state.radiusStart, event.latlng);
  state.radiusEdge = event.latlng;
  updateRadiusOverlay(radiusKm, state.radiusStart, event.latlng);
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
    resetRadiusPointer(event.originalEvent);
    setRadiusMode(false);
  }
}

function onRadiusPointerUp(event) {
  if (state.radiusPointerId !== null && event.pointerId !== state.radiusPointerId) return;
  const radiusEvent = radiusEventFromPointer(event);
  if (!radiusEvent) {
    resetRadiusPointer(event);
    return;
  }
  return onRadiusMouseUp(radiusEvent);
}

function onRadiusPointerCancel(event) {
  if (state.radiusPointerId !== null && event.pointerId !== state.radiusPointerId) return;
  resetRadiusPointer(event);
  map.dragging.enable();
  state.radiusStart = null;
  setRadiusMode(false);
}

function setupRadiusPointerEvents() {
  const container = map.getContainer?.();
  if (!container?.addEventListener || !window.PointerEvent) {
    map.on("mousedown", onRadiusMouseDown);
    map.on("mousemove", onRadiusMouseMove);
    map.on("mouseup", onRadiusMouseUp);
    return;
  }
  container.addEventListener("pointerdown", onRadiusPointerDown);
  container.addEventListener("pointermove", onRadiusPointerMove);
  container.addEventListener("pointerup", onRadiusPointerUp);
  container.addEventListener("pointercancel", onRadiusPointerCancel);
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
    "confidence",
    "coordinate_precision",
    "entity_confidence",
    "source_reliability",
    "freshness",
    "cross_source_support",
    "review_status",
    "source_dataset",
    "source_id",
    "source_name",
    "source_layer",
    "source_record_id",
    "operator",
    "product",
    "inn",
    "region",
    "map_latitude",
    "map_longitude",
    "location_quality",
    "source_url",
    "source_urls",
    "retrieved_at",
    "references",
  ];
  const lines = [fields.join(",")];
  for (const item of state.radiusResults) {
    const p = item.stored.feature.properties || {};
    const refs = featureReferences(p);
    const row = {
      distance_km: item.distance.toFixed(6),
      uid: p.uid || item.stored.feature.id,
      name: p.display_label || p.name || "",
      asset_class: p.asset_class || "",
      asset_type: p.asset_type || "",
      confidence: p.confidence || "",
      coordinate_precision: p.coordinate_precision || "",
      entity_confidence: p.entity_confidence || "",
      source_reliability: p.source_reliability || "",
      freshness: p.freshness || "",
      cross_source_support: p.cross_source_support || "",
      review_status: p.review_status || "",
      source_dataset: p.source_dataset || "",
      source_id: p.source_id || "",
      source_name: p.source_name || "",
      source_layer: p.source_layer || "",
      source_record_id: p.source_record_id || "",
      operator: p.operator || "",
      product: p.product || "",
      inn: p.inn || "",
      region: p.region || "",
      map_latitude: p.map_latitude || "",
      map_longitude: p.map_longitude || "",
      location_quality: p.location_quality || "",
      source_url: p.source_url || "",
      source_urls: refs.map((ref) => ref.url || ref.archive_url || "").filter(Boolean).join("; "),
      retrieved_at: refs.map((ref) => ref.retrieved_at || "").filter(Boolean).join("; "),
      references: refs.map((ref) => [ref.source_name || ref.source_id || "Source", ref.source_record_id].filter(Boolean).join(" record ")).join("; "),
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

function todayDateString() {
  const d = new Date();
  return `${d.getFullYear()}-${padDatePart(d.getMonth() + 1)}-${padDatePart(d.getDate())}`;
}
function parseDateString(value) { return /^\d{4}-\d{2}-\d{2}$/.test(String(value||"")) ? String(value) : null; }
function daysInMonth(year, month) { return new Date(Date.UTC(Number(year), Number(month), 0)).getUTCDate(); }
function addDays(dateString, dayOffset) {
  const [y,m,d] = (parseDateString(dateString) || todayDateString()).split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + Number(dayOffset || 0)));
  return `${date.getUTCFullYear()}-${padDatePart(date.getUTCMonth() + 1)}-${padDatePart(date.getUTCDate())}`;
}
function campaignResourceIds() { return state.estimator.resources.map((resource) => resource.id); }
function campaignLayerIdsFromScope() { return [...new Set(state.radiusResults.map((item) => item.stored?.feature?.properties?.map_layer).filter(Boolean))]; }
function normalizeCampaignSettings(saved = {}) {
  const resourceIds = new Set(campaignResourceIds());
  const layerIds = campaignLayerIdsFromScope();
  const order = Array.isArray(saved?.layerPriorityOrder) ? saved.layerPriorityOrder.filter((id) => layerIds.includes(id)) : [];
  for (const id of layerIds) if (!order.includes(id)) order.push(id);
  const keepResources = (object, fallback = 0) => Object.fromEntries([...resourceIds].map((id) => [id, boundedNumber(object?.[id], fallback, 0, 1e12)]));
  const layerWeights = {};
  for (const id of order) layerWeights[id] = boundedNumber(saved?.layerWeights?.[id], 1, 0, 1e9);
  return {
    startDate: parseDateString(saved?.startDate) || todayDateString(),
    maxSimulationDays: Math.round(boundedNumber(saved?.maxSimulationDays, DEFAULT_CAMPAIGN_SETTINGS.maxSimulationDays, 1, 10000)),
    allocationMode: CAMPAIGN_ALLOCATION_MODES.includes(saved?.allocationMode) ? saved.allocationMode : "weighted",
    playbackSpeedMs: Math.round(boundedNumber(saved?.playbackSpeedMs, 700, 100, 5000)),
    commandCapacityPerDay: Math.floor(boundedNumber(saved?.commandCapacityPerDay, 25, 0, 1000000)),
    layerPriorityOrder: order,
    layerWeights,
    fireCapacityPerDay: keepResources(saved?.fireCapacityPerDay),
    initialStock: keepResources(saved?.initialStock),
    productionMonthly: keepResources(saved?.productionMonthly),
    profiles: Array.isArray(saved?.profiles) ? saved.profiles.slice(0, 50) : [],
  };
}
function serializeCampaignSettings() { return { ...state.campaign, profiles: state.campaign?.profiles || [] }; }
function campaignScopeEntries() { return state.radiusResults.slice(); }
function layerInfoById(id) { return (state.manifest?.layers || []).find((layer) => layer.id === id) || { id, label: id }; }
function campaignLayerSummaries() {
  const counts = {};
  for (const item of campaignScopeEntries()) counts[item.stored.feature.properties.map_layer] = (counts[item.stored.feature.properties.map_layer] || 0) + 1;
  return Object.entries(counts).map(([id,total]) => ({ id, label: layerInfoById(id).label || id, total }));
}
function syncCampaignLayersFromScope() { state.campaign = normalizeCampaignSettings(state.campaign || state.savedPreferences?.campaign); state.campaignRun.stale = true; state.campaignRun.days = []; state.campaignRun.currentDayIndex = -1; renderCampaign(); }
function categoryRequirement(layerId) { return boundedNumber(state.estimator.categoryRequirements?.[layerId], 1, 0, 1000000); }
function dailyProductionForDate(resourceId, dateString, settings = state.campaign) { const [y,m] = dateString.split("-").map(Number); return boundedNumber(settings.productionMonthly?.[resourceId], 0, 0) / daysInMonth(y, m); }
function demandForLayerCount(layerId, count) { return Object.fromEntries(state.estimator.resources.map((r) => [r.id, estimateUnits(count, categoryRequirement(layerId), r.completionRate)])); }
function demandFitsConstraints(demand, stock, fireRemaining) { return Object.entries(demand).every(([id,v]) => Number.isFinite(v) && v <= (stock[id] || 0) + 1e-9 && v <= (fireRemaining[id] || 0) + 1e-9); }
function maxExecutableCountForLayer(layerId, desiredCount, stock, fireRemaining) { let lo=0, hi=Math.floor(desiredCount); while(lo<hi){const mid=Math.ceil((lo+hi)/2); if(demandFitsConstraints(demandForLayerCount(layerId, mid), stock, fireRemaining)) lo=mid; else hi=mid-1;} return lo; }
function buildSequentialLayerQuotas(remainingByLayer, settings = state.campaign) { const quotas={}; let slots=Math.floor(settings.commandCapacityPerDay); for(const id of settings.layerPriorityOrder){ const take=Math.min(slots, remainingByLayer[id]||0); if(take>0) quotas[id]=take; slots-=take; if(slots<=0) break;} return quotas; }
function buildWeightedLayerQuotas(remainingByLayer, settings = state.campaign) { const active=settings.layerPriorityOrder.filter((id)=>(remainingByLayer[id]||0)>0); const total=active.reduce((s,id)=>s+boundedNumber(settings.layerWeights?.[id],0,0),0); if(total<=0) return buildSequentialLayerQuotas(remainingByLayer, settings); const cap=Math.floor(settings.commandCapacityPerDay); const quotas={}; const rows=active.map((id,priority)=>{const raw=cap*(settings.layerWeights[id]||0)/total; const base=Math.min(Math.floor(raw), remainingByLayer[id]||0); quotas[id]=base; return {id,priority,remainder:raw-Math.floor(raw)};}); let used=Object.values(quotas).reduce((a,b)=>a+b,0); while(used<cap){ let picked=null; for(const row of rows.slice().sort((a,b)=>b.remainder-a.remainder||a.priority-b.priority)){ if((quotas[row.id]||0)<(remainingByLayer[row.id]||0)){picked=row; break;} } if(!picked) break; quotas[picked.id]=(quotas[picked.id]||0)+1; used++; } return quotas; }
function featureEntryId(item){ return item.stored.id || item.stored.feature.id; }
function sumValues(object) { return Object.values(object || {}).reduce((total, value) => total + (Number(value) || 0), 0); }
function campaignDayLabel(day) { return day ? `Day ${day.dayIndex + 1} - ${day.date}` : "Before campaign"; }
function campaignSelectedDay() { return state.campaignRun.days[state.campaignRun.currentDayIndex] || null; }
function campaignCumulativeProduction(dayIndex) {
  const totals = Object.fromEntries(campaignResourceIds().map((id) => [id, 0]));
  for (const day of state.campaignRun.days.slice(0, Math.max(0, dayIndex) + 1)) {
    for (const id of campaignResourceIds()) totals[id] += day.productionByResource?.[id] || 0;
  }
  return totals;
}
function campaignLayerDepletedDays() {
  const depleted = {};
  for (const day of state.campaignRun.days) {
    for (const [id, remaining] of Object.entries(day.remainingTargetsByLayer || {})) {
      if (remaining === 0 && depleted[id] === undefined) depleted[id] = day.date;
    }
  }
  return depleted;
}
function simulateCampaign(settings = state.campaign) {
  settings = normalizeCampaignSettings(settings); const entriesByLayer={}; for(const item of campaignScopeEntries()){ const id=item.stored.feature.properties.map_layer; (entriesByLayer[id] ||= []).push(item); }
  const totalEntries=campaignScopeEntries().length, remainingByLayer=Object.fromEntries(Object.entries(entriesByLayer).map(([id,a])=>[id,a.length])); const cursor=Object.fromEntries(Object.keys(entriesByLayer).map(id=>[id,0])); let stock={...settings.initialStock}; const cumLayer={}, cumRes=Object.fromEntries(campaignResourceIds().map(id=>[id,0])); let cumulativeIds=[]; const days=[]; let warning="";
  for(let dayIndex=0; dayIndex<settings.maxSimulationDays && Object.values(remainingByLayer).some(v=>v>0); dayIndex++){
    const date=addDays(settings.startDate, dayIndex), starting={...stock}, prod={}, available={}; for(const id of campaignResourceIds()){prod[id]=dailyProductionForDate(id,date,settings); available[id]=(stock[id]||0)+prod[id];} stock={...available}; const fire={...settings.fireCapacityPerDay}, fireRem={...fire}; const quotas=settings.allocationMode==="sequential"?buildSequentialLayerQuotas(remainingByLayer,settings):buildWeightedLayerQuotas(remainingByLayer,settings); const reqDemand=Object.fromEntries(campaignResourceIds().map(id=>[id,0])), exp=Object.fromEntries(campaignResourceIds().map(id=>[id,0])), executed={}, deferred={}, executedIds=[], deferredIds=[];
    for(const [lid,requested] of Object.entries(quotas)){ const d=demandForLayerCount(lid, requested); for(const rid of campaignResourceIds()) reqDemand[rid]+=d[rid]||0; const can=maxExecutableCountForLayer(lid, requested, stock, fireRem); const list=entriesByLayer[lid]||[], start=cursor[lid]||0; if(can<=0){ deferred[lid]=requested; for(const item of list.slice(start,start+requested)) deferredIds.push(featureEntryId(item)); if(settings.allocationMode==="sequential") break; continue;} const ed=demandForLayerCount(lid, can); for(const rid of campaignResourceIds()){ exp[rid]+=ed[rid]||0; stock[rid]=Math.max(0,(stock[rid]||0)-(ed[rid]||0)); fireRem[rid]=Math.max(0,(fireRem[rid]||0)-(ed[rid]||0)); } executed[lid]=can; deferred[lid]=requested-can; remainingByLayer[lid]-=can; cumLayer[lid]=(cumLayer[lid]||0)+can; for(const item of list.slice(start, start+can)) executedIds.push(featureEntryId(item)); for(const item of list.slice(start+can, start+requested)) deferredIds.push(featureEntryId(item)); cursor[lid]=start+can; }
    cumulativeIds=cumulativeIds.concat(executedIds); for(const rid of campaignResourceIds()) cumRes[rid]+=exp[rid]||0; days.push({dayIndex,date,startingStockByResource:starting,productionByResource:prod,availableSupplyByResource:available,requestedTargetsByLayer:quotas,executedTargetsByLayer:executed,deferredTargetsByLayer:deferred,remainingTargetsByLayer:{...remainingByLayer},requestedDemandByResource:reqDemand,expendedByResource:exp,fireCapacityByResource:fire,fireCapacityRemainingByResource:fireRem,endingStockByResource:{...stock},requestedSupplyDeltaByResource:Object.fromEntries(campaignResourceIds().map(id=>[id,(available[id]||0)-(reqDemand[id]||0)])),executedSupplyDeltaByResource:{...stock},executedFeatureIds:executedIds,deferredFeatureIds:deferredIds,cumulativeExecutedFeatureIds:cumulativeIds.slice(),cumulativeExecutedByLayer:{...cumLayer},cumulativeExpendedByResource:{...cumRes},blocked:executedIds.length===0,notes:[]});
  }
  if(Object.values(remainingByLayer).some(v=>v>0)) warning="Maximum simulation days reached before completion."; return { days, summary:{totalEntries, elapsedDays:days.length, completionDate:Object.values(remainingByLayer).every(v=>v===0)?days.at(-1)?.date:null, warning, remainingByLayer} };
}
function recalculateCampaign(){ pauseCampaign(); const run=simulateCampaign(state.campaign); state.campaignRun={...state.campaignRun,...run,stale:false,currentDayIndex:run.days.length?0:-1,playing:false,playbackTimer:null}; renderCampaign(); renderCampaignMapStatus(); return run; }
function setCampaignDay(dayIndex){ if(!state.campaignRun.days.length){state.campaignRun.currentDayIndex=-1;} else state.campaignRun.currentDayIndex=Math.min(state.campaignRun.days.length-1,Math.max(0,Number(dayIndex)||0)); renderCampaign(); renderCampaignMapStatus(); }
function stepCampaign(delta){ setCampaignDay((state.campaignRun.currentDayIndex<0?0:state.campaignRun.currentDayIndex)+delta); }
function pauseCampaign(options = {}){ if(state.campaignRun.playbackTimer) (window.clearInterval || clearInterval)(state.campaignRun.playbackTimer); state.campaignRun.playing=false; state.campaignRun.playbackTimer=null; if(options.render) renderCampaign(); }
function playCampaign(){ if(state.campaignRun.stale || !state.campaignRun.days.length) return; pauseCampaign(); const timerFn = window.setInterval || (typeof setInterval === "function" ? setInterval : null); state.campaignRun.playing=true; renderCampaign(); if (!timerFn) return; state.campaignRun.playbackTimer=timerFn(()=>{ if(state.campaignRun.currentDayIndex>=state.campaignRun.days.length-1) pauseCampaign({ render: true }); else stepCampaign(1); }, state.campaign.playbackSpeedMs); }
function resetCampaignPlayback(){
  pauseCampaign();
  state.campaignRun = { stale: true, currentDayIndex: -1, playing: false, playbackTimer: null, days: [], summary: null };
  clearCampaignMapStatus();
  renderCampaign();
}
function setSelectedTab(tab){ state.selectedTab=tab==="campaign"?"campaign":"map"; if(state.selectedTab!=="campaign") pauseCampaign({ render: true }); if(els.mapView) els.mapView.hidden=state.selectedTab!=="map"; if(els.campaignView) els.campaignView.hidden=state.selectedTab!=="campaign"; els.tabMapBtn?.classList.toggle("active",state.selectedTab==="map"); els.tabCampaignBtn?.classList.toggle("active",state.selectedTab==="campaign"); queueSavePreferences(); }
function clearCampaignMapStatus(){ state.campaignStatusGroup?.clearLayers?.(); }
function addCampaignStatusOverlay(item, status) {
  const styles = {
    executed: { color: "#25d366", radius: 5, className: "campaign-status-executed", fillOpacity: 0.35 },
    current: { color: "#00f5ff", radius: 7, className: "campaign-status-current-day", fillOpacity: 0.45 },
    deferred: { color: "#f59e0b", radius: 6, className: "campaign-status-deferred", fillOpacity: 0.28 },
  };
  const style = styles[status] || styles.executed;
  if (item.stored.point) {
    L.circleMarker(item.stored.point, { radius: style.radius, color: style.color, weight: 2, fillColor: style.color, fillOpacity: style.fillOpacity, interactive: false, className: style.className }).addTo(state.campaignStatusGroup);
  } else if (item.stored.feature?.geometry) {
    L.geoJSON(item.stored.feature, { style: { color: style.color, weight: status === "current" ? 5 : 4, opacity: 0.8, className: style.className } }).addTo(state.campaignStatusGroup);
  }
}
function renderCampaignMapStatus(){ clearCampaignMapStatus(); const day=state.campaignRun.days[state.campaignRun.currentDayIndex]; if(!day || !state.campaignStatusGroup) return; const current=new Set(day.executedFeatureIds), all=new Set(day.cumulativeExecutedFeatureIds), deferred=new Set(day.deferredFeatureIds||[]); for(const item of campaignScopeEntries()){ const id=featureEntryId(item); if(all.has(id)) addCampaignStatusOverlay(item, current.has(id)?"current":"executed"); else if(deferred.has(id)) addCampaignStatusOverlay(item, "deferred"); } }

function updateCampaignSetting(path, value){ const [group,key]=path.split('.'); if(key) state.campaign[group][key]=value; else state.campaign[group]=value; state.campaign=normalizeCampaignSettings(state.campaign); state.campaignRun.stale=true; renderCampaign(); queueSavePreferences(); }
function renderCampaignSettings(){ if(!els.campaignSettings) return; const s=state.campaign; els.campaignSettings.innerHTML=`<label>Start date <input id="campaignStartDate" type="date" value="${escapeHtml(s.startDate)}"></label><label>Max simulation days <input id="campaignMaxDays" type="number" min="1" max="10000" value="${s.maxSimulationDays}"></label><label>Allocation mode <select id="campaignAllocationMode"><option value="weighted">weighted</option><option value="sequential">sequential</option></select></label><label>Playback speed ms <input id="campaignPlaybackSpeed" type="number" min="100" max="5000" value="${s.playbackSpeedMs}"></label>`; document.getElementById('campaignAllocationMode').value=s.allocationMode; document.getElementById('campaignStartDate').onchange=e=>updateCampaignSetting('startDate',e.target.value); document.getElementById('campaignMaxDays').onchange=e=>updateCampaignSetting('maxSimulationDays',e.target.value); document.getElementById('campaignAllocationMode').onchange=e=>updateCampaignSetting('allocationMode',e.target.value); document.getElementById('campaignPlaybackSpeed').onchange=e=>updateCampaignSetting('playbackSpeedMs',e.target.value); }
function renderCampaignLayerAllocation(){ if(!els.campaignLayerAllocation) return; const day=state.campaignRun.days[state.campaignRun.currentDayIndex]; const rows=campaignLayerSummaries().map((layer,idx)=>`<div class="campaign-row campaign-allocation-row"><div class="campaign-layer-meta"><strong>${escapeHtml(layer.label)}</strong><small>${escapeHtml(layer.id)}</small><span class="campaign-layer-summary"><span><b>${layer.total}</b> entries</span><span><b>${day?.cumulativeExecutedByLayer?.[layer.id]||0}</b> executed</span><span><b>${day?.remainingTargetsByLayer?.[layer.id]??layer.total}</b> remaining</span></span></div><input aria-label="Weight ${escapeHtml(layer.label)}" type="number" min="0" data-layer-weight="${escapeHtml(layer.id)}" value="${state.campaign.layerWeights[layer.id]??1}"><button data-layer-up="${escapeHtml(layer.id)}" ${idx===0?'disabled':''}>Up</button><button data-layer-down="${escapeHtml(layer.id)}" ${idx===campaignLayerSummaries().length-1?'disabled':''}>Down</button></div>`).join('') || '<div class="empty-state">Draw a radius on the map to define the campaign scope.</div>'; els.campaignLayerAllocation.innerHTML=rows; els.campaignLayerAllocation.querySelectorAll('[data-layer-weight]').forEach(i=>i.onchange=e=>{state.campaign.layerWeights[e.target.dataset.layerWeight]=boundedNumber(e.target.value,0,0); state.campaignRun.stale=true; queueSavePreferences(); renderCampaign();}); const move=(id,delta)=>{const a=state.campaign.layerPriorityOrder; const i=a.indexOf(id), j=i+delta; if(i>=0&&j>=0&&j<a.length){[a[i],a[j]]=[a[j],a[i]]; state.campaignRun.stale=true; queueSavePreferences(); renderCampaign();}}; els.campaignLayerAllocation.querySelectorAll('[data-layer-up]').forEach(b=>b.onclick=e=>move(e.target.dataset.layerUp,-1)); els.campaignLayerAllocation.querySelectorAll('[data-layer-down]').forEach(b=>b.onclick=e=>move(e.target.dataset.layerDown,1)); }
function renderCampaignCapacity(){ if(!els.campaignCapacity) return; els.campaignCapacity.innerHTML=`<label>Command capacity per day <input id="campaignCommandCapacity" type="number" min="0" step="1" value="${state.campaign.commandCapacityPerDay}"></label>`+state.estimator.resources.map(r=>`<label>${escapeHtml(r.label)} fire capacity/day <input data-fire="${escapeHtml(r.id)}" type="number" min="0" step="1" value="${state.campaign.fireCapacityPerDay[r.id]||0}"></label>`).join(''); document.getElementById('campaignCommandCapacity').onchange=e=>updateCampaignSetting('commandCapacityPerDay',e.target.value); els.campaignCapacity.querySelectorAll('[data-fire]').forEach(i=>i.onchange=e=>updateCampaignSetting(`fireCapacityPerDay.${e.target.dataset.fire}`,e.target.value)); }
function renderCampaignSupply(){ if(!els.campaignSupply) return; const day=state.campaignRun.days[state.campaignRun.currentDayIndex]; els.campaignSupply.innerHTML=state.estimator.resources.map(r=>`<div class="campaign-supply-row"><strong>${escapeHtml(r.label)}</strong><label>Initial <input data-stock="${escapeHtml(r.id)}" type="number" min="0" value="${state.campaign.initialStock[r.id]||0}"></label><label>Monthly production <input data-prod="${escapeHtml(r.id)}" type="number" min="0" value="${state.campaign.productionMonthly[r.id]||0}"></label><span>Daily: ${numberFmt(dailyProductionForDate(r.id,state.campaign.startDate),3)} • stock: ${numberFmt(day?.endingStockByResource?.[r.id]??state.campaign.initialStock[r.id],2)}</span></div>`).join(''); els.campaignSupply.querySelectorAll('[data-stock]').forEach(i=>i.onchange=e=>updateCampaignSetting(`initialStock.${e.target.dataset.stock}`,e.target.value)); els.campaignSupply.querySelectorAll('[data-prod]').forEach(i=>i.onchange=e=>updateCampaignSetting(`productionMonthly.${e.target.dataset.prod}`,e.target.value)); }
function renderCampaignDashboard(){ if(!els.campaignDashboard) return; const day=campaignSelectedDay(); if(!state.campaignRun.days.length){ els.campaignDashboard.innerHTML='<div class="empty-state">Run simulation to see the campaign dashboard.</div>'; return; } const total=campaignScopeEntries().length; const executed=day?sumValues(day.cumulativeExecutedByLayer):0; const remaining=day?sumValues(day.remainingTargetsByLayer):total; const cumulativeProduction=day?campaignCumulativeProduction(day.dayIndex):Object.fromEntries(campaignResourceIds().map((id)=>[id,0])); const depleted=campaignLayerDepletedDays(); const completion=state.campaignRun.summary?.completionDate || "Not completed"; const resourceRows=state.estimator.resources.map((r)=>`<tr><td>${escapeHtml(r.label)}</td><td>${numberFmt(state.campaign.initialStock[r.id],2)}</td><td>${numberFmt(cumulativeProduction[r.id],2)}</td><td>${numberFmt(day?.cumulativeExpendedByResource?.[r.id]||0,2)}</td><td>${numberFmt(day?.endingStockByResource?.[r.id]??state.campaign.initialStock[r.id],2)}</td><td>${numberFmt(day?.requestedSupplyDeltaByResource?.[r.id]||0,2)}</td><td>${numberFmt((day?.fireCapacityByResource?.[r.id]||0)-(day?.fireCapacityRemainingByResource?.[r.id]||0),2)} / ${numberFmt(day?.fireCapacityByResource?.[r.id]||0,2)}</td></tr>`).join(""); const layerRows=campaignLayerSummaries().map((l,idx)=>`<tr><td>${escapeHtml(l.label)}<br><small>${escapeHtml(l.id)}</small></td><td>${l.total}</td><td>${day?.cumulativeExecutedByLayer?.[l.id]||0}</td><td>${day?.remainingTargetsByLayer?.[l.id]??l.total}</td><td>${numberFmt(state.campaign.layerWeights[l.id]??0,2)}</td><td>${idx+1}</td><td>${depleted[l.id]||""}</td></tr>`).join(""); els.campaignDashboard.innerHTML=`<div class="campaign-cards"><div><strong>${total}</strong><span>Total entries</span></div><div><strong>${executed}</strong><span>Executed</span></div><div><strong>${remaining}</strong><span>Remaining</span></div><div><strong>${campaignDayLabel(day)}</strong><span>Current day</span></div><div><strong>${state.campaignRun.summary?.elapsedDays||0}</strong><span>Elapsed days</span></div><div><strong>${escapeHtml(completion)}</strong><span>Completion date</span></div></div>${state.campaignRun.summary?.warning?`<p class="warning">${escapeHtml(state.campaignRun.summary.warning)}</p>`:''}<h4>Resources</h4><div class="campaign-table"><table><thead><tr><th>Resource</th><th>Initial</th><th>Production</th><th>Expended</th><th>Ending stock</th><th>Requested delta</th><th>Fire used</th></tr></thead><tbody>${resourceRows}</tbody></table></div><h4>Layers</h4><div class="campaign-table"><table><thead><tr><th>Layer</th><th>Total</th><th>Executed</th><th>Remaining</th><th>Weight</th><th>Priority</th><th>Depleted day</th></tr></thead><tbody>${layerRows}</tbody></table></div>`; }
function renderCampaignDailyTable(){ if(!els.campaignDailyTable) return; if(!state.campaignRun.days.length){ els.campaignDailyTable.innerHTML='<div class="empty-state">Run simulation to build the daily timeline.</div>'; return; } const rows=state.campaignRun.days.map(d=>`<tr data-day="${d.dayIndex}"><td>${d.dayIndex+1}</td><td>${d.date}</td><td>${sumValues(d.executedTargetsByLayer)}</td><td>${sumValues(d.deferredTargetsByLayer)}</td><td>${sumValues(d.remainingTargetsByLayer)}</td><td>${state.estimator.resources.map(r=>`${escapeHtml(r.label)}: ${numberFmt(d.expendedByResource[r.id],2)}`).join('<br>')}</td><td>${state.estimator.resources.map(r=>`${escapeHtml(r.label)}: ${numberFmt(d.endingStockByResource[r.id],2)}`).join('<br>')}</td><td>${state.estimator.resources.map(r=>`${escapeHtml(r.label)}: ${numberFmt(d.requestedSupplyDeltaByResource[r.id],2)}`).join('<br>')}</td></tr>`).join(''); els.campaignDailyTable.innerHTML=`<table><thead><tr><th>Day</th><th>Date</th><th>Executed</th><th>Deferred</th><th>Remaining</th><th>Expended</th><th>Ending stock</th><th>Requested delta</th></tr></thead><tbody>${rows}</tbody></table>`; els.campaignDailyTable.querySelectorAll('[data-day]').forEach(r=>r.onclick=e=>setCampaignDay(Number(e.currentTarget.dataset.day))); }
function buildCampaignTimelineCsv(){ const fields=['day_index','date','layer_id','layer_label','requested_targets','executed_targets','deferred_targets','remaining_targets','resource_id','resource_label','requested_demand','expended','daily_production','starting_stock','available_supply','ending_stock','fire_capacity','fire_capacity_remaining','requested_supply_delta','executed_supply_delta','cumulative_expended']; const lines=[fields.join(',')]; for(const d of state.campaignRun.days){ for(const l of campaignLayerSummaries()) for(const r of state.estimator.resources){ const row={day_index:d.dayIndex,date:d.date,layer_id:l.id,layer_label:l.label,requested_targets:d.requestedTargetsByLayer[l.id]||0,executed_targets:d.executedTargetsByLayer[l.id]||0,deferred_targets:d.deferredTargetsByLayer[l.id]||0,remaining_targets:d.remainingTargetsByLayer[l.id]||0,resource_id:r.id,resource_label:r.label,requested_demand:d.requestedDemandByResource[r.id]||0,expended:d.expendedByResource[r.id]||0,daily_production:d.productionByResource[r.id]||0,starting_stock:d.startingStockByResource[r.id]||0,available_supply:d.availableSupplyByResource[r.id]||0,ending_stock:d.endingStockByResource[r.id]||0,fire_capacity:d.fireCapacityByResource[r.id]||0,fire_capacity_remaining:d.fireCapacityRemainingByResource[r.id]||0,requested_supply_delta:d.requestedSupplyDeltaByResource[r.id]||0,executed_supply_delta:d.executedSupplyDeltaByResource[r.id]||0,cumulative_expended:d.cumulativeExpendedByResource[r.id]||0}; lines.push(fields.map(f=>csvEscape(row[f])).join(',')); }} return lines.join('\r\n'); }
function buildCampaignTimelineJson(){ return {exportedAt:new Date().toISOString(),settings:serializeCampaignSettings(),summary:state.campaignRun.summary,dailySnapshots:state.campaignRun.days,layerMetadata:campaignLayerSummaries(),resourceMetadata:state.estimator.resources}; }
function exportCampaignTimelineCsv(){ if(!state.campaignRun.days.length) return alert('Run simulation before exporting timeline CSV.'); downloadTextFile(`campaign_timeline_${new Date().toISOString().replace(/[:.]/g,'-')}.csv`,buildCampaignTimelineCsv(),'text/csv;charset=utf-8'); }
function exportCampaignTimelineJson(){ if(!state.campaignRun.days.length) return alert('Run simulation before exporting timeline JSON.'); downloadTextFile(`campaign_timeline_${new Date().toISOString().replace(/[:.]/g,'-')}.json`,JSON.stringify(buildCampaignTimelineJson(),null,2),'application/json;charset=utf-8'); }
function campaignProfileSnapshot(name){ return {version:APP_VERSION,name,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),...serializeCampaignSettings(),profiles:undefined}; }
function exportCampaignProfile(){ downloadTextFile(`campaign_profile_${new Date().toISOString().replace(/[:.]/g,'-')}.json`,JSON.stringify(campaignProfileSnapshot('Campaign profile'),null,2),'application/json;charset=utf-8'); }
function campaignProfilePayloadFromImport(parsed) {
  const payload = parsed?.campaign && typeof parsed.campaign === "object" && !Array.isArray(parsed.campaign) ? parsed.campaign : parsed;
  const knownKeys = ["startDate","maxSimulationDays","allocationMode","layerPriorityOrder","layerWeights","commandCapacityPerDay","fireCapacityPerDay","initialStock","productionMonthly","playbackSpeedMs"];
  if (!payload || typeof payload !== "object" || Array.isArray(payload) || !knownKeys.some((key) => Object.prototype.hasOwnProperty.call(payload, key))) {
    throw new Error("Profile JSON does not contain campaign settings.");
  }
  return payload;
}
function importCampaignProfileFromText(text){ const parsed=JSON.parse(text); const payload=campaignProfilePayloadFromImport(parsed); const profiles=state.campaign.profiles; state.campaign=normalizeCampaignSettings({...payload, profiles}); state.campaignRun.stale=true; renderCampaign(); savePreferencesNow(); }
function saveCampaignProfile(){ const name=prompt('Profile name?','Campaign profile'); if(!name) return; const profile=campaignProfileSnapshot(name); state.campaign.profiles=state.campaign.profiles.filter(p=>p.name!==name).concat(profile); renderCampaignProfiles(); savePreferencesNow(); }
function renderCampaignProfiles(){ if(!els.campaignProfileSelect) return; els.campaignProfileSelect.innerHTML=(state.campaign.profiles||[]).map((p,i)=>`<option value="${i}">${escapeHtml(p.name)}</option>`).join(''); }
function loadCampaignProfile(){ const p=state.campaign.profiles[Number(els.campaignProfileSelect?.value)]; if(p){ state.campaign=normalizeCampaignSettings({...p,profiles:state.campaign.profiles}); state.campaignRun.stale=true; renderCampaign(); savePreferencesNow(); }}
function deleteCampaignProfile(){ const i=Number(els.campaignProfileSelect?.value); if(Number.isInteger(i)){ state.campaign.profiles.splice(i,1); renderCampaignProfiles(); savePreferencesNow(); }}
function renderCampaignPlayer(){ if(!els.campaignPlayer) return; const noScope=!campaignScopeEntries().length, noRun=!state.campaignRun.days.length; const day=campaignSelectedDay(); els.campaignPlayer.innerHTML=`<div class="actions-row"><button id="campaignRunBtn" ${noScope?'disabled':''}>Recalculate / Run simulation</button><button id="campaignResetBtn" ${noRun?'disabled':''}>Reset run</button><button id="campaignPrevBtn" ${noRun?'disabled':''}>Previous</button><button id="campaignPlayBtn" ${state.campaignRun.stale||noRun?'disabled':''}>${state.campaignRun.playing?'Pause':'Play'}</button><button id="campaignNextBtn" ${noRun?'disabled':''}>Next</button></div><input id="campaignDaySlider" type="range" min="0" max="${Math.max(0,state.campaignRun.days.length-1)}" value="${Math.max(0,state.campaignRun.currentDayIndex)}" ${noRun?'disabled':''}><div>${campaignDayLabel(day)} ${state.campaignRun.stale?'<span class="warning">Stale: recalculate required.</span>':''}</div>`; document.getElementById('campaignRunBtn').onclick=recalculateCampaign; document.getElementById('campaignResetBtn').onclick=resetCampaignPlayback; document.getElementById('campaignPrevBtn').onclick=()=>stepCampaign(-1); document.getElementById('campaignNextBtn').onclick=()=>stepCampaign(1); document.getElementById('campaignPlayBtn').onclick=()=>state.campaignRun.playing?pauseCampaign():playCampaign(); document.getElementById('campaignDaySlider').oninput=e=>setCampaignDay(Number(e.target.value)); }
function updateCampaignExportButtons(){ const disabled=!state.campaignRun.days.length; if(els.exportCampaignTimelineCsvBtn) els.exportCampaignTimelineCsvBtn.disabled=disabled; if(els.exportCampaignTimelineJsonBtn) els.exportCampaignTimelineJsonBtn.disabled=disabled; }
function renderCampaign(){ if(!state.campaign) state.campaign=normalizeCampaignSettings(state.savedPreferences?.campaign); if(els.campaignScopeSummary) els.campaignScopeSummary.textContent=`${campaignScopeEntries().length.toLocaleString()} entries from current radius`; if(els.campaignStatus) els.campaignStatus.textContent=campaignScopeEntries().length?'Campaign scope ready.':'Draw a radius on the map to define the campaign scope.'; renderCampaignProfiles(); renderCampaignSettings(); renderCampaignLayerAllocation(); renderCampaignCapacity(); renderCampaignSupply(); renderCampaignPlayer(); renderCampaignDashboard(); renderCampaignDailyTable(); updateCampaignExportButtons(); }

function exportEstimatorAssumptions() {
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    estimator: serializeEstimatorAssumptions(),
    selectedTab: state.selectedTab,
    campaign: serializeCampaignSettings(),
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
  state.campaign = normalizeCampaignSettings(state.campaign);
  renderCampaign();
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
  if (els.appVersion) els.appVersion.textContent = APP_VERSION_LABEL;
  const manifestResponse = await fetch(DATA_DIR + "manifest.json");
  state.manifest = mergeExternalLayerDefinitions(await manifestResponse.json());
  state.changeReport = await loadChangeReport(state.manifest);
  await prepareExternalLayers(state.manifest);
  els.datasetSummary.textContent = `${state.manifest.total_features.toLocaleString()} normalized records across ${state.manifest.layers.length} layers`;
  applySavedInterfaceState();
  syncTemporalControlsFromState();
  renderChangeReport();
  renderCountries();
  await renderLayers();
  restoreSavedRadius();
  renderEstimator();
  renderSearch();
  syncCampaignLayersFromScope();
  setSelectedTab(state.selectedTab);
  state.persistenceReady = true;
  savePreferencesNow();
}

setupInfoButtons();
setupResizableMenus();
els.tabMapBtn?.addEventListener("click", () => setSelectedTab("map"));
els.tabCampaignBtn?.addEventListener("click", () => setSelectedTab("campaign"));
els.saveCampaignProfileBtn?.addEventListener("click", saveCampaignProfile);
els.loadCampaignProfileBtn?.addEventListener("click", loadCampaignProfile);
els.deleteCampaignProfileBtn?.addEventListener("click", deleteCampaignProfile);
els.exportCampaignProfileBtn?.addEventListener("click", exportCampaignProfile);
els.importCampaignProfileBtn?.addEventListener("click", () => { els.campaignImportInput.value = ""; els.campaignImportInput.click(); });
els.campaignImportInput?.addEventListener("change", async () => { const file = els.campaignImportInput.files?.[0]; if (!file) return; try { importCampaignProfileFromText(await file.text()); } catch (error) { alert(`Could not import campaign profile: ${error.message}`); } });
els.exportCampaignTimelineCsvBtn?.addEventListener("click", exportCampaignTimelineCsv);
els.exportCampaignTimelineJsonBtn?.addEventListener("click", exportCampaignTimelineJson);
els.searchInput.addEventListener("input", () => {
  renderSearch();
  queueSavePreferences();
});
els.fitLoadedBtn.addEventListener("click", fitLoadedLayers);
for (const panel of COLLAPSIBLE_PANELS) {
  els[`${panel.key}PanelToggle`]?.addEventListener("click", () => {
    setCollapsiblePanelCollapsed(panel.key, !els[`${panel.key}PanelBody`]?.hidden);
  });
}
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
els.timeFieldSelect.addEventListener("change", updateTemporalFiltersFromControls);
els.timeAfterInput.addEventListener("change", updateTemporalFiltersFromControls);
els.timeBeforeInput.addEventListener("change", updateTemporalFiltersFromControls);
els.showNewOnlyInput.addEventListener("change", updateTemporalFiltersFromControls);
els.showChangedOnlyInput.addEventListener("change", updateTemporalFiltersFromControls);
els.clearTemporalBtn.addEventListener("click", clearTemporalFilters);

setupRadiusPointerEvents();
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
