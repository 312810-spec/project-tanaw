import test from "node:test";
import assert from "node:assert/strict";
import { CO_MINIMUMS, computeCoCore, transmuteCoCore } from "../app/lib/ecr-co-core.ts";

const inputs = (overrides = {}) => ({ written: [11, 13, 13, 13, 15], writtenMaxima: [15, 15, 15, 15, 15], performance: [18, 17, 18], performanceMaxima: [20, 20, 20], examination: [26, 28, 34], examinationMaxima: [30, 30, 40], weights: [0.2, 0.5, 0.3], ...overrides });

test("CO example calculates each source component without rounding", () => {
  const result = computeCoCore(inputs());
  assert.equal(result.writtenPercent, 65 / 75 * 100);
  assert.equal(result.performancePercent, 53 / 60 * 100);
  assert.equal(result.examinationPercent, 88);
  assert.equal(result.initialGrade, (65 / 75 * 100) * 0.2 + (53 / 60 * 100) * 0.5 + 88 * 0.3);
  assert.equal(result.grade, 90);
});
test("every CO boundary preserves the supplied lookup offset", () => {
  for (let index = 0; index < CO_MINIMUMS.length; index++) {
    const threshold = CO_MINIMUMS[index];
    const expected = index === 0 ? 100 : index === 40 ? null : 99 - index;
    assert.equal(transmuteCoCore(threshold), expected, `exact threshold ${threshold}`);
    if (index > 0) assert.equal(transmuteCoCore(threshold + 0.000001), 100 - index, `above ${threshold}`);
    if (index < 40) assert.equal(transmuteCoCore(threshold - 0.000001), 99 - index, `below ${threshold}`);
  }
});
test("missing scores and entered zero stay distinct", () => {
  const empty = { written: [null, null, null, null, null], performance: [null, null, null], examination: [null, null, null] };
  const missing = computeCoCore(inputs(empty));
  assert.equal(missing.initialGrade, null);
  assert.equal(missing.grade, null);
  const zero = computeCoCore(inputs({ ...empty, written: [0, null, null, null, null] }));
  assert.equal(zero.writtenPercent, 0);
  assert.equal(zero.initialGrade, 0);
  assert.equal(zero.grade, null); // Literal source IFERROR; never invent a failing grade.
});
test("partial components follow COUNT/SUM and exam subweights", () => {
  const result = computeCoCore(inputs({ written: [15, null, null, null, null], performance: [null, null, null], examination: [30, null, null] }));
  assert.equal(result.writtenPercent, 20);
  assert.equal(result.performancePercent, null);
  assert.equal(result.examinationPercent, 30);
  assert.equal(result.initialGrade, 13);
});
test("full marks yield 100 with the source's weights", () => {
  assert.equal(computeCoCore(inputs({ written: [15,15,15,15,15], performance: [20,20,20], examination: [30,30,40] })).grade, 100);
});
test("invalid raw scores, missing maxima and invalid weights fail closed", () => {
  for (const score of [-1, 16, NaN, Infinity, "11", undefined]) {
    assert.throws(() => computeCoCore(inputs({ written: [score, null, null, null, null] })), /invalid-score/);
  }
  for (const maximum of [0, null, -1, Infinity]) assert.throws(() => computeCoCore(inputs({ writtenMaxima: [maximum, 15, 15, 15, 15] })));
  for (const weights of [[0.2,0.5,0.5], [0.1,0.6,0.3], [-0.2,0.9,0.3], [NaN,0.5,0.5], [0.5,0.5]]) assert.throws(() => computeCoCore(inputs({ weights })), /invalid-component-weights/);
  assert.throws(() => computeCoCore(inputs({ examination: [30, 30] })), /invalid-input-layout/);
});
test("nonnumeric, nonfinite and out-of-range grades are never transmuted", () => {
  for (const value of [NaN, Infinity, -1, 101, "90", undefined]) assert.throws(() => transmuteCoCore(value), /invalid-initial-grade/);
});
