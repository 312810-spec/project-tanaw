import type { PacketReadiness } from "@/app/lib/smea-packet-readiness";

const ISSUE_LABELS: Record<PacketReadiness["issues"][number]["code"], string> = {
  definitionNotVerified: "Indicator definition not verified",
  missingEvidence: "Source evidence missing",
  mismatchedIndicator: "Indicator reference mismatch",
  mismatchedPeriod: "Reporting period mismatch",
  nonfiniteValue: "Invalid numeric value",
  missingSourceLocator: "Source reference incomplete",
  duplicateEvidence: "Multiple evidence records require reconciliation",
  duplicateDefinition: "Duplicate indicator definitions",
};

/** Read-only preview of a packet validation result. Never represents approval. */
export function ReadinessReview({
  result,
  scopeLabel,
}: {
  result: PacketReadiness | null;
  scopeLabel: string;
}) {
  if (result === null) {
    return (
      <section aria-labelledby="readiness-title" className="rounded-xl border border-black/10 p-6 dark:border-white/15">
        <h2 id="readiness-title" className="text-lg font-semibold">Evidence review unavailable</h2>
        <p className="mt-2 text-sm text-foreground/70">
          No authorized school evidence source is connected to this review. No score,
          completion rate, or approval status has been calculated.
        </p>
      </section>
    );
  }
  return (
    <section aria-labelledby="readiness-title" className="rounded-xl border border-black/10 p-6 dark:border-white/15">
      <h2 id="readiness-title" className="text-lg font-semibold">
        Evidence readiness — {scopeLabel}
      </h2>
      <p className="mt-2 text-sm text-foreground/70">
        {result.readyIndicators} of {result.expected} indicators meet the evidence checks.
        This is not a certification, submission, district approval, or school Lock.
      </p>
      <p className="mt-3 text-sm font-medium" role="status">
        {result.ready ? "Evidence checks complete" : "Evidence requires review"}
      </p>
      {result.issues.length > 0 && (
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm">
          {result.issues.map((issue, index) => (
            <li key={issue.indicatorCode + "-" + issue.code + "-" + index}>
              <strong>{issue.indicatorCode}:</strong> {ISSUE_LABELS[issue.code]}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
