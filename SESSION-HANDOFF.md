# Project TANAW — Session Handoff

Checkpoint: 2026-10-08. Historical Phase 0.6C notes are archived in docs/session-handoff-phase-0.6c.md; their old current-state claims are superseded.

Verified application baseline: db2ad93b7d0c5487f25e55d762ce19c18fdd4685 (merged PR #16). CI on implementation head eab187dd7386c00aaa222289dec8b74306797320 passed fast domain tests, production build, isolated Supabase constraints/permissions/cycles and desktop/mobile public-route browser smoke. Screenshot artifact: https://github.com/312810-spec/project-tanaw/actions/runs/37739271181/artifacts/11532619601 (expires 2026-10-22).

## Verified work completed this session

PRs #9–#16 implement the following incremental foundations. Consult each PR and its exact commit checks for evidence; the list does not mean the full application is production ready.

| Area | Delivered | Remaining |
|---|---|---|
| Evidence/packet readiness | Explicit errors for missing, conflicting, orphan and inconsistent evidence | Authorized persisted submission lineage |
| Workflow policies | Deadline cutoff, scoped extensions, review eligibility, coordinator self-review exception, independent Head approval, explicit Lock eligibility, district aggregate review eligibility and correction versions | Connect these pure policies to authenticated atomic persistent mutations |
| Accounts | Active school memberships, multiple roles and subject scope, coordinator-only reasoned RPC and audit history, email/password sign-in and assigned-role workspace | Trusted initial coordinator provisioning, account creation/recovery UI and pilot |
| Cycles | Trusted verified calendar entry table, separate coordinator deadline, revision conflicts, closed/locked deadline protection and change history; workspace deadline form in Philippine time | Populate authoritative calendar only after annex/amendment verification; implement submission extensions and packet Lock |
| ECR preview | Pure all-or-none acceptance, blank roster artifact exclusion, duplicate/missing/invalid data and reconciliation rejection; 12 synthetic tests | XLSX parsing, raw formula verification, approved template fingerprints/mappings, upload/version persistence |
| Verification | Fast domain tests, full baseline/build and isolated Supabase tests, Chromium public-route desktop/mobile checks and six screenshot artifacts | Authenticated browser pilot and visual inspection of configured roles |

All 52 pure domain tests passed. SQL tests exercise actual local RLS/RPC behavior with synthetic transactions and rollback. Browser checks test unconfigured routes, disabled login, no unverified assignments, page errors and mobile overflow. They do not establish real-account sign-in or coordinator form success.

## Confirmed decisions

Read docs/confirmed-decisions-2026-10-08.md; do not repeat answered questions. The coordinator may review their own submission only at the school stage. School Head self-approval remains prohibited. Calendar instructional end dates and coordinator submission deadlines are separate. A closed deadline requires a per-submission extension; a locked version requires an amendment. Missing is not zero; submitted is not approved. Drive is reference-only during development, never a runtime integration.

## Continuous development and fallback

Continue unaffected work on independent branches while slow checks run. Pure tests avoid npm installation; browser and isolated database checks run concurrently. Successful prior jobs are not rerun without a change or unresolved concern. Inspect failed logs, repair code/configuration or rerun only a transiently failed job; do not bypass merge checks. Exact-head checks govern merges.

This session used GitHub Git tree/commit/ref APIs because no local shell or browser runtime was exposed. Remote Chromium produced screenshots when local capture was unavailable. A branch-history synchronization resolved a PR for which no workflows had started; current source trees were verified identical before bringing main ancestry into the feature branch. These CI workflows run checks, not a background coding agent.

Keep implementation and memory-only changes in separate commits. Record verified main SHA and any unresolved checks at the next checkpoint.

## Next development queue

1. Verify authoritative DepEd calendar annex and applicable amendments, then provision trusted calendar entries locally. Validate approved ECR raw formulas and mappings without publishing private source records.
2. Persist owned/subject-scoped submissions and corrected versions with atomic import preview and versioned audit history.
3. Connect staged review, per-submission extensions, independent Head approval, explicit packet Lock, incomplete packet reasons/acknowledgment, post-Lock amendments and district aggregate-only accept/return.
4. Coordinator account management/recovery and handover UI; real accounts require controlled provisioning.
5. Verified indicators, deterministic charts, editable approved Excel/PPT/PDF exports; live AI only after reporting is verified.
6. Offline drafts, in-app reminders, desktop/Android PWA and controlled TNHS pilot.

## Source and environment limits

Approved CO/Division ECR families and approved presentation reference were located in Drive. Cached extracted text does not expose authoritative formulas. Blank Division roster rows contain computed zero/failed artifacts; preview logic excludes only rows whose identity AND raw entered scores are empty. Entered zero scores remain data.

DO 009 s. 2026 and official reproductions were located; the main DepEd order/PDF returned 403. Government explanatory material corroborates a three-term calendar, but exact boundaries are not seeded until the annex and amendments are inspected. No school-year dates or grading formulas were invented.

No hosted Supabase mutation, deployment, real school records, real account creation or live AI call occurred. Hosted infrastructure remains separately approval-gated. Preserve existing operating-rules audits and sections 1–14. The user's current instruction authorizes continued development and GitHub work without repeating routine permissions.

## Continuation checkpoint — 8 October 2026, persistent workflow wave

Local shell is restored. Repository baseline was verified (5 PASS / Docker SKIP), and production build passed. Docker is absent; embedded PostgreSQL was used for local SQL checks. All four SQL suites passed, including the new persistent workflow suite. Full isolated Supabase CI is still required.

PR #17 (head adef78dbcddc9911a03b7550032e699b3a4fc4bf) adds manual-indicator submission assignments/immutable versions, subject review, school and independent Head packet review, manifest-based stale-review detection, explicit Lock, incomplete reasons/acknowledgment, time-limited amendment rounds and aggregate-only district status/decisions. XLSX submission remains closed pending approved parser verification. No hosted changes or actual accounts/records.

Raw CO and Division workbook inspection is now complete for those two core families only; findings are in docs/ecr-reference-findings-2026-10-08.md. Their transmutation tables differ, and the CO boundary lookup requires discrepancy handling. No computation was declared interchangeable or silently repaired.

Git CLI fetch works, but push has no credential helper in this environment. Publishing used the already-authorized GitHub connector APIs after local verification. Local and remote commit IDs differ because the connector creates the commit; source tree content is the same. Do not mistake the different commit IDs for different source implementations.

Next independent work: connect authenticated role UI to the checked workflow RPCs, then verify and advance the remaining import, account, offline and output tasks. Preserve source boundaries, current confirmed decisions and exact-head CI checks.

## Continuation checkpoint — coordinator access UI

PR #18 head 1f9d03161c0e45b8299388331265a7b1b37789bc passed fast domain, public browser, build and isolated Supabase including authenticated synthetic browser acceptance. It was squash merged as 0062bf6425e13817f2af5d0ca656086d0843877f. Authenticated screenshots: run 37747944996, artifact 11536941398. These are synthetic local fixtures, not TNHS pilot evidence.

The next increment adds coordinator-only school email labels, membership role/scope/disable UI, explicit revision checks with old unversioned writes denied, history display, and authenticated disable-access regression. Existing workspace effect/navigation lint findings were corrected and lint added to CI. Local embedded PostgreSQL suites pass; full Supabase/browser CI must pass at the published head before merge. Creation/recovery, recorded handover, official calendar provisioning, complete approved XLSX adapters, report outputs and offline/PWA remain pending. No hosted operation or real record mutation occurred.
