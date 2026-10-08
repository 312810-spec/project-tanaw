# Project TANAW — Confirmed Decisions

Date: 8 October 2026 (Asia/Manila)
Repository: `312810-spec/project-tanaw`
Purpose: authoritative implementation brief from the 29-question decision interview in this conversation. These are user-confirmed product decisions, not claims of implementation or official DepEd policy.

## Governing rules

AI prepares; teacher/user reviews and approves. TANAW stays separate from LIKHA-SIS and ILAW. New official evidence overrides older assumptions. Never invent school data, formulas, calendar dates, approvals, signatures, or official records. Missing data is not zero. Reviewed or locked data is not automatically district-approved.

## Confirmed decision register

| No. | Topic | Final user-confirmed decision |
|---|---|---|
| 1 | Deadline and lock timing | The SMEA Coordinator assigns the deadline. This replaces the initially suggested lock timing. Read together with decisions 2, 4 and 5. |
| 2 | Deadline enforcement | At the deadline, editing closes automatically. The SMEA Coordinator reviews completeness and explicitly locks the packet. Missing submissions remain marked missing. |
| 3 | Late submissions and corrections | The coordinator can grant a time-limited extension to a specific submission, with a recorded reason. After packet locking, changes create an amendment version rather than overwriting history. |
| 4 | School review flow | Subject Coordinator checks teacher submissions; SMEA Coordinator consolidates and checks the school packet; School Head reviews before SMEA Coordinator locks. |
| 5 | Lock eligibility | Unresolved validation errors and incomplete required reviews block locking. Missing submissions may remain only with a recorded reason, School Head acknowledgment and an Incomplete label. |
| 6 | District review | Assigned District MEA Coordinator receives locked school packets and accepts or returns them with comments. District reviewers cannot edit school source data or unlock school packets. |
| 7 | Account management | SMEA Coordinator centrally creates and manages accounts, roles and access scopes. Users cannot assign themselves privileges. |
| 8 | Initial school scope | Start with Tingub National High School; structure the system to add other schools later. Coordinator manages TNHS accounts. |
| 9 | Data entry and approved records | Upload approved class-record spreadsheets through import preview and validation; allow manual corrections and entry for indicators without a spreadsheet source. Only class-record versions approved in the reference Google Drive may be supported. For the CO version, reuse computations from other approved versions only after verifying matching inputs, grading rules and reporting period. Do not guess what CO means; inspect the actual source. |
| 10 | District data visibility | District receives consolidated school results and supporting evidence. Learner-level class records remain restricted to authorized school personnel. Supporting evidence exports must respect this boundary. |
| 11 | Import errors | Identify affected sheets, rows and errors; block import until corrected. Preserve the original upload for reference. No partial valid-row import into consolidated results. |
| 12 | Corrected uploads | Show changes for confirmation; create a new version; preserve previous versions; require affected reviews again. Locked packets use the amendment process. Do not count both versions. |
| 13 | Offline behavior | Save drafts locally and queue changes for reconnection. Submission, review, approval and locking require an online connection. Server controls deadlines and authorization. |
| 14 | Calendar and reporting deadlines | Determine instructional-block end dates from the applicable official DepEd school-calendar order and amendments. SMEA Coordinator sets submission deadlines separately. Do not silently shift assigned deadlines when the calendar changes. |
| 15 | Indicators | Use verified indicator sets from current official instructions and approved templates. Coordinator assigns applicable indicators; unresolved definitions and formulas remain pending. |
| 16 | Reporting outputs | Editable Excel consolidations, editable PowerPoint SMEA presentations and PDF copies, following applicable approved templates. |
| 17 | Eventual AI scope | AI may draft narratives, summarize verified results, flag issues and suggest/generate graphs and charts for review. Chart values use verified data and deterministic calculations. AI cannot change records, approve, submit or lock. Live AI is deferred by decision 28. |
| 18 | Performance visibility | Teachers see their own results; Subject Coordinators see assigned subjects; SMEA Coordinator and School Head see school-wide comparisons; district reviewers receive school aggregates. |
| 19 | Reminders | First release uses in-app notifications and coordinator dashboard for upcoming deadlines, missing submissions and overdue reviews. No email-reminder service required. |
| 20 | Multiple roles | One account may hold multiple assigned roles and switch workspaces. General rule: no self-review or self-approval; apply the explicit coordinator exception in decision 22. |
| 21 | Delivery format | Responsive, installable PWA for computers and Android phones, with the agreed offline draft behavior. No separate native Android application required for the first release. |
| 22 | SMEA Coordinator self-review | User explicitly permits the SMEA Coordinator to review their own submission. Record self-review transparently. Other users remain subject to the no-self-review rule. School Head review remains required before locking. The suggested alternate-reviewer requirement for the coordinator's own submission was not accepted. |
| 23 | Template registry | Only SMEA Coordinator may register or retire approved template versions, referencing their approved Drive source. Existing submissions retain their original template and formula version. Decision 25 means runtime registration does not require a live Drive connector. |
| 24 | Calculation discrepancies | Show spreadsheet and verified TANAW results and their calculation sources; block import until resolved. Never silently overwrite either value. |
| 25 | Google Drive boundary | Google Drive is a reference source during app development only. Incorporate approved templates into the app; users upload/download files. No live runtime Drive connection, automatic Drive saving or Drive synchronization is required. |
| 26 | Authentication | Coordinator-created accounts; email/password sign-in; secure password recovery. |
| 27 | Staff changes | Coordinator disables access or updates assignments. Preserve submitted records and authorship; reassign unfinished work with a recorded handover. |
| 28 | AI activation sequence | Start without live AI. Enable AI after reporting workflows are verified. Deterministic calculations, charts and exports remain in the initial release. No AI-provider credentials are needed for the initial release. |
| 29 | Acceptance and rollout | Synthetic-record tests first; controlled TNHS pilot with designated users and confirmed records next; regular use only after workflow verification. |

## Reconciliation of overrides

- Deadline closure, explicit coordinator Lock, School Head review and district acceptance are distinct events.
- School Head review is a Lock prerequisite; the deadline itself does not create approval or Lock.
- The coordinator may self-review a teacher submission, but this does not replace School Head review of the packet.
- A locked version remains immutable; extensions before Lock and amendments after Lock are separate mechanisms.
- Google Drive is development evidence, not a production integration dependency.
- AI chart generation is a confirmed later capability. First-release charts are deterministic and do not require live AI.
- Never present an incomplete packet as complete; district acceptance remains an explicit independent action.

## Evidence and dependencies to resolve during implementation

1. Inspect the current approved Drive class-record versions and exact CO structure. Extract and cross-check formulas, input ranges, period rules, rounding and computed summaries against approved sources.
2. Locate the applicable official school-calendar order and amendments; derive instructional-block boundaries without inventing dates.
3. Reconcile current indicator definitions, official templates, DMET/West 1 mappings, memo and division-logo evidence. Earlier research documented a reading-count discrepancy (reported 77 versus visible grade counts totaling 69); recheck the actual source before use.
4. Verify current repository/PR/CI state before changing code. Earlier inspection showed main at `be62c3d`, PRs #2–#8 merged and PR #9 draft with successful CI; this is a prior observation, not a fresh status claim.
5. Actual deployment configuration, authentication-email delivery, initial coordinator identity and pilot participants/records remain operational inputs. Do not invent credentials, accounts, participant names or approvals.
6. Existing hosted Supabase mutation/deployment restrictions remain in force; product choices above do not independently authorize a production rollout or hosted changes.

## Implementation sequence and completion evidence

1. Record these decisions in the correct repository and reconcile stale handoff/governance documentation. Verify PR #9 and resolve its remaining review/merge work under existing authorization.
2. Build school membership, coordinator-managed accounts and scoped permissions. Test role boundaries, multiple roles, the explicit self-review exception, account disablement and handover.
3. Implement approved-template identification, formula validation, import previews, atomic accepted imports and versioned corrections. Synthetic fixtures must prove missing/zero distinction, discrepancies and duplicate/version handling.
4. Implement cycles, official-calendar references, deadlines, extensions and staged school review. Test server-authoritative deadline closure, Lock prerequisites and amendment immutability.
5. Implement aggregate-only district review, return/correction/acceptance and traceable histories. Test that district users cannot retrieve restricted class records or mutate school sources.
6. Produce and visually verify template-faithful Excel, PowerPoint and PDF outputs with deterministic charts and source traceability.
7. Add installable responsive PWA behavior, offline drafts, reconnection conflict handling and in-app reminders. Test pending edits after deadlines or assignment changes without silently discarding data.
8. Complete synthetic end-to-end acceptance, then prepare controlled TNHS pilot. Live AI follows verified reporting workflows.

## Continuation state

DONE: All 29 planned product decisions answered; superseding choices reconciled in this brief.
VERIFIED: Decision contents checked against the visible interview. No new code, merge, deployment or pilot is claimed by this document.
PENDING: Implementation, source verification, exports and workflow acceptance.
BLOCKED: Only operational actions needing unavailable credentials, confirmed identities, official evidence or separately required deployment authorization; continue unaffected work.
NEXT: Use this brief to update repository decisions and implement the smallest verified TNHS workflow, preserving checkpoints and a current handoff.