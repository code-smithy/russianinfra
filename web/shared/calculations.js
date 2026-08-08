(function attachInfrastructureCalculations(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.InfrastructureCalculations = api;
})(typeof globalThis !== "undefined" ? globalThis : window, () => {
  function estimateUnits(count, unitsPerItem, completionRate) {
    if (count <= 0 || unitsPerItem <= 0) return 0;
    if (completionRate <= 0) return Infinity;
    return Math.ceil((count * unitsPerItem) / (completionRate / 100));
  }

  function addEstimatedUnits(current, value) {
    if (!Number.isFinite(current) || !Number.isFinite(value)) return Infinity;
    return current + value;
  }

  function estimatedUnitsEqual(a, b) {
    if (!Number.isFinite(a) || !Number.isFinite(b)) {
      return !Number.isFinite(a) && !Number.isFinite(b);
    }
    return a === b;
  }

  function metersKm(a, b) {
    const radius = 6371.0088;
    const toRad = (deg) => deg * Math.PI / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const h = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * radius * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  function padDatePart(value) {
    return String(value).padStart(2, "0");
  }

  function todayDateString(now = new Date()) {
    return `${now.getFullYear()}-${padDatePart(now.getMonth() + 1)}-${padDatePart(now.getDate())}`;
  }

  function parseDateString(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) ? String(value) : null;
  }

  function addDays(dateString, dayOffset, fallbackDate = new Date()) {
    const [y, m, d] = (parseDateString(dateString) || todayDateString(fallbackDate)).split("-").map(Number);
    const date = new Date(Date.UTC(y, m - 1, d + Number(dayOffset || 0)));
    return `${date.getUTCFullYear()}-${padDatePart(date.getUTCMonth() + 1)}-${padDatePart(date.getUTCDate())}`;
  }

  function daysInMonth(year, month) {
    return new Date(Date.UTC(Number(year), Number(month), 0)).getUTCDate();
  }

  function csvEscape(value) {
    const text = String(value ?? "");
    if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
    return text;
  }

  return {
    addDays,
    addEstimatedUnits,
    csvEscape,
    daysInMonth,
    estimatedUnitsEqual,
    estimateUnits,
    metersKm,
    padDatePart,
    parseDateString,
    todayDateString,
  };
});
