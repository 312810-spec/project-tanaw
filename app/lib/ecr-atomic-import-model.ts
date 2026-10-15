/** Synthetic reference model only. No route, persistence, permission or import enablement.
 * A future transaction must load every authority field from trusted server state,
 * lock the submission, compare revisions, and persist history + receipt atomically.
 * Private rows/results must never be logged or exposed to district workspaces.
 */
export type ImportScope = { schoolId: string; submissionId: string; classId: string; subjectId: string; schoolYear: string; term: string };
export type ImportStage = {
  requestId: string; stageId: string; ownerId: string; scope: ImportScope;
  sourceHash: string; templateVersion: string; formulaVersion: string;
  rosterRevision: string; mappingRevision: string; expectedVersion: number;
  expiresAt: number;
  rows: Array<{ learnerKey: string; value: number | null }>;
};
export type ImportAuthority = {
  actorId: string; ownerId: string; scope: ImportScope; accessActive: boolean;
  templateVersion: string; formulaVersion: string; rosterRevision: string; mappingRevision: string;
  sourceApproved: boolean; mappingApproved: boolean; retentionApproved: boolean;
  computationVerified: boolean; periodVerified: boolean;
  now: number; deadline: number; extension: null | { ownerId: string; until: number; reason: string };
  locked: boolean;
  /** Server-retained confirmation snapshot, required for replacement. */
  confirmedCorrection: ImportStage | null;
};
export type ImportVersion = {
  version: number; stage: ImportStage; supersedes: number | null;
  reviewState: "working";
};
export type ImportModelState = { currentVersion: number; history: ImportVersion[] };
type Outcome = {
  runtimeImportEnabled: false;
  status: "rejected" | "simulated-commit" | "replayed-receipt";
  code: string; state: ImportModelState; receiptVersion: number | null;
};
const versionFields = ["templateVersion", "formulaVersion", "rosterRevision", "mappingRevision"] as const;
const fields = ["schoolId", "submissionId", "classId", "subjectId", "schoolYear", "term"] as const;
const id = (value: string) => typeof value === "string" && value.length > 0 && value.length <= 200 && value.trim() === value;
const sameScope = (a: ImportScope, b: ImportScope) => fields.every((field) => a[field] === b[field]);
// Explicit ordered representation: object insertion order cannot alter retry identity.
const identity = (stage: ImportStage) => JSON.stringify([
  stage.requestId, stage.stageId, stage.ownerId, fields.map((field) => stage.scope[field]),
  stage.sourceHash, stage.templateVersion, stage.formulaVersion, stage.rosterRevision,
  stage.mappingRevision, stage.expectedVersion, stage.expiresAt,
  stage.rows.map((row) => [row.learnerKey, row.value]),
]);

/** Executable transaction specification with synthetic caller-supplied authority.
 * Successful output is a simulation, never an authorization receipt.
 * Failures preserve the complete prior state, withholding every candidate row.
 */
export function simulateAtomicImport(state: ImportModelState, stage: ImportStage, authority: ImportAuthority): Outcome {
  const finish = (status: Outcome["status"], code: string, next = state, version: number | null = null): Outcome => ({
    runtimeImportEnabled: false, status, code, state: structuredClone(next), receiptVersion: version,
  });
  const reject = (code: string) => finish("rejected", code);
  if (!authority.accessActive || authority.actorId !== authority.ownerId || stage.ownerId !== authority.ownerId || !sameScope(stage.scope, authority.scope)) return reject("access-or-scope-changed");
  if (!fields.every((field) => id(stage.scope[field])) || !["TERM 1", "TERM 2", "TERM 3"].includes(stage.scope.term) ||
      ![stage.requestId, stage.stageId, stage.ownerId, stage.templateVersion, stage.formulaVersion, stage.rosterRevision, stage.mappingRevision].every(id) ||
      !/^[a-f0-9]{64}$/.test(stage.sourceHash) || !Number.isSafeInteger(stage.expectedVersion) || stage.expectedVersion < 0 ||
      !Number.isFinite(stage.expiresAt) || !Number.isFinite(authority.now)) return reject("invalid-stage");
  if (!Array.isArray(stage.rows) || stage.rows.length < 1 || stage.rows.length > 100 || stage.rows.some((row) => !id(row.learnerKey) ||
      (row.value !== null && (typeof row.value !== "number" || !Number.isFinite(row.value) || row.value < 0))) ||
      new Set(stage.rows.map((row) => row.learnerKey)).size !== stage.rows.length) return reject("invalid-row-batch");
  // State is per submission. Detect accidental mixed histories before receipt lookup.
  if (state.currentVersion !== state.history.length || state.history.some((entry, index) => entry.version !== index + 1 ||
      entry.supersedes !== (index === 0 ? null : index) || !sameScope(entry.stage.scope, authority.scope)) ||
      new Set(state.history.map((entry) => entry.stage.requestId)).size !== state.history.length) return reject("invalid-history");
  const previous = state.history.find((entry) => entry.stage.requestId === stage.requestId);
  if (previous) {
    if (identity(previous.stage) !== identity(stage)) return reject("request-id-conflict");
    // Read-only recovery remains available after expiry/deadline/Lock, subject to current access.
    return finish("replayed-receipt", "already-recorded", state, previous.version);
  }
  if (authority.locked) return reject("locked-amendment-required");
  if (state.history.some((entry) => entry.stage.stageId === stage.stageId)) return reject("stage-already-consumed");
  if (state.currentVersion !== stage.expectedVersion) return reject("version-conflict");
  if (authority.now >= stage.expiresAt) return reject("stage-expired");
  if (!Number.isFinite(authority.deadline)) return reject("invalid-deadline");
  const extension = authority.extension;
  const extended = extension !== null && extension.ownerId === stage.ownerId &&
    typeof extension.reason === "string" && extension.reason.trim().length > 0 && Number.isFinite(extension.until) && authority.now < extension.until;
  if (authority.now >= authority.deadline && !extended) return reject("editing-closed");
  if (authority.sourceApproved !== true || authority.mappingApproved !== true || authority.retentionApproved !== true ||
      authority.computationVerified !== true || authority.periodVerified !== true) return reject("approval-or-evidence-pending");
  if (versionFields.some((field) => stage[field] !== authority[field])) return reject("stale-stage");
  if (state.currentVersion > 0 && (!authority.confirmedCorrection || identity(authority.confirmedCorrection) !== identity(stage))) return reject("correction-confirmation-required");
  const version = state.currentVersion + 1;
  const next = { currentVersion: version, history: [...state.history, {
    version, stage, supersedes: state.currentVersion || null, reviewState: "working" as const,
  }] };
  return finish("simulated-commit", "simulation-only", next, version);
}

/** Corrected imports replace the current contribution; retained history is never summed. */
export function currentImportModelRows(state: ImportModelState): ImportStage["rows"] {
  return structuredClone(state.history.find((entry) => entry.version === state.currentVersion)?.stage.rows ?? []);
}
