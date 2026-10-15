/** Browser-safe diagnostic contract. Recognition never establishes import readiness. */
export const ECR_FILE_LIMIT = 32 * 1024 * 1024;
export type FileCheckResult = { term: string; sourceHash: string; occupiedRows: number; excludedBlankRows: number };
const record = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
export function fileCheckSelectionError(file: { name: string; size: number } | null): string | null {
  if (!file) return "Choose a workbook to check.";
  if (!/\.xlsx$/i.test(file.name)) return "Choose an .xlsx workbook. Other file formats are not supported.";
  if (!Number.isSafeInteger(file.size) || file.size <= 0) return "This file is empty. Choose a workbook with content.";
  if (file.size > ECR_FILE_LIMIT) return "Choose a workbook no larger than 32 MiB.";
  return null;
}
export function parseFileCheckResult(value: unknown, term: string): FileCheckResult | null {
  if (!record(value) || value.code !== "recognized-diagnostic-only" || value.canImport !== false || value.runtimeImportEnabled !== false || value.computationComparison !== "not-performed" || value.term !== term || !["TERM 1", "TERM 2", "TERM 3"].includes(term) || value.rowSlots !== 100 || typeof value.sourceHash !== "string" || !/^[a-f0-9]{64}$/.test(value.sourceHash) || typeof value.occupiedRows !== "number" || typeof value.excludedBlankRows !== "number" || !Number.isInteger(value.occupiedRows) || !Number.isInteger(value.excludedBlankRows) || value.occupiedRows < 0 || value.excludedBlankRows < 0 || value.occupiedRows + value.excludedBlankRows !== 100) return null;
  return { term, sourceHash: value.sourceHash, occupiedRows: value.occupiedRows, excludedBlankRows: value.excludedBlankRows };
}
export function fileCheckFailure(status: number): string {
  if (status === 401 || status === 403) return "Your assignment access could not be verified. Refresh school access before trying again.";
  if (status === 413) return "This file is too large for this server. Choose a smaller supported workbook.";
  if (status === 422) return "This workbook could not pass the file check. Verify its approved template and try again.";
  if (status === 429) return "File checks are busy. Keep your file selected and try again shortly.";
  if (status === 408) return "The upload timed out. Keep your file selected and try again on a stable connection.";
  return "The file check could not finish. Keep your file selected and try again. No records were submitted.";
}
