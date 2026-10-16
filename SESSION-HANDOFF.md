# TANAW — active checkpoint

16 October 2026 (Manila). Repo `312810-spec/project-tanaw`; base main
`882c5613450ba8bbe187ff52785bc1dc21490b28` (PRs #35–#40 merged).
Branch `forge/private-staging-contract-20261016`. Inspect live Git/PR state on resume; avoid overlap with hourly continuation.
Commits, publishing, syncing and verified integration authorized; hosted actions,
deployment and actual learner operations remain separately gated.

## Current slice

T04 proposed private-staging contract, grounded in current preview authorization,
submission history and tested synthetic transaction mechanisms. It separates
upload/stage expiry from retention of accepted originals, defines exact byte and
review bindings, recovery for object/DB partial failure, and cleanup/commit races.
No duration, disposal authority or storage approval is invented. No code, schema,
policy, credential, hosted setting or runtime gate changes. See
`docs/ecr/private-staging-contract.md`; it is a design, not implemented behavior.

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
Current slice is documentation only; verify source references/consistency and
require applicable CI before merge. No device/pilot or token-saving claim.

## Next / gates

Publish/review staging contract, pass CI, integrate/sync. Retention policy/source
inputs are pending; continue independent synthetic adapter/RLS, T11 provisioning
or T10 exports without activating runtime storage.
T04 still needs approved private retention, server-owned immutable stages and
isolated transactional persistence/rollback/parallelism evidence. Source and
mapping approval gate activation, not independent synthetic implementation.
T02 remains partial (registered-original positive HTTP evidence, full approved
serialization, computation/period binding). T03 needs roster provenance and
approved review/mapping workflow. PR #35 added T08 frozen headcount/pooled-percentage diagnostic and authenticated
projection/privacy checks. Preserve its new calculator, CI flag and ledger state.
T08 persistence/charts and T10 synthetic exports remain implementable work. Indicators/calendar/device/pilot and
production recovery dependencies remain; do not claim the roadmap complete.
