# ECR source verification checkpoint

This increment is development source verification and a pure CO-core calculator. It does not enable XLSX upload, certify school results, register a production template or alter an approved workbook. Coordinator-managed runtime registration, the XLSX parser, raw-file retention, comparison UI and atomic versioned persistence remain pending.

## Source identity and structure

`source-registry.json` catalogs the two previously inspected approved Drive originals. It contains only source IDs, hashes, protected numeric cell addresses, counts and verification states. No original workbook, learner identity, raw score or cached class record is checked in.

Run a read-only audit from the repository:

```sh
python scripts/verify_ecr_source.py co-core /path/to/co-core.xlsx
python scripts/verify_ecr_source.py division-core /path/to/division-core.xlsx
```

The CO fingerprint covers all 5,242 formula cells (including shared and array formula attributes), ordered sheet names/states, merged ranges, HELPER B8:D48, and the percentage scales/component/exam weights on row 15 of all three term sheets. Editable identities, scores, maxima and cached formula results are excluded. Altered grading constants, lookup values or formulas cannot match. Formula serialization and numeric lexical forms are deliberately conservative: an equivalent Excel resave may fail identification and require review. This algorithm is a source-audit gate, not proof that any arbitrary workbook is a valid class record. It does not approve styles, labels, reporting metadata, final-grade calculations or roster mappings.

The tool limits ZIP size, expansion and member count, rejects duplicate/path-traversal/encrypted members, DTD/entity declarations, external relationships, macros and embedded objects. It never executes formulas or follows links. Reports expose hashes, counts and status only. Synthetic fixtures verify these behaviors in CI without private references or additional dependencies.

The Division original contains **13 external-workbook link records** (`xl/externalLinks/externalLink1.xml` through `externalLink13.xml`). It is cataloged with a blocked state and no eligible structural fingerprint. Their actual calculation dependence has not been established. Do not delete links or copy CO calculations into Division. Resolve the referenced formulas and approved source decision before supporting this family.

## CO computation scope

`app/lib/ecr-co-core.ts` implements the inspected TERM 1–3 WW/PT/examination percentages, AB initial grade and AC literal lookup. It accepts five WW, three PT and three exam positions; row-15 maxima are explicit inputs. The inspected component weights are 20/50/30 and exam subweights 30/30/40. Other configurations are rejected rather than treated as equivalent approved versions. No ROUND is introduced. Empty components stay empty and contribute nothing to AB's SUM; entered zero produces an initial zero and the source's blank transmuted result.

The source's descending MATCH(-1)+1 behavior is preserved. Exact minimum thresholds below 99.5 select the next lower grade. At initial zero the selected row is outside the lookup and the formula returns blank. This is not a policy correction or an importable zero grade; the existing preview gate rejects missing grades. Negative, nonfinite, over-maximum scores, invalid layout/weights and scores with missing/nonpositive maxima are rejected before calculation.

Synthetic checks cover every one of the 41 exact thresholds and adjacent values, missing/zero distinction, partial components, full marks, invalid configuration and invalid grades. One entered-score example exists in the inspected core workbook. A local, identity-free comparison found the final grade and initial/examination results agree; WW/PT cached values are stored to eight decimal places, with maximum absolute difference 3.3333265037072124e-9 from full-precision calculation. A strict 1e-10 intermediate comparison therefore failed on two cached percentages. This observation does not establish production tolerance, complete fixture verification or an independent spreadsheet-engine recalculation. No private comparison records were committed or retained.

## Next verification gates

1. Normalize/parse OOXML safely for runtime, resolving shared/array formulas and rejecting unrecognized structure/configuration.
2. Verify identity, row, subject and reporting-period mappings for every supported sheet; compare recalculated synthetic workbook fixtures against the source formulas and presentation rounding.
3. Produce source-versus-TANAW preview with explicit discrepancies and blocked whole-batch acceptance.
4. Preserve the original file privately; authorize coordinator registration/retirement and versioned import on the server with deadline, review, Lock/amendment and access rules.

Drive remains a development reference only. No runtime Drive integration, hosted data mutation, production deployment or real-user pilot is part of this increment.
