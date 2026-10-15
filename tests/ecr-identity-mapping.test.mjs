import test from "node:test";
import assert from "node:assert/strict";
import { evaluateCoIdentityMapping } from "../app/lib/ecr-identity-mapping.ts";

function fixture() {
  const context = { schoolId: "synthetic-school", classId: "synthetic-class", subjectId: "synthetic-subject", schoolYear: "synthetic-year", term: "TERM 1" };
  const sourceHash = "a".repeat(64), templateFingerprint = "b".repeat(64);
  const rows = Array.from({ length: 100 }, (_, index) => ({ rowNumber: index < 50 ? 18 + index : 19 + index,
    identityLocator: `INPUT DATA!${index < 50 ? "K" : "N"}${11 + index % 50}`, learnerName: index === 0 ? "PRIVATE_SYNTHETIC_NAME" : null,
    inputScores: Array.from({ length: 11 }, (_, cell) => index === 0 && cell === 0 ? 0 : null) }));
  return { context, source: { sourceHash, templateFingerprint, term: context.term, rows },
    roster: { schema: "tanaw-roster-snapshot-v1", context: { ...context }, revision: "roster-1", learnerKeys: ["PRIVATE_SYNTHETIC_KEY", "synthetic-2"] },
    mapping: { schema: "tanaw-co-identity-map-v1", context: { ...context }, sourceHash, templateFingerprint, revision: "mapping-1", rosterRevision: "roster-1",
      entries: [{ rowNumber: 18, identityLocator: "INPUT DATA!K11", learnerKey: "PRIVATE_SYNTHETIC_KEY" }] } };
}
const codes = (result) => result.errors.map((error) => error.code);
function blocked(input, code) {
  const result = evaluateCoIdentityMapping(input);
  assert.equal(result.mappingConsistent, false);
  assert.deepEqual(result.bindings, []);
  assert.ok(codes(result).includes(code), JSON.stringify(result.errors));
  assert.doesNotMatch(JSON.stringify(result.errors), /PRIVATE_SYNTHETIC/);
}

test("explicit scoped bindings preserve zero, exclude blank formula slots and do not mutate inputs", () => {
  const input = fixture(), original = structuredClone(input);
  const result = evaluateCoIdentityMapping(input);
  assert.equal(result.mappingConsistent, true);
  assert.equal(result.occupiedRows, 1);
  assert.deepEqual(result.bindings, [{ rowNumber: 18, learnerKey: "PRIVATE_SYNTHETIC_KEY" }]);
  assert.deepEqual(input, original);
  assert.equal("canImport" in result, false);
});
test("each context dimension is bound independently for both roster and mapping", () => {
  for (const target of ["roster", "mapping"]) for (const field of ["schoolId", "classId", "subjectId", "schoolYear", "term"]) {
    const input = fixture(); input[target].context[field] = field === "term" ? "TERM 2" : "another-scope";
    blocked(input, "mapping-scope-mismatch");
  }
});
test("a mapping cannot be reused after uploaded bytes, template or roster revision changes", () => {
  for (const field of ["sourceHash", "templateFingerprint"]) {
    const input = fixture(); input.mapping[field] = "c".repeat(64);
    blocked(input, "mapping-source-mismatch");
  }
  const input = fixture(); input.roster.revision = "roster-2";
  blocked(input, "stale-roster-mapping");
});
test("names and row positions never create learner keys", () => {
  const input = fixture(); input.mapping.entries = [];
  blocked(input, "unmapped-occupied-slot");
});
test("duplicate row mapping and duplicate learner mapping reject the entire batch", () => {
  const input = fixture(); input.mapping.entries.push({ ...input.mapping.entries[0] });
  blocked(input, "duplicate-mapped-row");
  const other = fixture(); other.source.rows[99].learnerName = "Synthetic same name";
  other.mapping.entries.push({ rowNumber: 118, identityLocator: "INPUT DATA!N60", learnerKey: "PRIVATE_SYNTHETIC_KEY" });
  blocked(other, "duplicate-mapped-learner");
});
test("last roster block maps independently and repeated names do not determine identity", () => {
  const input = fixture(); input.source.rows[99].learnerName = "PRIVATE_SYNTHETIC_NAME";
  input.mapping.entries.push({ rowNumber: 118, identityLocator: "INPUT DATA!N60", learnerKey: "synthetic-2" });
  const result = evaluateCoIdentityMapping(input);
  assert.equal(result.mappingConsistent, true);
  assert.equal(result.bindings.length, 2);
});
test("unknown keys, duplicate roster keys and blank-slot mappings are rejected", () => {
  const outside = fixture(); outside.mapping.entries[0].learnerKey = "foreign-key";
  blocked(outside, "learner-outside-roster");
  const duplicate = fixture(); duplicate.roster.learnerKeys.push("PRIVATE_SYNTHETIC_KEY");
  blocked(duplicate, "duplicate-roster-key");
  const blank = fixture(); blank.mapping.entries.push({ rowNumber: 19, identityLocator: "INPUT DATA!K12", learnerKey: "synthetic-2" });
  blocked(blank, "mapping-for-blank-slot");
});
test("entered zero without a name is occupied and must be explicitly mapped", () => {
  const input = fixture(); input.source.rows[0].learnerName = null; input.mapping.entries = [];
  blocked(input, "unmapped-occupied-slot");
});
test("named slot without scores is occupied, not silently discarded", () => {
  const input = fixture(); input.source.rows[0].inputScores.fill(null); input.mapping.entries = [];
  blocked(input, "unmapped-occupied-slot");
});
test("empty workbooks and malformed source row shapes fail closed", () => {
  const empty = fixture(); empty.source.rows[0].learnerName = null; empty.source.rows[0].inputScores.fill(null); empty.mapping.entries = [];
  blocked(empty, "empty-roster");
  for (const change of [row => { row.rowNumber = 68; }, row => { row.identityLocator = "INPUT DATA!N11"; }, row => { row.inputScores = []; }, row => { row.inputScores[0] = NaN; }, row => { row.learnerName = {}; }]) {
    const input = fixture(); change(input.source.rows[0]); blocked(input, "invalid-source-layout");
  }
  const duplicate = fixture(); duplicate.source.rows[1] = { ...duplicate.source.rows[0] }; blocked(duplicate, "invalid-source-layout");
});
test("invalid entries and unnormalized identifiers cannot leak user text into errors", () => {
  for (const entry of [null, { rowNumber: "PRIVATE_SYNTHETIC_ROW" }, { rowNumber: 18, identityLocator: "PRIVATE_SYNTHETIC_LOCATOR", learnerKey: "synthetic-2" },
    { rowNumber: 18, identityLocator: "INPUT DATA!K11", learnerKey: " PRIVATE_SYNTHETIC_KEY " }]) {
    const input = fixture(); input.mapping.entries = [entry]; blocked(input, "invalid-mapping-entry");
  }
});
test("malformed JSON structures and unbounded arrays return static errors", () => {
  for (const input of [null, [], {}, { context: [] }]) blocked(input, "invalid-mapping-bundle");
  const descriptor = fixture(); descriptor.source.term = "TERM 2"; blocked(descriptor, "invalid-source-descriptor");
  const hash = fixture(); hash.source.sourceHash = "PRIVATE_SYNTHETIC_HASH"; blocked(hash, "invalid-source-descriptor");
  const roster = fixture(); roster.roster.learnerKeys = Array(1001).fill("synthetic"); blocked(roster, "invalid-roster-snapshot");
  const map = fixture(); map.mapping.entries = Array(101).fill(map.mapping.entries[0]); blocked(map, "invalid-identity-map");
});
