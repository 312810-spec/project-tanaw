# Explicit CO identity mapping — diagnostic slice

15 October 2026. B0 + first B2 slice; T02/T03 remain partial.

## Behavior and boundaries

`app/lib/ecr-identity-mapping.ts` validates unknown JSON before use. Every occupied
CO row (18–67/K11:K60 or 69–118/N11:N60) requires explicit mapping to a roster key.
Names and rows never create official identities. Name-only rows and entered zero
without a name remain occupied. Formula caches in empty slots create no learners.
Repeated names can map to distinct explicit keys; duplicate targets cannot pass.

School/class/subject/year/term must match the expected context for both roster
and mapping. Uploaded-byte hash and template fingerprint must match; mapping's
rosterRevision must match roster.revision. Opaque canonical IDs/revisions cannot
be empty or silently trimmed. Duplicate keys, wrong locators, malformed/bounded
arrays, unknown keys, blank-slot entries or unmapped occupied rows withhold all
bindings. Errors expose static codes and validated row numbers only.

This proves consistency, not authority. A future server must acquire context
from authenticated authorization and roster from an approved source, enforce
review/revision and byte identity, and revalidate at commit. A self-supplied
development bundle cannot establish coordinator approval or access. The pure
function is not connected to an app upload/mutation route.

## Private diagnostic

Existing diagnostic invocation remains supported. Optional mapping review:

```bash
node --experimental-strip-types scripts/inspect_ecr_co_preview.mjs \
  /private/preview.json --mapping-review /private/review.json
```

Keep both files outside the public repository, with restricted private storage
(for example mode 0600). Review JSON fields:

| Object | Required fields |
|---|---|
| context | schoolId, classId, subjectId, schoolYear, term (TERM 1/2/3) |
| roster | schema `tanaw-roster-snapshot-v1`, context object, revision, learnerKeys array |
| mapping | schema `tanaw-co-identity-map-v1`, context object, revision, rosterRevision, sourceHash, templateFingerprint, entries |
| each entry | rowNumber, identityLocator, learnerKey |

sourceHash/templateFingerprint are exact 64-character lowercase hex digests.
The roster contains at most 1,000 keys and mapping at most 100 entries. Source
layout must contain exactly the 100 distinct valid CO slots and eleven raw score
positions per slot. Executable synthetic bundles are built by
`tests/ecr_mapping_pipeline_test.py`; no real roster fixture is committed.

The CLI prints status/counts/static errors, never keys/names/scores, bindings,
accepted rows or review contents. `consistent-diagnostic-only` never means
approved/importable. Runtime import remains false even when mapping succeeds;
source-policy, approved computation-version, full runtime serialization, private
retention and atomic persistence gates remain.

## Acceptance / evidence

- Twelve domain tests cover scope dimensions, hash/version staleness, duplicates,
  repeated names, unknown keys, empty slots, missing/zero, malformed layout/JSON
  and all-or-nothing binding rejection.
- Four Python integration tests create minimal synthetic OOXML, run existing
  fingerprint/normalization and invoke the diagnostic with explicit maps. The
  positive test covers all terms and shared/inline rich-string serialization
  (six combinations), both roster blocks, zero/missing, private log boundaries
  and retained import gates. Negative tests cover stale/incomplete/malformed maps.
- These are not registered workbooks, independent engine runs, all CO
  serializations, Excel equivalence or real roster approval. Production
  preparation still requires the existing registered fingerprint.
- No dependencies, formulas, schema, records, UI or production settings changed.
  No physical-device test or deployment occurs.

Local verification: 100 domain tests and 22 Python tests passed, including the
new cases above; lint, TypeScript typecheck and production build passed.
`npm run verify`: five PASS / zero FAIL / one SKIP (Docker unavailable; local
stack reachability was not tested). The handoff archive matches base main's
original bytes. Current PR/CI metadata identifies the exact published head;
local tests do not establish authenticated integration or production readiness.
Implementation commit: `178585fa1d5461cb717a5c141ce217656269ae15`.
Automatic approval review rejected publishing this branch to the existing TANAW
repository, citing missing branch/payload/destination authorization. No remote
publication, PR, fresh CI, merge or deployment is established for this increment.
Do not substitute another publishing mechanism for the rejected action.

## Next

Complete runtime parser/registry serialization gates, approved roster acquisition
and coordinator mapping review. Then private staging/atomic commit must enforce
request identity, ownership/version, cutoff/extension/amendment and Lock. Retain
reviewed manual evidence throughout.
