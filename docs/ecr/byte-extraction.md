# Bounded CO byte-extraction boundary

15 October 2026. Base main `55c88c6edf97da98af72fb9f96071b99c4f7a9bc` (PR #28).

## Outcome and changes

Use one immutable workbook snapshot for registered-source auditing and private
CO normalization. Remove temporary raw-workbook disk copies and keep parsing
checks reusable. This Python diagnostic boundary is not a Next.js upload route.

- `fingerprint_bytes(data, lookup_ranges)` applies the existing v1 fingerprint
  and conservative ZIP/XML gates. The path wrapper uses a bounded read. Same
  formulas/topology/lookups produce the same digest.
- `extract_co_diagnostic(data, term, source)` requires immutable bytes, a CO
  source contract with structural digest/protected lookups, and a supported term.
  Audit and normalization use the same snapshot without path reopening or disk
  staging. All four CO sheets must exist.
- The private CLI uses the existing repository registry, reads at most the
  compressed limit plus a sentinel byte, and delegates to this boundary.
  Exclusive private output, 0600 creation mode and static summaries remain.
- Wrong family/term/structure and malformed archive/XML fail closed. Import is
  always false. Returned names/scores remain private. The source contract must
  come from a trusted registry; an uploaded contract is not approval.

Existing limits remain 32 MiB compressed / 64 MiB expanded / 1,024 members. A
path growing after its initial size check still receives a bounded read. A
future upload endpoint must enforce transport limits before buffering; a helper
cannot undo earlier unbounded allocation. This is not a full ZIP security audit.

## Acceptance evidence

Eight new synthetic tests cover a pre-refactor golden v1 digest, all three terms,
snapshot independence after source replacement, absence of temporary staging,
immutable/oversized/expanded/member rejection, wrong source/term/formulas,
active/external/traversal/DTD/duplicate rejection, malformed input privacy and
missing CO sheet rejection. The mapping-pipeline tests now invoke this extractor
for all six term/string-serialization combinations.

The golden digest was obtained using base-main's original path implementation
against the synthetic workbook. No approved original, computation, template,
actual learner data or engine receipt changed. No dependencies, migration or UI
were added. Equivalent resaved files can still fail conservative serialization
gates. Unchanged computation receipts do not require invented fresh engine claims.

Local: 100 domain and 30 Python tests, lint and baseline passed. Baseline includes
typecheck and explicitly skips local stack reachability because Docker is absent.
No app/UI/configuration changed; exact-head CI also runs production build, SQL
and authenticated/public browser checks. Record CI against its actual head.

## Remaining gate

T02 is PARTIAL: Next.js service integration, upload/registry boundary and full
approved serialization support remain. Never expose a caller-selected registry,
claim policy conflict resolved, import partial rosters or skip authorized mapping,
private staging/atomic commit. T01/T03–T07 retain their separate requirements.
