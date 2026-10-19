# TANAW — active checkpoint

19 October 2026. Repo `312810-spec/project-tanaw`; baseline main
`af2a0c35b7835302360148c0a0fc64a9026361dc` (PR #49 merged). Branch
`forge/provisioning-claim-races-20261019`. Check live refs/PR/current-head CI
before continuing. Scoped implementation, publishing and verified integration
are authorized. Hosted mutation/deployment/actual-use gates remain separate.
Preserve unrelated work and project isolation.

## Current bounded work

T11 claim-specific contention/expiry verification. Existing sequential SQL and
real Auth claim tests did not prove overlapping claimant/takeover behavior or
expiry during a target-lock wait. The isolated verifier now observes actual
waiting HTTP claim/finish RPCs under held database locks. Frozen acceptance is
in `docs/provisioning-claim-races.md`.

Cases: two first claimants yield one epoch-1 owner and token-free busy; two
successors after operator-expired synthetic claim yield one epoch-2 owner and
new token; stale/mixed proofs cannot finish after a late external Auth write.
Successor reconciliation checks the fixed reserved UUID/metadata and does not
create again. Concurrent finishes include a deliberately discarded successful
response; retry must retain one membership/audit/receipt. A separate case holds
the target advisory lock through real database-clock lease expiry, requires zero
partial writes and recovers with a successor claim.

This adds integration tests and shared lock barriers only, not application
authority, a production worker, endpoint or migration. Discarded received response
is application-level outcome uncertainty, not an actual network partition.
Operator expiry and real-clock expiry are distinct. All pending RPCs settle
before fixture cleanup. No credentials, tokens or real records are delivered.

First CI at edec20e (isolated 39271091906) passed contention/late-Auth/lost-response
cases. Ten-second target-lock probe received query-cancellation 57014 before the
expected ownership rejection. Fixture lease reduced to three seconds, preserving
actual wait-before-expiry, real clock expiry, strict 42501 and zero-write checks.
No SQL timeouts or authorization changed; require fresh final-head CI.

Local syntax/lint/baseline/domain checks are available. Docker is absent here;
the new cases are NOT locally verified. Require fresh isolated CI on the exact
PR head, repair any failure, then integrate only after all required checks pass.
Use the PR's receipts for final status rather than inferring a live test from
source inspection or domain tests.

## Prior verified outcomes

PR #49 head `199fed1e298526467aed7de0e1bd7dcf97a58021` passed domain
39268149349 (168 Node / 40 Python), public browser 39268149334 and isolated
39268149194. Synthetic editable XLSX/native-table PPTX/fixed PDF generated;
edit/restore, package checks and every render inspected, final PPTX reopened
and rendered. Hash receipts: `docs/receipts/synthetic-export-2026-10-19.json`.
Artifacts are prototypes; native Microsoft edit/save/reopen untested.
T10 remains PARTIAL pending approved bindings and authorized committed results.

PR #48 fixed exact own-submission SMEA self-review and empty-form version
feedback. Independent Head remains mandatory. Final-head SQL/Auth/browser,
ACL and domain CI passed. See `docs/web-app-assurance-2026-10-18.md`.

## Continuation and limits

Inspect current claim-race PR/CI and integrate if verified. If merged, sync main.
Then use `docs/remaining-tasks.md` as the sole task ledger. T11 production caller
validation, provider execution/renewal, onboarding, initial coordinator, actual
network partitions and orphan disposition remain. Claim fencing cannot cancel
an external Auth write; late identities stay unassigned until authorized recovery.

T01–T07 source/policy/mapping/calendar gates, T08 result persistence/access, T09
district acceptance, T12 recovery delivery, T13 physical Android/TalkBack and
T14 actual pilot remain. Live AI is deferred. Drive is development reference.
Approved templates do not approve formulas or permit rewriting locked history.
Do not call the whole app or production rollout complete.
