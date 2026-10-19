# Synthetic editable export contract

19 October 2026. T10 development prototype; official reporting remains gated.

## Frozen acceptance

Start from locked synthetic packet manifests, exact historical evidence versions
and synthetic result contracts, not copied dashboard totals. The pure
`prepareSyntheticExport` seam recomputes using `projectFrozenResult`, applies the
two explicit revision-1 synthetic bindings and emits only aggregate rows. All
rows must share packet ID/version and exact school/cycle/period/population scope.
Any invalid binding or unavailable result withholds the whole export. The seam
is not an authorization service and has no endpoint, database write or UI gate.

The fixed example pools 1/2 and 0/18 to 1/20 = 5.00%; its separate recorded-count
measure is numeric zero. No actual school, learner, score or official indicator
is represented. The second measure is independent, not a subtotal of the first.

| Acceptance | External check |
|---|---|
| Shared values and units | XLSX numeric cells, native PPTX table and PDF extracted text agree with the aggregate model. |
| Editable source | XLSX cells and PowerPoint table/text remain native; PDF is the fixed reading copy. |
| Provenance | Every row retains exact packet, contract and partition IDs/revisions; each format includes those references. |
| Fail closed | Missing evidence, overlap, changed bindings and mixed snapshots release no rows. |
| Privacy | Serialized export model and output packages exclude source notes, authors, submission IDs and population membership. |
| Honest status | Visible synthetic warning; canPublish and canAcceptDistrict remain false. |
| Usable output | Inspect every sheet, slide and PDF page internally; inspect exported package structure. |

## Reproduction and observed evidence

The development builder is `scripts/exports/build-synthetic-prototype.mjs`.
It requires the bundled `@oai/artifact-tool` runtime, not an npm application
dependency. Copy it into a fresh OS temporary directory and symlink that
directory's `node_modules` to `CODEX_PRIMARY_RUNTIME_NODE_MODULES`. Set
`TANAW_EXPORT_REPO` to the absolute checkout path; run the copy with
`CODEX_PRIMARY_RUNTIME_NODE --experimental-strip-types`. It creates `output/`
and `qa/` and refuses to overwrite either directory. Use a fresh directory for
each revision. No proprietary authoring engine is bundled into the web app.

Run `scripts/exports/build_synthetic_pdf.py OUTPUT_DIRECTORY` and then
`scripts/exports/verify_synthetic_outputs.py OUTPUT_DIRECTORY` with
`CODEX_PRIMARY_RUNTIME_PYTHON` (ReportLab/pypdf). The PDF builder embeds installed
DejaVu Sans fonts. The verified output hashes are retained in
`receipts/synthetic-export-2026-10-19.json`; normal CI tests the pure binding seam,
not a fresh Artifact Tool generation. Regeneration requires these authoring and
package checks plus another visual inspection.

Observed: Excel edit 1 to 2 recalculated 5% to 10%; blank numerator, blank count
and zero denominator became unavailable; restored values returned 5% and numeric
zero. Exported XLSX retains those formulas and numeric cells without formula
errors/external links. Both PowerPoint slides contain native tables and visible
synthetic warnings. The PDF has one page with the same values and references.
Every sheet/slide/page was inspected internally. The first PDF font rendering and
second slide's repeated-warning preview required repair. These are artifact
checks, not evidence of Microsoft Excel/PowerPoint edit/save/reopen behavior.

Matching packet IDs alone cannot join different supplied packet/evidence
bodies. V1 conservatively requires identical JSON serialization for those
synthetic inputs; harmless ordering differences may withhold a prototype.
Transport JSON, file/body limits and real server authorization are future
runtime concerns, not controls supplied by this pure development helper.

Approved templates and bindings, applicable dictionary/population policy,
governed projection persistence, runtime authorization and target-application
Excel/PowerPoint edit/save/reopen acceptance remain separate gates. An editable
copy can be changed after download; its provenance describes the generated
snapshot, not the truth or approval of later edits. No automatic upstream sync.
