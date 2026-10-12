# SMEA indicator foundation — implementation checkpoint

> Current implementation reference: `docs/confirmed-decisions-2026-10-08.md` governs the review sequence: Submit → Subject review → School review → Independent School Head review → Explicit SMEA Coordinator Lock → District review. Earlier phase descriptions below are historical; district acceptance is separate from Lock and awaits governed result content. Autonomous UX repair and branch publishing are authorized in the current task; hosted changes and deployment still require separate authorization.

Status: **PROVISIONAL vertical slice**. This is a source/evidence type model and tested arithmetic boundary, not an official Division DMET dictionary, not a reporting database, and not a submission workflow.

## Evidence and provenance

Drive-backed discovery of current `SMEA 2026-2027` materials found School, District and Division consolidator folders; current `TINGUB NHS SMEA Q1(1).pptx`; ECR and BOW folders. Prior SMEA materials contain grade/subject/term performance, enrollment, dropout/failure, nutrition, BLICs and promising practices. Templates are evidence candidates, **not** automatic authority for official DMET labels or rate formulas.

Reference folder: https://drive.google.com/drive/folders/1aIj4bdsgRE3pUTLohi0fT65jdfUmnTmr

An older Q1 executive summary lists 77 frustration-level Filipino readers but visible grade counts add to 69 (30+14+12+13). The source requires reconciliation; no generated aggregate may silently paper over the discrepancy.

## Implemented in this branch

- `app/lib/smea-indicators.ts`: provenance references, indicator status, review state, explicit missing/recorded/derived values; explicit distinction between missing and evidenced zero.
- `validatedRatio`: only computes when the definition is marked verified with a formula, both inputs are finite numbers, and denominator > 0; derivation carries **both** input source references. It returns a fraction, without inventing a percentage or rounding policy. The function is not an official aggregate or a publication validator.
- `tests/smea-indicators.test.mjs`: synthetic zero/missing/invalid/provenance cases. No pupil-level data in fixtures.
- GitHub Actions runs Node's test runner with TypeScript stripping as part of branch PR checks.

## Governance conflict — do not bypass

Existing repository governance model is `Submit → Certify → Finalize → Endorse → Approve → Lock` with Teacher → Subject Coordinator → School SMEA Coordinator → School Head → District MEA Coordinator. The latest owner rule is: **only School SMEA Coordinator performs TANAW Lock**. There is an unresolved ambiguity in whether existing final `Lock` represents district-package closure or school packet immutability. Do not map them to one privilege or collapse the independent district validation. Proposed safe design: distinct school coordinator `school_packet_lock` from any future district lifecycle closure; owner must approve concrete state transition mapping before RLS/migration release.

## Boundaries

- No source workbook copied into repository.
- No guessed DMET fields, grade data, student data or policy.
- No hosted Supabase mutation, local migrations or changes to other repositories.
- No direct DMET API or automatic submission.
- No dashboard pretending to be an approved school report.
- Appending a new source row, migration or privileged workflow requires an explicit verified schema/role contract.

## Verification plan

GitHub Actions `npm ci`, `npm run verify`, `node --experimental-strip-types --test tests/smea-indicators.test.mjs`, `npm run build`, and separate local-only Supabase smoke check. Mark **PASS** only after observing relevant run conclusions.

## Next

Reconcile the source-derived indicator dictionary from actual 2026–2027 school/division files; approve the exact SMEA Lock and district-approval distinction; then create reviewed local-only migrations with school/role-scoped RLS and no data-loss operations. Do not attempt hosted rollout until separately approved.
