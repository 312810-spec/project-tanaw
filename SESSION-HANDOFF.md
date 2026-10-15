# TANAW — active checkpoint

15 October 2026. Repo `312810-spec/project-tanaw`; base main
`664c6d8498a6de381ed655594d52844a06c585fb` (PR #32).
Branch `forge/roster-declaration-ui-20261015`. Inspect current Git/PR metadata on resume.
Pushing/syncing/commit and verified integration authorized; preserve hosted boundaries.

## Current slice

SMEA coordinator assignment form and metadata-only paginated revision history for
pending roster-source declarations. Explicit source metadata, assigned reporting
year, term and learner keys; browser-only file hashing, no file upload or device
persistence. Unknown writes retain an immutable request snapshot for exact retry;
known rejection retains draft and requires refresh. Only confirmed receipts clear
fields; failed post-write reads are reported separately. No approval, active
roster, identity certification, mapping activation or import connection.
See [contract/evidence](docs/ecr/roster-declarations.md) and
[canonical ledger](docs/remaining-tasks.md).

## Rules

Read CLAUDE/AGENTS and relevant operating rules; retain all 29 decisions. Missing
is not zero; frozen history is immutable. Submit → Subject → SMEA → independent
Head → explicit SMEA Lock → district review; retain SMEA self-review exception.
District acceptance gated, AI deferred, Drive development-only. No hosted change,
deployment or actual learner record. Client capability/mapping is not authority.

## Evidence

PR #32 registry merged. Head `505c1a0fef2eaf4ec9d11909c0fe033410cbc20e`
passed [domain](https://github.com/312810-spec/project-tanaw/actions/runs/38719213100),
[public](https://github.com/312810-spec/project-tanaw/actions/runs/38719213016),
[isolated SQL/authenticated](https://github.com/312810-spec/project-tanaw/actions/runs/38719212925).

New UI slice: 123 domain/30 Python tests, lint, typecheck, production build and
baseline checks pass locally. Docker absent, local Supabase skipped explicitly.
Authenticated browser tests add real local RPC lost-receipt reconciliation,
revision conflict, accepted-write/read-failure recovery, metadata-only history,
keyboard focus and light/dark narrow layouts. Current exact-head CI must pass
before integration; inspect PR for final receipts. Browser CI is not physical
Android/TalkBack or full manual WCAG evidence. No measured token saving claimed.

## Next / gates

Finish exact-head CI, integrate and sync. T03 remains partial: acquire authorized
roster, independently verify provenance and keys, resolve retention/review, then
build approval/mapping workflow. Pending declarations never confer authority.
T02 still needs serialization, registered-original positive HTTP evidence,
approved computations/period binding; T04 private staging/atomic commit.
Indicators/calendar/exports/pilot gates persist. Load relevant task/contract
sections and update this checkpoint/ledger instead of duplicating audits.
