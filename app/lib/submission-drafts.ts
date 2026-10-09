export type DraftScope = { actorId: string; schoolId: string; submissionId: string };
export type EvidenceDraft = { definition: string; value: string; sourceTitle: string; sourceLocator: string; reason: string };
export type SavedDraft = { schema: 1; scope: DraftScope; sourceVersion: number; fields: EvidenceDraft };
export const emptyDraft: EvidenceDraft = { definition: "", value: "", sourceTitle: "", sourceLocator: "", reason: "" };
export function draftKey(scope: DraftScope): string {
  return "tanaw:manual-draft:" + JSON.stringify([scope.actorId, scope.schoolId, scope.submissionId]);
}
// Never overwrite an unreadable draft or an earlier recovery copy.
export function preserveUnreadableDraft(storage: Pick<Storage, "getItem" | "setItem">, key: string, raw: string): string {
  const recoveryKey = key + ":unreadable";
  const previous = storage.getItem(recoveryKey);
  if (previous !== null && previous !== raw) throw new Error("An earlier recovery copy already exists");
  storage.setItem(recoveryKey, raw);
  if (storage.getItem(recoveryKey) !== raw) throw new Error("Recovery copy could not be verified");
  return recoveryKey;
}
export function decodeDraft(raw: string | null, scope: DraftScope): SavedDraft | null {
  if (!raw) return null;
  try {
    const draft = JSON.parse(raw);
    if (draft.schema !== 1 || !Number.isSafeInteger(draft.sourceVersion) || draft.sourceVersion < 0 ||
      !draft.scope || draftKey(draft.scope) !== draftKey(scope) || !draft.fields ||
      Object.keys(emptyDraft).some((key) => typeof draft.fields[key] !== "string" || draft.fields[key].length > 2000)) return null;
    return { schema: 1, scope, sourceVersion: draft.sourceVersion, fields: Object.fromEntries(Object.keys(emptyDraft).map((key) => [key, draft.fields[key]])) as EvidenceDraft };
  } catch { return null; }
}
