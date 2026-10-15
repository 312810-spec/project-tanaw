import test from "node:test";
import assert from "node:assert/strict";
import { fileCheckSelectionError, parseFileCheckResult, fileCheckFailure, ECR_FILE_LIMIT } from "../app/lib/ecr-file-check.ts";

const result = (overrides = {}) => ({ code: "recognized-diagnostic-only", canImport: false, runtimeImportEnabled: false,
  computationComparison: "not-performed", term: "TERM 1", rowSlots: 100, occupiedRows: 1, excludedBlankRows: 99, sourceHash: "a".repeat(64), ...overrides });
test("browser rejects absent/unsupported/empty/oversized files before upload", () => {
  for (const file of [null, { name: "private.xlsm", size: 10 }, { name: "private.xlsx", size: 0 }, { name: "private.xlsx", size: -1 }, { name: "private.xlsx", size: Infinity }, { name: "private.xlsx", size: ECR_FILE_LIMIT + 1 }]) {
    const error = fileCheckSelectionError(file);
    assert.equal(typeof error, "string"); assert.doesNotMatch(error, /private/);
  }
  assert.equal(fileCheckSelectionError({ name: "synthetic.XLSX", size: ECR_FILE_LIMIT }), null);
});
test("recognized summaries keep only count/hash/term fields and preserve recorded zero", () => {
  const parsed = parseFileCheckResult(result({ occupiedRows: 0, excludedBlankRows: 100, learnerName: "PRIVATE_MARKER" }), "TERM 1");
  assert.deepEqual(parsed, { term: "TERM 1", sourceHash: "a".repeat(64), occupiedRows: 0, excludedBlankRows: 100 });
  assert.doesNotMatch(JSON.stringify(parsed), /PRIVATE_MARKER|canImport/);
});
test("mismatched term, unsupported semantics and malformed counts cannot become a result", () => {
  for (const value of [null, [], {}, result({ canImport: true }), result({ runtimeImportEnabled: true }), result({ computationComparison: "passed" }), result({ term: "TERM 2" }),
    result({ occupiedRows: -1 }), result({ occupiedRows: 0.5 }), result({ excludedBlankRows: 100 }), result({ sourceHash: "PRIVATE_HASH" }), result({ rowSlots: 99 })]) {
    assert.equal(parseFileCheckResult(value, "TERM 1"), null);
  }
  assert.equal(parseFileCheckResult(result(), "TERM 4"), null);
});
test("all supported terms remain explicit and independently bound to a result", () => {
  for (const term of ["TERM 1", "TERM 2", "TERM 3"]) assert.equal(parseFileCheckResult(result({ term }), term)?.term, term);
});
test("HTTP failures offer recovery without raw server text or false completion", () => {
  for (const status of [400, 401, 403, 408, 413, 422, 429, 500, 503]) {
    const text = fileCheckFailure(status);
    assert.ok(text.length > 20); assert.doesNotMatch(text, /has been approved|was approved|import complete|PRIVATE_MARKER/);
  }
  assert.match(fileCheckFailure(403), /Refresh school access/);
  assert.match(fileCheckFailure(429), /try again/);
});
