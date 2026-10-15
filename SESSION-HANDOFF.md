# TANAW — active checkpoint

15 October 2026. Repo `312810-spec/project-tanaw`; base main
`dcb15bb42fe24e3bca09498a0cd29d9ed1645283` (PR #31).
Branch `forge/roster-declarations-20261015`. Inspect current Git/PR metadata on resume.
Pushing/syncing/commit authorized; preserve hosted boundaries.

## Current slice

Pending-only immutable roster-source declarations use existing assignment scope.
Active school SMEA coordinator RPC, explicit bounded source metadata/learner keys,
assignment year check, request reconciliation and per-slot revision conflict
checks. Existing scoped readers only; no district/raw cross-school access.
No approval transition, active roster, mapping activation, UI or import connection.
Hash/keys are declarations, not independently verified official identities.
See [contract/evidence](docs/ecr/roster-declarations.md) and
[canonical ledger](docs/remaining-tasks.md).

## Rules

Read CLAUDE/AGENTS and relevant operating rules; retain all 29 decisions. Missing
is not zero; frozen history is immutable. Submit → Subject → SMEA → independent
Head → explicit SMEA Lock → district review; retain SMEA self-review exception.
District acceptance gated, AI deferred, Drive development-only. No hosted change,
deployment or actual learner record. Client capability/mapping is not authority.

## Evidence

PR #31 file-check UI merged. Head `d644093486a3360560178140cc4b38b99fe24f45`
passed [domain](https://github.com/312810-spec/project-tanaw/actions/runs/38714486609),
[public](https://github.com/312810-spec/project-tanaw/actions/runs/38714486570),
[build/SQL/authenticated](https://github.com/312810-spec/project-tanaw/actions/runs/38714486612).
Positive UI responses were labelled intercepted fixtures, not registered-original
HTTP evidence. Browser CI is not physical Android/TalkBack or full manual WCAG.

New source-registry slice: all nine migrations/five rollback SQL suites passed
PGlite 0.5.10 with synthetic auth bootstrap. This is supplemental PostgreSQL
validation; current PR must pass isolated Supabase and existing browser CI before
integration. No runtime dependency added. Docker remains absent locally.

## Next / gates

Verify/publish this slice, pass exact-head CI, integrate and sync. T03 remains
partial: acquire authorized roster, independently verify provenance and keys,
resolve retention/review, then build approval/mapping workflow. Never treat a
pending declaration as an approved roster. T02 still needs serialization,
registered-original positive HTTP evidence, approved computations/period binding;
T04 private staging/atomic commit. Indicators/calendar/exports/pilot gates persist.
Load current task sections, retain hashes/tested SHAs, and update this checkpoint
and ledger rather than duplicating audits. Prior details remain in source evidence
and the archived handoff. No measured token-saving percentage is claimed.
