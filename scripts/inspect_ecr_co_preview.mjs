/** Private development diagnostic. Never authorizes imports or prints identities. */
import { readFileSync } from "node:fs";
import { computeCoCore } from "../app/lib/ecr-co-core.ts";
import { evaluateEcrPreview } from "../app/lib/ecr-preview.ts";
import { evaluateCoIdentityMapping } from "../app/lib/ecr-identity-mapping.ts";

try {
  const args = process.argv.slice(2);
  if (args.length !== 1 && !(args.length === 3 && args[1] === "--mapping-review")) throw new Error();
  const data = JSON.parse(readFileSync(process.argv[2], "utf8"));
  if (data.schema !== "tanaw-co-diagnostic-v1" || data.family !== "co-core" || data.runtimeImportEnabled !== false || !["TERM 1", "TERM 2", "TERM 3"].includes(data.term) || !Array.isArray(data.rows) || data.rows.length !== 100) throw new Error();
  if (data.rows.some((row, index) => row.rowNumber !== (index < 50 ? 18 + index : 19 + index))) throw new Error();
  const calculationErrors = [];
  const rows = data.rows.map((row) => {
    let computedGrade = null;
    try { computedGrade = computeCoCore(row.inputs).grade; }
    catch { calculationErrors.push({ rowNumber: row.rowNumber, code: "invalid-score-or-layout" }); }
    return { rowNumber: row.rowNumber, learnerKey: row.learnerKey, learnerName: row.learnerName,
      inputScores: [...row.inputs.written, ...row.inputs.performance, ...row.inputs.examination],
      computedGrade, referenceGrade: row.referenceGrade };
  });
  let identityMapping = null;
  if (args.length === 3) {
    const review = JSON.parse(readFileSync(args[2], "utf8"));
    identityMapping = evaluateCoIdentityMapping({ context: review?.context, roster: review?.roster, mapping: review?.mapping,
      source: { sourceHash: data.sourceHash, templateFingerprint: data.templateFingerprint, term: data.term,
        rows: rows.map((row, index) => ({ rowNumber: row.rowNumber, identityLocator: data.rows[index].identityLocator,
          learnerName: row.learnerName, inputScores: row.inputScores })) } });
    const bindings = new Map(identityMapping.bindings.map((binding) => [binding.rowNumber, binding.learnerKey]));
    for (const row of rows) row.learnerKey = bindings.get(row.rowNumber) ?? null;
  }
  const preview = evaluateEcrPreview({ templateFingerprint: data.templateFingerprint, mapping: {
    templateFingerprint: data.templateFingerprint, formulaVerified: false, fixtureVerified: false,
    comparisonTolerance: 0, // Exact final-grade comparison; not an approved cache tolerance.
  }, rows });
  console.log(JSON.stringify({ status: "diagnostic-only", term: data.term, learnerCount: preview.learnerCount,
    excludedBlankRows: preview.excludedBlankRows, errors: [...calculationErrors, ...(identityMapping?.errors ?? []), ...preview.errors, { rowNumber: null, code: "source-policy-conflict" }],
    identityMapping: identityMapping ? { status: identityMapping.mappingConsistent ? "consistent-diagnostic-only" : "blocked",
      occupiedRows: identityMapping.occupiedRows, boundRows: identityMapping.bindings.length } : { status: "not-supplied" },
    canImport: false, runtimeImportEnabled: false,
    sourceExpressionFixtures: "405 independent engine cases verified; current source fails policy fixed points",
    remainingGates: ["approved-policy-consistent-source-version", "approved-learner-identity-mapping", "runtime-serialization-fixtures", "scope-period-mapping", "private-retention-and-atomic-import"] }, null, 2));
} catch {
  console.log(JSON.stringify({ error: "invalid-private-preview", canImport: false }));
  process.exitCode = 1;
}
