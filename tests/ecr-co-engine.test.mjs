import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { computeCoCore, transmuteCoCore } from "../app/lib/ecr-co-core.ts";

const receipt = JSON.parse(readFileSync(new URL("./fixtures/ecr-co-engine.json", import.meta.url), "utf8"));
const registry = JSON.parse(readFileSync(new URL("../docs/ecr/source-registry.json", import.meta.url), "utf8"));
const policy = JSON.parse(readFileSync(new URL("../docs/ecr/policy-fixed-points.json", import.meta.url), "utf8"));
test("independent CO engine receipt belongs to the registered source and stays unapproved for import", () => {
  const source = registry.sources.find((item) => item.family === "co-core");
  assert.equal(receipt.schema, "tanaw-co-engine-receipt-v1");
  assert.equal(receipt.sourceHash, source.original_sha256);
  assert.equal(receipt.structuralFingerprint, source.structural_fingerprint);
  assert.equal(receipt.runtimeImportApproved, false);
  assert.deepEqual(receipt.terms.map((item) => item.term), ["TERM 1", "TERM 2", "TERM 3"]);
});
for (const term of receipt.terms) {
  test(`${term.term}: independent engine matches all 124 lookup cases`, () => {
    assert.equal(term.lookupCases.length, 124);
    for (const [id, initialGrade, grade] of term.lookupCases) assert.equal(transmuteCoCore(initialGrade), grade, id);
  });
  test(`${term.term}: independent engine matches eleven synthetic component cases`, () => {
    assert.equal(term.componentCases.length, 11);
    for (const item of term.componentCases) {
      const actual = computeCoCore(item.inputs);
      for (const [key, expected] of Object.entries(item.expected)) {
        if (expected === null || key === "grade") assert.equal(actual[key], expected, `${item.id}: ${key}`);
        // Floating-point regression precision, never a production import tolerance.
        else assert.ok(Math.abs(actual[key] - expected) <= 1e-12, `${item.id}: ${key}`);
      }
    }
  });
  test(`${term.term}: reviewable candidate fixes all 41 policy points while the source conflict remains explicit`, () => {
    assert.equal(policy.fixed_points.length, 41);
    assert.equal(policy.runtime_formula_approval, false);
    let sourceConflicts = 0;
    for (const [initial, prescribed] of policy.fixed_points) {
      const item = term.lookupCases.find(([id, value]) => id.endsWith("-exact") && value === initial);
      assert.ok(item);
      assert.equal(item[3], prescribed, `candidate at ${initial}`);
      if (item[2] !== prescribed) sourceConflicts++;
    }
    assert.equal(sourceConflicts, 40);
    for (const [id, , original, candidate] of term.lookupCases) {
      if (!id.endsWith("-exact")) assert.equal(candidate, original, id);
    }
    assert.equal(term.componentCases.find((item) => item.id === "missing").candidateGrade, null);
    assert.equal(term.componentCases.find((item) => item.id === "entered-zero").candidateGrade, 60);
  });
}
