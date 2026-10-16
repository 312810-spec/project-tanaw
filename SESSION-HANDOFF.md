# TANAW — active checkpoint

17 October 2026 (Manila). Repo `312810-spec/project-tanaw`; baseline main
`dc739da0b91b235dcb64c055fdf540f5bb897487` (PR #46 merged).
Branch `forge/provisioning-worker-claims-20261017`; inspect live Git/PR state
and automation work before resuming. Publishing/syncing/verified integration are
authorized. Hosted changes, deployment and actual learner operations remain gated.

## Current slice

T11 server-only worker claim database foundation. Private token/expiry plus
monotonic request epoch; active claim busy, successor after expiry. Service-only
claim/ownership/finish RPCs; no authenticated token reads or direct claim writes.
Claimed pending requests cannot use ordinary client completion. Finish checks
current actor, epoch/token/expiry and exact trusted Auth bindings, then commits
membership/audit/receipt with stored actor attribution. Legacy unclaimed requests
and historical receipts retain behavior. Fresh migration/SQL and real service HTTP
checks required; no worker/endpoint/credential/hosted activation.
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
fencing/network partitions. PR #46 uncertainty recovery passed all CI at
`34d7ca2877d06d37dc9a3055acaa392c50a7058a` (isolated `38976412265`, domain
`38976412202`, public `38976412169`): 160 domain / 40 Python plus real Auth,
SQL/concurrency, production build and authenticated browser. Controlled response
loss is not an actual partition. Current claim migration requires fresh CI;
local Docker/PostgreSQL unavailable. Publish/pass CI/merge/sync. Claim-specific
concurrent takeover/partition and production endpoint caller validation remain;
DB claims fence membership completion, not external Auth writes. No device/pilot
or measured token saving claimed.

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
