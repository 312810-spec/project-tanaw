# TANAW — canonical remaining-task ledger

20 November 2026. Wave A starts from main `8e949b19c9ed37105ef564f980bd21eaa8b151ad` (PR #53 merged).
READY = bounded synthetic/local development; GATED = activation awaits evidence;
BLOCKED = external input required; PARTIAL never means operationally done.

| ID | Task / state | Next acceptance gate |
|---|---|---|
| T01 | CO policy/version — BLOCKED activation | Reviewed applicable formula/precision/completeness/rounding version; preserve historical formulas. |
| T02 | Runtime parser/preview — PARTIAL | Owned file-check API/panel and ambiguous-OOXML rejection added; complete approved serialization, registered-original positive HTTP evidence, approved computation and period mapping remain. |
| T03 | Learner/scope mapping — PARTIAL | Explicit consistency validator, pending-only registry and coordinator entry/history; authorized roster acquisition, approval and coordinator-reviewed mappings still needed. |
| T04 | Private staging/atomic import — PARTIAL mechanisms/design | [Model and SQL/concurrency fixtures](ecr/atomic-import-model.md) verified; [private-staging design](ecr/private-staging-contract.md) proposed. Approved retention/access, production storage/RLS/transactions and source/mapping remain. |
| T05 | Template registry/families — GATED | Coordinator version controls and per-family verification; resolve Division/SHS external dependencies. |
| T06 | Current indicators/templates — BLOCKED activation | Applicable memo/approved dictionary, DMET/West 1 mappings, coverage and 77/69 source reconciliation. |
| T07 | Calendar provisioning — GATED | Applicable amendments/local reconciliation, Term 3 inconsistency; preserve assigned deadlines. |
| T08 | Governed results/charts — PARTIAL synthetic | Frozen headcount/pooled-percentage diagnostic tested; reviewed contracts/populations, server projection persistence and aggregate-only chart/district access remain. |
| T09 | District acceptance — GATED | T08 and required reviews; existing acceptance gate stays closed. |
| T10 | Editable Excel/PPT/PDF — PARTIAL synthetic | [Aggregate-only prototypes](synthetic-export-prototype.md) generated, native cells/tables and all renders checked. Official template bindings, governed totals, runtime authorization and target-application edit/save/reopen remain. |
| T11 | Account bootstrap/provisioning — PARTIAL local HTTP and UI | PR #53 merged coordinator test-account creation and receipt recovery. Secure credential handoff, reviewed production budgets/quotas, initial coordinator and real partitions remain. |
| T12 | Production recovery email - BLOCKED live setup | Local Mailpit and PKCE reset verified. Authorized production sender/domain, trusted callback and observed recipient flow remain. |
| T13 | Android/TalkBack — PENDING observations | Physical touch/focus/assistive/interruption checks; CI viewports do not replace them. |
| T14 | TNHS pilot/rollout — BLOCKED actual use | Designated participants, confirmed records, authorized environment and observed workflow/recovery. |
| T15 | Carryover reconciliation — PARTIAL | Own-submission SMEA exception and empty-form feedback merged in PR #48; final-head a78666d SQL/Auth/browser, ACL and domain CI passed. Draft/reviewed online-send paths traced; interruption, memo/logo provenance and family scope remain. |
| T16 | Live AI — DEFERRED | Verified reporting first; separate bounded activation. |

## Wave A release checks

The first slice updates Next.js and its ESLint configuration from 16.3.5 to
16.4.6. npm reported zero known vulnerabilities after compatible lockfile
updates. The fast domain, public browser and isolated integration workflows now
also target pushes to `main` so they can report on the exact merged SHA. Isolated
CI fails on high or critical npm advisories. The final lockfile installed and
passed local lint and regression checks. The Windows production build and
public desktop/mobile smoke passed with the opt-in directory retry documented
in the README. It retries transient `EPERM` errors during generated route
directory creation. Run the Linux CI build and isolated Supabase browser
matrix before accepting a release candidate.

The Lock confirmation now requires a loaded reporting-period label and the
currently eligible packet. The authenticated browser fixture checks that a
missing label leaves the packet unlocked, then restores the label and checks
the period and packet version in the confirmation. Isolated execution is pending.

Workflow and historical evidence reads now use bounded, single-statement
snapshots with the caller's existing row-level permissions. This removes the
offset-page race and the workflow's submission-ID fan-out. The workflow
pauses when a collection exceeds 5,000 rows. The recent packet list still
shows 20 versions.
All migrations and eight SQL fixture files passed against the local Supabase
PostgreSQL 17.6 service. The verification transaction rolled back the test
schema and fixture records. The full authenticated browser suite still needs
the isolated stack's CLI status and candidate migrations. The runner supports
native SQL over the published port when CLI status is supplied on stdin. A
Docker-enabled shell must obtain that status, and this mode requires native `psql`.
A focused Chrome test reached the real loopback Auth service through its
published port. Synthetic sign-in, failure-closed school access on the
unmigrated stack, sign-out, and signed-out reload passed. The disposable
account was removed. This check did not exercise an assigned school role.
A separate Chrome recovery check produced a real local Mailpit message,
completed the PKCE callback and password change, and verified rejection of
the old password and acceptance of the new one. The disposable account and
captured message were removed.
The production candidate migrations were subsequently applied to the empty
local PostgreSQL database using Supabase CLI over its published port. The
database recorded 15 migrations and returned ready. A focused authenticated
Chrome run with synthetic users passed teacher submission of a recorded zero,
subject and school review, independent Head review, exact-version Lock,
district returns and history, and district denial of private evidence. It
also verified the preview term mismatch and Python worker rejection. The
full CI suite remains pending. The locked synthetic packet projected zero
and the existing export fixture reconciled 5 percent and zero as expected.
Apply migration `20261120000100_consistent_workflow_reads.sql` before routing
traffic to the updated app. Verify the authenticated browser journey in CI.

District packet reads now page by Lock timestamp and packet ID, and each
packet carries its own latest decision for the next write. Older decisions
page by revision using the existing access policy. Apply migration
`20261120000200_district_packet_pages.sql` before routing traffic to the
updated app. District acceptance remains gated by governed results.

The deployment readiness endpoint verifies the database release-contract RPC
and, when preview is enabled, the packaged Python worker and registry. Apply
`20261120000300_release_readiness.sql` before the readiness check. It returns
503 for invalid configuration or unavailable dependencies without exposing
configuration details. Verify the hosted Auth and mail services separately.
The workflow also rejects incomplete directory, cycle and indicator reads,
queries the open amendment directly, and pauses writes after uncertain
responses or revision conflicts until a successful refresh.

Diagnostic preview rejects a selected term when it conflicts with a verified
assignment calendar label of Term 1, Term 2 or Term 3. It rechecks the term
after parsing before returning counts. Official period mapping and import
activation require the source evidence below.
The preview upload deadline also releases its worker slot when stream cleanup
stalls. The interrupted request returns without accepting any workbook.
On 23 November 2026, the local reference workbook matched the registered CO
original SHA-256 and the isolated worker returned allowlisted diagnostics for
all three terms. This is worker-level evidence. The source contains a
populated row, so the authenticated browser proof used synthetic bytes.

PR #53 merged the local coordinator creation and receipt-recovery UI for T11.
The [isolated integration run](https://github.com/312810-spec/project-tanaw/actions/runs/39322434638)
passed on PR head `f9b3b1ed`. Production provisioning, credential delivery and
initial coordinator authorization remain pending.

The first source-intake scope is one reporting cycle. Confirmation is pending for
the exact calendar and amendments, CO formula and rounding policy, applicable
indicator and template versions, roster authority, and original-file retention
rules. Record scope, effective period, source locator and approval evidence
before enabling the corresponding workflows.

| Intake gate | Evidence required to proceed |
|---|---|
| Calculation and period (T01/T02/T07) | Approved applicable calculation, precision and completeness rules, reconciliation of the CO fixed points and Term 3 discrepancy, calendar/amendment references, and assignment-to-template period mapping. |
| Source, roster and retention (T03–T06) | Approved template and indicator versions, DMET/West 1 mappings and 77/69 reconciliation, coordinator-approved roster bindings, and authorized original-file access and retention rules. |
| Reporting and publication (T08–T10) | Approved populations and suppression, reconciled synthetic and authorized totals, official output bindings, and native Excel/PowerPoint edit-save-reopen receipts. |
| Deployment and school use (T11–T15) | Authorized staging and support owners, approved onboarding and sender, restore rehearsal, physical Android/TalkBack observations, and designated pilot participants. |

T07 source recheck, 20 November 2026. The [central DepEd publication of DO 009, s. 2026](https://www.deped.gov.ph/2026/04/16/april-16-2026-do-009-s-2026-guidelines-on-the-implementation-of-the-three-term-school-calendar-in-basic-education/)
and [national opening memorandum](https://www.deped.gov.ph/wp-content/uploads/DM_s2026_030r.pdf)
corroborate the national three-term framework for SY 2026–2027. Indexed official
results did not resolve the recorded Term 3 discrepancy or establish the
Mandaue-specific amendment position. Keep the approved local calendar and
period mapping gates open.

## Carryover evidence

`manual-evidence-form.tsx` stores account/school/submission-scoped preparation,
retains sourceVersion and requires explicit submit after reconnection/access
refresh. A stale version requires review; the service worker never queues
protected requests. This is pending local preparation, not automatic server
replay or complete offline reopening. Do not silently introduce either. Recheck
cutoff/assignment-change rejection in integration/device acceptance.
Device draft saves and removals now compare against the last observed storage
value. A newer copy detected during submit or discard stays in device storage,
and conflicting edits can be downloaded from the tab that still holds them.
Chrome verified this using two tabs and a delayed synthetic submission receipt.
Physical shared-device and interruption observations remain pending.

The unresolved reading count is in `smea-indicator-foundation.md`. Current
memo/approved output authority and division-logo provenance are not established
by this increment. Keep numerical governance separate from branding.

## Execution / context budget

Owner delegates engineering prioritization using FORGE and weighted scoring.
Use [the current decision record](workaround-decisions-2026-10-20.md) for choices
and re-score when evidence/access changes. Hard source/privacy/actual-use gates
override numerical scores; never count a workaround as official approval.

B0 checkpoint → B1 source contracts and independent B2 parser/mapping or B5
provisioning work → B3 governed results → B4 exports → B6 device/pilot. Source
authority gates actual activation, not labelled synthetic development.

Entry: `SESSION-HANDOFF.md`. Target 500–800 tokens active checkpoint, 300–600
task/acceptance packet, bounded relevant source reads and 150–300 result delta;
expand for correctness. Retain hashes/tested SHAs. Load relevant playbook jobs,
contracts and gates, not whole archives/API trees. Run focused checks during
editing and required integration gates before merge. No measured token-saving
percentage is claimed. Update this ledger instead of creating competing backlogs.
