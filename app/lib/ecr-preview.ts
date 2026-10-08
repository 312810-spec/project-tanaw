/** Pure preview policy only. Workbook parsing, approved formula mappings and persistence are separate. */
export type EcrPreviewRow = {
  rowNumber: number;
  learnerKey: string | null;
  learnerName: string | null;
  inputScores: Array<number | null>;
  computedGrade: number | null;
  referenceGrade: number | null;
};
export type EcrPreviewInput = {
  templateFingerprint: string;
  mapping: {
    templateFingerprint: string;
    formulaVerified: boolean;
    fixtureVerified: boolean;
    comparisonTolerance: number;
  } | null;
  rows: EcrPreviewRow[];
};
export type EcrPreviewResult = {
  canImport: boolean;
  learnerCount: number;
  excludedBlankRows: number;
  errors: Array<{ rowNumber: number | null; code: string }>;
  acceptedRows: EcrPreviewRow[];
};
export function evaluateEcrPreview(input: EcrPreviewInput): EcrPreviewResult {
  const errors: EcrPreviewResult["errors"] = [];
  const candidates: EcrPreviewRow[] = [];
  let excludedBlankRows = 0;
  const mapping = input.mapping;
  if (!mapping || !input.templateFingerprint.trim() || mapping.templateFingerprint !== input.templateFingerprint) {
    errors.push({ rowNumber: null, code: "unrecognized-template" });
  }
  if (!mapping?.formulaVerified || !mapping?.fixtureVerified) {
    errors.push({ rowNumber: null, code: "unverified-computation" });
  }
  const tolerance = mapping?.comparisonTolerance;
  if (typeof tolerance !== "number" || !Number.isFinite(tolerance) || tolerance < 0 || tolerance > 1) {
    errors.push({ rowNumber: null, code: "invalid-comparison-tolerance" });
  }
  const keys = new Set<string>();
  const rowNumbers = new Set<number>();
  for (const row of input.rows) {
    if (!Number.isInteger(row.rowNumber) || row.rowNumber < 1 || rowNumbers.has(row.rowNumber)) {
      errors.push({ rowNumber: row.rowNumber, code: "invalid-or-duplicate-row-number" });
    }
    rowNumbers.add(row.rowNumber);
    const key = row.learnerKey?.trim() ?? "";
    const name = row.learnerName?.trim() ?? "";
    const hasEnteredScores = row.inputScores.some((score) => score !== null);
    // Ignore formula artifacts only when both identity and raw scores are empty.
    if (!key && !name && !hasEnteredScores) { excludedBlankRows++; continue; }
    candidates.push(row);
    if (!key || !name) errors.push({ rowNumber: row.rowNumber, code: "incomplete-learner-identity" });
    if (key && keys.has(key)) errors.push({ rowNumber: row.rowNumber, code: "duplicate-learner" });
    if (key) keys.add(key);
    if (row.inputScores.some((score) => score !== null && (!Number.isFinite(score) || score < 0))) {
      errors.push({ rowNumber: row.rowNumber, code: "invalid-input-score" });
    }
    if (!hasEnteredScores) errors.push({ rowNumber: row.rowNumber, code: "missing-input-scores" });
    const actual = row.computedGrade;
    const expected = row.referenceGrade;
    if (actual === null || expected === null || !Number.isFinite(actual) || !Number.isFinite(expected) || actual < 0 || actual > 100 || expected < 0 || expected > 100) {
      errors.push({ rowNumber: row.rowNumber, code: "missing-or-invalid-grade" });
    } else if (typeof tolerance === "number" && Number.isFinite(tolerance) && Math.abs(actual - expected) > tolerance + Number.EPSILON * 100) {
      errors.push({ rowNumber: row.rowNumber, code: "computation-discrepancy" });
    }
  }
  if (candidates.length === 0) errors.push({ rowNumber: null, code: "empty-roster" });
  return {
    canImport: errors.length === 0,
    learnerCount: candidates.length,
    excludedBlankRows,
    errors,
    // Atomic acceptance: a valid row cannot escape a rejected batch.
    acceptedRows: errors.length === 0 ? candidates : [],
  };
}
