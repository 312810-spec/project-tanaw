import assert from "node:assert/strict";
import test from "node:test";
import {
  displayObservedValue,
  isCalculable,
  validatedRatio,
} from "../app/lib/smea-indicators.ts";

const source = (sourceId) => ({
  sourceId,
  documentTitle: "Synthetic test fixture",
  schoolYear: "2026-2027",
  locator: "fixture",
});

const base = {
  code: "FIXTURE_ONLY",
  label: "Synthetic ratio",
  unit: "fraction",
  reportingPeriod: "term-1",
  schoolYear: "2026-2027",
  status: "verified",
  source: source("definition"),
  formula: {
    expression: "numerator / denominator",
    numerator: "Synthetic count",
    denominator: "Synthetic population",
    rounding: "none",
  },
};
const num = { kind: "number", value: 0, evidence: source("n") };
const den = { kind: "number", value: 3, evidence: source("d") };

test("unverified indicator cannot produce a ratio", () => {
  assert.equal(isCalculable({ ...base, status: "pending" }), false);
  assert.equal(validatedRatio({ ...base, status: "pending" }, num, den).kind, "missing");
});

test("recorded zero remains zero, not missing", () => {
  assert.deepEqual(validatedRatio(base, num, den), {
    kind: "derivedNumber",
    value: 0,
    sources: [num.evidence, den.evidence],
    formulaCode: "FIXTURE_ONLY",
  });
});

test("missing denominator is not zero", () => {
  const value = validatedRatio(base, num, { kind: "missing", reason: "Not provided" });
  assert.equal(value.kind, "missing");
  assert.match(displayObservedValue(value), /Missing/);
});

test("zero denominator blocks calculation", () => {
  assert.equal(validatedRatio(base, num, { ...den, value: 0 }).kind, "missing");
});

test("nonfinite value blocks calculation", () => {
  assert.equal(validatedRatio(base, { ...num, value: Number.NaN }, den).kind, "missing");
});

test("derivation preserves both inputs' source references", () => {
  const value = validatedRatio(base, { ...num, value: 6 }, den);
  assert.equal(value.kind, "derivedNumber");
  assert.deepEqual(value.sources, [num.evidence, den.evidence]);
});
