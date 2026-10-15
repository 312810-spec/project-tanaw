# TANAW — active checkpoint

15 October 2026. Repo: `312810-spec/project-tanaw`. Base main:
`55c88c6edf97da98af72fb9f96071b99c4f7a9bc` (merged PR #28).
Branch: `forge/co-byte-boundary-20261015`. Inspect current Git/PR metadata on resume.
Publishing/syncing/commit authorized by the user on 15 October.

## Outcome / current slice

T02 bounded CO extraction: `fingerprint_bytes` retains v1 digests;
`extract_co_diagnostic` audits and normalizes one immutable snapshot without
raw-workbook disk staging. The private preparation CLI now uses that boundary
and a bounded source read. Mapping pipeline tests use the shared extractor.
See [task ledger](docs/remaining-tasks.md) and
[byte evidence](docs/ecr/byte-extraction.md). No Next.js upload endpoint exists.

## Rules to retain

Read `CLAUDE.md`, `AGENTS.md` and relevant operating rules. All 29
[confirmed decisions](docs/confirmed-decisions-2026-10-08.md) remain. Missing is
not zero; preserve frozen versions and history. Submit → Subject → SMEA →
independent Head → explicit SMEA Lock → district review. Preserve SMEA self-review
exception. Runtime imports and district acceptance stay gated; AI deferred;
Drive is development-only. No hosted changes/deployment are established here.

## Verified integration

PR #28 head `1f97407683cf6331fbe551b23d61d1320f618e63` passed all three workflows:
[domain](https://github.com/312810-spec/project-tanaw/actions/runs/38702762079),
[public browser](https://github.com/312810-spec/project-tanaw/actions/runs/38702762107),
[build/SQL/authenticated browser](https://github.com/312810-spec/project-tanaw/actions/runs/38702761980).
Merged as `55c88c6`. Its 100 domain/22 Python tests and local build/lint/type/baseline
passed. New byte-slice evidence is separate; never infer its checks from PR #28.
Current byte slice: 100 domain / 30 Python tests, lint and baseline/typecheck
passed locally; local Docker reachability skipped. Exact-head CI remains required.
The historical 405 independent expression cases remain unchanged and bounded.

## Pending / next

T02/T03 partial: Next.js runtime bridge/upload route, full registered serialization,
authorized roster acquisition and coordinator mapping review remain. Mapping
consistency is not authority; never accept a client-selected source registry.
Private staging, atomic persistence, approved policy version, indicators/calendar,
exports and operational/pilot gates remain. Online-only consequential actions
cannot be replayed blindly after cutoff or access change.

Next: verify current diff and publish the scoped byte slice, require exact-head CI,
then continue the next READY task. Preserve physical Android/TalkBack and actual
TNHS pilot as unverified. Prior details: [mapping](docs/ecr/identity-mapping.md),
[12 October archive](docs/session-handoff-2026-10-12-archive.md),
[blocker research](docs/intensive-blocker-research-2026-10-12.md).
Load only active-task sections; update this checkpoint and ledger.
