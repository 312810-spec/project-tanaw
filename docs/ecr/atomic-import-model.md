# T04 — synthetic atomic-import reference model

16 October 2026 (Manila). This is an executable transaction specification, not
private storage, a database transaction, an import API or an approval mechanism.
`app/lib/ecr-atomic-import-model.ts` has no application callers. Every result
contains `runtimeImportEnabled: false`. Its synthetic authority inputs prove
conditional behavior only; they do not certify an actual source or roster.

## Transaction contract

A future server must load authenticated actor/access, assigned owner and scope,
source/computation/period approval, roster/mapping revisions, retention approval,
deadline, extension and Lock from authoritative records within a transaction.
Never deserialize authority flags from a workbook or client request. Pending
roster declarations cannot supply approved mapping authority.

The reference model applies these rules in order:

1. Recheck active access, owner and all six scope dimensions, including submission.
2. Validate the bounded stage, exact source hash, version references and entire
   row batch. Null remains missing; explicit zero remains zero. Duplicate keys or
   any invalid value reject all rows. Values are synthetic scalars, not an
   implementation of an approved grade computation or indicator definition.
3. Check per-submission history consistency; reconcile an existing request only
   if its entire ordered immutable stage matches. Changed payload under the same
   request rejects. Current access is required even for read-only recovery.
4. Exact receipt recovery may succeed after stage expiry, deadline or Lock,
   because it performs no write. It returns the original receipt version even
   after a later correction exists. It never resets the current version.
5. New writes reject Lock (amendment required), consumed stages, stale expected
   versions, expired staging and deadline closure. An extension must name this
   owner, have a recorded reason and remain unexpired. Boundary equality closes.
6. Source, mapping, retention, computation and period checks must all pass;
   template/formula/roster/mapping revisions must still match.
7. Replacement requires an exact server-retained correction confirmation snapshot.
   Changed rows, hashes or versions invalidate that confirmation. Append a new
   version with `supersedes`, retain prior bytes/metadata in the future private
   implementation, and restart required reviews. The model marks new versions
   `working`; it does not implement or bypass any review transitions.
8. Produce history plus receipt as one state result. Failures return an unchanged
   detached prior snapshot. Current contribution reads select one current version,
   never sum corrected and superseded versions.

Request and stage identifiers are per submission. Row order is part of identity;
object insertion order is not. Error codes contain no row values or learner keys.
The returned state/row snapshots contain private synthetic data: no district
projection, public logging or output/export authorization is implied.

## Required persistence implementation

Before runtime connection, separately implement and test:

- Approved private original-file retention, encryption/access policies, disposal,
  staging TTL and interruption recovery. No retention period is invented here.
- Immutable server-created stages binding exact uploaded bytes, complete parsed
  input, source/formula versions, approved roster/mapping and full discrepancies.
  The model uses an immutable stage ID plus full snapshot for confirmation;
  runtime code must verify the original object and reject mismatched bytes.
- A locked database transaction, owner/scope/RLS checks, unique request/stage
  constraints, expected-version compare-and-swap and original receipt lookup.
  Real parallel transactions, rollback/crash tests and authorization changes
  must be exercised in isolated Supabase. The pure model proves no SQL atomicity.
- Review invalidation for corrections throughout subject/school/independent Head
  review and explicit SMEA Lock. Locked amendments require a distinct reviewed
  workflow; the model deliberately rejects all new writes to locked history.
- All affected-sheet/row validation and discrepancy confirmation UI; no partial
  valid-row acceptance. Preserve original uploads and all immutable old versions.
- Source-policy resolution, approved serialization, period binding and real
  roster authorization. Source fidelity alone does not resolve CO policy conflict.

## Verification

Thirteen synthetic domain cases exercise success without activation, null/zero,
batch rejection, scoped access, pending evidence, stale versions, exact cutoff,
reasoned extensions, lost receipts after Lock, payload conflicts, concurrent stale
writers, confirmed corrections/history/review reset and stage reuse. Inputs and
outputs are checked for snapshot isolation. No actual learner, private workbook,
SQL schema, hosted setting, deployment, app route or live AI changes.

This advances T04 design/tests. T04 remains PARTIAL until private persistence and
isolated transaction evidence exist; no production readiness is asserted.

Local checks after incorporating PR #35: 148 domain cases (executed directly per test file), 40 Python
tests, lint, typecheck and baseline pass. Docker is unavailable. The local default
build first failed Google font retrieval; after network access it failed
Turbopack process/port binding with `Operation not permitted`. No code or build
configuration was changed to evade that restriction. Require the unchanged-head
isolated CI production build before integration; local build success is not claimed.


## Batch integrity follow-up — 16 October 2026

Regression tests reproduced a sparse row array reaching simulated commit and a
sparse history throwing at receipt lookup. Array methods that skip holes cannot
establish whole-batch validation. The model now visits every position and rejects
sparse/null/undefined row and history entries while preserving the prior state.
Two new domain cases cover these failures; runtime imports remain disabled.
This is a bounded model correction, not general validation of unknown JSON or
evidence of database transaction safety.


## PostgreSQL mechanism fixture — 16 October 2026

`tests/ecr-import-transaction-local.sql` runs in isolated CI using only temporary
tables and a session-local function, inside an explicitly rolled-back transaction.
It adds no migration or production RPC. Synthetic integer identities, a target
owner and readiness flag are fixture inputs, not authorization or approval data.

The fixture exercises whole-batch rejection; history/receipt/current-version
rollback after an injected interruption; exact replay without a new write;
changed-payload denial; stale expected-version rejection; unique stage reuse;
wrong owner/target and disabled-access denial; and receipt recovery after Lock
or deadline without reopening writes. Zero and JSON null remain distinct.

This tests PostgreSQL subtransaction rollback, uniqueness, foreign keys and
compare-and-swap sequencing. The function locks its target row, but this suite
uses one session: actual concurrent writers, crashes/disconnects, production RLS,
immutable server-created stages, retention/encryption/disposal, approved roster
and formula semantics, extensions and confirmed corrections still require their
own integration evidence. Temporary objects and a fixture readiness flag must
never be promoted to runtime import authority. No private file is stored.

Local PostgreSQL/Docker are unavailable; fresh CI SQL execution is required
before claiming this fixture passes. Existing domain/Python suites remain useful
regression evidence, not execution evidence for this SQL.


## Parallel-session mechanism harness — 16 October 2026

`scripts/verify_import_parallel.py` targets only the fixed local Supabase Docker
container. It adapts the same SQL fixture function and tables into a unique
synthetic schema because temporary tables cannot be shared between backends.
Each session uses bounded statement/lock timeouts. A holder keeps its transaction
open; the control session observes the contender in `pg_stat_activity` waiting
on a lock before releasing the holder. This avoids claiming contention from
sequential calls or guessed sleep timing.

Four scenarios require: one committed version when a competing stale writer
rejects; one receipt for two simultaneous exact requests; rollback of an open
transaction when its psql client disconnects, allowing the waiting writer to
commit; and access revocation committed while a writer waits, which must deny
that write. Final history, receipt and current-version counts are checked. The
unique schema is removed in cleanup. These checks require fresh isolated CI;
local syntax validation alone does not execute PostgreSQL.

This is concurrency evidence for the fixture only. Production RLS, real source
and mapping authority, original-file retention, server-created stages,
correction/extension integration, database process crashes and network partitions
remain unverified. Runtime imports and district acceptance remain disabled.
