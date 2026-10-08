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

## Continuation checkpoint — scoped drafts and reminders

Access-management PR #19 at 14bf0b01d58e638219e70f1b50c48f4104eb07b1 passed baseline/build/lint, all SQL suites and authenticated account-disable acceptance. Its separate public browser job is delayed in Chromium installation; do not claim the entire CI run passed until final status is checked.

An independent increment adds actor/school/submission-scoped manual drafts, source-version conflict acknowledgment, explicit online-only submission, and deadline/missing/current-version review reminders. Local lint, build and all 60 domain tests passed. The six desktop/mobile public-route checks also passed locally using the available Chromium binary; no checks were bypassed. Extended authenticated offline-draft restoration/clear-after-success tests require isolated CI. Offline reload/PWA installation and generic workbook import remain separate unfinished tasks.

## Continuation checkpoint — PWA verification and merge ancestry

PR #19 passed all three CI workflows and merged as 4a0b1f44d1d584dbda54cb72ec7ca12a5a10649b. PR #20 original head 79f0a9b8a64d001d8b950b77dd505301d064c2c7 passed all three workflows, including authenticated offline draft preparation/restoration. Squash ancestry caused a merge conflict: the PR #19 tree and main were verified identical, so main was added as a merge parent while preserving the already-tested draft tree. Exact-head checks must pass again before PR #20 merges.

PWA shell increment adds a framework-native manifest, 192/512 PNG icons, install prompt, connection status and a service worker caching only a credential-free public offline page. It never caches authenticated pages, API responses, school records or tokens. Offline reload requires reconnection to reopen authenticated editing; drafts survive. Local lint/build/baseline, 63 domain tests and desktop/mobile browser checks passed. Browser checks verify manifest/icon dimensions, exact cache allowlist and offline navigation. Mobile offline screenshot was visually checked. Full exact-head CI must pass before merge.

Main unfinished areas: approved XLSX adapters and remaining family formulas, authoritative calendar annex/amendment verification and indicator reconciliation, secure account creation/recovery, attributable unfinished-work handover, aggregate calculations/charts and approved Excel/PPT/PDF outputs, and configured TNHS pilot. The central DepEd DO 009 PDF still returns HTTP 403; a four-page division reproduction does not establish all annex dates. No calendar dates were seeded from search snippets. No live AI, hosted database, actual records or deployment were used.

## Continuation checkpoint — recovery and deterministic offline validation

PR #20 merged as adfc329ac2248d804c16827d22ae36b019f6fffa after all exact-head checks passed. PR #21 public browser initially failed because context offline simulation did not interrupt service-worker-owned requests consistently in the CI Chromium version. Its browser test now disconnects/restarts the origin and verifies the actual fallback; that job passed at f1edfd4ecc7e9d7a854e658c6b9c6e5e596cdcbd. Navigation fetches also use no-store. Full isolated CI is still pending at this checkpoint.

Recovery increment adds forgot/change-password pages, a fixed-destination PKCE callback, explicit trusted TANAW_APP_ORIGIN and local redirect allowlist. It uses only the publishable client. Local lint/build/baseline and public desktop/mobile checks passed, including disabled unconfigured recovery and callback redirect safety. Authenticated CI will capture a synthetic recovery email in local Mailpit, follow the PKCE link, change the password and verify disabled school membership stays disabled. Production SMTP delivery and hosted configuration remain unverified. See docs/password-recovery.md for operational dependencies.

## Continuation checkpoint — verified PWA/recovery and handover

PR #21 at f1edfd4ecc7e9d7a854e658c6b9c6e5e596cdcbd passed all CI workflows and merged as 9ff67e662106bf4793b73ac55a17c08919756714. PR #22 at 34f2762492d93d9a1f33ce6531302f989e15aec4 passed all CI workflows, including actual local Mailpit capture and the PKCE recovery callback/new password acceptance. These results establish the synthetic isolated flow, not hosted SMTP delivery.

The next handover increment allows a coordinator to transfer an unlocked unsubmitted assignment to an active subject-scoped assignee, with optimistic ownership checks and immutable before/after attribution. Submitted source versions cannot be transferred or rewritten by this operation; corrections remain versioned and attributable under the existing coordinator/amendment workflow. Device drafts stay with their original account; no deadline/extension is changed. Added database regression tests for former-author write denial, teacher takeover denial, stale ownership, foreign target, submitted/locked rejection and district history denial. Embedded PostgreSQL suites, local lint/build/baseline passed. Browser acceptance adds a coordinator handover round trip before the existing submission/review/Lock/recovery flow. Full exact-head CI remains required.
