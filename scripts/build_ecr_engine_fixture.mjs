/** Synthetic test workbook only. Original approved workbooks are never rewritten. */
import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const [sourcePath, destination] = process.argv.slice(2);
const source = JSON.parse(await fs.readFile(sourcePath, "utf8"));
if (source.schema !== "tanaw-co-engine-source-v1" || source.helper.length !== 41 || source.terms.length !== 3) throw new Error("invalid-source-contract");
await fs.mkdir(destination, { recursive: true });
const workbook = Workbook.create();
const helper = workbook.worksheets.add("HELPER");
helper.getRange("B8:D48").values = source.helper;
helper.showGridLines = false;
const metadata = { schema: "tanaw-co-engine-cases-v1", sourceHash: source.sourceHash, structuralFingerprint: source.structuralFingerprint, terms: [] };

const syntheticInputs = (overrides = {}) => ({ written: [null,null,null,null,null], performance: [null,null,null], examination: [null,null,null],
  writtenMaxima: [15,15,15,15,15], performanceMaxima: [20,20,20], examinationMaxima: [30,30,40], weights: [0.2,0.5,0.3], ...overrides });
const components = [
  ["missing", syntheticInputs()],
  ["entered-zero", syntheticInputs({ written: [0,null,null,null,null] })],
  ["written-only", syntheticInputs({ written: [15,null,null,null,null] })],
  ["performance-only", syntheticInputs({ performance: [20,null,null] })],
  ["st1-only", syntheticInputs({ examination: [30,null,null] })],
  ["st2-only", syntheticInputs({ examination: [null,30,null] })],
  ["term-exam-only", syntheticInputs({ examination: [null,null,40] })],
  ["partial-components", syntheticInputs({ written: [15,null,null,null,null], examination: [30,null,null] })],
  ["full-marks", syntheticInputs({ written: [15,15,15,15,15], performance: [20,20,20], examination: [30,30,40] })],
  ["fractional-percentages", syntheticInputs({ written: [1,2,3,4,5], performance: [1,2,3], examination: [1,2,3] })],
  ["mixed-missing-and-zero", syntheticInputs({ written: [0,5,null,2,null], performance: [0,null,1], examination: [0,null,5] })],
];
const shift = (formula, row) => formula.replace(/(\$?[A-Z]{1,3})18\b/g, `$1${row}`);
const candidate = (formula) => {
  const anchor = "MATCH(AB18,HELPER!$B$8:$B$48,-1)+1";
  if (!formula.includes(anchor)) throw new Error("unknown-lookup-expression");
  // Reviewable experiment only: retain source expression and compare separately.
  return formula.replace(anchor, "MATCH(AB18,HELPER!$B$8:$B$48,-1)+IF(COUNTIF(HELPER!$B$8:$B$48,AB18)>0,0,1)");
};

for (const term of source.terms) {
  const sheet = workbook.worksheets.add(term.term);
  sheet.showGridLines = false;
  sheet.getRange("A2").values = [[`${term.term} · synthetic formula verification`]];
  sheet.getRange("A3").values = [["No learners, schools, records or official approvals"]];
  sheet.getRange("A2:AC170").format.font = { name: "Arial", size: 10 };
  sheet.getRange("A2").format.font = { name: "Arial", size: 14, bold: true };
  sheet.getRange("A16:E16").values = [["Case", "Kind", "Initial grade", "Source grade", "Notes"]];
  sheet.getRange("A16:E16").format = { fill: "#223047", font: { name: "Arial", size: 10, color: "#FFFFFF", bold: true } };
  sheet.getRange("A1:A170").format.columnWidth = 35;
  sheet.getRange("B1:E170").format.columnWidth = 18;
  sheet.getRange("F1:AC170").format.columnWidth = 11;
  sheet.freezePanes.freezeRows(16);
  for (const [column, value] of Object.entries(term.constants)) sheet.getRange(`${column}15`).values = [[value]];
  sheet.getRange("F15:J15").values = [[15,15,15,15,15]];
  sheet.getRange("N15:P15").values = [[20,20,20]];
  sheet.getRange("T15:V15").values = [[30,30,40]];
  sheet.getRange("K15").formulas = [["=SUM(F15:J15)"]];
  sheet.getRange("Q15").formulas = [["=SUM(N15:P15)"]];
  const cases = [];
  let row = 18;
  for (const [index, item] of source.helper.entries()) {
    for (const [side, delta] of [["below",-0.01],["exact",0],["above",0.01]]) {
      const initial = Math.round((item[0] + delta) * 100) / 100;
      if (initial < 0 || initial > 100) continue;
      cases.push({ id: `threshold-${index}-${side}`, kind: "lookup", row, initialGrade: initial });
      sheet.getRange(`A${row}:B${row}`).values = [[`threshold-${index}-${side}`, "lookup"]];
      sheet.getRange(`AB${row}`).values = [[initial]];
      sheet.getRange(`AC${row}`).formulas = [[shift(term.formulas.AC, row)]];
      sheet.getRange(`AD${row}`).formulas = [[shift(candidate(term.formulas.AC), row)]];
      sheet.getRange(`C${row}:D${row}`).formulas = [[`=AB${row}`, `=AC${row}`]];
      row++;
    }
  }
  for (const initial of [null, 100]) {
    cases.push({ id: initial === null ? "blank-initial" : "maximum-initial", kind: "lookup", row, initialGrade: initial });
    sheet.getRange(`A${row}:B${row}`).values = [[cases.at(-1).id, "lookup"]];
    if (initial !== null) sheet.getRange(`AB${row}`).values = [[initial]];
    sheet.getRange(`AC${row}`).formulas = [[shift(term.formulas.AC, row)]];
    sheet.getRange(`AD${row}`).formulas = [[shift(candidate(term.formulas.AC), row)]];
    row++;
  }
  for (const [id, inputs] of components) {
    cases.push({ id, kind: "components", row, inputs });
    sheet.getRange(`A${row}:B${row}`).values = [[id, "components"]];
    sheet.getRange(`F${row}:J${row}`).values = [inputs.written];
    sheet.getRange(`N${row}:P${row}`).values = [inputs.performance];
    sheet.getRange(`T${row}:V${row}`).values = [inputs.examination];
    for (const [column, formula] of Object.entries(term.formulas)) sheet.getRange(`${column}${row}`).formulas = [[shift(formula, row)]];
    sheet.getRange(`AD${row}`).formulas = [[shift(candidate(term.formulas.AC), row)]];
    sheet.getRange(`C${row}:D${row}`).formulas = [[`=IF(AB${row}="","",AB${row})`, `=AC${row}`]];
    row++;
  }
  metadata.terms.push({ term: term.term, candidateFormula: candidate(term.formulas.AC), cases });
}
workbook.recalculate();
await fs.writeFile(path.join(destination, "cases.json"), JSON.stringify(metadata, null, 2));
const preview = await workbook.render({ sheetName: "TERM 1", range: "A16:E23", scale: 1.5, format: "png" });
await fs.writeFile(path.join(destination, "fixture-preview.png"), new Uint8Array(await preview.arrayBuffer()));
await (await SpreadsheetFile.exportXlsx(workbook)).save(path.join(destination, "co-synthetic.xlsx"));
console.log(JSON.stringify({ status: "synthetic-workbook-created", terms: 3, casesPerTerm: metadata.terms[0].cases.length }));
