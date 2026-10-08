# Project TANAW — Session Handoff

Checkpoint: 2026-10-08. Historical Phase 0.6C notes are archived in docs/session-handoff-phase-0.6c.md; their claims about current branch, stack and scope are superseded.

## Current verified state

Repository: 312810-spec/project-tanaw. Main is 595c416b55fbaa8f559f7db6274cddc693ce7490 after PRs #9, #10 and #11 were merged with successful fast checks, production builds and isolated local Supabase checks.
- #9: evidence and packet readiness semantics.
- #10: pure deadline, extension, review, lock and amendment eligibility policies plus synthetic regression tests. These policies are not yet connected to persistent submissions.
- #11: coordinator-managed active school memberships, multiple roles and subject scope, scoped reads and audited updates. SQL regression tests passed. No hosted migration or real account provisioning.
- #12: draft sign-in and assigned-role workspace; head 8860d880eaaaf72641f83cee353a36a62a186659. Fast tests passed; full validation pending at this checkpoint.

Confirmed product decisions are in docs/confirmed-decisions-2026-10-08.md. Do not repeat answered questions. The coordinator may review their own submission at the school stage only. School Head self-approval remains prohibited. Instructional block ends come from the applicable DepEd calendar; coordinator separately sets deadlines.

## Continuous development

Use independent branches for unaffected next tasks while slow checks run. Fast pure tests run without npm dependency installation; full build and isolated database validation remain merge gates. Inspect failed job logs and fix failures rather than skipping checks. Do not repeatedly update a tested branch and cancel expensive checks unnecessarily. Keep memory-only commits separate from implementation commits.

Current session has GitHub and reference-reading capabilities but no local shell/browser runtime. Work is committed through GitHub APIs; verification uses isolated CI. A browser smoke and screenshot pipeline is the next work item. No background coding agent is installed or implied by these workflows.

## Pending work and evidence limits

1. Complete browser verification of sign-in/workspace and capture desktop/mobile UI screenshots.
2. Connect coordinator membership management UI and operational account provisioning/recovery. Initial coordinator must be provisioned through a trusted operation; no self-signup or self-assigned roles.
3. Implement persistent cycles, submissions, staged reviews, deadline/extension rules, independent Head approval, lock, amendment versions and aggregate-only district review.
4. Inspect raw approved ECR workbook formulas and register validated template fingerprints/mappings; implement atomic preview/import, corrected version history and blank roster-row exclusion.
5. Connect indicators, reporting, approved template exports and deterministic charts. Live AI follows verified reporting.
6. Implement offline drafts and in-app reminders; test controlled TNHS pilot with synthetic data before real records.

Drive is reference-only in development, not a runtime source. CO and Division workbook families were located. Cached extracted text is not formula verification. Division cached blank rows include zero/failed computed artifacts; these must not be counted as learners. DO 009 s. 2026 was located, but exact instructional boundaries must be verified from the authoritative calendar annex and amendments before seeding; primary DepEd links returned 403 in this session. No dates or formulas were invented.

## Boundaries

No hosted Supabase mutation, deployment, real accounts, real school records or live AI calls were performed. Missing is not zero; submitted is not approved. Preserve operating-rules sections 1–14 and existing audits. Current user explicitly authorizes continued app development and GitHub work; historical per-command approval notes do not require repeating completed decisions. Hosted infrastructure approval remains separate.
