# Pending roster-source declarations

15 October 2026. T03 foundation only; no approved roster or active mapping.

`20261015000100_pending_roster_declarations.sql` adds immutable, pending-only
source declarations against existing assignment slots. An active school SMEA
coordinator calls `tanaw_declare_roster_source(target_submission,
expected_revision, request_id, source)`. School, subject and assignment come from
the stored slot, not client claims. Source school year must match the assignment's
instructional block. Class reference and term are explicit declarations; they are
not inferred from a row, display label or calendar, nor independently validated.

The exact JSON contract is `tanaw-roster-declaration-v1`: source title, locator,
revision, class reference, school year, term (`TERM 1`–`TERM 3`), lowercase SHA-256
text and 1–1000 distinct explicit learner keys. Metadata is bounded, trimmed and
free of control characters; unknown fields and malformed keys fail closed. The
hash is a **declared source hash**, not a server-verified file digest. A key's shape
cannot establish that it is official, or prevent a caller from mislabelling a
name as a key. No name matching or identity generation occurs.

Each record retains its author, timestamp, source payload and per-slot revision.
Slot locking and expected revision reject stale edits; an exact request retry
returns the original declaration. Reusing a request for a changed payload/slot
fails. Authorization is checked again before retry reconciliation. The unique
request constraint also rejects conflicting simultaneous requests across slots.
Updates/deletes are rejected by a trigger; a new declaration appends a revision.
There is no approval transition, active pointer or import connection.

Existing slot-read rules limit inspection to an active assigned teacher, assigned
subject coordinator, or school Head/SMEA. District users and other schools cannot
read private learner keys. Authenticated callers have SELECT only; all writes use
the coordinator RPC. Revoked membership removes read/write and retry authority.

## Verification and limits

`tests/roster-declarations-local.sql` uses synthetic identities and rollback only.
It checks payload boundaries, ACL/RLS, author provenance, exact retry, changed
retry, stale revision, school-year mismatch, cross-school denial, teacher/subject
reads, district/disabled/revoked denial, immutable pending history and unchanged
submission evidence. Both isolated SQL workflows run this suite.

Supplemental local validation: all nine migrations and all five SQL suites passed
under PGlite 0.5.10 with a minimal synthetic `auth.users`/`auth.uid()` bootstrap.
This is PostgreSQL SQL/role regression evidence, not Supabase Auth, PostgREST or
hosted evidence. PGlite is an ephemeral verifier, not an application dependency.
Exact-head isolated Supabase CI results belong in the PR before integration.

## Coordinator entry and recovery

The SMEA assignment panel records the exact source contract with its assigned
year. File hashing stays in browser memory (nonempty, at most 32 MiB); no file
bytes are uploaded by this form. Explicit keys are validated without trimming,
inferring or generating identities. Source fields have no device persistence.
History fetches only revision/provenance metadata, never learner-key payloads,
in descending pages of twenty. All entries remain pending.

A confirmation names the scope, source, term and key count. Unknown write outcomes
freeze the source snapshot and retain the same request ID for an explicit retry.
Known revision/access/validation rejection retains fields and requires refresh.
Only a confirmed RPC receipt clears source fields; a subsequent history failure
is reported separately and blocks another new declaration until refresh. Global
unsaved-work handling still protects navigation away from an open draft.

Domain tests cover metadata/key/UTF-8 bounds; the authenticated browser suite adds
synthetic real-RPC retry, conflict, write/read-failure, metadata-only history,
keyboard receipt focus and light/dark narrow-layout checks. Exact-head CI results
must pass before integration. Browser CI is not physical Android/TalkBack evidence.

No mapping approval is included. Acquire the authorized roster,
verify its bytes/provenance and key meaning, decide retention and review policy,
and bind approved scope/period before activating mappings or imports. The pending
registry must not be treated as an approved roster by the preview validator.
No hosted migration or real learner record was used.
