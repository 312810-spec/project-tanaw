# Approved ECR computation findings — 8 October 2026

Raw files were read from the user-approved development reference folder. Original workbooks and cached learner data remain outside this public repository. They were inspected without resaving, so workbook drawings, formatting and originals were not changed.

| Reference | CO core | Division core |
|---|---|---|
| Drive ID | 1l6OFDTh_CiELpIT_QKxp_ObSpY7E6Otv | 1WF91Fu-2gUZJZ9eK86D8DYWzs9a_jSdD |
| Inspected size | 404,255 bytes | 2,331,211 bytes |
| Formula cells | 5,242 | 32,498 |
| Term sheets | TERM 1, TERM 2, TERM 3 | TERM 1, TERM 2, TERM 3 |
| Lookup | Descending MATCH with a +1 row offset, except the highest band | Ascending VLOOKUP in learner rows |
| Cross-version reuse | Not established | Not established |

CO core SHA-256: c230d5b29f5d6651132bd705e16a890095e1e98353cf3a554fc319955a1c0bf6.
Division core SHA-256: 1f8e5684db5961336794c25c46d8bda3a6d22c39c9d34d3a0340b9aea87031cd.
These identify the inspected originals. Edited class-record uploads require a structural template fingerprint, not an exact file hash.

CO TERM 1 row 18 uses WW inputs F:J, PT inputs N:P and examination inputs T:V. Row 15 contains maxima and component weights; examination subweights are 30/30/40. AB is the initial grade; AC uses the HELPER B8:D48 transmutation table. Rows and corresponding formulas were inspected for all three terms.

The CO lookup formula uses MATCH against descending minimum thresholds and adds one to the matching row. At an exact minimum threshold below the highest band, that points to the next lower band; at zero, the next row is outside the table and IFERROR returns blank. This is a finding about the supplied formula, not an approved correction. TANAW must not silently fix, replace or reinterpret it.

Division learner row 14 uses a different transmutation table at HELPER M1:N41. Its AQ formula returns blank for missing, nonnumeric or zero initial grades. Its WW/PT formulas also include additional scoring-area calculations. Therefore the two versions have not been proven interchangeable. Do not copy computations between them merely because both are approved or cover the same subject.

Implementation consequence: keep XLSX final submission closed until each supported family's exact formula, rounding, missing-value behavior, row mapping, structural signature and boundary fixtures are verified. Show source-versus-TANAW discrepancies and reject the complete batch. Blank identities with no entered raw scores are excluded; entered zero is never treated as an empty cell. Correcting an approved workbook's formula requires an approved source/version decision, not an automatic app change.

Only two approved families have been inspected in raw form. MAPEH, EPP/TLE, GMRC/Values and SHS families still require their own verification. No family has been declared a fully supported import adapter by this document.
