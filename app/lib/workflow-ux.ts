export type RequirementSlot = { required_indicator_ids: string[] | null };
export function indicatorCoverage(slot: RequirementSlot, entries: readonly { definitionId: string }[], verifiedIds?: readonly string[]) {
  const required = slot.required_indicator_ids;
  const recorded = new Set(entries.map((entry) => entry.definitionId));
  const missing = (required ?? []).filter((id) => !recorded.has(id) || (verifiedIds !== undefined && !verifiedIds.includes(id)));
  return { configured: !!required?.length, missing, complete: !!required?.length && missing.length === 0 };
}
export function workflowError(code: string | undefined, message?: string) {
  if (code === '40001') return 'The record changed. Refresh, compare the current version and review your unsent edits before retrying.';
  if (code === '23505') return 'This assignment or review already exists. Refresh to inspect the recorded result before retrying.';
  if (code === '42501') return 'This action is blocked by your assignment, cutoff, Lock or required reviews. Refresh and check the eligibility details; ask the SMEA Coordinator if access needs correction.';
  if (code === '22023') return message ? `Check the action requirements: ${message}` : 'Check the required fields, verified indicators, future cutoff and recorded reason.';
  return 'The action could not be verified. Refresh to check its history before retrying; keep your unsent work open.';
}
