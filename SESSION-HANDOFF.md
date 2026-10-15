# TANAW — active checkpoint

15 October 2026. Repo: `312810-spec/project-tanaw`. Base main:
`6f9331d83a06cffcf633e5d72b15daee3ade5b74` (PR #27).
Branch: `forge/import-mapping-20261015`. Inspect current Git/PR metadata on resume.
Local implementation: `178585fa1d5461cb717a5c141ce217656269ae15`.
Publication authorization received on 15 October 2026 for pushing/syncing/commit.
Published implementation: `32701f33a94b933b3aa0e5a83baaf586b7d80888`;
its file tree exactly matches local checkpoint `685194b`. Current PR/CI metadata
governs integration status; no merge or deployment is established here.

## Outcome / active slice

B0 compact checkpoint and carryover reconciliation; first B2 synthetic
extraction/mapping slice. [Task ledger](docs/remaining-tasks.md).

Implemented: pure CO identity-mapping consistency validation, optional private
diagnostic `--mapping-review`, and synthetic OOXML → extraction → diagnostic
fixtures. Bind occupied slots explicitly to roster keys, school/class/subject/
year/term, uploaded-byte hash, template fingerprint and roster revision. No
name/row-derived identities; any error withholds all bindings. The development
bundle is not authorization or proof of roster approval.

## Rules to retain

Read `CLAUDE.md`, `AGENTS.md` and relevant `docs/operating-rules.md` sections.
All 29 [confirmed decisions](docs/confirmed-decisions-2026-10-08.md) remain.
Missing is not zero. Frozen versions/history remain immutable. Submit → Subject
review → SMEA review → independent Head review → explicit SMEA Lock → district
review. Preserve the explicit SMEA self-review exception. Runtime imports and
district acceptance remain gated; live AI is deferred; Drive is development-only.
No hosted changes or deployment are established by this checkpoint.

## Evidence

Baseline rerun on base main: 88 domain and 18 Python tests passed;
`npm run verify` passed five checks and explicitly skipped local stack
reachability because Docker is unavailable. New slice: 100 domain / 22 Python
tests, lint, typecheck, build and baseline passed (local stack still skipped).
[Mapping evidence](docs/ecr/identity-mapping.md) and current PR/CI metadata
identify publication/integration. Do not infer fresh checks from old test counts.

Preserve previously integrated PR #25 UI/recovery controls and PR #27's 405
independent synthetic expression cases. Source-policy conflict remains;
mapping consistency does not approve computation or runtime serialization.

## Pending / next

T02/T03 progressed, not finished: no app upload route, approved roster acquisition,
mapping UI/approval, private staging or atomic import RPC. T01 source/version,
T06 indicator/template, T07 calendar and T12/T14 operational gates remain.
Next B2 slice: runtime parser boundary/serialization and reviewed roster acquisition,
then staging/atomic persistence under verified source/identity contracts.
Continue independent synthetic work; activate nothing from a self-supplied bundle.
Publication prerequisite resolved by explicit user authorization. Next integration
gate: exact-head CI for the published branch before considering merge.

Offline carryover: current scoped local drafts retain pending preparation;
submission is explicit after reconnection/access refresh, never automatic. Full
offline workspace reopening and Android interruption remain unverified. Current
memo/logo provenance remains a source gate, not a new assumed feature.

Prior evidence/limits: [12 October archive](docs/session-handoff-2026-10-12-archive.md),
[blocker research](docs/intensive-blocker-research-2026-10-12.md),
[UI/UX completion](docs/forge-ui-ux-completion.md). Load only active task sections.
