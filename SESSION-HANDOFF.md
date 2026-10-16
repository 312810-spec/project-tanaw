# TANAW — active checkpoint

17 October 2026 (Manila). Repo `312810-spec/project-tanaw`; baseline main
`21541ae3c2d700e29f9f49b8b06a5c827db087c6` (PR #45 merged).
Branch `forge/auth-uncertainty-recovery-20261017`; inspect live Git/PR state
and automation work before resuming. Publishing/syncing/verified integration are
authorized. Hosted changes, deployment and actual learner operations remain gated.

## Current slice

T11 uncertain Auth reconciliation seam plus worker integration. Unknown initial
lookup never creates; definitive missing permits at most one create attempt.
Ignore create response and independently read the reserved UUID; require exact
email/trusted request/school metadata. Missing/unavailable stays pending,
conflict/ownership loss withholds identity. No email adoption, password reset,
role grant, retry loop, endpoint, credential or production activation. Worker
injects loss after actual Auth write before its existing kill/restart test.
See `docs/local-account-provisioning.md`; task ledger is canonical.

## Rules

Read AGENTS/CLAUDE, operating rules and all 29 confirmed decisions. Missing is not
zero; submitted is not approved; history is immutable. Submit → Subject → SMEA →
independent Head → explicit SMEA Lock → district review. Preserve coordinator
self-review exception, school scope and aggregate-only district visibility.
Pending roster declarations never approve identity/mapping. CO source fidelity
does not resolve policy conflict. Drive development-only; live AI deferred.

## Evidence / next

PR #43 durable reservation SQL passed CI at
`b5470485f746b843bae152f05fdc86bc421acec1` (isolated `38847271130`).
PR #44 durable real-Auth/HTTP contention/recovery passed at
`89652d7f9d54c7763d5839fedd49bbf8bb1c3e48` (isolated `38849264812`, domain
`38849264777`, public `38849264902`): 152 domain / 40 Python plus SQL/concurrency,
production build and authenticated browser. Older receipts stay in merged PRs.
PR #45 killed-process/restart and worker-exclusion fixture passed all CI at
`27abd72ef21d1c6068dcfc5636b0ef65fe2ae990` (isolated `38930026726`, domain
`38930026706`, public `38930026839`). It proves local restart, not production
fencing/network partitions. Current 8 focused recovery tests pass; require full
local checks and unchanged-head CI for revised real Auth/worker integration.
Local Docker unavailable; never count its skip as a pass. Publish/pass CI/merge/
sync. No device/pilot or measured token-saving claim. Test production ownership,
provider uncertainty and network partitions before enabling a server endpoint.

## Remaining gates

T11 still needs reviewed production worker/endpoint, onboarding, reservation and
orphan disposition, initial coordinator and authorized environment. T04 staging
design is proposed; retention/access policy, private adapter and real atomic import
integration remain. T02 approved serialization/computation/period and registered
original HTTP evidence; T03 authorized roster/class and mappings. T08 approved
result dictionary/populations and persistence/chart/district projection; T10
synthetic exports remain independent work. Calendar/indicator/source/device/pilot
and production recovery dependencies persist. Runtime imports/district acceptance
stay disabled. No roadmap-complete claim.
