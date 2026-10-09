"use client";

import { useEffect, useState, type FormEvent } from "react";
import { clearFormDirty } from "@/app/components/unsaved-work";
import { decodeDraft, draftKey, emptyDraft, preserveUnreadableDraft, type DraftScope, type EvidenceDraft } from "@/app/lib/submission-drafts";

const input = "w-full min-w-0 rounded-lg border border-foreground/20 bg-background p-3 text-sm";
export function ManualEvidenceForm({ scope, version, definitions, recordedEntries = [], canSubmit = true, eligibility, busy, onSubmit }: {
  scope: DraftScope; version: number; definitions: { id: string; label: string; unit: string }[];
  recordedEntries?: { definitionId: string; value: number; sourceTitle: string; sourceLocator: string }[]; canSubmit?: boolean; eligibility?: string;
  busy: boolean; onSubmit: (fields: EvidenceDraft) => Promise<boolean>;
}) {
  const [fields, setFields] = useState<EvidenceDraft>(emptyDraft);
  const [draftVersion, setDraftVersion] = useState(version);
  const [loaded, setLoaded] = useState(false);
  const [unreadable, setUnreadable] = useState<string | null>(null);
  const [recovery, setRecovery] = useState<string | null>(null);
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
        else { setUnreadable(raw); setMessage(raw ? "This device draft cannot be read. Editing is paused to protect the original." : "Drafts save on this device as you type."); }
        setRecovery(localStorage.getItem(key + ":unreadable"));
      } catch { setMessage("Device storage is unavailable. Keep this page open to preserve unsent edits."); }
      setLoaded(true);
    });
    return () => { cancelled = true; };
  }, [key, scope]);
  function persist(next: EvidenceDraft, sourceVersion: number) {
    if (unreadable !== null) return;
    try { localStorage.setItem(key, JSON.stringify({ schema: 1, scope, sourceVersion, fields: next })); setMessage(navigator.onLine ? "Device draft saved. Submission requires your review." : "Offline draft saved. Submit after reconnecting and refreshing access."); }
    catch { setMessage("Device save failed. Unsent edits remain in this open page."); }
  }
  function change(field: keyof EvidenceDraft, value: string) {
    const next = { ...fields, [field]: value };
    setFields(next); persist(next, draftVersion);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    if (!canSubmit || !loaded || busy || unreadable !== null || draftVersion !== version) return;
    if (!navigator.onLine) { persist(fields, draftVersion); return; }
    if (await onSubmit(fields)) {
      clearFormDirty(formElement); setFields(emptyDraft); setDraftVersion(version + 1);
      try { localStorage.removeItem(key); setMessage("Submission recorded; working device draft cleared. The retained recovery copy, if any, remains available."); } catch { setMessage("Submission recorded; the device draft could not be cleared."); }
    }
  }
  function chooseIndicator(id: string) {
    if (fields.definition && fields.definition !== id && (fields.value || fields.sourceTitle || fields.sourceLocator) && !window.confirm("Switch indicators and replace the current entry fields with the selected recorded evidence? Cancel to keep these unsent edits.")) return;
    const entry = recordedEntries.find((entry) => entry.definitionId === id);
    const next = { ...fields, definition: id, value: entry ? String(entry.value) : "", sourceTitle: entry?.sourceTitle ?? "", sourceLocator: entry?.sourceLocator ?? "" };
    setFields(next); persist(next, draftVersion);
  }
  const original = recordedEntries.find((entry) => entry.definitionId === fields.definition);
  function download(raw: string) {
    const url = URL.createObjectURL(new Blob([raw], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "TANAW-unreadable-draft.txt"; link.click(); URL.revokeObjectURL(url);
  }
  return <form onSubmit={submit} className="space-y-3">
    <p className="text-sm text-foreground/65">Manual entry is for indicators without a class-record spreadsheet source. Class-record uploads remain unavailable while approved computations are being verified.</p>
    <p role="status" aria-live="polite" className="text-sm">{message}</p>
    {unreadable !== null && <div className="space-y-3 rounded-lg border border-foreground/30 p-3 text-sm"><p>Download the original for recovery. Starting a new draft requires a verified retained copy; no submission will be sent automatically.</p><button type="button" className="underline" onClick={() => download(unreadable)}>Download unreadable original</button><button type="button" className="ml-3 underline" disabled={busy} onClick={() => {
      try { preserveUnreadableDraft(localStorage, key, unreadable); setRecovery(unreadable); setUnreadable(null); setFields(emptyDraft); setDraftVersion(version); setMessage("Original retained separately on this device. You can prepare a new draft."); }
      catch { setMessage("Could not retain a recovery copy. The original remains protected; download it before contacting support."); }
    }}>Retain original and start a new draft</button></div>}
    {recovery !== null && <button type="button" className="text-sm underline" onClick={() => download(recovery)}>Download retained recovery copy</button>}
    {eligibility && <p className="text-sm">{eligibility}</p>}
    {original && <p className="break-words text-sm">Correction review · Recorded: {original.value} · Proposed: {fields.value || "not entered"}<br />Recorded source: {original.sourceTitle} · {original.sourceLocator}<br />Proposed source: {fields.sourceTitle} · {fields.sourceLocator}. Submitting preserves the old version and requires new reviews.</p>}
    {definitions.length === 0 && <p className="text-sm">No verified indicators are available for this reporting period. Ask your SMEA Coordinator to verify the indicator registry. Unsent edits remain available here.</p>}
    {loaded && draftVersion !== version && <div className="space-y-2 rounded-lg border border-gold/50 p-3 text-sm"><p>This draft started from version {draftVersion}; the last verified view shows version {version}. Compare the current evidence before using these edits.</p><button type="button" disabled={busy} className="underline" onClick={() => { setDraftVersion(version); persist(fields, version); }}>I reviewed current evidence; use this draft for the current version</button></div>}
    <fieldset disabled={busy || !loaded || unreadable !== null} className="space-y-3">
      <label className="block text-sm">Verified indicator<select name="definition" className={input} required value={fields.definition} onChange={(event) => chooseIndicator(event.target.value)}><option value="">Select an indicator</option>{definitions.map((definition) => <option key={definition.id} value={definition.id}>{definition.label} ({definition.unit})</option>)}</select></label>
      <label className="block text-sm">Recorded value<input name="value" type="number" step="any" required className={input} value={fields.value} onChange={(event) => change("value", event.target.value)} /></label>
      <label className="block text-sm">Evidence title<input name="sourceTitle" required maxLength={200} className={input} value={fields.sourceTitle} onChange={(event) => change("sourceTitle", event.target.value)} /></label>
      <label className="block text-sm">Evidence location or reference<input name="sourceLocator" required maxLength={1000} className={input} value={fields.sourceLocator} onChange={(event) => change("sourceLocator", event.target.value)} /></label>
      <label className="block text-sm">Reason for submission or correction<textarea name="reason" required maxLength={2000} className={input} value={fields.reason} onChange={(event) => change("reason", event.target.value)} /></label>
      <button className="rounded-lg border border-brand px-4 py-2 text-sm text-brand disabled:opacity-50" disabled={!canSubmit || draftVersion !== version || definitions.length === 0}>Submit a new evidence version</button>
    </fieldset>
  </form>;
}
