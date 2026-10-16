# TANAW — active checkpoint

17 October 2026 (Manila). Repo `312810-spec/project-tanaw`; baseline main
`a980aa3187b1bfd2e3cc46dd49bda3a66221c8bf` (PR #44 merged).
Branch `forge/provisioning-worker-restart-20261017`; inspect live Git/PR state
and automation work before resuming. Publishing/syncing/verified integration are
authorized. Hosted changes, deployment and actual learner operations remain gated.

## Current slice

T11 local subprocess coordination/restart fixture. A generated request and actor
bearer token pass through stdin only. A local DB session lock prevents a second
worker from creating/completing the same identity. Kill the first Node process
after Auth creation; observe DB-session release; start a new process to recover
the durable reservation/Auth identity and complete once; replay in another
process. Assert one membership revision/audit. Cleanup generated identities,
including those created before a failed status marker. No production worker,
lease/fencing, endpoint, credential file, onboarding or hosted configuration.
See `docs/local-account-provisioning.md` and canonical `docs/remaining-tasks.md`.

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
Current subprocess fixture needs fresh isolated CI; local Docker is unavailable.
Publish/pass unchanged-head CI/integrate/sync. No device/pilot or token-saving
claim. Test network partitions, production worker ownership/fencing and uncertain
Auth outcomes before enabling a server endpoint; current session lock is local
fixture coordination only.

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
