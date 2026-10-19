# TANAW — active checkpoint

19 October 2026. Repo `312810-spec/project-tanaw`; baseline main
`3d2014964899afc85cd5f020a91bde6cf60e1fab` (PR #50 merged). Branch
`forge/bounded-auth-recovery-20261019`. Inspect live refs/PR/current-head CI
before continuing. Scoped implementation, publishing and verified integration
are authorized. Hosted mutations/deployment/actual-use gates remain separate.
Preserve project isolation and unrelated work.

## Current bounded work

T11 bounded provider-recovery foundation. The original pure recovery seam
expects bounded adapters; a never-settling synthetic ownership callback leaves
it suspended at a 30 ms observation boundary. This is a caller-contract gap,
not a live Auth outage or production defect claim.

New `reconcileReservedAuthBounded` supplies one explicit total timeout and
shared AbortSignal, optional parent cancellation, monotonic deadline checks
before stages and before returning identity. Deadline/cancellation returns
pending without identity, aborts the signal and prevents subsequent callbacks.
No timeout reset, retry scheduler, lease renewal or membership grant. An already
running provider that ignores cancellation can still write; later authorized
recovery must use the same reserved UUID.

Eight new tests cover stalled ownership/lookup/create/final read, parent abort,
late write/rejection and later recovery, shared budget, delayed timer delivery,
invalid options and original identity/ownership/private-error semantics. Local
176 domain / 40 Python tests, lint/typecheck/baseline passed. Docker is absent;
stack SKIP is not PASS. Initial build hit the stale Turbopack persistence cache;
clean production build passed after moving that generated cache aside.

The synthetic subprocess uses an explicit 5000 ms budget and forwards cancellation
to actual ownership HTTP and Auth fetch calls. Fresh unchanged-head isolated
CI must verify composition with create-response loss, kill/restart, one receipt
and existing claim/expiry/browser checks. See `docs/bounded-auth-recovery.md`.
No production worker, endpoint, credential, schema/grant or hosted change.

## Prior verified outcomes

PR #50 final head `f9db28cb71c5e462da857599f2a46a7112762224` passed isolated
39271897474, domain 39271897298 and public browser 39271897050. Initial 10-second
expiry test was query-canceled (57014); a 3-second synthetic lease preserved
observed target wait, real clock expiry, strict 42501, zero-write and successor
recovery assertions. Contending first/successor claims, stale late-Auth denial,
fixed-UUID reconciliation and discarded duplicate-finish response with one
attributed membership passed. Source: `docs/provisioning-claim-races.md`.

PR #49 synthetic editable XLSX/native PPTX/fixed PDF passed value, edit/restore,
package and render checks; hashes in
`docs/receipts/synthetic-export-2026-10-19.json`. Native Microsoft edit/save/reopen
and official bindings remain pending. PR #48 fixed exact own-submission SMEA
review and empty-form version feedback; independent Head remains required.

## Continuation and limits

Inspect the bounded-recovery PR/head and CI; repair failures and integrate only
after required gates pass. If merged, sync main. Use `docs/remaining-tasks.md`
as the sole task ledger. T11 reviewed budget/ownership/provider execution policy,
renewal, endpoints/onboarding, initial coordinator, real partitions and orphan
disposition remain. Pending never proves an external write was canceled or absent.

T01–T07 source/policy/mapping/calendar gates, T08 governed persistence/access,
T09 district acceptance, T10 official exports, T12 recovery delivery, T13 physical
Android/TalkBack and T14 actual pilot remain. Live AI is deferred. Drive is a
development reference. Do not call the whole app or production rollout complete.
