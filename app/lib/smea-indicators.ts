/**
 * TANAW SMEA indicator foundation.
 *
 * This module describes evidence and review state. It does not declare that
 * any named indicator or formula is officially approved by DepEd or DMET.
 * Missing evidence is never coerced into zero.
 */
export type IndicatorStatus = "pending" | "verified" | "superseded";
export type EvidenceState = "missing" | "recorded" | "rejected";
export type ReviewState = "working" | "submitted" | "certified" | "finalized" | "endorsed" | "approved";

export interface SourceReference {
  sourceId: string;
  documentTitle: string;
  schoolYear: string;
  locator: string;
  revision?: string;
}

export interface IndicatorDefinition {
  code: string;
  label: string;
  unit: string;
  reportingPeriod: string;
  schoolYear: string;
  status: IndicatorStatus;
  source: SourceReference;
  /** Null explicitly means the formula remains unverified. */
  formula: {
    expression: string;
    numerator: string;
    denominator: string;
    rounding: string;
  } | null;
}

export type ObservedValue =
  | { kind: "missing"; reason: string }
  | { kind: "number"; value: number; evidence: SourceReference }
  | { kind: "text"; value: string; evidence: SourceReference };

export interface IndicatorObservation {
  indicatorCode: string;
  reportingPeriod: string;
  scopeId: string;
  value: ObservedValue;
  reviewState: ReviewState;
}

/** A calculation can run only after its approved formula is recorded. */
export function isCalculable(definition: IndicatorDefinition): boolean {
  return definition.status === "verified" && definition.formula !== null;
}

/** Denominators must be evidenced, finite, and strictly positive. */
export function validatedRatio(
  numerator: ObservedValue,
  denominator: ObservedValue,
): ObservedValue {
  if (numerator.kind !== "number" || denominator.kind !== "number") {
    return { kind: "missing", reason: "Source numerator or denominator is missing or nonnumeric." };
  }
  if (
    !Number.isFinite(numerator.value) ||
    !Number.isFinite(denominator.value) ||
    denominator.value <= 0
  ) {
    return { kind: "missing", reason: "Invalid numerator or denominator; no ratio generated." };
  }
  return { kind: "number", value: numerator.value / denominator.value, evidence: numerator.evidence };
}

/**
 * A display value is deliberately not an approval shortcut.
 * Validation belongs to authoritative server-side workflow transitions.
 */
export function displayObservedValue(value: ObservedValue): string {
  switch (value.kind) {
    case "missing":
      return "Missing — " + value.reason;
    case "number":
      return String(value.value);
    case "text":
      return value.value;
  }
}
