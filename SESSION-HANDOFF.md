# TANAW — active checkpoint

16 October 2026 (Manila). Repo `312810-spec/project-tanaw`; base main
`a54faf1d8625f9a29dcf80385d8d0e5e2e2a3e02` (PRs #35–#39 merged).
Branch `forge/import-parallel-tests-20261016`. Inspect live Git/PR state on resume; avoid overlap with hourly continuation.
Commits, publishing, syncing and verified integration authorized; hosted actions,
deployment and actual learner operations remain separately gated.

## Current slice

T04 multi-session PostgreSQL mechanism harness. Reuse the rollback-only SQL
fixture function in a unique test schema shared by separate backend sessions.
Observe a contender waiting on a database lock before releasing the holder.
Check stale writes, exact retry, client disconnect rollback and access revocation
while waiting. Cleanup removes the synthetic schema. No production schema,
grant, route, private file or runtime import is added. Fresh CI is required.

## Rules

Read CLAUDE/AGENTS/operating rules and all 29 confirmed decisions. Submit → Subject
→ SMEA → independent Head → explicit SMEA Lock → district review. Preserve SMEA
self-review exception, scoped access and aggregate-only district visibility.
Pending declarations never approve identities/mappings. CO source fidelity does
not resolve policy conflict. Drive development-only; live AI deferred.

## Evidence

PR #36 merged after all CI passed at
`4a1f5d421357855eca2ff48601728706921894ac` (isolated run `38823783372`).
PR #37 merged after all CI passed at
`c50f171b63c51c7987211a277db6b5b9398b75e4` (isolated run `38823754628`).
Combined main passed 150 domain / 40 Python tests, lint, typecheck, baseline and
production build locally. Docker unavailable locally; never count its skip as a pass.

PR #38 sparse-batch/history repair merged at `da827c4`; unchanged-head CI passed
(domain `38842374728`, public `38842374729`, isolated `38842374710`).
PR #39 SQL mechanism fixture merged; all CI passed at
`b8d60323dac41ef21beabde75182a92feb6626b6` (isolated `38843263546`).
Current parallel harness requires fresh isolated CI execution; no local PostgreSQL or
Docker is available. Existing local 152 domain / 40 Python tests pass. The
rollback-only fixture is a test mechanism, not production import acceptance or
proof of production transaction safety. No device/pilot test or token saving claimed.

## Next / gates

Publish parallel harness, require fresh multi-session and full CI, integrate and sync.
T04 still needs approved private retention, server-owned immutable stages and
isolated transactional persistence/rollback/parallelism evidence. Source and
mapping approval gate activation, not independent synthetic implementation.
T02 remains partial (registered-original positive HTTP evidence, full approved
serialization, computation/period binding). T03 needs roster provenance and
approved review/mapping workflow. PR #35 added T08 frozen headcount/pooled-percentage diagnostic and authenticated
projection/privacy checks. Preserve its new calculator, CI flag and ledger state.
T08 persistence/charts and T10 synthetic exports remain implementable work. Indicators/calendar/device/pilot and
production recovery dependencies remain; do not claim the roadmap complete.
