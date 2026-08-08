(function attachInfrastructureEstimator(root, factory) {
  const calculations = typeof module === "object" && module.exports
    ? require("./calculations.js")
    : root.InfrastructureCalculations;
  const api = factory(calculations);
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.InfrastructureEstimator = api;
})(typeof globalThis !== "undefined" ? globalThis : window, (calculations) => {
  function resourceMetadata(resources) {
    return resources.map((resource) => ({
      id: resource.id,
      label: resource.label,
    }));
  }

  function buildEstimatorAggregates(detailRows, sourceResources) {
    const resources = resourceMetadata(sourceResources);
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
      totalByResource.set(resourceKey, calculations.addEstimatedUnits(totalByResource.get(resourceKey) || 0, row.estimated_units));
      band.resources.set(resourceKey, calculations.addEstimatedUnits(band.resources.get(resourceKey) || 0, row.estimated_units));
      band.rowTotal = calculations.addEstimatedUnits(band.rowTotal, row.estimated_units);
      layer.resources.set(resourceKey, calculations.addEstimatedUnits(layer.resources.get(resourceKey) || 0, row.estimated_units));
      layer.rowTotal = calculations.addEstimatedUnits(layer.rowTotal, row.estimated_units);
      grandTotal.value = calculations.addEstimatedUnits(grandTotal.value, row.estimated_units);
    }

    return {
      resources,
      totalByResource,
      rangeBands,
      rangeBandOrder,
      grandTotal: grandTotal.value,
    };
  }

  function aggregateTotals(detailRows, aggregate) {
    const detailGrandTotal = detailRows.reduce((sum, row) => calculations.addEstimatedUnits(sum, row.estimated_units), 0);
    const resourceGrandTotal = [...aggregate.totalByResource.values()]
      .reduce((sum, value) => calculations.addEstimatedUnits(sum, value), 0);
    const rangeBandGrandTotal = [...aggregate.rangeBands.values()]
      .reduce((sum, band) => calculations.addEstimatedUnits(sum, band.rowTotal), 0);
    return {
      detailGrandTotal,
      resourceGrandTotal,
      rangeBandGrandTotal,
      aggregateGrandTotal: aggregate.grandTotal,
    };
  }

  function validateEstimatorAggregates(detailRows, aggregate, logger = null) {
    const totals = aggregateTotals(detailRows, aggregate);
    const valid = calculations.estimatedUnitsEqual(totals.detailGrandTotal, aggregate.grandTotal)
      && calculations.estimatedUnitsEqual(totals.resourceGrandTotal, aggregate.grandTotal)
      && calculations.estimatedUnitsEqual(totals.rangeBandGrandTotal, aggregate.grandTotal);
    if (!valid) {
      logger?.warn?.("Estimator aggregate mismatch.", totals);
    }
    return valid;
  }

  function estimatorExportRows(detailRows, aggregate) {
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
          category_hardness: "",
          resource_id: resource.id,
          resource_label: resource.label,
          completion_rate_percent: "",
          penetration_value: "",
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
        category_hardness: "",
        resource_id: resource.id,
        resource_label: resource.label,
        completion_rate_percent: "",
        penetration_value: "",
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
      category_hardness: "",
      resource_id: "",
      resource_label: "",
      completion_rate_percent: "",
      penetration_value: "",
      estimated_units: aggregate.grandTotal,
    });

    return rows;
  }

  return {
    aggregateTotals,
    buildEstimatorAggregates,
    estimatorExportRows,
    validateEstimatorAggregates,
  };
});
