# CO private diagnostic preview

Development extraction/comparison is implemented; runtime import stays disabled.

```bash
python scripts/prepare_ecr_co_preview.py /private/co.xlsx /private/new-preview.json --term 'TERM 1'
node --experimental-strip-types scripts/inspect_ecr_co_preview.mjs /private/new-preview.json
```

Use an existing private directory outside this repository. Output must not exist; it is created with mode 0600. The JSON contains private names/scores: never attach, publish or commit it. The second command prints counts, row numbers and static codes only, never identities/scores or accepted rows. Successful inspection does not authorize import.

Preparation audits a temporary snapshot of exactly the bytes parsed against the registered CO fingerprint. The existing safe archive gate rejects external/active content, unsafe XML and unknown formula/topology/lookup serialization. Extraction additionally rejects duplicate cells, formulas in raw inputs or identities, bad shared-string indices, nonnumeric/error/boolean cells and negative/nonfinite values. Known shared/array formulas are fingerprinted, never executed or silently converted to an approved alternate family. Equivalent resaved files can fail closed.

Verified source layout: TERM 1–3 rows 18–67 reference INPUT DATA K11:K60; rows 69–118 reference N11:N60. These are 100 **name slots**, without a verified learner-key field. No learner key is invented from a name or row number. Explicit term selection extracts scores, row-15 maxima and cached AC final grades. Zero remains data, missing remains missing. Existing CO computation validates maxima/score/weight bounds. Exact final-grade comparison is diagnostic only; formula/fixture flags remain false.

## Evidence, 12 October 2026

Original SHA/fingerprint match. All three terms extracted. TERM 1 has one entered learner and 99 excluded blank slots, with no final-grade discrepancy against TANAW; identity and independent fixture gates still block import.

An unchanged disposable copy recalculated in LibreOfficeDev 26.8.0.0.alpha0 (`2c87e51eeaa2b413ff4ae097b2705eea1995d8e5`). Comparison covered L/M/R/S/W/X/Y/Z/AA/AB/AC across 100 slots and three terms: 3,300 cached cells, eleven populated numeric cells, one populated final grade, no missing/type differences. Final-grade difference zero; maximum intermediate cache difference `3.3333016347114608e-9`. Originals, private previews and recalculated copy stayed outside the repository. The engine output is not a replacement approved template.

This verifies one source example, not all independent threshold/missing/rounding fixtures, Microsoft Excel equivalence, policy compliance, an approved tolerance or CO/Division interchangeability. Literal threshold-offset and zero-to-blank behavior remains unchanged.

Remaining: approved identity and school/class/subject/period mappings; complete independent synthetic source fixtures and current policy reconciliation; runtime OOXML/registry/version support; private raw retention and atomic server imports enforcing scope, deadlines, reviews, amendments and Lock.

Seven new synthetic tests cover locators, zero/missing, invalid cell types/formulas, rich/shared strings, duplicates, private output restrictions, gated batches and malformed diagnostic log injection. Combined Python suite: sixteen tests. Fixtures contain no approved workbook or real learner data.
