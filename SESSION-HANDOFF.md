# TANAW — active checkpoint

15 October 2026. Repo `312810-spec/project-tanaw`; base main
`bb78437e060766cbb824b49bd36c47481f2b80d3` (PR #29).
Branch `forge/ecr-upload-preview-20261015`. Inspect current Git/PR metadata on resume.
User authorized pushing/syncing/commit on 15 October; preserve hosted boundaries.

## Current slice

T02 app-side adapter: opt-in `POST /api/ecr/preview` accepts bounded raw XLSX for
an owned assignment. Fresh session/RLS membership/subject checks run before body
read and again before returning a count-only summary. Same-origin validation,
size/time/concurrency limits, a no-shell isolated Python worker and private
no-store responses preserve source/record boundaries. Default disabled; Python
must be installed/configured on an authorized Node host. No file-picker UI yet.
See [adapter evidence](docs/ecr/upload-preview.md) and
[canonical ledger](docs/remaining-tasks.md).

## Rules

Read `CLAUDE.md`, `AGENTS.md` and relevant operating rules. All 29 confirmed
decisions remain. Missing is not zero; frozen history stays immutable. Submit →
Subject → SMEA → independent Head → explicit SMEA Lock → district review.
Preserve SMEA self-review exception. Imports and district acceptance stay gated;
AI deferred; Drive development-only. No hosted change/deployment or real records.
Never trust a client-selected source registry or roster as authority.

## Evidence

PR #28 mapping and PR #29 byte extraction merged after all exact-head CI passed.
PR #29 tested head `d1aa8ad2c746ba8fec61accd67974ecd980a9b12`:
[domain](https://github.com/312810-spec/project-tanaw/actions/runs/38703989172),
[public browser](https://github.com/312810-spec/project-tanaw/actions/runs/38703989368),
[build/SQL/authenticated](https://github.com/312810-spec/project-tanaw/actions/runs/38703989278).
Its 100 domain/30 Python tests are prior evidence, not new-adapter verification.
Current-adapter checks and exact published head belong in the current PR.
Local adapter: 113 domain/worker and 30 Python tests, lint, baseline/typecheck and
build passed. Local Docker reachability skipped; actual authorized HTTP is a CI gate.
Build tracing includes all five required worker/library/registry files; it does
not install Python. Registered-original positive HTTP recognition remains
unverified; synthetic/negative HTTP coverage must not imply that result.

## Next / gates

Verify actual authenticated HTTP ownership/anonymous/district/disabled denial
and fixed-registry rejection in isolated CI, then integrate the scoped adapter.
T02 remains partial: teacher picker/result UI, full serialization/original-source
HTTP evidence and period binding. T03 roster acquisition/review, T04 private
staging/atomic imports, policy/version, indicators/calendar, exports and operational
pilot gates remain. Preview is not submission, retention or approval.
Prior detail: mapping/byte evidence, 12 October archive and blocker research.
Load only active-task sections; update this checkpoint and ledger.
