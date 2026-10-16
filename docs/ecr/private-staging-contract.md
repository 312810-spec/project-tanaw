# T04 — private original-file staging contract

16 October 2026 (Manila). **Proposed design; no storage or runtime activation.**
Baseline `882c5613450ba8bbe187ff52785bc1dc21490b28` (PR #40).

## Outcome and current evidence

An authorized assignment owner can prepare one bounded workbook, review its
errors/mapping/discrepancies, and explicitly accept a complete version. Accepted
versions retain the exact original and reviewed bindings. Lost responses can be
reconciled; corrected uploads preserve history. No partial batch enters results.

The current preview route discards uploaded bytes after diagnosis; it cannot
satisfy original retention. Its authorization uses the stored submission/slot,
fresh user identity and active membership. Existing roster declarations remain
pending-only. The pure import model and SQL/concurrency fixtures establish
bounded mechanisms, not a production import service.

Sources: confirmed decisions 9–13, 23–25 and 27–29; `app/api/ecr/preview/route.ts`;
`app/lib/ecr-upload.ts`; `app/lib/ecr-identity-mapping.ts`;
`app/lib/ecr-atomic-import-model.ts`; current submission/version migrations;
`tests/ecr-import-transaction-local.sql`; `scripts/verify_import_parallel.py`.
Newest migrations govern current behavior; initial migrations alone are history.

Current slots include `scope_label`, not an authoritative class registry. Do not
derive a stable class ID or roster membership from that label. Reviewed mapping
must bind the assignment to an authorized class/roster source before acceptance;
pending declarations and synthetic model IDs do not resolve this dependency.

## Proposed boundaries

Use the existing Supabase stack as the candidate private object-store adapter,
subject to installed-version API, immutable-object and access-policy verification.
Do not add a live Drive integration. Database rows own workflow state; the
object store owns bytes. There is no assumed atomic transaction spanning both.

Begin with the same owner boundary as diagnostic upload: the current assignment
author with active teacher/subject access or the existing coordinator exception.
Do not infer permission from a browser-selected role, school-wide read access,
filename, path, payload owner or roster declaration. Reading originals for other
school review roles requires an explicit reviewed access matrix before enabling.
District users and anonymous users receive no raw files, rows or learner keys.

Storage stays disabled until an approved, versioned policy and verified adapter
exist. No bucket, hosted setting, privileged credential or migration is created
by this document. Future credentials remain server-only; client-safe identifiers
and private storage paths are different fields.

## Required records (proposed logical schema)

| Record | Required binding / invariant |
|---|---|
| Retention policy revision | Reviewed source/reference, designated authority, policy revision, staging expiry rule, original retention/disposal rules, hold/exception rules and access matrix. All operational values remain PENDING. |
| Upload attempt | Server ID, authenticated actor, stored school/cycle/slot/submission, expected version, server-created object reference, requested term and policy revision. Client cannot supply authoritative scope. |
| Private object receipt | Exact SHA-256 and byte length computed from received bytes, opaque immutable object version/reference, verified availability and integrity. No filename/path inference. |
| Stage snapshot | Attempt/object receipt plus template fingerprint/version, formula version, verified year/period, approved roster/mapping revisions, parser/comparison version, full private row bindings and validation/discrepancy outcome. |
| Review confirmation | Exact immutable stage revision and diff digest, actor and server timestamp; required replacement confirmation binds every changed value/source/version, not a generic checkbox. |
| Commit receipt | Submission/new version, request ID, consumed stage revision, original object receipt, retained source/roster/formula/policy references. Unique request/stage per submission. |
| Recovery/cleanup record | Object/stage IDs, observed state/revision, action, server identity/time and outcome; exclude file contents, names, scores and learner keys from logs. |

These are design fields, not existing tables or approved record formats. Prefer
existing submission versions/events over duplicate history systems. Private row
snapshots must not appear in district projections or ordinary audit logs.

## State and recovery contract

| State | Entry and permitted next step | Failure / recovery |
|---|---|---|
| Unavailable | Policy/adapter/source prerequisites absent; no original upload accepted for retention. Existing diagnostic-only mode may remain separate. | Explain the missing capability without claiming a saved original. |
| Receiving | Current owner checks pass and server allocates an attempt. Bound body, time and concurrency; compute exact byte hash. | Interrupted writes are uncommitted attempts; reconcile actual object availability before cleanup. Never retry automatically on reconnect. |
| Stored, unvalidated | Exact completed object/version is verified and private metadata recorded. | Object-store success followed by DB failure is an orphan candidate, not an import. Reconcile using the immutable receipt. |
| Rejected | Parser/source/period/mapping/comparison fails; return private sheet/row issues. | No evidence version/result changes. Retain/dispose only according to the reviewed policy; no invented default duration. |
| Awaiting review | Full stage is valid under current reviewed versions. Show differences and explicit next action. | Any changed bytes, scope, formula, roster/mapping or expected version requires a new snapshot/review. |
| Committing | Explicit user request rechecks server authority and locks the target. | Roll back all DB writes on failure; a verified stored object is not proof of commit. |
| Committed | Immutable version/history, receipt and original reference are committed together in DB. | Recover exact receipt after lost response; do not write a duplicate or reset current version. |
| Expired stage | Reviewed staging expiry rule closes new acceptance. | Expiry does not erase accepted history or authorize deleting its original. Reconcile receipt first. |
| Cleanup pending / completed | Policy authorizes disposal, no accepted reference/hold exists, and safe recovery checks pass. | Record intended deletion and retryable outcome; never report deletion until observed. |

Do not overload expiry, deadline closure, account disablement, packet Lock,
original retention and deletion as one status. Retry receipt reads require
current access even after expiry/deadline/Lock. Expired staging cannot create a
new version; a valid extension does not override packet Lock.

## Cross-resource commit protocol

1. Recheck access and policy before receiving; allocate opaque server IDs.
2. Receive bounded bytes into a private object, without overwriting an earlier
   object. Verify exact size/hash and immutable object reference. No object URL
   or identifier alone establishes integrity, scope or approval.
3. Record an immutable stage bound to that object and every reviewed dependency.
   Keep extraction, mapping and calculation output private. Any discrepancy
   blocks whole-batch acceptance; missing remains missing and explicit zero zero.
4. On explicit acceptance, load current identity, assignment, deadlines,
   extension/Lock/amendment state, reviewed source/formula/period/roster/mapping,
   stage expiry, correction confirmation and original availability from server
   records. Client approval flags are never authority.
5. Lock in a documented consistent order across cycle, assignment/submission and
   stage/policy records. Exact lock order must reconcile existing RPCs and pass
   isolated deadlock/race tests before runtime integration. Recheck revocation,
   handover and cutoff inside the protected operation.
6. In one database transaction append the evidence version and original binding,
   consume the stage, write the unique receipt and update the current pointer.
   Corrected uploads restart affected reviews; locked changes use an authorized
   amendment, not an ordinary import. Historical versions remain unchanged.
7. Respond only after DB commit. On uncertainty, query the same scoped receipt.
   If commit fails, retain the object as uncommitted until policy-driven recovery;
   never compensate by deleting an object that may support committed history.

Object integrity/availability and DB references can race without a shared
transaction. The adapter must prevent replacement/deletion of referenced objects
and cleanup must coordinate with commits using the same DB lifecycle locks.
Availability failures withhold acceptance; later missing/corrupt originals must
surface an integrity incident, never silently synthesize replacement bytes.
Provider guarantees and any external/manual deletion path must be verified.

## Access and safe disposal requirements

- Deny direct client object mutations and public enumeration. Use an authorized
  server path; any future signed-download capability needs a reviewed lifetime,
  recipient check and revocation analysis before enabling.
- Handover/disablement rechecks must cover receiving, stage review, commit,
  original retrieval and receipt recovery. Preserve original authorship separately
  from recorded-by identity; do not transfer file access implicitly.
- Cleanup first reconciles commit receipts and all version/packet references,
  policy revision and holds. A committed original is not an orphan because the
  current submission moved to a corrected version.
- Record a deletion intent under lifecycle locks, perform only the specifically
  authorized object deletion, verify it and finalize metadata. An object-store
  timeout is an unknown outcome requiring reconciliation, not confirmed deletion.
- No automatic purge, finite retention period, legal interpretation or approval
  is established here. School-authorized policy is an external input.

## Acceptance sequence and remaining inputs

1. Review retention/access policy and choose the approved deployment/storage
   environment. Exact durations, disposal authority, holds and source references
   remain PENDING. This is required for runtime storage, not synthetic development.
2. Implement adapter/schema against local synthetic storage only, with runtime
   feature off. Test no public/list/raw-district access and no cross-school leak.
3. Exercise altered bytes, replaced object references, partial upload, object
   success/DB failure, DB success/lost response, cleanup/commit races, handover,
   revoked access, deadline equality, expiry, correction confirmation and Lock.
4. Verify real-source serialization/computation/period and authorized mappings;
   preserve all policy/version lineage. A passing mechanism fixture is insufficient.
5. Controlled environment configuration, observed recovery and designated-user
   TNHS pilot precede actual use. Deployment/hosted changes require authorization.

Next independent work while policy/source inputs are pending: isolated adapter
and RLS prototypes, T11 account provisioning, or T10 clearly synthetic exports.
Do not silently activate retention, imports, district acceptance or live AI.
