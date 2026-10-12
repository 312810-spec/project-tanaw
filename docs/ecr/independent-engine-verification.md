# Independent CO expression verification

Status: **405 synthetic cases independently recalculated**. Source-expression verification is complete within the scope below. Runtime import and a replacement source version are not approved.

Source: registered CO original SHA `c230d5b29f5d6651132bd705e16a890095e1e98353cf3a554fc319955a1c0bf6`; structural fingerprint `1baa11b3de6bc493b016a0dcd49b2f86ef49d465ec6668913b6915c83122b820`. No learner cells enter the extraction or test fixtures.

## Method and actual result

1. Extract row-18 component/lookup expressions and protected HELPER B8:D48 constants from a fingerprint-verified snapshot of the original bytes. Preserve each term's expressions separately.
2. Build a new, explicitly synthetic workbook using the Artifact Tool. Keep the original source AC expression, add a separate candidate expression in AD, and translate only row-18 references to fixture rows. Preserve original expressions in the generated source column; do not resave the approved workbook.
3. Recalculate the generated workbook with **LibreOfficeDev 26.8.0.0.alpha0**, build `2c87e51eeaa2b413ff4ae097b2705eea1995d8e5`.
4. Read the recalculated file's cached numeric/blank outputs and retain its SHA in `tests/fixtures/ecr-co-engine.json`. Compare those independently obtained results with TANAW's existing calculator using Node tests.

Per term: 124 lookup cases (all 41 thresholds, +/-0.01 where in range, blank initial grade and 100) plus eleven component profiles: missing, entered zero, written only, performance only, each examination position separately, partial components, full marks, fractional percentages and mixed missing/zero. Total: 135 × 3 = 405. Every original-source case matches TANAW. Component floating-point comparisons use 1e-12 for this synthetic regression suite; this is not a production import/cache tolerance.

The generated workbook contains no names, learner keys, school names or actual scores. Its working view was rendered and inspected; no screenshot deliverable is provided. Public fixtures contain synthetic case IDs, synthetic inputs, numeric/blank results and provenance hashes only. The approved original and private diagnostic files remain outside this public repository.

## Policy conflict and separate candidate

DO 015 s. 2026, Annex D, Table 4, printed page 37/PDF page 40 was visually inspected. Its 41 minimum-value points are recorded independently in `docs/ecr/policy-fixed-points.json`.

| Initial grade | Original CO expression and TANAW | Prescribed table | Experimental candidate |
| --- | --- | --- | --- |
| 99.50 | 100 | 100 | 100 |
| 98.32 | 98 | 99 | 99 |
| 70.00 | 74 | 75 | 75 |
| 0.00 | Blank | 60 | 60 |
| Missing initial grade | Blank | Not a recorded zero | Blank |

Forty of the 41 exact minimums conflict with the table in each term. This is independently observed workbook behavior, not an incorrect TANAW reproduction. The separately tested candidate removes the extra row offset only when the initial grade exactly matches a minimum:

```excel
=IF(AB18="","",IFERROR(INDEX(HELPER!$D$8:$D$48,IF(AB18>=HELPER!$B$8,1,MATCH(AB18,HELPER!$B$8:$B$48,-1)+IF(COUNTIF(HELPER!$B$8:$B$48,AB18)>0,0,1))),""))
```

The candidate matches all 41 official minimums for all three terms, retains the tested non-exact lookup results, preserves missing blanks and maps entered zero to 60. It is an experiment for review, not a replacement workbook or an activated app formula. Full precision between printed hundredths, subject/grade applicability, missing-score completeness, final-grade averaging/rounding, full serialization and source-version approval remain separate requirements. Historical submitted/locked evidence must keep its original computation version.

## Reproduction

Run extraction against the private original:

```bash
python scripts/prepare_ecr_engine_fixture.py /private/co.xlsx /private/new-engine-source.json
```

The builder requires the documented Artifact Tool runtime. Copy `scripts/build_ecr_engine_fixture.mjs` into a temporary working directory with the runtime-owned node_modules symlink; run it with the bundled Node, source JSON and a temporary output directory. It produces `co-synthetic.xlsx` and `cases.json`, never an approved replacement template. Recalculate into a different directory using an isolated LibreOffice profile; originals stay untouched. Collect results with:

```bash
python scripts/collect_ecr_engine_receipt.py /tmp/generated/cases.json /tmp/recalculated/co-synthetic.xlsx /tmp/new-receipt.json --engine 'exact observed engine version and build'
node --experimental-strip-types --test tests/ecr-co-engine.test.mjs
```

Do not replace the committed receipt with unrecalculated builder caches. Normal CI tests the checked-in receipt against current code; it does not claim to run LibreOffice afresh. New source/formula/lookup/engine changes require a new recalculation receipt and review. These fixtures test selected expressions and synthetic component profiles, not all 5,242 original formulas, all workbook families or Excel serialization compatibility.
