# Teacher file-check panel

15 October 2026. Base main `191238535f2abd30306b73df4b57423ce1fbed1c` (PR #30).

## Behavior and scope

An owned assignment in the Teacher or SMEA Coordinator workspace has a secondary
“Check a class-record file” disclosure beside the existing manual workflow. It
checks configured availability through a no-store GET returning only a boolean.
The server remains authoritative for POST access and source validation; the
capability response is not authentication, interpreter health or import approval.

The teacher chooses an .xlsx workbook and explicitly selects its term. Empty,
unsupported and oversized files are rejected locally, with field-associated
errors/focus. Checking sends raw bytes only to the existing owner-authorized
adapter. It never saves/submits a school record or enables an import. A recognized
result shows occupied/blank slots, the selected term and a collapsed file hash;
it explicitly says grades/computations/mapping/period checks are unfinished.

States: checking availability, unavailable, failed availability/retry, ready,
invalid fields, offline, stale access/workflow, checking/cancel, rejected/busy/
access/network/timeout recovery and validated recognition. Response text is never
rendered directly; an allowlisted count/hash/term contract rejects malformed,
wrong-term or import-ready payloads. Recorded zero is retained in counts.

File selections and results live only in the mounted account/school/submission
scope. They are not put in storage or restored after switching/reloading. File or
term changes clear results; unmount, cancellation, offline or access refresh
invalidates pending checks. Late replies cannot repopulate a different context.
Reconnect never sends a file. A failed/canceled check retains the local selection
for explicit retry, and keyboard clear removes it. This temporary file selection
does not mark the unrelated manual-evidence form dirty; manual draft protection
is unchanged. The panel discloses its nonpersistent selection behavior.

## Verification

Five pure contract tests cover file boundaries, zero/count handling, private-field
removal, mismatched term/semantics/malformed results and recovery copy. Existing
backend authorization/worker tests remain. Authenticated browser additions cover
real file rejection, required field/focus semantics, selection retention, explicit
recognized/malformed UI fixtures, narrow 320/390/1440 light/dark results, offline
retention without replay, cancel/stale reply, keyboard clear, capability off/retry
and remount clearing. Public browser checks default-off boolean/privacy headers.

Positive/malformed UI responses are deliberately intercepted synthetic fixtures,
not production mocks and not proof of a registered-original HTTP success. The
real rejection still traverses browser POST → auth → fixed-registry Python.
No new screenshot deliverable or physical Android/TalkBack result is claimed;
DOM/rendered layout assertions are distinct from manual visual review.

Local: 118 domain and 30 Python tests, lint, baseline/typecheck and production
build passed. Local stack reachability explicitly skipped because Docker is
unavailable. Current PR/checkpoint records exact-head CI after execution.
Complete approved serialization, registered-original positive HTTP evidence,
authorized roster/review, period matching and private atomic import remain gates.
No dependency, migration, official data/template change or hosted activation.
