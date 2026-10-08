import assert from "node:assert/strict";
import test from "node:test";
import { checkPacketReadiness } from "../app/lib/smea-packet-readiness.ts";

const source = { sourceId: "fixture", documentTitle: "Synthetic", locator: "A1", schoolYear: "2026-2027" };
const definition = { code: "A", label: "Synthetic", unit: "count", schoolYear: "2026-2027", reportingPeriod: "term-1", status: "verified", source, formula: null };
const observation = { indicatorCode: "A", reportingPeriod: "term-1", scopeId: "s1", reviewState: "working", value: { kind: "number", value: 0, evidence: source } };

test("empty packet is not ready", () => {
  const result = checkPacketReadiness([], [], "s1");
  assert.equal(result.ready, false);
});
test("evidenced zero counts as ready", () => {
  assert.deepEqual(checkPacketReadiness([definition], [observation], "s1"), {
    ready: true, expected: 1, readyIndicators: 1, issues: [],
  });
});
test("missing evidence cannot count as readiness", () => {
  const result = checkPacketReadiness([definition], [], "s1");
  assert.equal(result.ready, false);
  assert.deepEqual(result.issues.map((issue) => issue.code), ["missingEvidence"]);
});
test("duplicate evidence is not silently selected", () => {
  const result = checkPacketReadiness([definition], [observation, observation], "s1");
  assert.equal(result.ready, false);
  assert.deepEqual(result.issues.map((issue) => issue.code), ["duplicateEvidence"]);
});
test("duplicate definitions block readiness", () => {
  const result = checkPacketReadiness([definition, definition], [observation], "s1");
  assert.equal(result.ready, false);
  assert.ok(result.issues.some((issue) => issue.code === "duplicateDefinition"));
});
test("unverified definition blocks packet", () => {
  const result = checkPacketReadiness([{ ...definition, status: "pending" }], [observation], "s1");
  assert.deepEqual(result.issues.map((issue) => issue.code), ["definitionNotVerified"]);
});

test("evidence from another scope does not satisfy this packet", () => {
  const result = checkPacketReadiness([definition], [{ ...observation, scopeId: "s2" }], "s1");
  assert.deepEqual(result.issues.map((issue) => issue.code), ["missingEvidence"]);
});

test("unexpected evidence in the requested scope blocks readiness", () => {
  const extra = { ...observation, indicatorCode: "UNKNOWN" };
  const result = checkPacketReadiness([definition], [observation, extra], "s1");
  assert.equal(result.ready, false);
  assert.deepEqual(result.issues.map((issue) => issue.code), ["unexpectedEvidence"]);
});
test("unexpected evidence in another scope is excluded", () => {
  const extra = { ...observation, indicatorCode: "UNKNOWN", scopeId: "s2" };
  const result = checkPacketReadiness([definition], [observation, extra], "s1");
  assert.equal(result.ready, true);
});
test("blank reporting scope fails closed", () => {
  const result = checkPacketReadiness([definition], [], " ");
  assert.equal(result.ready, false);
  assert.ok(result.issues.some((issue) => issue.code === "invalidScope"));
});
