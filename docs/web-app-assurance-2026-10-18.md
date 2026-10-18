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
