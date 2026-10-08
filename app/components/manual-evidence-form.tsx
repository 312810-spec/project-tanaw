"use client";

import { useEffect, useState, type FormEvent } from "react";
import { decodeDraft, draftKey, emptyDraft, type DraftScope, type EvidenceDraft } from "@/app/lib/submission-drafts";

const input = "w-full min-w-0 rounded-lg border border-foreground/20 bg-background p-3 text-sm";
export function ManualEvidenceForm({ scope, version, definitions, busy, onSubmit }: {
  scope: DraftScope; version: number; definitions: { id: string; label: string; unit: string }[];
  busy: boolean; onSubmit: (fields: EvidenceDraft) => Promise<boolean>;
}) {
  const [fields, setFields] = useState<EvidenceDraft>(emptyDraft);
  const [draftVersion, setDraftVersion] = useState(version);
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState("Checking saved draft…");
  const key = draftKey(scope);
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      try {
        const raw = localStorage.getItem(key);
        const saved = decodeDraft(raw, scope);
        if (saved) { setFields(saved.fields); setDraftVersion(saved.sourceVersion); setMessage("Device draft restored. Review it before submitting."); }
        else { setMessage(raw ? "Saved draft could not be read. It has been preserved on this device." : "Drafts save on this device as you type."); }
      } catch { setMessage("Device storage is unavailable. Keep this page open to preserve unsent edits."); }
      setLoaded(true);
    });
    return () => { cancelled = true; };
  }, [key, scope]);
  function persist(next: EvidenceDraft, sourceVersion: number) {
    try { localStorage.setItem(key, JSON.stringify({ schema: 1, scope, sourceVersion, fields: next })); setMessage(navigator.onLine ? "Device draft saved. Submission requires your review." : "Offline draft saved. Submit after reconnecting and refreshing access."); }
    catch { setMessage("Device save failed. Unsent edits remain in this open page."); }
  }
  function change(field: keyof EvidenceDraft, value: string) {
    const next = { ...fields, [field]: value };
    setFields(next); persist(next, draftVersion);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!loaded || busy || draftVersion !== version) return;
    if (!navigator.onLine) { setMessage("Offline draft retained. Reconnect and refresh before submitting."); return; }
    if (await onSubmit(fields)) {
      try { localStorage.removeItem(key); } catch { setMessage("Submission recorded; the device draft could not be cleared."); }
    }
  }
  return <form onSubmit={submit} className="space-y-3">
    <p className="text-sm text-foreground/65">Manual entry is for indicators without a class-record spreadsheet source. Class-record uploads remain unavailable while approved computations are being verified.</p>
    <p role="status" aria-live="polite" className="text-sm">{message}</p>
    {loaded && draftVersion !== version && <div className="space-y-2 rounded-lg border border-gold/50 p-3 text-sm"><p>This draft started from version {draftVersion}; the server now has version {version}. Compare the current evidence before using these edits.</p><button type="button" disabled={busy} className="underline" onClick={() => { setDraftVersion(version); persist(fields, version); }}>I reviewed current evidence; use this draft for the current version</button></div>}
    <fieldset disabled={busy || !loaded} className="space-y-3">
      <label className="block text-sm">Verified indicator<select name="definition" className={input} required value={fields.definition} onChange={(event) => change("definition", event.target.value)}><option value="">Select an indicator</option>{definitions.map((definition) => <option key={definition.id} value={definition.id}>{definition.label} ({definition.unit})</option>)}</select></label>
      <label className="block text-sm">Recorded value<input name="value" type="number" step="any" required className={input} value={fields.value} onChange={(event) => change("value", event.target.value)} /></label>
      <label className="block text-sm">Evidence title<input name="sourceTitle" required maxLength={200} className={input} value={fields.sourceTitle} onChange={(event) => change("sourceTitle", event.target.value)} /></label>
      <label className="block text-sm">Evidence location or reference<input name="sourceLocator" required maxLength={1000} className={input} value={fields.sourceLocator} onChange={(event) => change("sourceLocator", event.target.value)} /></label>
      <label className="block text-sm">Reason for submission or correction<textarea name="reason" required maxLength={2000} className={input} value={fields.reason} onChange={(event) => change("reason", event.target.value)} /></label>
      <button className="rounded-lg border border-brand px-4 py-2 text-sm text-brand disabled:opacity-50" disabled={draftVersion !== version || definitions.length === 0}>Submit a new evidence version</button>
    </fieldset>
  </form>;
}
