# FORGE workaround decision record

20 October 2026. Baseline: PR #51 merged as 9d45bd4. This is engineering
prioritization, not approval of school records, official policy or production use.

## Decision method

Score each candidate 1–5 for consequence/impact (30%), dependencies unlocked
(25%), current evidence (20%), feasible verification (15%) and reversibility
(10%). Total = sum(weight × score / 5). Scores are ordinal professional judgments
supported by the current ledger; they are not measured productivity or correctness.
Re-score when new official evidence, environment access or a failed probe changes
an input. Hard authority/privacy/actual-use gates override any numerical score.

| Candidate | Impact | Unlock | Evidence | Feasibility | Reversibility | /100 |
|---|---:|---:|---:|---:|---:|---:|
| Coordinator provisioning HTTP boundary | 5 | 4 | 5 | 4 | 4 | 90 |
| Source approval/intake workflow | 5 | 5 | 3 | 3 | 4 | 84 |
| Renewed official-source research | 5 | 5 | 2 | 2 | 5 | 79 |
| Private import staging/commit | 5 | 5 | 2 | 2 | 2 | 73 |
| Native output application checks | 3 | 2 | 3 | 2 | 5 | 56 |

Provisioning has trusted reservation/claim/completion SQL, real Auth contention,
bounded recovery and passed CI. The missing HTTP boundary can reuse them rather
than build another parallel authority system. Source work unlocks more reporting
areas but unresolved applicable formulas/templates still require external source
authority. A checklist, historical template or plausible formula cannot supply it.
Import storage additionally needs approved retention/access and roster bindings.
Native Microsoft application and physical-device acceptance need actual access.

## Selected implementation and frozen acceptance

Build the coordinator-authorized provisioning HTTP boundary, disabled by default
and structurally limited to the isolated loopback stack. This increment covers
HTTP admission → fresh cookie identity/active school role → immutable reservation
→ server-only claim → exact-UUID bounded Auth recovery → fenced finish → reread
durable receipt. Status checks recover uncertain writes without re-creation.
The coordinator form, credential handoff/onboarding and production activation
remain subsequent gates. No initial coordinator identity is invented.

1. Wrong origin, disabled/hosted configuration, malformed/oversized body,
   anonymous/non-coordinator/cross-school caller cannot reach privileged Auth.
2. Caller cannot supply actor, reserved UUID, claim token, epoch or trusted metadata.
   Stored journal rows must match authenticated actor and exact requested scope.
3. Password goes only to first creation of the reserved UUID. Never store it in
   the journal, return it, log it, reset an existing password or adopt by email.
4. In-flight duplication returns pending/busy or the same completed receipt;
   exactly one membership/audit. Expired/stale/revoked authority cannot finish.
5. Timeouts, response loss and canceling an invocation mean uncertain/pending,
   not absent, rolled back or approved. Explicit status reads recheck authority.
6. Request body, time and process-local concurrency are bounded. No claim renewal
   or automatic retry. Server credentials remain process-only, never public env.
7. Test the actual Next route against isolated Auth and SQL, plus adverse HTTP
   tests and unchanged-head integration/browser CI. No UI layout change is made.

Technical local-only choices: 8 KiB body, two concurrent requests per process,
3 s body budget, 15 s operation budget, 60 s worker claim and 5 s Auth-recovery
budget. These are bounded test/development settings, not school deadlines,
record retention, distributed quotas or approved production provider policy.

## Workaround order for the ledger

Integrate already-verified carryovers first. Finish this boundary, then complete
coordinator UX and secure account handoff. For T01/T05–T07 prepare exact versioned
source decisions and reconcile contradictions before activation. T02–T04 may use
labelled synthetic adapters while originals/mapping/retention remain gated.
T08–T10 consume frozen, authorized aggregates only. T09 cannot equate Lock with
district acceptance. T12–T14 need verified sender/device/participant evidence.
T16 stays deferred. A technical workaround can remove an access or integration
obstacle; it cannot manufacture source authority or observations.

## First integration finding and correction

At 5843da6, isolated run 39293002239 stopped before account creation: anonymous
HTTP was 403 instead of 401. A local production Next server with synthetic keys
reproduced `request-not-permitted`. Admission used the framework's reconstructed
Request URL. Replacing that comparison with pinned browser Origin plus HTTP Host
produced the expected anonymous 401; wrong Origin remained 403. A regression
also rejects wrong Host and accepts the normalized internal-URL case only through
authentication. No credential, role, cross-school or hosted gate was relaxed.
The local probe verifies transport admission only; fresh isolated CI still must
verify actual Auth creation, receipts and the full school workflow.
