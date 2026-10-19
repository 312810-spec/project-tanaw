# Provisioning worker contention acceptance

19 October 2026. Baseline `af2a0c35b7835302360148c0a0fc64a9026361dc`.
T11 integration verification only; no production worker or endpoint activation.

Start from the current claim/ownership/finish RPCs, actual Auth UUID and durable
reservation, rather than treating a passing sequential token check as concurrency
evidence. The invariant is one reserved identity, one current claim epoch and at
most one attributed membership event. Auth identity alone grants no school access.

| Case | Observable acceptance |
|---|---|
| Two initial claimants | Both HTTP RPCs observed waiting on a held actor lock; one receives epoch 1, the other receives only busy, without its token. |
| Two expired-claim successors | Expire only the synthetic claim as test operator; observe both claimants waiting; one receives epoch 2 with a new token. Old/mixed proofs cannot complete. |
| Late external Auth write | Old worker's Auth creation lands after takeover using the same reserved UUID and metadata. It creates no membership; successor checks that exact UUID without adopting by email. |
| Duplicate finish and lost response | Both finish RPCs observed waiting. One client's successful server response is deliberately consumed and discarded; retry returns the same receipt and membership/audit remain single. This is application-level response loss, not a network partition. |
| Lease expires while waiting | One valid finish waits on the held target advisory lock until database clock reports expiry. On release it must reject without membership/event/receipt; successor can recover the same Auth identity. |

The tests must fail if overlap was not observed. Operator expiry changes are
restricted to generated request IDs; the target-lock case uses real database
clock expiry. Keep finite RPC, statement and holder timeouts. Existing SQL ACL,
real Auth recovery, revoked coordinator and disabled-history tests stay required.
No claim is made until fresh unchanged-head isolated CI executes these cases.

Initial run `39271091906` at `edec20e` passed the contended initial/successor,
late-Auth, exact-UUID and discarded-finish-response cases. The ten-second lease
probe received query-cancellation code `57014` during its wait, so it did not
prove the expected ownership rejection. The fixture now uses a three-second
synthetic lease while retaining observed wait-before-expiry, real clock expiry,
strict `42501`, zero-write and successor-recovery assertions. No database timeout
or authority rule was relaxed. Fresh final-head CI remains required.

Production caller validation, bounded provider execution/renewal policy,
onboarding, initial coordinator and orphan disposition remain separate gates.
Claim fencing controls membership completion, not the external Auth service.
