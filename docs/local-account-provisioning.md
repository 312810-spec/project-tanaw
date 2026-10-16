# T11 — isolated account-provisioning recovery fixture

16 October 2026 (Manila). Baseline `4955210bb8cdd840e96a201a4283724779a5e182`.
**Integration fixture, not a production endpoint or initial-coordinator setup.**

## Existing boundary and inspected SDK

The account UI manages already-provisioned identities. The current
`tanaw_manage_member` RPC requires an active school coordinator, denies self
assignment, checks expected membership revision and writes an attributable access
event. Its existing role-assignment rules remain authoritative.

Installed `@supabase/auth-js` source exposes optional `AdminUserAttributes.id`
and `app_metadata`, plus `getUserById` and server admin `createUser`. The inspected
SDK documents that `createUser` does not send confirmation email. Source files:
`node_modules/@supabase/auth-js/src/lib/types.ts` and `GoTrueAdminApi.ts`; package
versions are pinned by the repository lockfile. This is installed-version
evidence, not a guarantee for another deployment's Auth service.

Auth creation and membership creation are separate operations. An Auth identity
alone must confer no school access. Retrying by email must not silently adopt or
modify an existing identity. Production onboarding/delivery remains unresolved.

## Executable local fixture

`scripts/verify_local_provisioning.mjs` reads keys into memory from local
Supabase status, requires the exact `http://127.0.0.1:55321` URL and uses the fixed
TANAW Docker database container. No caller-supplied target URL or credentials are
accepted. Only generated `fixture.invalid` users and synthetic schools are used.
No key/password is printed or written to a file. Generated fixture identities
are explicitly confirmed only for these isolated tests, never as a production
onboarding recommendation or a claim of verified personal identity.

The harness creates a unique test schema holding an operator-only request
journal. The reservation binds request, generated user UUID, actor, school and
exact email/role/subject payload. Passwords are not stored in that journal. A
server-reserved UUID and server-set request metadata supply recovery identity;
neither user-editable metadata nor email lookup grants access.

The fixture tests these cases against actual local Auth and database behavior:

1. Account creation succeeds but its response is lost. The identity can sign in
   but cannot see schools while no membership exists.
2. Retry recovers that reserved UUID only when email and server metadata match.
   Unknown lookup failures stop; they do not trigger blind account creation.
3. An injected failure after the membership RPC rolls back membership, access
   audit and request completion together. The unassigned Auth identity remains
   for explicit recovery, without school access.
4. Retry grants one membership and records one access event. Exact receipt retry
   does not increment revision or grant access again. Recovery does not reset the
   original password, even when a retry supplies a different password.
5. A changed request payload is rejected. A coordinator lacking access to the
   target school cannot create an account there. An email collision with another
   UUID fails without adopting or granting access to the existing identity.
6. A disabled coordinator cannot recover even a completed request. All generated
   fixture journal, membership/events, schools and Auth users are cleaned up.

The membership/completion transaction executes through test-operator SQL using
the real membership RPC and synthetic actor claims, as existing SQL fixtures do.
This is **not** an authenticated public request API or a production journal RLS
implementation. Local admin credentials are privileged test setup, never client
credentials. Initial coordinator bootstrapping is test setup only.

## Acceptance evidence and remaining work

Local syntax/lint/baseline checks do not execute Auth or PostgreSQL; fresh
isolated CI is required before claiming the scenarios pass. The existing domain
and SQL suites remain regression gates. This fixture adds no app route, migration,
UI, production journal, hosted mutation, real person or email delivery.

Before operational provisioning, implement reviewed server-only endpoints and
durable actor/school-bound reservations, authorization/RLS and lease/concurrency
controls. Reconcile target identity and request provenance without disclosing
cross-school account existence. Recheck privileges during every transition and
persist membership plus request completion atomically. Test concurrent duplicate
requests, revocation races, stale revisions, cleanup and recovery after process
restart. Do not overwrite an independently edited/disabled membership on retry.

Production invitation/password setup, recipient verification and email delivery
need a reviewed flow; do not reuse fixture passwords or unconditional confirmation.
Existing-account linking needs explicit review rather than implicit email-based
adoption. Initial coordinator identity, deployment credentials/environment and
hosted authorization remain external inputs. No production readiness is claimed.


## Durable reservation foundation — 16 October 2026

Migration `20261016000100_provisioning_requests.sql` adds a private durable
journal and authenticated `tanaw_reserve_account` / `tanaw_complete_account`
RPCs. This is database foundation only: there is still no Auth-admin app endpoint,
production worker, bootstrap or onboarding UI. No hosted migration is applied.

Reservations bind creator, school, server-generated Auth UUID, normalized email,
canonical role/subject sets and reason. Exact creator-scoped retries return the
same UUID; changed payloads and school/email conflicts reject. RLS exposes rows
only to the initiating current active school coordinator. Anonymous access and
client table mutations are denied. The service role has read access only to this
journal; it has no execute grant on these authenticated RPCs. Privileged Auth
creation remains a future trusted server operation.

Completion checks current coordinator access and the exact reserved Auth UUID,
email and trusted `raw_app_meta_data` request/school identifiers. User-editable
metadata and email alone cannot satisfy this check. It calls the existing
revision-zero membership RPC and commits membership, its audit event and journal
completion together. A historical receipt never reactivates or overwrites a
later independently changed membership. Actor membership advisory/row locks
coordinate with the existing access-management lock key; request and target
membership locks serialize the database transitions.

`tests/account-provisioning-local.sql` exercises RLS/ACL, exact reservation retry,
payload/source-scope conflicts, invalid input, metadata spoofing, incomplete Auth,
rollback, one-time membership/audit completion, later disable preservation and
revoked-actor privacy. It uses rollback-only synthetic identities and operator
Auth setup. Fresh isolated CI must execute the migration and SQL before a pass
claim. The previous real-Auth fixture remains separate; connecting real Auth to
this durable journal, multi-session races for these specific RPCs, API recipient
checks, cleanup policy and process-restart recovery still require evidence.

Reservation lifetime/cancellation and any orphan-account disposal policy are
unresolved; no purge duration or automatic account deletion is introduced.
Production credentials, initial coordinator designation, invitation/password setup
and real email delivery remain gated. This journal does not approve a human
identity, class roster, imported workbook or deployment.


## Real Auth and durable RPC integration — 16 October 2026

The local verifier now replaces its operator-only throwaway request journal with
actual authenticated HTTP calls to `tanaw_reserve_account`, creator-RLS request
reads and `tanaw_complete_account`. Auth admin creation uses the server-reserved
UUID and the journal's trusted app-metadata bindings. A fresh coordinator client
resumes the request after a simulated lost Auth response; this is fresh-client
recovery, not a claim of full server-process restart testing.

For both reservation and completion, a separate database session first holds the
coordinator membership advisory lock. Two HTTP requests start together, and the
control session must observe both waiting on a PostgreSQL lock before releasing
the holder. Results must identify one reserved UUID, one membership revision and
one attributable access event. The fixture also checks conflicting email/request,
original-password preservation, no school access before completion, preserved
later disable, existing-email rejection and coordinator revocation after real
Auth creation but before completion. The rollback-only SQL suite continues to
verify transaction failure atomicity; it is not replaced by this HTTP harness.

Generated fixture rows and Auth identities are cleaned up through test-operator
SQL/admin calls only. No new runtime deletion policy, production credential,
endpoint, invitation or hosted mutation is introduced. Fresh isolated CI must
execute this revised harness before results can be asserted. Production worker
leases, concurrent Auth-create reconciliation, recipient/onboarding review,
full process restart, reservation cancellation and orphan disposition remain.


## Local subprocess coordination/restart fixture — 17 October 2026

`scripts/local_provisioning_worker_fixture.mjs --synthetic-local-only` is a CI
subprocess, not a shipped app worker. It accepts one generated fixture request
and the coordinator bearer token through stdin only. It requires the fixed local
Supabase URL/container and a fixture.invalid address. Local admin keys remain in
memory; no password, token, key or Auth response is printed or written to a file.
Its output is limited to static status labels. A watchdog bounds its lifetime.

The fixture coordinates a request using a session-level PostgreSQL advisory lock
in a fixed local operator connection. A second worker reports busy without Auth
creation or completion. The verifier waits for the first process to report that
Auth exists, kills that process, observes the local DB session disappear, and
starts a separate process to recover the same durable reservation/identity and
complete once. A fourth process checks exact receipt replay. Final membership
revision and audit count must remain one. Cleanup includes reserved identities
even if a child fails before reporting its status.

Fresh isolated CI is required; local syntax/lint/baseline do not execute these
scenarios. This extends the fresh-client tests with an actual killed Node process
and a new Node process. It does not establish production lease/fencing safety,
network partition handling, database crashes, or lock loss during an in-flight
Auth operation. No generic privileged worker, production endpoint, automatic
orphan purge, invitation, initial coordinator or hosted configuration is enabled.
A production worker must use reviewed ownership/fencing and reconciliation for
uncertain Auth outcomes before runtime activation. The previous rollback/RLS/HTTP
contention suites remain required regression evidence.


## Uncertain Auth outcome reconciliation — 17 October 2026

`app/lib/provisioning-auth-recovery.ts` is a privilege-free orchestration seam
used by the local worker fixture. Its caller supplies a trusted immutable journal
reservation, current request-ownership check and bounded provider adapters. It
adds no credential, endpoint, lease, school grant or production activation.

A definitive missing UUID permits at most one create attempt per invocation.
Unknown/failed initial lookup permits no create. Regardless of create success or
error, independently re-read only the reserved UUID and require exact email plus
trusted request/school app-metadata bindings. Missing/unavailable final reads stay
pending; mismatched identity stays conflicted. Never search/adopt by email, trust
a create response as completion evidence, reset a password or retry in a loop.
A later invocation can recover a delayed account through that same reserved UUID.

The ownership callback is checked before/after reads and after a create attempt;
loss withholds identity and never grants membership. This callback is not an
atomic external-provider fence. A late provider write can still leave an unassigned
identity; final school access always requires the separately authorized durable
completion RPC. Durable retry scheduling, provider uniqueness/uncertainty handling
and ownership/fencing under real network partition remain production requirements.

Eight domain cases cover post-write response loss, unknown initial lookups,
missing/unavailable post-write reads, later recovery without create, conflicting
bindings, untrusted create output, ownership loss and static/private error output.
The local worker injects an exception after real Auth creation; reconciliation
must read the actual identity before the existing kill/restart scenario proceeds.
This is a controlled lost-response injection, not a real network-partition test.
Child Node explicitly enables TypeScript stripping for this shared helper.
Fresh isolated CI must execute the revised fixture before a pass claim.
