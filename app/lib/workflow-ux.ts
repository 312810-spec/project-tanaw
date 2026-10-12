export type RequirementSlot = { required_indicator_ids: string[] | null };
export function indicatorCoverage(slot: RequirementSlot, entries: readonly { definitionId: string }[], verifiedIds?: readonly string[]) {
  const required = slot.required_indicator_ids;
  const recorded = new Set(entries.map((entry) => entry.definitionId));
  const missing = (required ?? []).filter((id) => !recorded.has(id) || (verifiedIds !== undefined && !verifiedIds.includes(id)));
  return { configured: !!required?.length, missing, complete: !!required?.length && missing.length === 0 };
}
export function workflowError(code: string | undefined, message?: string) {
  const safeReasons: Record<string, string> = {
    'Deadline closed': 'The submission cutoff has passed. Keep your draft and ask the SMEA Coordinator for a scoped extension.',
    'Required subject review missing': 'A current submission still needs subject review. Ask its assigned Subject Coordinator to review this version.',
    'Current school and independent Head reviews required': 'Record school review and independent School Head review of this exact packet before locking.',
    'Independent Head review required': 'An independent School Head must review this packet. Its preparer or submitting author cannot provide Head approval.',
    'School review required first': 'The SMEA Coordinator must record school review before School Head review.',
    'Head must acknowledge missing submissions': 'Acknowledge the listed missing or incomplete evidence before recording School Head review.',
    'Locked packet requires an active amendment': 'The packet is locked. Ask the SMEA Coordinator to open an amendment; keep your draft.',
    'Active amendment required': 'An active amendment is required before changing locked-cycle requirements.',
    'Every assignment needs explicit verified indicator requirements': 'Configure verified required indicators for every assignment before preparing a packet.',
    'Every missing submission needs a reason': 'Enter a reason for every missing or incomplete assignment before preparing a packet.',
    'An amendment round is already open': 'An amendment is already active. Use that round instead of opening another.',
    'Verified period indicators required': 'Choose indicators verified for this school and reporting period.',
    'Distinct required indicators and reason required': 'Choose at least one distinct verified indicator and provide a reason.',
  };
  if (message && safeReasons[message]) return safeReasons[message];
  if (code === '40001') return 'The record changed. Refresh, compare the current version and review your unsent edits before retrying.';
  if (code === '23505') return 'This assignment or review already exists. Refresh to inspect the recorded result before retrying.';
  if (code === '42501') return 'This action is blocked by your assignment, cutoff, Lock or required reviews. Refresh and check the eligibility details; ask the SMEA Coordinator if access needs correction.';
  if (code === '22023') return 'Check the required fields, verified indicators, future cutoff and recorded reason. Your unsent work is retained.';
  return 'The action could not be verified. Refresh to check its history before retrying; keep your unsent work open.';
}
