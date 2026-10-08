import test from "node:test";
import assert from "node:assert/strict";
import { evaluateEcrPreview } from "../app/lib/ecr-preview.ts";

const row = (overrides = {}) => ({ rowNumber: 1, learnerKey: "synthetic-1", learnerName: "Synthetic Learner", inputScores: [10, 0, null], computedGrade: 90, referenceGrade: 90, ...overrides });
const preview = (rows, overrides = {}) => evaluateEcrPreview({ templateFingerprint: "synthetic-approved-fixture", mapping: { templateFingerprint: "synthetic-approved-fixture", formulaVerified: true, fixtureVerified: true, comparisonTolerance: 0 }, rows, ...overrides });
const has = (result, code) => result.errors.some((error) => error.code === code);

test("blank roster formula artifacts never become learners", () => {
  const result = preview([row(), row({ rowNumber: 2, learnerKey: null, learnerName: " ", inputScores: [null], computedGrade: 0, referenceGrade: 0 })]);
  assert.equal(result.canImport, true);
  assert.equal(result.learnerCount, 1);
  assert.equal(result.excludedBlankRows, 1);
  assert.equal(result.acceptedRows.length, 1);
});
test("zero entered scores are data and require learner identity", () => {
  const result = preview([row({ learnerKey: null, learnerName: null, inputScores: [0] })]);
  assert.equal(result.excludedBlankRows, 0);
  assert.ok(has(result, "incomplete-learner-identity"));
});
test("one discrepancy blocks every row", () => {
  const result = preview([row(), row({ rowNumber: 2, learnerKey: "synthetic-2", referenceGrade: 89 })]);
  assert.ok(has(result, "computation-discrepancy"));
  assert.deepEqual(result.acceptedRows, []);
});
test("template must match the registered mapping", () => {
  assert.ok(has(preview([row()], { templateFingerprint: "unrecognized" }), "unrecognized-template"));
  assert.equal(preview([row()], { mapping: null }).canImport, false);
});
test("both formula and fixture verification are required", () => {
  for (const field of ["formulaVerified", "fixtureVerified"]) {
    const mapping = { templateFingerprint: "synthetic-approved-fixture", formulaVerified: true, fixtureVerified: true, comparisonTolerance: 0, [field]: false };
    assert.ok(has(preview([row()], { mapping }), "unverified-computation"));
  }
});
test("duplicates after key whitespace normalization block the batch", () => {
  assert.ok(has(preview([row(), row({ rowNumber: 2, learnerKey: " synthetic-1 " })]), "duplicate-learner"));
});
test("identified learners with no entered scores are incomplete, never zero", () => {
  assert.ok(has(preview([row({ inputScores: [null], computedGrade: 0, referenceGrade: 0 })]), "missing-input-scores"));
});
test("missing, nonfinite and out-of-range grades are rejected", () => {
  for (const grade of [null, NaN, Infinity, -1, 101]) {
    assert.ok(has(preview([row({ computedGrade: grade })]), "missing-or-invalid-grade"));
    assert.ok(has(preview([row({ referenceGrade: grade })]), "missing-or-invalid-grade"));
  }
});
test("invalid raw scores are rejected", () => {
  for (const score of [NaN, Infinity, -1]) assert.ok(has(preview([row({ inputScores: [score] })]), "invalid-input-score"));
});
test("empty or entirely blank rosters are rejected", () => {
  assert.ok(has(preview([]), "empty-roster"));
  assert.ok(has(preview([row({ learnerKey: null, learnerName: null, inputScores: [null] })]), "empty-roster"));
});
test("invalid and repeated row positions are rejected", () => {
  assert.ok(has(preview([row({ rowNumber: 0 })]), "invalid-or-duplicate-row-number"));
  assert.ok(has(preview([row(), row({ learnerKey: "synthetic-2" })]), "invalid-or-duplicate-row-number"));
});
test("comparison tolerance is bounded and must come from a verified mapping", () => {
  const mapping = { templateFingerprint: "synthetic-approved-fixture", formulaVerified: true, fixtureVerified: true, comparisonTolerance: 0.01 };
  assert.equal(preview([row({ computedGrade: 90.009 })], { mapping }).canImport, true);
  assert.equal(preview([row({ computedGrade: 90.02 })], { mapping }).canImport, false);
  for (const value of [-1, NaN, Infinity, 2]) assert.ok(has(preview([row()], { mapping: { ...mapping, comparisonTolerance: value } }), "invalid-comparison-tolerance"));
});
