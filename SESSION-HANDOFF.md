# TANAW — active checkpoint

20 October 2026. Repo 312810-spec/project-tanaw, baseline main
`e40ee53943718095858f2d3b666401ceca8e7a0b` (PR #52). Active branch
`forge/provisioning-workspace-20261020`. Inspect actual HEAD/PR/CI before
continuing. Publishing and verified merges are authorized; hosted changes,
deployment and actual-use activation remain separate. No unrelated work exists.

## Selected outcome and evidence

Owner delegates choices using FORGE weighted priority: impact30%, unlock25%,
evidence20%, feasibility15%, reversibility10%. Ordinal 1–5; hard source/privacy/
actual-use gates override any score. See docs/workaround-decisions-2026-10-20.md.
Local creation/recovery UI scores90; source intake84; production onboarding68.
Select the local journey, not unverified credential delivery.

PR #52 head030cbbb passed domain39294346243 (189 Node/40 Python), public
browser39294346411 and isolated39294346328. Actual Next route completed one
attributed membership, denied wrong origin/school/actor, reconciled duplicates
and preserved the original password. Merged e40ee53. Earlier failed admission
probe and correction remain in the decision record and PR description.
PR #51 bounded Auth recovery and #50 claim concurrency are merged. PR #49
synthetic editable aggregate exports remain unofficial. PR #48 own-submission
SMEA review preserves mandatory independent Head review.

## Current UI increment / frozen acceptance

AccountProvisioning is rendered only in coordinator School access. Capability
GET controls availability; server still rechecks fresh identity and school role.
Review before creation; persist only request ID in sessionStorage under actor+
school before sending. Storage denial/offline means no send. Password clears on
dispatch and is never in browser recovery storage, URLs or downloaded notes.
Submitted details freeze. Pending/lost/mismatched replies cannot enable a new ID.
Explicit retry uses the same in-memory command and password re-entry. Reload
restores only the ID for status checks; pending after reload requires coordinator
reconciliation, not reconstructed credentials. Only matching200 complete receipt
allows explicit next request. Completion is not delivery/ownership or school-use
approval. Workspace account components are keyed by actor+school.

Browser script adds real creation/audit, response dropped after commit, reload/
status recovery, storage denial/offline zero writes, mismatched/202/403/404/409
feedback, explicit same-ID retry, password clearing and responsive keyboard checks.
Require fresh final-head domain, build, public and isolated SQL/Auth/browser CI
before merging, then sync main. Generated CI renders need internal inspection;
do not deliver screenshots. Do not infer a live pass from source/unit tests.

## Pending / blocked / untested

Use docs/remaining-tasks.md as sole ledger. Secure credential handoff, invitation/
first-login policy, initial coordinator, reviewed production budgets/quotas and
real partitions remain T11 gates. Hosted creation remains structurally disabled;
local process-only service credentials never go to .env.local/public/commits.
T01–T07 applicable source/formula/mapping/calendar/retention remain gates.
T08–T10 governed aggregates/official output/native-app checks remain. T12 sender,
T13 physical Android/TalkBack and T14 designated actual pilot need real evidence.
T16 live AI stays deferred. Do not infer approvals, participants, records or source
authority. Missing differs from zero; Lock differs from district acceptance.

Exact next action: inspect current branch checks; fix only evidenced failures;
merge only unchanged-head complete verification and update PR with receipts.
