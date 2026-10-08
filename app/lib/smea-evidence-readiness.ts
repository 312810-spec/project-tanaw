import type {
  IndicatorDefinition,
  IndicatorObservation,
  ObservedValue,
} from "./smea-indicators";

export type ReadinessIssueCode =
  | "definitionNotVerified"
  | "missingEvidence"
  | "mismatchedIndicator"
  | "mismatchedPeriod"
  | "nonfiniteValue"
  | "missingSourceLocator";

export interface ReadinessIssue {
  code: ReadinessIssueCode;
  indicatorCode: string;
}

export interface ReadinessResult {
  ready: boolean;
  issues: readonly ReadinessIssue[];
}

/**
 * Evidence-only readiness. It cannot certify, submit, approve, endorse, or lock.
 * It intentionally makes no claim that a definition matches official DMET fields.
 */
export function checkEvidenceReadiness(
  definition: IndicatorDefinition,
  observation: IndicatorObservation | null,
): ReadinessResult {
  const issues: ReadinessIssue[] = [];
  const add = (code: ReadinessIssueCode) =>
    issues.push({ code, indicatorCode: definition.code });

  if (definition.status !== "verified") add("definitionNotVerified");
  if (!observation || observation.value.kind === "missing") {
    add("missingEvidence");
  } else {
    if (observation.indicatorCode !== definition.code) add("mismatchedIndicator");
    if (observation.reportingPeriod !== definition.reportingPeriod) {
      add("mismatchedPeriod");
    }
    const value: ObservedValue = observation.value;
    if (
      (value.kind === "number" || value.kind === "derivedNumber") &&
      !Number.isFinite(value.value)
    ) add("nonfiniteValue");

    const sources =
      value.kind === "derivedNumber" ? value.sources : [value.evidence];
    if (sources.some((source) =>
      !source.sourceId.trim() || !source.locator.trim() || !source.documentTitle.trim()
    )) add("missingSourceLocator");
  }
  return { ready: issues.length === 0, issues };
}
