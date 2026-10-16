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
