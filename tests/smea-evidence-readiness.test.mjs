import assert from "node:assert/strict";
import test from "node:test";
import { checkEvidenceReadiness } from "../app/lib/smea-evidence-readiness.ts";

const src = { sourceId: "fixture", documentTitle: "Synthetic", schoolYear: "2026-2027", locator: "Sheet!A1" };
const def = { code: "SYNTHETIC", label: "Synthetic", unit: "count", schoolYear: "2026-2027", reportingPeriod: "term-1", status: "verified", source: src, formula: null };
const observed = (value) => ({ indicatorCode: def.code, reportingPeriod: def.reportingPeriod, scopeId: "fixture-scope", reviewState: "working", value });

test("valid sourced numeric zero is ready as evidence, not approval", () => {
  assert.deepEqual(checkEvidenceReadiness(def, observed({ kind: "number", value: 0, evidence: src })), { ready: true, issues: [] });
});
test("missing data is not silently treated as zero", () => {
  const result = checkEvidenceReadiness(def, observed({ kind: "missing", reason: "Not reported" }));
  assert.deepEqual(result.issues.map((i) => i.code), ["missingEvidence"]);
});
test("unverified definitions are not ready", () => {
  assert.deepEqual(checkEvidenceReadiness({ ...def, status: "pending" }, observed({ kind: "number", value: 0, evidence: src })).issues.map((i) => i.code), ["definitionNotVerified"]);
});
test("period mismatch blocks readiness", () => {
  assert.deepEqual(checkEvidenceReadiness(def, { ...observed({ kind: "number", value: 1, evidence: src }), reportingPeriod: "term-2" }).issues.map((i) => i.code), ["mismatchedPeriod"]);
});
test("nonfinite data and source gaps block readiness", () => {
  assert.deepEqual(checkEvidenceReadiness(def, observed({ kind: "number", value: Infinity, evidence: { ...src, locator: "" } })).issues.map((i) => i.code), ["nonfiniteValue", "missingSourceLocator"]);
});
test("derived values must preserve both input locators", () => {
  assert.deepEqual(checkEvidenceReadiness(def, observed({ kind: "derivedNumber", value: 0.5, sources: [src, { ...src, sourceId: "" }], formulaCode: "SYNTHETIC" })).issues.map((i) => i.code), ["missingSourceLocator"]);
});
