import { projectFrozenResult } from "./frozen-results.ts";
import type { FrozenResultDiagnostic } from "./frozen-results.ts";

/** Development prototype only. No route, authority check or official template. */
const bindings = [
  { key: "pooled-count", label: "Synthetic participation", contractId: "00000000-0000-4000-8000-000000000001", method: "populationPercentage", decimals: 2, numeratorId: "00000000-0000-4000-8000-000000000010", denominatorId: "00000000-0000-4000-8000-000000000011" },
  { key: "recorded-zero", label: "Synthetic recorded count", contractId: "00000000-0000-4000-8000-000000000006", method: "countSum", decimals: 0, numeratorId: "00000000-0000-4000-8000-000000000012", denominatorId: null },
] as const;
type Provenance = NonNullable<FrozenResultDiagnostic["provenance"]>;
export type SyntheticExportRow = NonNullable<FrozenResultDiagnostic["result"]> & {
  binding: string; label: string; decimals: number; provenance: Provenance;
};
export type SyntheticExport = {
  schema: "tanaw-synthetic-export-v1";
  template: "synthetic-aggregate-v1";
  title: "TANAW synthetic results";
  warning: "Synthetic prototype. Not approved for official reporting.";
  status: "readyPrototypeOnly" | "unavailable";
  canPublish: false; canAcceptDistrict: false;
  issues: ("invalidBindings" | "unavailableResult" | "mixedPacket" | "mixedScope" | "mixedSnapshot")[];
  rows: SyntheticExportRow[];
};
const object = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);

/**
 * Recompute from original synthetic frozen inputs, never from supplied totals.
 * V1 binds two explicit synthetic contracts/revisions to one packet and scope.
 * On any failure release no row, subtotal, provenance or source text.
 * This is a pure formatting seam, not an authorization or persistence service.
 */
export function prepareSyntheticExport(sources: unknown): SyntheticExport {
  const out: SyntheticExport = { schema: "tanaw-synthetic-export-v1", template: "synthetic-aggregate-v1", title: "TANAW synthetic results", warning: "Synthetic prototype. Not approved for official reporting.", status: "unavailable", canPublish: false, canAcceptDistrict: false, issues: [], rows: [] };
  const fail = (issue: SyntheticExport["issues"][number]) => { out.issues = [issue]; return out; };
  if (!Array.isArray(sources) || sources.length !== bindings.length || !Array.from(sources).every(object)
      || new Set(sources.map(s => s.binding)).size !== bindings.length
      || sources.some(s => !bindings.some(b => b.key === s.binding))) return fail("invalidBindings");
  const rows: SyntheticExportRow[] = [];
  let packetKey: string | undefined, scopeKey: string | undefined, snapshotKey: string | undefined;
  for (const binding of bindings) {
    const source = sources.find(s => s.binding === binding.key)!;
    const c = source.contract;
    if (!object(c) || c.id !== binding.contractId || c.revision !== 1 || c.method !== binding.method
        || c.decimals !== binding.decimals || !object(c.numeratorDefinition) || c.numeratorDefinition.id !== binding.numeratorId
        || (binding.denominatorId === null ? c.denominatorDefinition !== null : !object(c.denominatorDefinition) || c.denominatorDefinition.id !== binding.denominatorId)
        || !object(c.partition) || c.partition.id !== "00000000-0000-4000-8000-000000000004" || c.partition.revision !== 1) return fail("invalidBindings");
    const diagnostic = projectFrozenResult(c, source.packet, source.evidence);
    if (diagnostic.status !== "readyDiagnosticOnly" || !diagnostic.result || !diagnostic.provenance) return fail("unavailableResult");
    const currentPacket = JSON.stringify([diagnostic.provenance.packetId, diagnostic.provenance.packetVersion]);
    const currentScope = JSON.stringify([c.schoolId, c.cycleId, c.schoolYear, c.period, c.partition]);
    if (packetKey !== undefined && packetKey !== currentPacket) return fail("mixedPacket");
    if (scopeKey !== undefined && scopeKey !== currentScope) return fail("mixedScope");
    // Matching IDs alone must not join different supplied snapshot bodies.
    // This bounded prototype accepts JSON-shaped inputs in identical serialization.
    const currentSnapshot = JSON.stringify([source.packet, source.evidence]);
    if (snapshotKey !== undefined && snapshotKey !== currentSnapshot) return fail("mixedSnapshot");
    packetKey = currentPacket; scopeKey = currentScope;
    snapshotKey = currentSnapshot;
    rows.push({ binding: binding.key, label: binding.label, decimals: binding.decimals,
      ...diagnostic.result, provenance: { ...diagnostic.provenance } });
  }
  out.rows = rows; out.status = "readyPrototypeOnly";
  return out;
}
