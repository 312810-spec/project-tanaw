# TANAW — active checkpoint

16 October 2026 (Manila). Repo `312810-spec/project-tanaw`; base main
`4955210bb8cdd840e96a201a4283724779a5e182` (PRs #35–#41 merged).
Branch `forge/local-provisioning-tests-20261016`. Inspect live Git/PR state on resume; avoid overlap with hourly continuation.
Commits, publishing, syncing and verified integration authorized; hosted actions,
deployment and actual learner operations remain separately gated.

## Current slice

T11 isolated real Auth/membership recovery fixture. Reserve a synthetic user UUID
and operator-only journal; simulate lost Auth response, unassigned identity,
membership transaction rollback, exact retry, changed request, cross-school denial,
email collision and disabled-coordinator denial. Recovery never adopts by email
or resets password. No production endpoint, migration, journal RLS, UI or initial
coordinator provisioning. See `docs/local-account-provisioning.md`. Fresh CI
must execute this harness before any pass claim; local Docker is unavailable.

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
Current fixture syntax/lint/baseline checks are local evidence only; require real
local Auth/SQL plus full CI at the published head. No production RLS, onboarding,
email delivery, physical device/pilot or measured token saving is claimed.

## Next / gates

Publish provisioning fixture, require fresh Auth/SQL recovery and full CI,
integrate/sync. Then implement reviewed server-side reservation/authorization
and concurrency, without operational bootstrap or hosted actions.
T04 still needs approved private retention, server-owned immutable stages and
isolated transactional persistence/rollback/parallelism evidence. Source and
mapping approval gate activation, not independent synthetic implementation.
T02 remains partial (registered-original positive HTTP evidence, full approved
serialization, computation/period binding). T03 needs roster provenance and
approved review/mapping workflow. PR #35 added T08 frozen headcount/pooled-percentage diagnostic and authenticated
projection/privacy checks. Preserve its new calculator, CI flag and ledger state.
T08 persistence/charts and T10 synthetic exports remain implementable work. Indicators/calendar/device/pilot and
production recovery dependencies remain; do not claim the roadmap complete.
