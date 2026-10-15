/** Pending source declarations only; keys and hashes are not approval evidence. */
export type RosterDraft = { sourceTitle: string; sourceLocator: string; sourceRevision: string; classReference: string; term: string; sourceHash: string; learnerKeysText: string };
export type RosterPayload = { schema: "tanaw-roster-declaration-v1"; sourceTitle: string; sourceLocator: string; sourceRevision: string; classReference: string; schoolYear: string; term: string; sourceHash: string; learnerKeys: string[] };
export const emptyRosterDraft: RosterDraft = { sourceTitle: "", sourceLocator: "", sourceRevision: "", classReference: "", term: "", sourceHash: "", learnerKeysText: "" };
export function prepareRosterDeclaration(draft: RosterDraft, schoolYear: string) {
  const errors: Partial<Record<keyof RosterDraft | "schoolYear", string>> = {};
  const valid = (value: string, limit: number) => value.length > 0 && Array.from(value).length <= limit && value.trim() === value && !Array.from(value).some((ch) => ch.charCodeAt(0) < 32 || (ch.charCodeAt(0) >= 127 && ch.charCodeAt(0) <= 159));
  for (const [field, limit] of [["sourceTitle", 200], ["sourceLocator", 1000], ["sourceRevision", 200], ["classReference", 200]] as const) {
    if (!valid(draft[field], limit)) errors[field] = "Enter a source value within " + limit + " characters, without padding or control characters.";
  }
  if (!valid(schoolYear, 100)) errors.schoolYear = "Refresh the assignment's reporting year before recording a declaration.";
  if (!["TERM 1", "TERM 2", "TERM 3"].includes(draft.term)) errors.term = "Choose the term stated in the source.";
  if (!/^[a-f0-9]{64}$/.test(draft.sourceHash)) errors.sourceHash = "Choose the source file to calculate its reference on this device.";
  const learnerKeys = draft.learnerKeysText.replaceAll("\r\n", "\n").split("\n");
  if (learnerKeys.at(-1) === "") learnerKeys.pop(); // A final line separator is not a learner.
  if (learnerKeys.length < 1 || learnerKeys.length > 1000 || learnerKeys.some((key) => !valid(key, 200))) errors.learnerKeysText = "Enter 1–1000 explicit source keys, one per line. Remove blank lines, padding and control characters.";
  else if (new Set(learnerKeys).size !== learnerKeys.length) errors.learnerKeysText = "Each source learner key must be distinct. Resolve duplicate keys before recording.";
  const payload: RosterPayload = { schema: "tanaw-roster-declaration-v1", sourceTitle: draft.sourceTitle, sourceLocator: draft.sourceLocator, sourceRevision: draft.sourceRevision, classReference: draft.classReference, schoolYear, term: draft.term, sourceHash: draft.sourceHash, learnerKeys };
  // Conservative margin for jsonb text spacing beneath the server's 262144-byte cap.
  if (new TextEncoder().encode(JSON.stringify(payload)).byteLength > 250_000) errors.learnerKeysText = "Source details and keys are too large. Use a smaller declaration.";
  return { errors, payload: Object.keys(errors).length ? null : payload };
}
export function rosterDeclarationFailure(code: string) {
  if (code === "40001") return "The roster source revision changed. Refresh history and review it before recording a new declaration.";
  if (code === "42501") return "Coordinator access could not be verified. Refresh school access; unsaved source details remain in this open assignment.";
  return "The source declaration was not accepted. Check its source details and assigned reporting year, then refresh history. Unsaved fields remain here.";
}
