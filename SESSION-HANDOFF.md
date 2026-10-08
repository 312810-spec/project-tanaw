# Project TANAW — Current Session Handoff

Checkpoint: 8 October 2026. This file supersedes the archived foundation notes in `docs/session-handoff-2026-10-08-foundations.md` and `docs/session-handoff-phase-0.6c.md`.

Verified main implementation: **889593851bccae57aaf1440b4f8808b9ee65bceb** (PR #24). Latest tested implementation head: **7e2456e7aee2a9a164d0be6c7402a094b6ffb150**. PRs #18–#24 are merged. All three CI workflows passed at each final head before merge; exact run evidence is below. No hosted change, actual account/record mutation, production deployment or live AI occurred.

## DONE — implemented and integrated

- Authenticated assigned-role workspaces, coordinator-managed membership roles/scopes/disable controls, school-only account labels and immutable access history. Revision checks reject stale changes and unversioned clients cannot bypass them. This manages already-provisioned accounts; secure account creation is still pending.
- Reporting cycles separate verified instructional-block end dates from coordinator deadlines. Deadline cutoff and scoped extensions are server-controlled. Official calendar entries are not populated from unverified snippets.
- Manual indicator evidence with immutable versions and provenance; current-version subject review; coordinator school review (including explicit self-review exception), independent Head review, missing-submission reasons/acknowledgment, explicit Lock, time-limited amendment rounds and aggregate-only district accept/return.
- Device drafts scoped to account/school/submission, recorded-zero preservation, server-version conflict acknowledgment and explicit online-only submission. Successful server acceptance clears the draft; interrupted/failed requests retain it.
- In-app deadline, missing-submission, current-version review and active-extension reminders for visible assignments. Device-clock alerts are advisory; server permissions and cutoff remain authoritative.
- Responsive PWA manifest, 192/512 PNG icons, install prompt, connection state and public offline fallback. Service worker caches only `/offline.html`, never authenticated pages, API data, tokens or records. Offline reload requires reconnection to reopen authenticated editing; open workspaces can keep preparing device drafts.
- Email/password recovery pages and fixed-destination PKCE callback using a trusted `TANAW_APP_ORIGIN`. Synthetic Mailpit capture verifies the complete email-link/password-change flow. Recovery never enables disabled school access.
- Attributable handover of unlocked **unsubmitted** assignments to active subject-scoped accounts, rejecting stale ownership, unauthorized/foreign targets and submitted/locked work. Historical submitted versions are preserved; submitted corrections use existing version/amendment rules. Device drafts remain with their original account, and handover never changes deadlines/extensions.

- Development-only approved ECR source catalog, conservative formula/lookup/weight/topology fingerprint audit, and separate CO-core TERM 1–3 calculator preserving literal threshold/zero behavior. Runtime XLSX import remains closed; see the source-verification continuation below.

## VERIFIED — completion evidence

| Increment | Final tested head | Isolated CI run | Outcome |
|---|---|---|---|
| Role/workflow UI (#18) | 1f9d03161c0e45b8299388331265a7b1b37789bc | 37747944996 | Passed |
| Coordinator access (#19) | 14bf0b01d58e638219e70f1b50c48f4104eb07b1 | 37772395705 | Passed |
| Drafts/reminders (#20) | 440c9bcdaa7e4f44ee5536c479342f00ef78a3e2 | 37773641861 | Passed |
| PWA (#21) | f1edfd4ecc7e9d7a854e658c6b9c6e5e596cdcbd | 37774442181 | Passed |
| Recovery (#22) | 34f2762492d93d9a1f33ce6531302f989e15aec4 | 37774832842 | Passed |
| Handover (#23) | 74ece7a5d1021ce947065d611dfaf2b0fa6434c0 | 37775398142 | Passed |
| ECR source audit/CO calculation (#24) | 7e2456e7aee2a9a164d0be6c7402a094b6ffb150 | 37782042838 | Passed |

Latest validation: 70 domain tests, nine synthetic ZIP/XML audit tests, lint, production build, baseline checks and four isolated Supabase SQL suites passed. Authenticated Chromium acceptance covers handover round trip, teacher zero submission, offline draft restore, subject/school/independent Head review, explicit Lock, district acceptance/raw-data denial, account disable and complete synthetic email recovery with disabled access preserved. Public browser checks cover five routes on desktop/mobile, manifest/icon dimensions, safe callback redirects, exact cache allowlist and offline navigation. Mobile offline page was visually reviewed. Authenticated screenshot download returned HTTP 403 in this environment; do not claim those images were visually inspected.

CI artifacts are temporary and contain synthetic fixtures. Latest authenticated run: https://github.com/312810-spec/project-tanaw/actions/runs/37782042838 . Production readiness and a real TNHS pilot are **not established** by these tests.

## PENDING — remaining implementation

1. Approved XLSX runtime registry, family-specific parsers, independent recalculation fixtures, file retention, comparison preview and atomic versioned import. CO now has a development source catalog/fingerprint and separate pure calculator with all 41 threshold checks; nine synthetic ZIP/XML audit tests are added. These are not a runtime import adapter. Only CO/Division core originals have been inspected; other families remain unverified. XLSX submission stays unavailable until all adapter gates pass.
2. Current indicator definitions, DMET/West 1 mappings, formula/coverage validation and source-discrepancy reconciliation. Missing is never zero. Recorded teacher evidence is not automatically certified as an official result.
3. Deterministic source-traceable school aggregates/charts and approved editable Excel/PPT/PDF exports. Live AI remains deferred by the confirmed decision.
4. Secure coordinator account provisioning and initial coordinator setup. Production SMTP/redirect configuration and hosted account recovery delivery remain unverified.
5. Controlled TNHS pilot with designated users, confirmed records, authenticated mobile/accessibility review and production operations/recovery checks. Extended offline reopening/editing requires additional design; current offline reload safely preserves drafts and requires reconnection.

## BLOCKED / source dependencies

- Central DepEd DO 009 s. 2026 PDF returned HTTP 403 again. A four-page official division reproduction does not establish the full calendar annex. Verify applicable annex/amendments before seeding real block dates; never silently change an assigned deadline.
- Division core contains 13 external-workbook link records and is rejected by the self-contained source gate. No numeric external workbook indices were found in expanded cell formula text, but this does not establish that all link records are safely removable. Resolve the approved dependency/version decision before supporting it.
- CO and Division core use different transmutation tables; the CO boundary lookup differs at exact thresholds. Interchangeability or automatic correction is not approved. See `docs/ecr-reference-findings-2026-10-08.md`.
- Original reference workbooks/cached learner data must stay outside the public repository. Drive is a development reference only, not a runtime app integration.
- Hosted credentials, protected infrastructure changes and actual-user pilot actions need their separate authorized operational setup. Existing repository operating rules remain in effect.

## NEXT — resume without repeated questions

Read `docs/confirmed-decisions-2026-10-08.md`, current code and this handoff; retain all 29 decisions/overrides. Continue the first CO-specific XLSX parser/preview vertical slice from `docs/ecr/source-verification.md`; preserve its literal lookup behavior and keep final import closed until verification is complete. Park exact unresolved formulas/definitions instead of inventing them. Connect exports only after their source values and approved template structure are verified.

## Continuous verification and fallbacks

Develop independent increments while CI runs; do not wait idly or bypass merge gates. Fast domain checks run separately from public browser and isolated database jobs. PWA browser verification disconnects/restarts the origin because older Chromium did not consistently propagate the browser-context offline flag to service-worker requests. CI download delays were worked around with the same local browser assertions using an available binary; final CI still passed before merge.

Use merge commits for dependent branches when preserving tested ancestry avoids squash conflicts. If ancestry conflicts occur, compare source trees first, preserve the intended tree explicitly, then require checks on the new head. Local Docker is absent; embedded PostgreSQL provides supplemental SQL checks, while isolated full Supabase CI remains authoritative for integration. Local git fetch works; push has no credential helper, so publishing used authorized GitHub tree/commit/ref APIs. Local/connector commit IDs may differ; compare source trees.

Keep implementation and documentation checkpoints in separate commits. Record main SHA, exact tested head, CI outcomes and unresolved dependencies before ending a substantial session. Automatic CI is verification, not an unattended coding agent.

## Source verification continuation — PR #24

Published head: `7e2456e7aee2a9a164d0be6c7402a094b6ffb150`. Local validation: 70 domain tests, nine synthetic ZIP/XML audit tests, lint, build and baseline checks passed. CO original hash and structural fingerprint match; Division audit rejects its external-link records. A strict intermediate cache comparison failed on two eight-decimal percentages (maximum difference 3.34e-9); final grade agrees on the single entered-score source example. Do not claim full spreadsheet-engine fixture verification. All three exact-head CI workflows passed: fast domain run 37782042820, public desktop/mobile run 37782042833, isolated build/database/authenticated workflow run 37782042838. PR #24 merged to implementation main `889593851bccae57aaf1440b4f8808b9ee65bceb`.
