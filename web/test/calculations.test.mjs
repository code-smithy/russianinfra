import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const calculations = require("../shared/calculations.js");

test("estimator unit helpers handle finite and impossible cases", () => {
  assert.equal(calculations.estimateUnits(10, 2, 50), 40);
  assert.equal(calculations.estimateUnits(0, 2, 50), 0);
  assert.equal(calculations.estimateUnits(10, 0, 50), 0);
  assert.equal(calculations.estimateUnits(10, 2, 0), Infinity);
  assert.equal(calculations.addEstimatedUnits(3, 4), 7);
  assert.equal(calculations.addEstimatedUnits(Infinity, 4), Infinity);
  assert.equal(calculations.estimatedUnitsEqual(Infinity, Infinity), true);
  assert.equal(calculations.estimatedUnitsEqual(Infinity, 10), false);
});

test("date helpers normalize date math across month boundaries", () => {
  assert.equal(calculations.daysInMonth(2024, 2), 29);
  assert.equal(calculations.addDays("2026-01-31", 1), "2026-02-01");
  assert.equal(calculations.addDays("2026-03-01", -1), "2026-02-28");
  assert.equal(calculations.parseDateString("2026-07-23"), "2026-07-23");
  assert.equal(calculations.parseDateString("07/23/2026"), null);
});

test("geo and CSV helpers preserve existing output semantics", () => {
  const distance = calculations.metersKm({ lat: 55.75, lng: 37.61 }, { lat: 59.93, lng: 30.31 });
  assert.ok(distance > 630 && distance < 640);
  assert.equal(calculations.csvEscape("plain"), "plain");
  assert.equal(calculations.csvEscape('quote, "line"\nnext'), '"quote, ""line""\nnext"');
});
