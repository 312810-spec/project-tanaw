import type { IndicatorDefinition, IndicatorObservation } from "./smea-indicators";
import { checkEvidenceReadiness, type ReadinessIssue } from "./smea-evidence-readiness";

export interface PacketReadiness {
  ready: boolean;
  expected: number;
  readyIndicators: number;
  issues: readonly ReadinessIssue[];
}

/**
 * Read-only, evidence-only projection. Never changes lifecycle state.
 * A missing observation or duplicate definition is not silently ignored.
 */
export function checkPacketReadiness(
  definitions: readonly IndicatorDefinition[],
  observations: readonly IndicatorObservation[],
  scopeId: string,
): PacketReadiness {
  const issues: ReadinessIssue[] = [];
  let readyIndicators = 0;

  for (const definition of definitions) {
    const matching = observations.filter(
      (o) =>
        o.scopeId === scopeId &&
        o.indicatorCode === definition.code &&
        o.reportingPeriod === definition.reportingPeriod,
    );
    if (matching.length !== 1) {
      issues.push({
        code: matching.length === 0 ? "missingEvidence" : "duplicateEvidence",
        indicatorCode: definition.code,
      });
      continue;
    }
    const result = checkEvidenceReadiness(definition, matching[0]);
    issues.push(...result.issues);
    if (result.ready) readyIndicators += 1;
  }

  const distinctDefinitions = new Set(
    definitions.map((d) => JSON.stringify([d.code, d.reportingPeriod, d.schoolYear])),
  );
  if (distinctDefinitions.size !== definitions.length) {
    issues.push({ code: "duplicateDefinition", indicatorCode: "*" });
  }
  return {
    ready: definitions.length > 0 && issues.length === 0,
    expected: definitions.length,
    readyIndicators,
    issues,
  };
}
