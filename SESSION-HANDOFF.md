# TANAW — active checkpoint

19 October 2026 (Manila). Repo `312810-spec/project-tanaw`; main baseline
`6bcea137a492c27715f7ad9d3065f05debdb7966` (PR #47 merged), verified tree
`608a33f0dd0830d72b28eb2a4ed114c7211697bd`. Branch
`forge/coordinator-own-review-20261018`. Source recovered via GitHub connector;
local tree and signed commit object hashes matched upstream exactly. Inspect
current refs/CI before resuming. Scoped implementation, publishing and verified
integration authorized; hosted mutation/deployment/actual-use gates remain.

## Outcome / current slice

Whole-app update, one evidenced journey at a time. First: SMEA own manual
submission → exact-version self-review → packet preparation → school review →
independent Head review → Lock. Decision 22 was implemented only for packet
self-review. Pre-edit executable submission policy probe returned `wrongRole`;
UI/RPC/table constraint also disallowed the exception. Acceptance contract and
whole-app coverage: `docs/web-app-assurance-2026-10-18.md`.

Repair: same-school active SMEA may review own submission without a separate
subject-coordinator assignment. Store self-review/version/actor transparently;
UI explains exception and displays attribution. Other authors require assigned
independent Subject Coordinator. Preserve immutable history, stale-version checks,
cycle lock, independent Head prerequisite and closed district acceptance.
New migration is local/CI only; no hosted schema application authorized here.

## Completed evidence / remaining criteria

Baseline: 160 domain + 40 Python tests, lint/typecheck/build passed. After repair:
162 domain + 40 Python tests, syntax/diff/baseline/lint and production build
passed. Baseline stack check SKIP (Docker unavailable),
not PASS. Standard Playwright 1.56.1 installation now succeeds through its
built-in fallback. Local public desktop/mobile browser checks and internal renders
passed; no restriction bypass. At 90b9f13 all CI passed (domain 39238085404, public 39238085392, isolated
39238085554), including real SQL/Auth/browser. First CI failed on a test UUID,
corrected without authorization changes. Desktop render inspection found false
stale-draft feedback on an empty cleared form; refined it and extended browser
checks for real unsent stale work and a 390px capture. Fresh head CI still required. Inspect relevant actual
renders internally; do not deliver screenshots. Physical Android/TalkBack and
pilot remain untested. No full-app completion or measured token savings claimed.

## Rules and dependencies

Read AGENTS/CLAUDE, operating rules and all 29 confirmed decisions. Missing is
not zero; submitted is not approved. The explicit SMEA own-submission exception
never replaces independent Head review. Schools/projects stay isolated. Latest
v3.1 evidence statuses apply; criteria are frozen before edits. Canonical ledger:
`docs/remaining-tasks.md`; do not create a second competing backlog.

T01–T07 source/computation/roster/template/calendar authority gates remain. T08
result dictionary/populations/persistence and T09 district acceptance remain gated.
T10 synthetic editable exports remain independent pending work; approved bindings
and editability/renders required. T11 server claim foundation merged in #47; real
production endpoint/onboarding, claim races/partitions and initial coordinator
remain. T12 live recovery delivery, T13 device checks, T14 pilot still pending.
Drive is development reference only; live AI deferred. Prior T11 receipts reside
in PR #47 and `docs/local-account-provisioning.md`; no activation inferred.

## Exact next action

PR #48 is open, draft and unmerged. Finish checks and publish the empty-form
feedback refinement. Inspect fresh SQL/browser outcomes and desktop/mobile own-
review renders; repair failures before integration. Then proceed to the next evidence-ranked journey or
independent synthetic output work while preserving all activation gates.
