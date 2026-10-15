/** CO diagnostic mapping consistency only: no identity inference or import authority.
 * A future server caller must supply its own authorized context/roster, not trust
 * an uploaded bundle. Returned bindings are private and must not be logged.
 */
type Scope = { schoolId: string; classId: string; subjectId: string; schoolYear: string; term: string };
type SourceRow = { rowNumber: number; identityLocator: string; learnerName: string | null; inputScores: Array<number | null> };
type MappingError = { rowNumber: number | null; code: string };
export type IdentityMappingResult = {
  mappingConsistent: boolean;
  occupiedRows: number;
  errors: MappingError[];
  bindings: Array<{ rowNumber: number; learnerKey: string }>;
};
const scopeFields = ["schoolId", "classId", "subjectId", "schoolYear", "term"] as const;
const record = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const identifier = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length <= 200 && value.trim() === value && !/[\u0000-\u001f\u007f]/.test(value);
const digest = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const scope = (value: unknown): value is Scope => record(value) && scopeFields.every((field) => identifier(value[field])) && ["TERM 1", "TERM 2", "TERM 3"].includes(String(value.term));
const sameScope = (left: Scope, right: Scope) => scopeFields.every((field) => left[field] === right[field]);
const locator = (row: number) => row >= 18 && row <= 67 ? `INPUT DATA!K${row - 7}` : row >= 69 && row <= 118 ? `INPUT DATA!N${row - 58}` : null;
const rowNumber = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && locator(value) !== null;

/** Unknown JSON is validated before use; errors contain static codes/CO rows only. */
export function evaluateCoIdentityMapping(input: unknown): IdentityMappingResult {
  const errors: MappingError[] = [];
  let occupiedRows = 0;
  const fail = (code: string, row: number | null = null) => errors.push({ rowNumber: row, code });
  const result = (bindings: IdentityMappingResult["bindings"] = []): IdentityMappingResult => ({ mappingConsistent: errors.length === 0, occupiedRows, errors, bindings: errors.length ? [] : bindings });
  if (!record(input) || !scope(input.context) || !record(input.source) || !record(input.roster) || !record(input.mapping)) {
    fail("invalid-mapping-bundle"); return result();
  }
  const { context, source, roster, mapping } = input;
  if (!digest(source.sourceHash) || !digest(source.templateFingerprint) || source.term !== context.term || !Array.isArray(source.rows) || source.rows.length !== 100) {
    fail("invalid-source-descriptor"); return result();
  }
  const sourceRows: SourceRow[] = [];
  const seenRows = new Set<number>();
  for (const row of source.rows) {
    if (!record(row) || !rowNumber(row.rowNumber) || seenRows.has(row.rowNumber) || row.identityLocator !== locator(row.rowNumber) ||
      !(row.learnerName === null || (typeof row.learnerName === "string" && row.learnerName.length <= 500)) ||
      !Array.isArray(row.inputScores) || row.inputScores.length !== 11 || row.inputScores.some((score) => score !== null && (typeof score !== "number" || !Number.isFinite(score) || score < 0))) {
      fail("invalid-source-layout"); return result();
    }
    seenRows.add(row.rowNumber);
    sourceRows.push(row as SourceRow);
  }
  const occupied = sourceRows.filter((row) => !!row.learnerName?.trim() || row.inputScores.some((value) => value !== null));
  occupiedRows = occupied.length;
  if (!occupiedRows) fail("empty-roster");
  if (roster.schema !== "tanaw-roster-snapshot-v1" || !scope(roster.context) || !identifier(roster.revision) || !Array.isArray(roster.learnerKeys) || roster.learnerKeys.length > 1000 || !roster.learnerKeys.every(identifier)) {
    fail("invalid-roster-snapshot"); return result();
  }
  if (mapping.schema !== "tanaw-co-identity-map-v1" || !scope(mapping.context) || !identifier(mapping.revision) || !identifier(mapping.rosterRevision) || !digest(mapping.sourceHash) || !digest(mapping.templateFingerprint) || !Array.isArray(mapping.entries) || mapping.entries.length > 100) {
    fail("invalid-identity-map"); return result();
  }
  if (!sameScope(context, roster.context) || !sameScope(context, mapping.context)) fail("mapping-scope-mismatch");
  if (mapping.sourceHash !== source.sourceHash || mapping.templateFingerprint !== source.templateFingerprint) fail("mapping-source-mismatch");
  if (mapping.rosterRevision !== roster.revision) fail("stale-roster-mapping");
  const allowedKeys = new Set<string>(roster.learnerKeys);
  if (allowedKeys.size !== roster.learnerKeys.length) fail("duplicate-roster-key");
  const bindings: IdentityMappingResult["bindings"] = [];
  const boundRows = new Set<number>(), boundKeys = new Set<string>();
  const occupiedByRow = new Map(occupied.map((row) => [row.rowNumber, row]));
  for (const entry of mapping.entries) {
    if (!record(entry) || !rowNumber(entry.rowNumber) || entry.identityLocator !== locator(entry.rowNumber) || !identifier(entry.learnerKey)) {
      fail("invalid-mapping-entry"); continue;
    }
    const row = entry.rowNumber, key = entry.learnerKey;
    if (boundRows.has(row)) fail("duplicate-mapped-row", row);
    if (boundKeys.has(key)) fail("duplicate-mapped-learner", row);
    boundRows.add(row); boundKeys.add(key);
    if (!occupiedByRow.has(row)) fail("mapping-for-blank-slot", row);
    if (!allowedKeys.has(key)) fail("learner-outside-roster", row);
    bindings.push({ rowNumber: row, learnerKey: key });
  }
  for (const row of occupied) if (!boundRows.has(row.rowNumber)) fail("unmapped-occupied-slot", row.rowNumber);
  return result(bindings);
}
