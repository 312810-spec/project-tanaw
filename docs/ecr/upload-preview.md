# App-side diagnostic file adapter

15 October 2026. Base main `bb78437e060766cbb824b49bd36c47481f2b80d3`.

UI continuation: the owned Teacher/SMEA file-check panel and boolean capability
GET are described in `docs/ecr/file-check-ui.md`. Its configured capability flag
is not authorization or interpreter health. Historical no-picker statements
below describe the initial adapter increment, not the later UI addition.

## Behavior

`POST /api/ecr/preview?submission=<UUID>&term=TERM%201` accepts one raw XLSX
body with `application/octet-stream` or the XLSX MIME type. It is diagnostic
only: no original is retained, no evidence/version is created, and imports stay
disabled. A recognized source returns row-slot/occupied/blank counts and the
uploaded-byte hash. It does not return identities, scores, rows or calculated
grades. `computationComparison: not-performed` is explicit. An unknown or malformed
file returns a static rejection. There is no file-picker UI in this increment.

The endpoint uses Next's Node runtime to invoke the existing Python extractor
through stdin, without a shell, disk staging or inherited application secrets.
The worker uses the deployed trusted registry, never a client-selected contract.
The source-policy conflict and approved computation/mapping/period/retention/
atomic-import gates are not resolved by recognizing a template.

## Access and bounded execution

- Exact configured Origin, UUID/term, content type and encoding are validated.
- A fresh Supabase user check and RLS-governed queries require ownership of the
  selected assignment and active school membership: SMEA Coordinator, or teacher
  with that subject. District and school-wide readers of another author's slot
  cannot preview through this endpoint. No privileged key is used.
- Access is checked again after extraction, so revocation/handover withholds the
  summary. This read-only double-check is not atomic import authorization.
- Body limit: 32 MiB even without Content-Length; body deadline: 30 seconds.
  At most two in-process upload/parser operations run concurrently. Worker limit:
  15 seconds / 16 KiB stdout, with stderr suppressed and output allowlisted.
- Responses use `no-store, private`; failures never echo filenames, paths, raw
  errors, executable details, identities or scores. Unexpected worker output is
  unavailable, never accepted evidence.

Limits are per process and do not replace host/network-wide rate limits, upload
limits or worker resource isolation. The host may impose a smaller file limit.
This endpoint's in-memory preview does not satisfy original-file retention for
an eventual accepted import.

## Explicit runtime capability

Default: `TANAW_ECR_PREVIEW_ENABLED=0`. To enable in an authorized environment,
install Python and set server-only `TANAW_ECR_PREVIEW_ENABLED=1`, a trusted absolute
`TANAW_ECR_PYTHON` executable path, and exact `TANAW_APP_ORIGIN` (no trailing path).
Next tracing includes the worker, library scripts and registry. It does not
bundle/install Python. A Node host without Python must keep this feature off;
no production host capability or deployment is claimed. The child uses Python
isolated mode and a minimal environment. Do not expose these settings to clients.

## Verification and limits

Thirteen domain tests cover capability/origin/auth rejection without body reads,
ownership recheck, invalid targets/types/size, chunked size cancellation, empty/
stalled/disconnected streams, safe summaries/errors, concurrency release, an actual isolated
Python rejection, and invalid/aborted bridge startup. Existing byte extraction
and mapping suites cover synthetic recognized layouts across all terms.

Authenticated CI adds actual HTTP tests for anonymous/unknown/non-owner/district/
disabled denial and an authorized upload reaching the real fixed-registry Python
gate. It asserts file checks leave submission versions unchanged. Public browser
CI checks disabled capability. No approved private workbook is committed as a
fixture; full positive HTTP recognition of the registered original remains
unverified. Positive summary contracts use unit test doubles, not runtime mocks.

T02 remains PARTIAL: teacher file-picker/result UI, complete serialization,
registered original acceptance evidence, authorized roster acquisition/review and
source-to-period binding remain; T04 staging/atomic persistence follows later.
No source formula, official record, migration, dependency or hosted setup changed.
Actual local/exact-head CI results are recorded in the checkpoint/current PR.

Local verification: 113 domain/worker tests, 30 Python tests, lint, baseline/
typecheck and production build passed. All five required worker/registry files
are present in the route's build trace. Local database reachability was explicitly
skipped because Docker is unavailable; actual HTTP authorization awaits isolated
CI. The fast workflow now sets up Python before domain/worker tests.
