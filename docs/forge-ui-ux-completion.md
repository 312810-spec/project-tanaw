# FORGE UI + UX completion checkpoint

12 October 2026. Based on main `3bc80811e5bcc184440fa4c7c6a6c991fc1169d8` and recovery head `2d20ece413e37da5cabdf53a10116f9e8d80993f`.

## Implemented

- Preserve all 22 recovery mechanisms; verified indicator requirements, expiry recovery, protected unreadable drafts, exact packet reviews, decision reconciliation and gated district acceptance remain.
- Paginate complete ordered assignment/submission/review reads; current evidence and the latest immutable packet snapshot use an RLS-governed focused SQL projection instead of fetching all historical versions. Selected immutable history has load-older pagination.
- Author/reviewer labels respect school/work scope; district headings identify the authorized reporting period.
- New packet manifests freeze indicator labels, units, formula/rounding/input definitions and source metadata. Locked historical records are not modified. Historical packets without frozen labels display original IDs rather than inventing old labels.
- Keep an existing scoped local draft editable through failed workflow/access refresh. Online mutation eligibility remains gated by verified access, readiness and server checks.
- Searchable role task queues, status filters, explicit no-match feedback, school/role context and mounted task navigation preserve current forms.
- A packet prerequisite checklist identifies snapshot, round, school-review and independent Head-review requirements.
- Safe error-message allowlist; manual evidence validation is field-associated and focuses the first invalid field. Unknown SQL text is not shown.
- Explicit download of unsent rationale/comment notes; the downloaded working notes are not submitted records or applied access changes. Working device draft discard preserves server versions and recovery copies.
- Shared action/surface/focus styles, readable solid surfaces, touch controls and keyboard skip links; reduced-motion baseline.

## Verification at publication

Local: 78 domain tests and nine synthetic workbook-audit tests passed; typecheck, lint, baseline checks and production build passed. Docker is unavailable locally. Browser install returned an invalid/truncated download; no browser restriction was bypassed.

Updated isolated SQL tests exercise 1,100 extra historical versions, exact snapshot retrieval, frozen labels and district/cross-school read denial. Authenticated browser fixtures exercise field validation, offline-refresh draft editing, review/Lock/return, disabled access, recovery, keyboard skip links and narrow light/dark layouts. These require the exact-head CI runs; they are not marked passed merely because syntax/build checks pass.

## Dependencies preserved

Runtime XLSX import, authoritative indicator/calendar population, governed district result content, approved editable exports and actual pilot/production setup remain dependent on the verified source and operational gates in `SESSION-HANDOFF.md`. This UX increment supplies no invented official formulas, dates, templates, identities, records or approvals. Live AI remains deferred. District acceptance stays unavailable until governed results exist.

No hosted database mutation or deployment is part of this checkpoint. Main integration requires passing relevant CI on the submitted implementation.

## First exact-head CI result

At `6ee226880ed3f95177bc820f04837c5fcfc0cf76`, fast domain run 38212582164 and public browser run 38212582159 passed. Isolated run 38212582184 passed build and all four SQL suites, including focused history/privacy/frozen definitions, then found an outdated browser fixture that blindly toggled an already-preserved open handover disclosure closed. The fixture now opens the disclosure only when its field is hidden. This preserves the real retention behavior rather than resetting forms to satisfy the old test. The next exact head must rerun authenticated acceptance. Legacy unlocked packet manifests without frozen definition metadata are now visibly stale; locked historical packets remain immutable.

## Historical inspection and recovery checks

Earlier packet snapshots are now reachable through a separately paged, read-only history view and an exact RLS-governed historical-evidence projection. Historical inspection never changes the current review/Lock target. School Head review appears before the evidence queue. Added acceptance checks commit a real synthetic submission and fail its subsequent presentation read, verifying truthful confirmation/draft cleanup and explicit refresh recovery; switching mounted tasks retains access-change rationale.

At recovery refinement head `172fad38fea14bdd729afb86f1030f208de3e6c4`, domain/public browser/build/SQL checks passed. Authenticated acceptance reached the district view after teacher offline recovery, subject/school/Head review and Lock, then exposed an exact-label lookup mismatch in the wrapped decision select. The decision field now has a distinct explicit HTML label association. Final-head CI remains required.

The read-failure fixture at `1ab3c1e0e738498a9753c439c5cbad40730bf052` initially aborted only one GET. The installed PostgREST client automatically retried and recovered it, so the expected failed-refresh message correctly did not occur. Inspection of the installed retry implementation and the actual render confirmed this. Fault injection now remains active through SDK retries until explicit recovery; application retry behavior is preserved.

## Final implementation verification

Implementation `d659076799e4dd1df51e2abc075bb91680f2b96d` passed all three workflows: fast domain 38214385440, public browser 38214385281 and isolated build/database/authenticated browser 38214385329. The isolated run completed all four SQL suites and the complete authenticated acceptance, including sustained read failure/recovery and read-only history. Latest result supersedes earlier acceptance limitations for these tested scenarios. Physical-device/TalkBack/full WCAG assessment and production operations remain unverified. Final checkpoint edits are documentation only; the tested application/migration/script/test files remain byte-for-byte unchanged.
