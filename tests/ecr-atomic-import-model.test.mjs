import test from "node:test";
import assert from "node:assert/strict";
import { simulateAtomicImport, currentImportModelRows } from "../app/lib/ecr-atomic-import-model.ts";

function fixture() {
  const scope = { schoolId: "synthetic-school", submissionId: "synthetic-submission", classId: "synthetic-class", subjectId: "synthetic-subject", schoolYear: "synthetic-year", term: "TERM 1" };
  const versions = { templateVersion: "template-v1", formulaVersion: "formula-v1", rosterRevision: "roster-v1", mappingRevision: "map-v1" };
  return { state: { currentVersion: 0, history: [] }, stage: { ...versions, scope, requestId: "request-1", stageId: "stage-1", ownerId: "synthetic-owner", sourceHash: "a".repeat(64), expectedVersion: 0, expiresAt: 200,
    rows: [{ learnerKey: "PRIVATE_SYNTHETIC_A", value: 0 }, { learnerKey: "PRIVATE_SYNTHETIC_B", value: null }] },
    authority: { ...versions, scope: { ...scope }, actorId: "synthetic-owner", ownerId: "synthetic-owner", accessActive: true, sourceApproved: true, mappingApproved: true, retentionApproved: true, computationVerified: true, periodVerified: true, now: 100, deadline: 150, extension: null, locked: false, confirmedCorrection: null } };
}
const run = (f) => simulateAtomicImport(f.state, f.stage, f.authority);
function blocked(f, code) {
  const before = structuredClone(f), result = run(f);
  assert.equal(result.status, "rejected"); assert.equal(result.code, code);
  assert.deepEqual(result.state, before.state); assert.deepEqual(f, before);
  assert.equal(result.receiptVersion, null); assert.equal(result.runtimeImportEnabled, false);
  assert.doesNotMatch(result.code, /PRIVATE_SYNTHETIC/);
}
test("atomic simulation retains explicit zero and missing, creates no approval, and isolates snapshots", () => {
  const f = fixture(), before = structuredClone(f), result = run(f);
  assert.equal(result.status, "simulated-commit"); assert.equal(result.runtimeImportEnabled, false);
  assert.deepEqual(currentImportModelRows(result.state).map((row) => row.value), [0, null]);
  assert.equal(result.state.history[0].reviewState, "working"); assert.deepEqual(f, before);
  result.state.history[0].stage.rows[0].value = 99; assert.deepEqual(f, before);
});
test("one invalid row rejects all rows; duplicate keys never partially import", () => {
  for (const value of [NaN, Infinity, -1, undefined, "0"]) { const f = fixture(); f.stage.rows[1].value = value; blocked(f, "invalid-row-batch"); }
  const f = fixture(); f.stage.rows[1].learnerKey = f.stage.rows[0].learnerKey; blocked(f, "invalid-row-batch");
});
test("every scope dimension and current access are rechecked", () => {
  for (const field of Object.keys(fixture().stage.scope)) { const f = fixture(); f.authority.scope[field] = "changed"; blocked(f, "access-or-scope-changed"); }
  for (const patch of [{ accessActive: false }, { actorId: "other" }, { ownerId: "other" }]) { const f = fixture(); Object.assign(f.authority, patch); blocked(f, "access-or-scope-changed"); }
});
test("pending evidence cannot become authority, including pending roster declarations", () => {
  for (const field of ["sourceApproved", "mappingApproved", "retentionApproved", "computationVerified", "periodVerified"]) {
    for (const value of [false, "pending", undefined]) { const f = fixture(); f.authority[field] = value; blocked(f, "approval-or-evidence-pending"); }
  }
});
test("stale template, formula, roster or mapping revision rejects the entire stage", () => {
  for (const field of ["templateVersion", "formulaVersion", "rosterRevision", "mappingRevision"]) { const f = fixture(); f.authority[field] = "v2"; blocked(f, "stale-stage"); }
});
test("deadline and stage expiry close at the exact boundary", () => {
  for (const now of [150, 151]) { const f = fixture(); f.authority.now = now; blocked(f, "editing-closed"); }
  const f = fixture(); f.authority.now = 200; blocked(f, "stage-expired");
});
test("only an unexpired owner-specific reasoned extension permits a late simulation", () => {
  const f = fixture(); f.authority.now = 150; f.authority.extension = { ownerId: f.stage.ownerId, reason: "Synthetic exception", until: 170 };
  assert.equal(run(f).status, "simulated-commit");
  for (const patch of [{ ownerId: "other" }, { reason: " " }, { until: 150 }, { until: NaN }]) { const changed = structuredClone(f); Object.assign(changed.authority.extension, patch); blocked(changed, "editing-closed"); }
});
test("lost receipt retries are idempotent even after deadline and Lock, but never bypass access", () => {
  const f = fixture(); f.state = run(f).state; f.authority.now = 300; f.authority.locked = true;
  const result = run(f); assert.equal(result.status, "replayed-receipt"); assert.equal(result.receiptVersion, 1); assert.deepEqual(result.state, f.state);
  f.authority.accessActive = false; blocked(f, "access-or-scope-changed");
});
test("request identity binds all stage fields and every private row", () => {
  const base = fixture(); base.state = run(base).state;
  for (const mutate of [f => f.stage.sourceHash = "b".repeat(64), f => f.stage.stageId = "other", f => f.stage.rows[0].value = 1,
    f => f.stage.rows[1].value = 0, f => f.stage.rows.reverse(), f => f.stage.expectedVersion = 1,
    f => f.stage.expiresAt++, f => f.stage.formulaVersion = "v2"]) {
    const f = structuredClone(base); mutate(f); blocked(f, "request-id-conflict");
  }
  const f = structuredClone(base); f.stage.scope = Object.fromEntries(Object.entries(f.stage.scope).reverse()); assert.equal(run(f).status, "replayed-receipt");
});
test("concurrent stale writes cannot replace a successful version", () => {
  const f = fixture(); f.state = run(f).state; f.stage.requestId = "concurrent-request"; f.stage.stageId = "concurrent-stage"; blocked(f, "version-conflict");
});
test("corrected upload appends immutable history, resets reviews and counts only its current rows", () => {
  const f = fixture(); f.state = run(f).state; const first = structuredClone(f.state.history[0]);
  f.stage.requestId = "request-2"; f.stage.stageId = "stage-2"; f.stage.expectedVersion = 1; f.stage.rows[0].value = 20;
  blocked(f, "correction-confirmation-required");
  f.authority.confirmedCorrection = structuredClone(f.stage);
  const changed = structuredClone(f); changed.stage.rows[0].value = 21; blocked(changed, "correction-confirmation-required");
  const result = run(f); assert.equal(result.status, "simulated-commit");
  assert.deepEqual(result.state.history[0], first); assert.equal(result.state.history[1].supersedes, 1);
  assert.equal(result.state.history[1].reviewState, "working"); assert.deepEqual(currentImportModelRows(result.state).map(row => row.value), [20, null]);
  const rows = currentImportModelRows(result.state); rows[0].value = 99; assert.equal(currentImportModelRows(result.state)[0].value, 20);
  f.authority.locked = true; blocked(f, "locked-amendment-required");
});
test("malformed versions, digests, times and mixed histories fail closed", () => {
  for (const patch of [{ sourceHash: "bad" }, { expectedVersion: -1 }, { expectedVersion: 0.5 }, { expiresAt: Infinity }]) { const f = fixture(); Object.assign(f.stage, patch); blocked(f, "invalid-stage"); }
  const f = fixture(); f.state = run(f).state; f.state.currentVersion = 2; blocked(f, "invalid-history");
  const other = fixture(); other.authority.deadline = NaN; blocked(other, "invalid-deadline");
});

test("a consumed private stage cannot be recorded again under a different request", () => {
  const f = fixture(); f.state = run(f).state; f.stage.requestId = "different-request"; f.stage.expectedVersion = 1;
  blocked(f, "stage-already-consumed");
});

test("sparse or empty row entries reject the entire batch without throwing", () => {
  for (const rows of [Array(1), [fixture().stage.rows[0], ,], [null], [undefined]]) {
    const f = fixture(); f.stage.rows = rows; blocked(f, "invalid-row-batch");
  }
});

test("sparse or empty history entries cannot establish a valid prior version", () => {
  for (const history of [Array(1), [null], [undefined]]) {
    const f = fixture(); f.state = { currentVersion: 1, history };
    f.stage.expectedVersion = 1; blocked(f, "invalid-history");
  }
});
