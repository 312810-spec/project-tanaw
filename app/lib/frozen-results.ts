/** Synthetic, read-only aggregation. No authority, publication or workflow transition. */
type JsonObject = Record<string, unknown>;
export type FrozenResultIssue = "invalidContract" | "invalidPacket" | "packetNotLockedComplete" | "scopeMismatch" | "coverageMismatch" | "overlappingPopulation" | "invalidManifest" | "invalidEvidence" | "missingFrozenVersion" | "definitionMismatch" | "missingMeasure" | "invalidCount" | "populationMismatch" | "zeroDenominator";
export type FrozenResultDiagnostic = {
  schema: "tanaw-frozen-result-diagnostic-v1";
  status: "readyDiagnosticOnly" | "unavailable";
  canPublish: false;
  canAcceptDistrict: false;
  coverage: { expected: number; included: number };
  issues: FrozenResultIssue[];
  result: { method: "countSum" | "populationPercentage"; unit: "count" | "percent"; value: number; numerator: number; denominator: number | null } | null;
  provenance: { packetId: string; packetVersion: number; contractId: string; contractRevision: number; partitionId: string; partitionRevision: number } | null;
};
const definitionFields = ["id", "label", "unit", "sourceTitle", "sourceLocator", "sourceId", "schoolYear", "period", "formula", "numerator", "denominator", "rounding"] as const;
const object = (value: unknown): value is JsonObject => value !== null && typeof value === "object" && !Array.isArray(value);
const uuid = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(value);
const count = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const positive = (value: unknown): value is number => count(value) && value > 0;
const text = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length <= 2000 && value.trim() === value;
const list = (value: unknown, max: number): value is unknown[] => Array.isArray(value) && value.length <= max;
const records = (value: unknown, max: number): value is JsonObject[] => list(value, max) && Array.from(value).every(object);
const sameSet = (a: string[], b: string[]) => a.length === b.length && new Set(a).size === a.length && new Set(b).size === b.length && a.every((key) => b.includes(key));

/**
 * Contract fields: schema, purpose="synthetic", id/revision, schoolId/cycleId,
 * schoolYear/period, method, decimals, rounding="halfUp", numeratorDefinition, denominatorDefinition,
 * partition {id, revision, contributions:[{slot, populationKeys: UUID[]}] }.
 * Definitions are the exact frozen manifest fields, never a live registry read.
 * V1 covers all packet slots for one count measure or one population percentage.
 * Only supplied synthetic membership can be checked; this is not roster approval.
 */
export function projectFrozenResult(contract: unknown, packet: unknown, evidence: unknown): FrozenResultDiagnostic {
  const out: FrozenResultDiagnostic = { schema: "tanaw-frozen-result-diagnostic-v1", status: "unavailable", canPublish: false, canAcceptDistrict: false, coverage: { expected: 0, included: 0 }, issues: [], result: null, provenance: null };
  const add = (issue: FrozenResultIssue) => { if (!out.issues.includes(issue)) out.issues.push(issue); };
  const validDefinition = (d: unknown): d is JsonObject => object(d) && definitionFields.every((field) => text(d[field])) && uuid(d.id) && d.unit === "count";
  if (!object(contract) || contract.schema !== "tanaw-frozen-result-contract-v1" || contract.purpose !== "synthetic"
      || !uuid(contract.id) || !positive(contract.revision) || !uuid(contract.schoolId) || !uuid(contract.cycleId)
      || !text(contract.schoolYear) || !text(contract.period)
      || (contract.method !== "countSum" && contract.method !== "populationPercentage") || contract.rounding !== "halfUp"
      || !count(contract.decimals) || contract.decimals > 6 || (contract.method === "countSum" && contract.decimals !== 0)
      || !validDefinition(contract.numeratorDefinition)
      || (contract.method === "populationPercentage" ? !validDefinition(contract.denominatorDefinition) : contract.denominatorDefinition !== null)
      || !object(contract.partition) || !uuid(contract.partition.id) || !positive(contract.partition.revision)
      || !records(contract.partition.contributions, 1000) || contract.partition.contributions.length === 0) {
    add("invalidContract"); return out;
  }
  const definitions = [contract.numeratorDefinition];
  if (object(contract.denominatorDefinition)) definitions.push(contract.denominatorDefinition);
  if (new Set(definitions.map((d) => d.id)).size !== definitions.length
      || definitions.some((d) => d.schoolYear !== contract.schoolYear || d.period !== contract.period)) {
    add("invalidContract"); return out;
  }
  const contributions = contract.partition.contributions;
  out.coverage.expected = contributions.length;
  const population = new Set<string>(), slots = new Set<string>();
  let members = 0;
  for (const contribution of contributions) {
    if (!uuid(contribution.slot) || slots.has(contribution.slot) || !list(contribution.populationKeys, 1000) || !Array.from(contribution.populationKeys).every(uuid)) {
      add("invalidContract"); return out;
    }
    slots.add(contribution.slot);
    members += contribution.populationKeys.length;
    if (members > 10000) { add("invalidContract"); return out; }
    for (const key of contribution.populationKeys as string[]) {
      if (population.has(key)) add("overlappingPopulation");
      population.add(key);
    }
  }
  if (!object(packet) || !uuid(packet.id) || !positive(packet.version) || !uuid(packet.school_id) || !uuid(packet.cycle_id)
      || !records(packet.manifest, 1000) || packet.manifest.length === 0 || !list(packet.missing, 1000)) {
    add("invalidPacket"); return out;
  }
  if (packet.school_id !== contract.schoolId || packet.cycle_id !== contract.cycleId) add("scopeMismatch");
  if (typeof packet.locked_at !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(packet.locked_at)
      || !Number.isFinite(Date.parse(packet.locked_at)) || packet.completeness !== "complete" || packet.missing.length) add("packetNotLockedComplete");
  const manifest = packet.manifest;
  if (!sameSet([...slots], manifest.map((item) => String(item.slot)))) add("coverageMismatch");
  const submissionIds = new Set<string>();
  for (const item of manifest) {
    if (!uuid(item.slot) || !uuid(item.submission) || submissionIds.has(item.submission) || !positive(item.version)
        || item.coverageComplete !== true || !positive(item.requirementsRevision)
        || !list(item.requiredIndicators, 200) || !Array.from(item.requiredIndicators).every(uuid)
        || new Set(item.requiredIndicators).size !== item.requiredIndicators.length
        || !records(item.definitions, 200) || !item.definitions.every((d) => uuid(d.id))
        || new Set(item.definitions.map((d) => d.id)).size !== item.definitions.length) {
      add("invalidManifest"); continue;
    }
    submissionIds.add(item.submission);
    for (const definition of definitions) {
      const frozen = item.definitions.find((d) => d.id === definition.id);
      if (!item.requiredIndicators.includes(definition.id) || !frozen || definitionFields.some((field) => frozen[field] !== definition[field])) add("definitionMismatch");
    }
  }
  if (!records(evidence, 1000)) { add("invalidEvidence"); return out; }
  // Exact RPC-shaped input only: later/current versions cannot silently replace or join a frozen one.
  const versionKeys = new Set<string>();
  for (const version of evidence) {
    if (!uuid(version.submission_id) || !positive(version.version) || !object(version.evidence)
        || version.evidence.kind !== "manualIndicators"
        || !records(version.evidence.entries, 200) || version.evidence.entries.length === 0
        || !version.evidence.entries.every((entry) => uuid(entry.definitionId))
        || new Set(version.evidence.entries.map((entry) => entry.definitionId)).size !== version.evidence.entries.length) { add("invalidEvidence"); continue; }
    const key = version.submission_id + ":" + version.version;
    if (versionKeys.has(key) || !manifest.some((item) => item.submission === version.submission_id && item.version === version.version)) add("invalidEvidence");
    versionKeys.add(key);
  }
  if (out.issues.length) { out.issues.sort(); return out; }
  out.provenance = { packetId: packet.id, packetVersion: packet.version, contractId: contract.id, contractRevision: contract.revision, partitionId: contract.partition.id, partitionRevision: contract.partition.revision };
  let numerator = BigInt(0), denominator = BigInt(0);
  for (const contribution of contributions) {
    const item = manifest.find((row) => row.slot === contribution.slot)!;
    const version = evidence.find((row) => row.submission_id === item.submission && row.version === item.version);
    if (!version) { add("missingFrozenVersion"); continue; }
    const entries = (version.evidence as JsonObject).entries as JsonObject[];
    const measures = definitions.map((definition) => entries.find((entry) => entry.definitionId === definition.id));
    if (measures.some((entry) => !entry || !text(entry.sourceTitle) || !text(entry.sourceLocator))) { add("missingMeasure"); continue; }
    if (measures.some((entry) => !count(entry!.value))) { add("invalidCount"); continue; }
    const num = measures[0]!.value as number, den = measures[1]?.value as number | undefined;
    const size = (contribution.populationKeys as string[]).length;
    if (num > size || (den !== undefined && den !== size)) { add("populationMismatch"); continue; }
    numerator += BigInt(num); if (den !== undefined) denominator += BigInt(den);
    out.coverage.included++;
  }
  if (contract.method === "populationPercentage" && denominator === BigInt(0)) add("zeroDenominator");
  if (out.issues.length) { out.issues.sort(); return out; }
  const factor = BigInt(10 ** contract.decimals);
  // Nonnegative exact rational arithmetic, rounded half-up once after pooling counts.
  const value = contract.method === "countSum" ? Number(numerator)
    : Number((BigInt(2) * numerator * BigInt(100) * factor + denominator) / (BigInt(2) * denominator)) / Number(factor);
  out.result = { method: contract.method as "countSum" | "populationPercentage", unit: contract.method === "countSum" ? "count" : "percent", value, numerator: Number(numerator), denominator: contract.method === "countSum" ? null : Number(denominator) };
  out.status = "readyDiagnosticOnly";
  return out;
}
