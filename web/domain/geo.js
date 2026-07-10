const EARTH_RADIUS_KM = 6371.0088;

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
    [27.2, 47.0, 66.5, 70.0],
    [37.7, 43.3, 48.8, 47.3],
    [48.0, 47.0, 180.0, 82.1],
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

function toRad(degrees) {
  return degrees * Math.PI / 180;
}

function toDeg(radians) {
  return radians * 180 / Math.PI;
}

function manifestCountrySet(countries) {
  return new Set((countries || []).map((country) => typeof country === "string" ? country : country.id).filter(Boolean));
}

export function metersKm(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function radiusBearingDegrees(origin, edge) {
  if (!origin || !edge || metersKm(origin, edge) < 0.001) return 90;
  const lat1 = toRad(origin.lat);
  const lat2 = toRad(edge.lat);
  const dLng = toRad(edge.lng - origin.lng);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export function radiusDestinationPoint(origin, bearingDegrees, distanceKm) {
  const angularDistance = distanceKm / EARTH_RADIUS_KM;
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

export function iterGeometryPositions(geometry) {
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

export function featurePoint(feature, fallbackLatLng) {
  if (fallbackLatLng) return { lat: fallbackLatLng.lat, lng: fallbackLatLng.lng };
  const p = feature.properties || {};
  const lat = Number(p.map_latitude);
  const lng = Number(p.map_longitude);
  if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  return null;
}

export function countryForPosition(position, countries) {
  const lat = Number(position?.lat);
  const lng = Number(position?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const manifestCountries = manifestCountrySet(countries);
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

export function inferredFeatureCountries(feature, countries, fallbackCountry) {
  const inferredCountries = new Set();
  const point = featurePoint(feature);
  if (point) {
    const country = countryForPosition(point, countries);
    if (country) inferredCountries.add(country);
  }
  for (const position of iterGeometryPositions(feature.geometry)) {
    const country = countryForPosition(position, countries);
    if (country) inferredCountries.add(country);
  }
  if (!inferredCountries.size && fallbackCountry) inferredCountries.add(fallbackCountry);
  return [...inferredCountries];
}

export function featureDistanceToPointKm(feature, point) {
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
