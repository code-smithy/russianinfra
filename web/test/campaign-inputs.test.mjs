import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = fs.readFileSync("web/app.js", "utf8");
const context = vm.createContext({});
vm.runInContext(source.slice(source.indexOf("function numberFmt("), source.indexOf("function wholeNumberFmt(")), context);
vm.runInContext(source.slice(source.indexOf("function formatCampaignInputNumber("), source.indexOf("function renderCampaignSettings(")), context);

test("distance labels use dot grouping independently of browser locale", () => {
  assert.equal(context.numberFmt(1000, 0), "1.000");
  assert.equal(context.numberFmt(12345.67, 1), "12.345,7");
});

test("campaign numbers round trip with dot grouping and fractional costs", () => {
  for (const [value, display] of [[0, "0"], [999, "999"], [1000, "1.000"], [100000, "100.000"], [1000000, "1.000.000"], [1234567.89, "1.234.567,89"], [0.01, "0,01"]]) {
    assert.equal(context.formatCampaignInputNumber(value), display);
    assert.equal(context.parseCampaignInputNumber(display), value);
  }
  assert.equal(context.parseCampaignInputNumber("1000000"), 1000000);
  assert.equal(context.parseCampaignInputNumber(" 1.000,50 "), 1000.5);
  for (const value of ["", "abc", "1.00", "1..000", "1,000,50", "Infinity"]) {
    assert.ok(Number.isNaN(context.parseCampaignInputNumber(value)));
  }
});

test("campaign input commits numeric values and rejects malformed edits", () => {
  let saved;
  const input = {
    type: "number", value: "1000000.5",
    onchange(event) { saved = Number(event.target.value); },
    setCustomValidity(message) { this.error = message; },
    reportValidity() { this.reported = true; },
  };
  context.formatCampaignNumberInputs({ querySelectorAll: () => [input] });
  assert.equal(input.type, "text");
  assert.equal(input.value, "1.000.000,5");
  input.value = "2.000,50";
  input.onchange({ target: input });
  assert.equal(saved, 2000.5);
  assert.equal(input.value, "2.000,5");
  input.value = "2.00";
  input.onchange({ target: input });
  assert.equal(saved, 2000.5);
  assert.ok(input.error);
  assert.ok(input.reported);
  input.oninput();
  assert.equal(input.error, "");
});
