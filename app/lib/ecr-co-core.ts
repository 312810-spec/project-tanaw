/** CO core only: source c230d5b…bf6, TERM 1–3. No formula repair or rounding. */
export const CO_MINIMUMS = [99.5, 98.32, 97.14, 95.96, 94.78, 93.6, 92.42, 91.24, 90.06, 88.88, 87.7, 86.52, 85.34, 84.16, 82.98, 81.8, 80.62, 79.44, 78.26, 77.08, 75.9, 74.72, 73.54, 72.36, 71.18, 70, 65.34, 60.67, 56.01, 51.34, 46.67, 42.01, 37.34, 32.68, 28.01, 23.35, 18.68, 14.01, 9.35, 4.68, 0] as const;

/** Literal INDEX/MATCH(-1)+1 behavior, including exact-threshold and zero blanks. */
export function transmuteCoCore(initialGrade: number | null): number | null {
  if (initialGrade === null) return null;
  if (!Number.isFinite(initialGrade) || initialGrade < 0 || initialGrade > 100) throw new Error("invalid-initial-grade");
  if (initialGrade >= CO_MINIMUMS[0]) return 100;
  // Descending MATCH finds the last minimum >= input, then INDEX advances one row.
  let matched = 0;
  for (let index = 0; index < CO_MINIMUMS.length; index++) {
    if (CO_MINIMUMS[index] >= initialGrade) matched = index;
  }
  const selected = matched + 1;
  return selected < CO_MINIMUMS.length ? 100 - selected : null;
}

type Score = number | null;
export type CoCoreInputs = {
  written: Score[]; performance: Score[]; examination: Score[];
  writtenMaxima: Score[]; performanceMaxima: Score[]; examinationMaxima: Score[];
  weights: [number, number, number];
};
export type CoCoreResult = {
  writtenPercent: number | null; performancePercent: number | null; examinationPercent: number | null;
  initialGrade: number | null; grade: number | null;
};
const sum = (values: Score[]) => values.reduce<number>((total, value) => total + (value ?? 0), 0);
const entered = (values: Score[]) => values.some((value) => value !== null);

/** Validated raw inputs; formula-empty components contribute nothing to AB's SUM. */
export function computeCoCore(input: CoCoreInputs): CoCoreResult {
  const groups = [input.written, input.performance, input.examination];
  const maxima = [input.writtenMaxima, input.performanceMaxima, input.examinationMaxima];
  const widths = [5, 3, 3];
  for (let group = 0; group < groups.length; group++) {
    if (groups[group].length !== widths[group] || maxima[group].length !== widths[group]) throw new Error("invalid-input-layout");
    for (let index = 0; index < widths[group]; index++) {
      const score = groups[group][index], maximum = maxima[group][index];
      if (maximum !== null && (!Number.isFinite(maximum) || maximum < 0)) throw new Error("invalid-maximum");
      if (score !== null && (!Number.isFinite(score) || score < 0 || maximum === null || maximum <= 0 || score > maximum)) throw new Error("invalid-score-or-maximum");
    }
  }
  if (input.weights.length !== 3 || input.weights.some((weight, index) => weight !== [0.2, 0.5, 0.3][index])) throw new Error("invalid-component-weights");
  const writtenPercent = entered(input.written) ? sum(input.written) / sum(input.writtenMaxima) * 100 : null;
  const performancePercent = entered(input.performance) ? sum(input.performance) / sum(input.performanceMaxima) * 100 : null;
  // W/X/Y use the reference's 30/30/40 subweights. Missing exams stay blank.
  const examinationPercent = entered(input.examination) ? sum(input.examination.map((score, index) => score === null ? null : score / input.examinationMaxima[index]! * [30, 30, 40][index])) : null;
  const initialGrade = groups.some(entered) ? (writtenPercent ?? 0) * input.weights[0] + (performancePercent ?? 0) * input.weights[1] + (examinationPercent ?? 0) * input.weights[2] : null;
  return { writtenPercent, performancePercent, examinationPercent, initialGrade, grade: transmuteCoCore(initialGrade) };
}
