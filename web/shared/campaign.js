(function attachInfrastructureCampaign(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.InfrastructureCampaign = api;
})(typeof globalThis !== "undefined" ? globalThis : window, () => {
  function boundedNumber(value, fallback, min = 0, max = Infinity) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(max, Math.max(min, number));
  }

  function emptyBandResourceMap(bandIds, resourceIds, defaultValue = 0) {
    return Object.fromEntries(bandIds.map((bandId) => [
      bandId,
      Object.fromEntries(resourceIds.map((resourceId) => [resourceId, defaultValue])),
    ]));
  }

  function hasNestedBandResourceMap(value, bandIds) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    return bandIds.some((bandId) => value[bandId] && typeof value[bandId] === "object" && !Array.isArray(value[bandId]));
  }

  function normalizeBandResourceMap(value, bandIds, resourceIds, fallback = 0) {
    const nested = hasNestedBandResourceMap(value, bandIds);
    const legacyBandId = bandIds[0];
    return Object.fromEntries(bandIds.map((bandId) => [
      bandId,
      Object.fromEntries(resourceIds.map((resourceId) => {
        // Legacy flat campaign maps were global per resource; migrate them to the first configured band to avoid inventing cross-band supply.
        const sourceValue = nested ? value?.[bandId]?.[resourceId] : (bandId === legacyBandId ? value?.[resourceId] : undefined);
        return [resourceId, boundedNumber(sourceValue, fallback, 0, 1e12)];
      })),
    ]));
  }

  function bandResourceSource(saved, nestedKey, legacyKey, bandIds) {
    return hasNestedBandResourceMap(saved?.[nestedKey], bandIds) ? saved[nestedKey] : saved?.[legacyKey];
  }

  function sumBandResourceMap(map, bandIds, resourceIds) {
    const totals = Object.fromEntries(resourceIds.map((id) => [id, 0]));
    for (const bandId of bandIds) {
      for (const resourceId of resourceIds) {
        totals[resourceId] += Number(map?.[bandId]?.[resourceId]) || 0;
      }
    }
    return totals;
  }

  function cloneBandResourceMap(map, bandIds, resourceIds) {
    return Object.fromEntries(bandIds.map((bandId) => [
      bandId,
      Object.fromEntries(resourceIds.map((resourceId) => [resourceId, Number(map?.[bandId]?.[resourceId]) || 0])),
    ]));
  }

  function costForBandResourceMap(expendedMap, unitCostByBand, bandIds, resourceIds) {
    return Object.fromEntries(bandIds.map((bandId) => [
      bandId,
      Object.fromEntries(resourceIds.map((resourceId) => {
        const expended = Number(expendedMap?.[bandId]?.[resourceId]) || 0;
        const unitCost = Number(unitCostByBand?.[bandId]?.[resourceId]) || 0;
        return [resourceId, expended * unitCost];
      })),
    ]));
  }

  function sumValues(object) {
    return Object.values(object || {}).reduce((total, value) => total + (Number(value) || 0), 0);
  }

  function dayCostSummary(day, settings, bandIds, resourceIds) {
    const unitCosts = settings?.resourceUnitCostByBand || {};
    const costByBandResource = costForBandResourceMap(day?.expendedByBandResource, unitCosts, bandIds, resourceIds);
    const cumulativeCostByBandResource = costForBandResourceMap(day?.cumulativeExpendedByBandResource, unitCosts, bandIds, resourceIds);
    return {
      costByBandResource,
      costByResource: sumBandResourceMap(costByBandResource, bandIds, resourceIds),
      totalCost: sumValues(sumBandResourceMap(costByBandResource, bandIds, resourceIds)),
      cumulativeCostByBandResource,
      cumulativeCostByResource: sumBandResourceMap(cumulativeCostByBandResource, bandIds, resourceIds),
      cumulativeTotalCost: sumValues(sumBandResourceMap(cumulativeCostByBandResource, bandIds, resourceIds)),
    };
  }

  function incrementBandResource(map, bandId, resourceId, value) {
    if (!map[bandId]) map[bandId] = {};
    map[bandId][resourceId] = (map[bandId][resourceId] || 0) + (Number(value) || 0);
  }

  function ensureLayerBandResource(map, layerId, bandId, resourceIds) {
    if (!map[layerId]) map[layerId] = {};
    if (!map[layerId][bandId]) map[layerId][bandId] = Object.fromEntries(resourceIds.map((id) => [id, 0]));
    return map[layerId][bandId];
  }

  function incrementLayerBandResource(map, layerId, bandId, resourceId, value, resourceIds) {
    const row = ensureLayerBandResource(map, layerId, bandId, resourceIds);
    row[resourceId] = (row[resourceId] || 0) + (Number(value) || 0);
  }

  function incrementLayerBandCount(map, layerId, bandId, value = 1) {
    if (!map[layerId]) map[layerId] = {};
    map[layerId][bandId] = (map[layerId][bandId] || 0) + value;
  }

  function incrementBandCount(map, bandId, value = 1) {
    map[bandId] = (map[bandId] || 0) + value;
  }

  function buildSequentialLayerQuotas(remainingByLayer, settings) {
    const quotas = {};
    let slots = Math.floor(settings.commandCapacityPerDay);
    for (const id of settings.layerPriorityOrder) {
      const take = Math.min(slots, remainingByLayer[id] || 0);
      if (take > 0) quotas[id] = take;
      slots -= take;
      if (slots <= 0) break;
    }
    return quotas;
  }

  function buildWeightedLayerQuotas(remainingByLayer, settings) {
    const active = settings.layerPriorityOrder.filter((id) => (remainingByLayer[id] || 0) > 0);
    const total = active.reduce((sum, id) => sum + boundedNumber(settings.layerWeights?.[id], 0, 0), 0);
    if (total <= 0) return buildSequentialLayerQuotas(remainingByLayer, settings);

    const cap = Math.floor(settings.commandCapacityPerDay);
    const quotas = {};
    const rows = active.map((id, priority) => {
      const raw = cap * (settings.layerWeights[id] || 0) / total;
      const base = Math.min(Math.floor(raw), remainingByLayer[id] || 0);
      quotas[id] = base;
      return { id, priority, remainder: raw - Math.floor(raw) };
    });

    let used = Object.values(quotas).reduce((a, b) => a + b, 0);
    while (used < cap) {
      let picked = null;
      for (const row of rows.slice().sort((a, b) => b.remainder - a.remainder || a.priority - b.priority)) {
        if ((quotas[row.id] || 0) < (remainingByLayer[row.id] || 0)) {
          picked = row;
          break;
        }
      }
      if (!picked) break;
      quotas[picked.id] = (quotas[picked.id] || 0) + 1;
      used += 1;
    }
    return quotas;
  }

  return {
    bandResourceSource,
    buildSequentialLayerQuotas,
    buildWeightedLayerQuotas,
    cloneBandResourceMap,
    costForBandResourceMap,
    dayCostSummary,
    emptyBandResourceMap,
    ensureLayerBandResource,
    hasNestedBandResourceMap,
    incrementBandCount,
    incrementBandResource,
    incrementLayerBandCount,
    incrementLayerBandResource,
    normalizeBandResourceMap,
    sumBandResourceMap,
  };
});
