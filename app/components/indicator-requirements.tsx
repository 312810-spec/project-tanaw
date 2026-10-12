"use client";

import { useState, type FormEvent } from "react";
import { clearFormDirty } from "@/app/components/unsaved-work";

export function IndicatorRequirements({ definitions, required, revision, busy, onSave }: {
  definitions: { id: string; label: string }[]; required: string[] | null; revision: number;
  busy: boolean; onSave: (ids: string[], reason: string, expectedRevision: number) => Promise<boolean>;
}) {
  const [chosen, setChosen] = useState(required ?? []);
  const [sourceRevision, setSourceRevision] = useState(revision);
  const [reason, setReason] = useState("");
  const conflict = sourceRevision !== revision;
  const label = (id: string) => definitions.find((definition) => definition.id === id)?.label ?? id;
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || conflict || !chosen.length || !reason.trim()) return;
    const element = event.currentTarget;
    if (await onSave(chosen, reason.trim(), sourceRevision)) { clearFormDirty(element); setSourceRevision(sourceRevision + 1); setReason(""); }
  }
  return <details><summary className="cursor-pointer text-sm font-medium">Configure this assignment’s required indicators</summary>
    <form className="mt-3 space-y-3" onSubmit={save}>
      <p className="text-sm">Choose requirements from the verified period registry. Changes invalidate earlier packet snapshots and need fresh packet reviews.</p>
      {conflict && <div role="status" className="space-y-2 rounded-lg border border-foreground/30 p-3 text-sm"><p>Requirements changed since you started. Current: {(required ?? []).map(label).join(", ") || "Not configured"}. Your unsent selection: {chosen.map(label).join(", ") || "None"}.</p><button type="button" className="underline" disabled={busy} onClick={() => setSourceRevision(revision)}>I compared both selections; use my draft against the current revision</button></div>}
      {definitions.map((definition) => <label key={definition.id} className="flex gap-2 text-sm"><input type="checkbox" value={definition.id} checked={chosen.includes(definition.id)} disabled={busy} onChange={(event) => setChosen(event.target.checked ? [...chosen, definition.id] : chosen.filter((id) => id !== definition.id))} />{definition.label}</label>)}
      <label className="block text-sm">Reason<textarea required maxLength={2000} value={reason} disabled={busy} onChange={(event) => setReason(event.target.value)} className="w-full rounded-lg border border-foreground/20 bg-background p-3 text-sm" /></label>
      <button disabled={busy || conflict || !chosen.length} className="rounded-lg border border-brand px-4 py-2 text-sm text-brand disabled:opacity-50">Save indicator requirements</button>
    </form>
  </details>;
}
