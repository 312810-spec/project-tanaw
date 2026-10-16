# TANAW — active checkpoint

16 October 2026 (Manila). Repo `312810-spec/project-tanaw`; base main
`58b94963fd2268266257b511247b44aee970b534` (PRs #35–#37 merged).
Branch `forge/import-batch-integrity-20261016`. Inspect live Git/PR state on resume; avoid overlap with hourly continuation.
Commits, publishing, syncing and verified integration authorized; hosted actions,
deployment and actual learner operations remain separately gated.

## Current slice

T04 executable synthetic transaction model plus contract/tests. Current access
and six scope fields are rechecked, batches reject atomically, exact request retry
reconciles lost receipts, stale writers/consumed stages reject, deadline/extension
and Lock are distinct. Corrections require exact confirmation, append immutable
history and reset review state; current contributions select one version. Missing
stays null, explicit zero stays zero. No runtime caller, storage, schema or route.
All outputs retain runtimeImportEnabled false. See
[contract/limits](docs/ecr/atomic-import-model.md) and
[canonical ledger](docs/remaining-tasks.md).

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

Current repair reproduced sparse rows bypassing validation and sparse history
throwing. Every array position is now checked; sparse/null/undefined entries
reject without changing prior state. 152 domain / 40 Python tests pass locally.
Require remaining lint/typecheck/baseline/build and unchanged-head CI before merge.
The pure model proves no SQL atomicity; no runtime caller or import is enabled.
No physical Android/TalkBack test or pilot occurs. No token saving measured.

## Next / gates

Publish current repair, pass CI, integrate and sync. Record final receipts in PR.
T04 still needs approved private retention, server-owned immutable stages and
isolated transactional persistence/rollback/parallelism evidence. Source and
mapping approval gate activation, not independent synthetic implementation.
T02 remains partial (registered-original positive HTTP evidence, full approved
serialization, computation/period binding). T03 needs roster provenance and
approved review/mapping workflow. PR #35 added T08 frozen headcount/pooled-percentage diagnostic and authenticated
projection/privacy checks. Preserve its new calculator, CI flag and ledger state.
T08 persistence/charts and T10 synthetic exports remain implementable work. Indicators/calendar/device/pilot and
production recovery dependencies remain; do not claim the roadmap complete.
