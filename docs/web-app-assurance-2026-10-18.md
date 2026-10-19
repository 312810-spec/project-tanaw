# TANAW app update — evidence and acceptance contract

Baseline: main `6bcea137a492c27715f7ad9d3065f05debdb7966`, tree
`608a33f0dd0830d72b28eb2a4ed114c7211697bd`. Both reconstructed objects were
hash-verified against GitHub after direct clone was unavailable. No unrelated
working changes were present. Read current instructions, decisions and ledger.

## First journey and frozen criteria

SMEA Coordinator submits own manual evidence → reviews that exact submission
version under decision 22 → prepares packet → school review → independent Head
review → explicit Lock. Boundary: restore this confirmed exception; do not extend
coordinator review to other authors, activate imports/results/AI, or change Head
independence. Selected because its absence blocks the coordinator's own reporting
and imposes the rejected alternate reviewer. Packet self-review is a separate
existing behavior and does not satisfy this submission requirement.

Before edits: an executable policy probe with active same-school SMEA Coordinator,
own version 1 and subject review returned `wrongRole` instead of allowed. Source
also shows no SMEA submission-review button, SQL requiring independent subject
role, and a table constraint forbidding every self-review. These establish a
policy failure and source defects, not a completed database/browser reproduction.

Required checks, fixed before implementation:

1. Active same-school SMEA may review own submitted current version without a
   separate subject-coordinator assignment; store exact version/reviewer and
   `self_review=true`. Show the exception before and after the UI action.
2. Teacher/ordinary Subject Coordinator cannot self-review. SMEA cannot use this
   exception for other authors or schools. Disabled accounts and anonymous/direct
   table writes remain denied. Normal assigned independent review still works.
3. Stale/zero version and locked cycle without active amendment reject. Retry
   records one review/event; corrections preserve previous review but require a
   new exact-version review. Denied/uncertain actions must not claim success.
4. Own submission review cannot substitute for school or independent Head review.
   The submitting/preparing coordinator cannot approve as Head even with both
   roles. Incomplete packet requires reasons and Head acknowledgment. Lock stays
   immutable; district acceptance stays disabled.
5. Required repository checks, production build, rollback SQL and authenticated
   browser fixture pass at the published revision. Inspect actual relevant
   mobile/desktop renders internally; no screenshot delivery. Missing required
   execution/render evidence is INCONCLUSIVE, never a pass.

Synthetic lineage: actor/school/slot → manual indicator `0` and source → immutable
submission version → version-specific review/event → exact packet manifest →
independent Head review → Lock. Value/identity/version/history must be unchanged
by reviewing; no new official records or policy definitions are introduced.

## Whole-app coverage baseline

| Established journey/surface | Current evidence and next gate |
|---|---|
| Sign-in, school/role access and recovery | Source inspected; existing isolated Auth/browser suites. Actual production email and initial coordinator remain gated. |
| Accounts, disablement and handover | Source/SQL tests inspected; PR #47 merged worker-claim foundation. Production endpoint/onboarding and claim races remain pending. |
| Cycles, deadlines and extensions | Source/SQL tests inspected; official calendar reconciliation still gated. |
| Drafts, manual submission and corrections | Scoped device drafts and expected-version RPC inspected; fresh end-to-end evidence required. |
| Own-submission review exception | Verified policy reproduction FAIL at baseline; first repair slice. |
| Subject, school, Head review and Lock/amendments | SQL/UI traced; current suite tests packet self-review but misses submission exception. Fresh regression required. |
| Class-record check, mapping and imports | Diagnostic UI/parser present; runtime accepted imports remain disabled under T01–T05. |
| Governed indicators/results/charts | Synthetic helpers only; T06/T08 authority and persistence gates remain. |
| District return and acceptance | Return/reconciliation implemented; acceptance explicitly disabled pending governed results. |
| Excel/PPT/PDF outputs | T10 ready for synthetic development, not completed outputs. Approved bindings and rendered/editable exports pending. |
| PWA, responsive states and accessibility | Offline public fallback/device drafts inspected; physical Android/TalkBack and pilot remain untested. |

Baseline locally: 160 domain tests, 40 Python tests, lint, typecheck and production
build passed. Docker/PostgreSQL unavailable. Playwright browser missing; standard
browser installation returned invalid/truncated downloads. Do not bypass a
browser restriction. Existing isolated GitHub CI is the supported verification
route; historical PR #47 results do not verify new changes.

## Results

Policy/RPC/UI repair implemented. Post-edit 162 domain tests and 40 Python tests,
lint/typecheck/baseline checks and script syntax passed. Local stack verification
SKIP; fresh migration/SQL/authenticated-browser/render checks pending CI.
Whole-app readiness is INCONCLUSIVE;
source/operational blockers are recorded in the canonical remaining-task ledger.


## 19 October continuation and evidence

At `243e3d422aeaef2895ae7c16be789be5428a1741`, isolated CI applied the migration
and passed own-review/attribution, retry, correction and cross-school cases, then
stopped on a malformed UUID in the disabled-account test. Corrected that fixture
and validated all 121 UUID literals. No application authorization change was
needed for this failure.

At `90b9f134fbf22637bdc2bd307c90fc39fac2bc13`, all workflows passed:
- Fast domain: run `39238085404` (162 domain / 40 Python tests).
- Public browser: run `39238085392`.
- Isolated build, real Auth, migration/SQL/concurrency/recovery and authenticated
  school workflow: run `39238085554`.

The real SQL fixture proves own-review attribution/current version, rejected
ordinary self-review and unauthorized access, immutable earlier evidence/reviews,
retry deduplication and independent Head prerequisites. The authenticated test
traces a real synthetic record through submit, concurrent correction, stale-review
denial, lost receipt, refresh/retry, packet preparation, separate school/Head
reviews and Lock, with exact frozen value/source/version reconciliation.

Internal desktop render inspection of the authenticated artifact found a second
observed UX defect: after submission cleared all fields, a concurrent correction
made the empty form display a stale-draft warning alongside its cleared message.
Refinement: only an empty readable form follows the current version; actual
unsent fields and unreadable originals keep their existing source/version and
recovery protections. Extended browser fixture checks empty versus real stale
work, preservation of unsent zero/source/reason, explicit discard and a captured
390px review render. These additional checks require fresh CI before readiness.

Local browser availability was rechecked on 19 October: the standard installer
for the same Playwright 1.56.1 used in CI succeeded through its built-in download
fallback. No proxy, tunnel, security flag or browser restriction bypass was used.
The public desktop/mobile smoke suite passed locally with its required
`TANAW_APP_ORIGIN=http://127.0.0.1:3000`; screenshots inspected internally. This
supersedes the earlier missing-browser blocker for these public routes only.
Local Docker/PostgreSQL and physical-device evidence remain unavailable.


## Refined implementation verification

Implementation `a1d974c209daa94db41cc5923d2d98837392b91a` passed all three
workflows: domain `39238821288`, public browser `39238821411`, isolated build /
real Auth / migration and adversarial SQL / authenticated browser `39238821322`.
The extended browser trace passed both empty-form and real-unsent-draft cases,
version-3 self-review, lost receipt/reconciliation, one review/event, separate
Head review and exact version/value/source in the locked packet.

Desktop (1440px) and mobile (390px) own-review renders from authenticated artifact
`12181145244` were inspected internally. Reviewer/version attribution, recorded
zero/source, truthful cleared/discarded status and the self-review explanation
remain readable without horizontal overflow; no persistent empty-form stale
warning remains. Automated width assertions also passed at 320px. Keyboard Enter
activated the review control. These are bounded browser observations, not physical
Android/TalkBack or full WCAG conformance.

| Fixed criterion | Evidence / status |
|---|---|
| 1. Own-submission exception and transparent attribution | PASS — policy, real SQL and authenticated browser with exact actor/version/self flag. |
| 2. Role/school boundaries and direct-write protection | PASS — normal independent review, ordinary self denial, other-author/cross-school/disabled denial and direct-write rejection. Anonymous RPC execute privilege is revoked in the migration; an explicit ACL assertion is added in the final fixture checkpoint for fresh CI. |
| 3. Versions, retries, corrections, Lock and honest recovery | PASS — stale/zero/locked rejection, retained old evidence, one review/event and interrupted receipt reconciliation. |
| 4. Separate Head prerequisite and frozen output | PASS — multi-role self-Head denied in SQL; distinct browser Head approval required; exact frozen version/value/source asserted. |
| 5. Build, repository, SQL, browser and relevant renders | PASS at a1d974c; final fixture/checkpoint requires current-head CI before merge. |

The final checkpoint adds a SQL privilege assertion for anonymous RPC access and
client INSERT/UPDATE/DELETE, plus documentation only. No application, migration,
calculation, authentication or output code changes after a1d974c. Inspect PR #48
for the final-head test/merge receipts. This journey is READY FOR REVIEW within
the tested synthetic scope; it is not approval for hosted rollout. Whole-app
readiness remains INCONCLUSIVE because source/operational and unfinished feature
gates in the canonical ledger remain.

## Next bounded work

Next independent implementation candidate: T10 synthetic editable exports from
the already-tested frozen diagnostic. Freeze aggregate-only bindings and artifact
acceptance first; do not represent a prototype as an approved school template,
connect live district acceptance, or infer missing computation/population rules.
T01–T09 source gates and T11–T14 operational/device/pilot gates remain separate.
