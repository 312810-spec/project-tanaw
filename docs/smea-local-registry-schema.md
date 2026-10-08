# SMEA registry local database foundation

## Outcome and scope
Create storage for school-scoped indicator definitions and source evidence. This is a **schema-only** vertical slice; no UI, real school data, seeded formulas, DMET submission, hosted migration, approval, or Lock operation.

## Data contracts

- `smea_indicator_definitions`: school UUID, indicator code, school year, reporting period, unit, label, source file/revision/locator, pending/verified/superseded definition state, all-or-none formula fields.
- `smea_indicator_evidence`: school UUID, indicator reference, scope label, missing/recorded/rejected state, typed numeric or text value, missing reason, provenance.
- FK `(definition_id, school_id)` prevents evidence from linking to a definition of another school.
- A missing result requires a reason and does **not** silently become numeric zero.
- A recorded numeric zero remains a valid numeric zero only with a source locator.
- No calculated value is written automatically in this wave. Computed ratio lineage remains in the domain-model increment already merged.
- No historical or current student records are seeded.

## Access posture

Both tables have RLS enabled and client grants explicitly revoked. **There is no access policy**: authenticated users cannot currently read/write either table through ordinary client roles. This is deliberately safer than granting broad `authenticated` privileges before school membership and actor identity exist. Service-role privilege bypasses RLS by design and is not used by the app's client.

## Authority parked

The latest owner decision reserves TANAW school-level Lock to the School SMEA Coordinator. The old repository workflow models `Submit → Certify → Finalize → Endorse → Approve → Lock`, which is not an approved mapping of **school lock** vs **district closure**. The registry does not implement either until the state distinction is ratified and exercised under RLS tests.

## Verification

- CI branch uses `npx --no-install supabase start` on an isolated runner and `npm run verify:stack`; the new migration should be applied to that ephemeral local database at start.
- The CI build and baseline verification remain required.
- Explicit **migration behavior** test (same-school accepted, cross-school reference rejected, missing vs zero, no role grants) still needs a dedicated SQL test harness, before this wave can be considered schema-complete.
- No hosted Supabase project calls are authorized by this migration.

## Next

Add local-only DB constraint/RLS regression tests, run them on isolated CI, fix any failures, and obtain review before merge. Then design permissions against an actual school membership table and actor audit fields—do not invent district authority.
