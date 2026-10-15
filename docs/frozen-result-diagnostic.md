# Frozen result diagnostic — synthetic T08 foundation

16 October 2026. Baseline main `f3fa465f7a586a3f8bdcb3879c7e185c4e9b3126` (PR #34).

`app/lib/frozen-results.ts` implements a deterministic, read-only projection from
existing locked packet manifest fields and exact `tanaw_packet_evidence` rows.
It supplies a tested seam for future reviewed result contracts, charts and
exports. No route, UI, database grant, district acceptance gate or import was
activated. Every output has `canPublish: false` and `canAcceptDistrict: false`.

## Contract and arithmetic

`projectFrozenResult(contract, packet, evidence)` accepts unknown JSON-shaped
inputs. Contract schema is `tanaw-frozen-result-contract-v1`, with mandatory
`purpose: synthetic`, UUID ID, positive revision, school/cycle IDs, school year,
period, exact frozen numerator definition, optional denominator definition,
method, decimal places, explicit `rounding: halfUp`, and a versioned partition.
The partition identifies each required slot and its explicit synthetic population
UUIDs. V1 requires exact coverage of every packet slot. No population/identity is
inferred from display labels, names or assignment counts.

Supported methods are bounded headcount operations:

| Method | Inputs and output |
|---|---|
| `countSum` | Nonnegative safe integer counts within each declared population; count total, zero decimal places. |
| `populationPercentage` | Numerator count within each population, denominator exactly its supplied membership count; pool both counts, multiply by 100 and round half-up once to 0–6 decimal places. |

Percentage arithmetic uses exact BigInt rationals until the final display value.
For example, 1/2 and 0/18 produce 1/20 = 5%, rather than averaging class percentages
to 25%. A recorded zero remains numeric; absent evidence never contributes zero.
An empty total denominator is unavailable, including an explicitly recorded zero.

Bounds: 1–1000 slots, at most 1000 population keys per slot and 10000 overall,
at most 200 definitions/entries per row, bounded 2000-character semantic/source
fields. Count totals are bounded by the declared population. This function does
not replace transport/body limits or worker resource isolation.

## Snapshot, coverage and privacy behavior

- Require a complete locked packet, empty missing list, positive source versions,
  distinct slots/submissions and complete manifest coverage/requirements.
- Require exact contract school/cycle and school-year/period semantics. Compare
  all consumed definition metadata with the packet's frozen definitions, never
  query a live registry. Legacy manifests without those snapshots are withheld.
- Require each measure in the frozen assignment's required indicators and one
  exact evidence version for each contribution. Duplicate or unrelated versions,
  duplicate definitions/measures, missing provenance and malformed counts fail.
- Reject repeated population keys within or across contributions. Supplied keys
  cannot prove official roster meaning, actual real-world identity uniqueness or
  authorized population completeness; those remain external approval gates.
- Withhold the whole numeric result on any issue. Return static issue codes and
  coverage counts without releasing a partial subtotal. A successful result is
  labelled `readyDiagnosticOnly`, never approved/published/accepted.
- Return only aggregate math, counts and packet/contract/partition version
  references. No learner keys, submission IDs, authors, freeform source notes,
  rows or file content are copied. Inputs remain unchanged. Repeated evaluation
  of the same inputs is deterministic; no persistence/idempotent commit is claimed.

An amendment is evaluated against its own packet/evidence versions and produces
new provenance. Later evidence cannot silently replace an earlier packet's
referenced version. The existing school-only historical RPC supplies private
inputs under RLS; this pure calculator is not an authorization service.

## Verification and next gate

Twelve synthetic domain tests cover pooling versus averaged percentages, half-up
ties, zero/missing distinction, exact coverage, overlapping populations, complete
Lock state, mixed context/stale semantics, exact versions, amendments, numeric
bounds, source provenance, malformed/oversized inputs, privacy and immutability.
Authenticated isolated CI additionally projects the real synthetic locked packet
and its scoped historical RPC rows, and verifies that district cannot fetch those
private inputs. These CI cases must pass on the unchanged PR head before merge.

T08 remains PARTIAL. Next: authoritative applicable result dictionary and
population partition/overlap policy, reviewed versioned contract persistence,
server authorization/revalidation, immutable committed projections, governed
aggregate-only district RPC/chart UI and export bindings. General decimal or
financial aggregation, arbitrary formulas, partial-packet results and multi-period
population rules require separate reviewed contracts. Current official source,
T09 acceptance, T10 approved-template and physical-device gates remain open.

## Lock instant validation follow-up — 16 October 2026

The initial timestamp check used `Date.parse`, which normalizes some impossible
calendar dates and `24:00:00` to a different day. A regression first reproduced
February 30 incorrectly reaching `readyDiagnosticOnly`. The diagnostic now
validates Gregorian month/day bounds (including century leap-year rules), clock
and offset fields before parsing. Invalid instants produce
`packetNotLockedComplete` and withhold the result. Valid leap days, month ends,
fractional seconds and timezone offsets retain their prior diagnostic behavior.
This validates input syntax/calendar meaning, not actual Lock authority.

Local verification: 137 domain tests (14 frozen-result cases), 40 Python tests,
lint, typecheck, baseline and production build passed. Local database verification
was skipped because Docker is unavailable; full isolated CI remains the merge
gate. No database, runtime endpoint, UI, import or approval gate changed.
