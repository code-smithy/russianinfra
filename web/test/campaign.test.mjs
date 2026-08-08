import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const campaign = require("../shared/campaign.js");

const bandIds = ["band_500", "band_open"];
const resourceIds = ["resource_a", "resource_b"];

test("band resource maps create the full band/resource shape", () => {
  assert.deepEqual(campaign.emptyBandResourceMap(bandIds, resourceIds, 2), {
    band_500: { resource_a: 2, resource_b: 2 },
    band_open: { resource_a: 2, resource_b: 2 },
  });
});

test("normalizeBandResourceMap migrates legacy flat maps only to the first band", () => {
  const normalized = campaign.normalizeBandResourceMap({ resource_a: 5, resource_b: "3" }, bandIds, resourceIds);

  assert.deepEqual(normalized, {
    band_500: { resource_a: 5, resource_b: 3 },
    band_open: { resource_a: 0, resource_b: 0 },
  });
  assert.equal(campaign.hasNestedBandResourceMap(normalized, bandIds), true);
});

test("bandResourceSource prefers nested settings over legacy settings", () => {
  const saved = {
    initialStock: { resource_a: 99 },
    initialStockByBand: { band_open: { resource_a: 7 } },
  };

  assert.equal(campaign.bandResourceSource(saved, "initialStockByBand", "initialStock", bandIds), saved.initialStockByBand);
  assert.equal(campaign.bandResourceSource({ initialStock: saved.initialStock }, "initialStockByBand", "initialStock", bandIds).resource_a, 99);
});

test("clone, sum, and cost helpers preserve campaign arithmetic", () => {
  const source = {
    band_500: { resource_a: 2, resource_b: 3 },
    band_open: { resource_a: 5, resource_b: 7 },
  };
  const clone = campaign.cloneBandResourceMap(source, bandIds, resourceIds);
  clone.band_500.resource_a = 100;

  assert.equal(source.band_500.resource_a, 2);
  assert.deepEqual(campaign.sumBandResourceMap(source, bandIds, resourceIds), {
    resource_a: 7,
    resource_b: 10,
  });
  assert.deepEqual(campaign.costForBandResourceMap(source, {
    band_500: { resource_a: 10, resource_b: 2 },
    band_open: { resource_a: 4, resource_b: 1 },
  }, bandIds, resourceIds), {
    band_500: { resource_a: 20, resource_b: 6 },
    band_open: { resource_a: 20, resource_b: 7 },
  });
});

test("dayCostSummary returns daily and cumulative cost summaries", () => {
  const summary = campaign.dayCostSummary({
    expendedByBandResource: {
      band_500: { resource_a: 2, resource_b: 3 },
      band_open: { resource_a: 1, resource_b: 0 },
    },
    cumulativeExpendedByBandResource: {
      band_500: { resource_a: 5, resource_b: 4 },
      band_open: { resource_a: 2, resource_b: 1 },
    },
  }, {
    resourceUnitCostByBand: {
      band_500: { resource_a: 10, resource_b: 2 },
      band_open: { resource_a: 4, resource_b: 1 },
    },
  }, bandIds, resourceIds);

  assert.equal(summary.totalCost, 30);
  assert.deepEqual(summary.costByResource, { resource_a: 24, resource_b: 6 });
  assert.equal(summary.cumulativeTotalCost, 67);
});

test("increment helpers mutate existing tracking maps in place", () => {
  const resources = campaign.emptyBandResourceMap(bandIds, resourceIds);
  campaign.incrementBandResource(resources, "band_500", "resource_a", 2.5);
  campaign.incrementBandResource(resources, "band_500", "resource_a", 1.5);

  const layerResources = {};
  campaign.incrementLayerBandResource(layerResources, "energy", "band_open", "resource_b", 3, resourceIds);
  campaign.incrementLayerBandCount(layerResources, "energy", "band_500", 2);
  const bandCounts = {};
  campaign.incrementBandCount(bandCounts, "band_500", 4);

  assert.equal(resources.band_500.resource_a, 4);
  assert.equal(layerResources.energy.band_open.resource_b, 3);
  assert.equal(layerResources.energy.band_500, 2);
  assert.deepEqual(bandCounts, { band_500: 4 });
});

test("sequential quotas spend capacity in layer priority order", () => {
  const settings = {
    commandCapacityPerDay: 4,
    layerPriorityOrder: ["energy", "military", "rail"],
  };

  assert.deepEqual(campaign.buildSequentialLayerQuotas({
    energy: 2,
    military: 10,
    rail: 5,
  }, settings), {
    energy: 2,
    military: 2,
  });
});

test("weighted quotas round by remainder and never exceed remaining targets", () => {
  const settings = {
    commandCapacityPerDay: 5,
    layerPriorityOrder: ["energy", "military", "rail"],
    layerWeights: { energy: 50, military: 25, rail: 25 },
  };

  assert.deepEqual(campaign.buildWeightedLayerQuotas({
    energy: 10,
    military: 1,
    rail: 10,
  }, settings), {
    energy: 3,
    military: 1,
    rail: 1,
  });
});

test("weighted quotas fall back to sequential allocation when all weights are zero", () => {
  const settings = {
    commandCapacityPerDay: 3,
    layerPriorityOrder: ["energy", "military"],
    layerWeights: { energy: 0, military: 0 },
  };

  assert.deepEqual(campaign.buildWeightedLayerQuotas({
    energy: 1,
    military: 10,
  }, settings), {
    energy: 1,
    military: 2,
  });
});
