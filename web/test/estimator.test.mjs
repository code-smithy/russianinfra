import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const estimator = require("../shared/estimator.js");

const resources = [
  { id: "resource_a", label: "Resource A", completionRate: 80 },
  { id: "resource_b", label: "Resource B", completionRate: 60 },
];

const detailRows = [
  {
    row_type: "detail",
    layer_id: "energy_facilities",
    layer_label: "Oil/Gas Facilities",
    range_band: "0-500 km",
    resource_id: "resource_a",
    resource_label: "Resource A",
    estimated_units: 5,
  },
  {
    row_type: "detail",
    layer_id: "energy_facilities",
    layer_label: "Oil/Gas Facilities",
    range_band: "0-500 km",
    resource_id: "resource_b",
    resource_label: "Resource B",
    estimated_units: 3,
  },
  {
    row_type: "detail",
    layer_id: "power_facilities",
    layer_label: "Power Plants & Substations",
    range_band: "500+ km",
    resource_id: "resource_a",
    resource_label: "Resource A",
    estimated_units: 2,
  },
];

test("buildEstimatorAggregates returns the app's Map-based aggregate shape", () => {
  const aggregate = estimator.buildEstimatorAggregates(detailRows, resources);

  assert.deepEqual(aggregate.resources, [
    { id: "resource_a", label: "Resource A" },
    { id: "resource_b", label: "Resource B" },
  ]);
  assert.deepEqual(aggregate.rangeBandOrder, ["0-500 km", "500+ km"]);
  assert.equal(aggregate.totalByResource.get("resource_a"), 7);
  assert.equal(aggregate.totalByResource.get("resource_b"), 3);
  assert.equal(aggregate.rangeBands.get("0-500 km").rowTotal, 8);
  assert.equal(aggregate.rangeBands.get("0-500 km").layers.get("energy_facilities").rowTotal, 8);
  assert.equal(aggregate.rangeBands.get("500+ km").layers.get("power_facilities").resources.get("resource_a"), 2);
  assert.equal(aggregate.grandTotal, 10);
});

test("estimatorExportRows appends range, resource, and grand totals", () => {
  const aggregate = estimator.buildEstimatorAggregates(detailRows, resources);
  const rows = estimator.estimatorExportRows(detailRows, aggregate);

  assert.equal(rows.length, 10);
  assert.equal(rows[0], detailRows[0]);
  assert.deepEqual(rows.filter((row) => row.row_type === "range_band_total").map((row) => [
    row.range_band,
    row.resource_id,
    row.estimated_units,
  ]), [
    ["0-500 km", "resource_a", 5],
    ["0-500 km", "resource_b", 3],
    ["500+ km", "resource_a", 2],
    ["500+ km", "resource_b", 0],
  ]);
  assert.deepEqual(rows.find((row) => row.row_type === "grand_total"), {
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
    estimated_units: 10,
  });
});

test("validateEstimatorAggregates reports mismatches through an optional logger", () => {
  const aggregate = estimator.buildEstimatorAggregates(detailRows, resources);
  assert.equal(estimator.validateEstimatorAggregates(detailRows, aggregate), true);

  aggregate.grandTotal = 999;
  const warnings = [];
  const valid = estimator.validateEstimatorAggregates(detailRows, aggregate, {
    warn(message, payload) {
      warnings.push({ message, payload });
    },
  });

  assert.equal(valid, false);
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].message, "Estimator aggregate mismatch.");
  assert.equal(warnings[0].payload.aggregateGrandTotal, 999);
});
