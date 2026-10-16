# TANAW — active checkpoint

16 October 2026 (Manila). Repo `312810-spec/project-tanaw`; base main
`88f4df724b99b0b6be814db6b1c969de40241106` (PRs #35–#42 merged).
Branch `forge/provisioning-journal-20261016`. Inspect live Git/PR state on resume; avoid overlap with hourly continuation.
Commits, publishing, syncing and verified integration authorized; hosted actions,
deployment and actual learner operations remain separately gated.

## Current slice

T11 durable reservation/completion database foundation: initiating-coordinator RLS,
server-generated Auth UUID, exact canonical request binding and trusted Auth
app-metadata verification. Completion calls existing revision-checked membership
RPC and commits membership/audit/receipt together. Replay preserves later access
changes. Actor membership locks align with access-management keys. No Auth admin
endpoint, worker, UI, credential, bootstrap or hosted migration. Fresh migration
and rollback-only SQL tests require isolated CI. See `docs/local-account-provisioning.md`.

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
PR #39 SQL fixture merged with all CI green (`38843263546`). PR #40 parallel
fixture passed four multi-session scenarios and all CI at
`ddb6de721870a7d3c116be587219714e72cf3981` (isolated `38843995090`, domain
`38843995285`, public `38843995238`). This includes 152 domain / 40 Python tests.
Those receipts verify fixture mechanisms, not production RLS/retention/imports.
PR #41 staging design merged after all CI passed (isolated `38844617590`).
PR #42 real local Auth recovery fixture merged; all CI passed at
`8d98d447019fb817e7bac34f85b922f58c4efde3` (isolated `38845760426`).
Current migration/SQL require fresh isolated CI; local lint/typecheck/baseline only. Require real
local Auth/SQL plus full CI at the published head. No production RLS, onboarding,
email delivery, physical device/pilot or measured token saving is claimed.

## Next / gates

Publish journal foundation, require fresh migration/SQL authorization and full CI,
integrate/sync. Then connect the real-Auth harness to durable RPCs and test their multi-session
races/process restart before implementing a server endpoint. No operational bootstrap or hosted actions.
T04 still needs approved private retention, server-owned immutable stages and
isolated transactional persistence/rollback/parallelism evidence. Source and
mapping approval gate activation, not independent synthetic implementation.
T02 remains partial (registered-original positive HTTP evidence, full approved
serialization, computation/period binding). T03 needs roster provenance and
approved review/mapping workflow. PR #35 added T08 frozen headcount/pooled-percentage diagnostic and authenticated
projection/privacy checks. Preserve its new calculator, CI flag and ledger state.
T08 persistence/charts and T10 synthetic exports remain implementable work. Indicators/calendar/device/pilot and
production recovery dependencies remain; do not claim the roadmap complete.
