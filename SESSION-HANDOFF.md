# TANAW — active checkpoint

19 October 2026 (Manila). Repo `312810-spec/project-tanaw`; baseline main
`6bcea137a492c27715f7ad9d3065f05debdb7966` (PR #47). Branch
`forge/coordinator-own-review-20261018`, PR #48. Check live refs/PR/CI before
continuing; latest receipts are in the PR. Scoped implementation, publishing and
verified integration are authorized. Hosted mutation/deployment/actual-use gates
remain. Preserve unrelated work and keep schools/projects isolated.

## Outcome and completed evidence

Whole-app update, one evidenced journey at a time. Own manual submission → exact
SMEA self-review → school packet → school review → independent Head → Lock is
implemented. Decision 22 previously existed only at packet level; the policy probe
returned wrongRole and RPC/UI/schema rejected submission self-review. Repair uses
trusted same-school active role/author identity and stores actor/version/self flag.
Other authors still need assigned independent subject review. Head independence,
locked history, source values and closed district acceptance remain.

Render review found false stale-draft feedback after cleared fields and concurrent
correction. Empty readable forms now follow the current version; actual unsent
work stays pinned and protected. Browser tests prove retained zero/source/reason,
explicit discard, stale-review rejection and receipt-loss reconciliation.

At `a1d974c209daa94db41cc5923d2d98837392b91a`, all CI passed: domain 39238821288
(162 domain / 40 Python), public 39238821411, isolated 39238821322 (build, real
SQL/Auth/concurrency/recovery and authenticated browser). Internal 1440px/390px
own-review renders inspected; 320px overflow and keyboard activation asserted.
First CI failed on a test UUID, corrected without authorization changes. Final
checkpoint adds explicit anonymous-RPC/direct-write ACL assertions and docs only;
require current-head CI before integration. Contract/results/coverage:
`docs/web-app-assurance-2026-10-18.md`.

## Limits and remaining work

Docker/PostgreSQL unavailable locally; stack SKIP is not PASS. Standard
Playwright 1.56.1 installer now succeeds via its built-in fallback; local public
mobile/desktop smoke and render inspection passed with required TANAW_APP_ORIGIN.
No browser restriction bypass. Physical Android/TalkBack and actual pilot untested.
Read AGENTS/CLAUDE, operating rules, confirmed decisions and canonical ledger
`docs/remaining-tasks.md`. Source/calculation/roster/template/calendar gates
T01–T07 persist. T08 governed results/persistence and T09 acceptance remain gated.
T10 synthetic editable exports remain independent pending work. T11 production
endpoint/onboarding/claim races, T12 recovery delivery, T13 devices and T14 pilot
still need evidence/inputs. Drive is development reference; live AI deferred.

## Exact next action

Inspect PR #48 current head, CI and merge state. If open, repair any failure and
integrate only after current required gates pass. If merged, sync main and begin
T10 synthetic export acceptance/bindings from the frozen diagnostic, keeping it
clearly prototype and aggregate-only. No full-app or production-ready claim.
