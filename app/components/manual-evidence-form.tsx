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
  const [errors, setErrors] = useState<Partial<Record<keyof EvidenceDraft, string>>>({});
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
    setErrors((old) => ({ ...old, [field]: undefined }));
    const next = { ...fields, [field]: value };
    setFields(next); persist(next, draftVersion);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    if (!canSubmit || !loaded || busy || unreadable !== null || draftVersion !== version) return;
    const invalid: Partial<Record<keyof EvidenceDraft, string>> = {};
    if (!definitions.some((definition) => definition.id === fields.definition)) invalid.definition = "Choose an available verified indicator.";
    if (!fields.value.trim() || !Number.isFinite(Number(fields.value))) invalid.value = "Enter the recorded numeric value. Zero is valid; missing evidence is not zero.";
    for (const [field, limit] of [["sourceTitle", 200], ["sourceLocator", 1000], ["reason", 2000]] as const) {
      if (!fields[field].trim() || fields[field].length > limit) invalid[field] = "Enter this required field within " + limit + " characters.";
    }
    setErrors(invalid);
    const first = Object.keys(invalid)[0];
    if (first) { setMessage("Check the highlighted fields. Your draft is retained."); formElement.querySelector<HTMLElement>('[name="' + first + '"]')?.focus(); return; }
    if (!navigator.onLine) { persist(fields, draftVersion); return; }
    if (await onSubmit(fields)) {
      clearFormDirty(formElement); setFields(emptyDraft); setDraftVersion(version + 1);
      try { localStorage.removeItem(key); setMessage("Submission recorded; working device draft cleared. The retained recovery copy, if any, remains available."); } catch { setMessage("Submission recorded; the device draft could not be cleared."); }
    }
  }
  function chooseIndicator(id: string) {
    if (fields.definition && fields.definition !== id && (fields.value || fields.sourceTitle || fields.sourceLocator) && !window.confirm("Switch indicators and replace the current entry fields with the selected recorded evidence? Cancel to keep these unsent edits.")) return;
    setErrors((old) => ({ ...old, definition: undefined }));
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
    <p id="manual-draft-status" role="status" aria-live="polite" className="text-sm">{message}</p>
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
      <label className="block text-sm">Verified indicator<select name="definition" aria-invalid={!!errors.definition} aria-describedby={errors.definition ? "manual-definition-error" : "manual-draft-status"} className={input} required value={fields.definition} onChange={(event) => chooseIndicator(event.target.value)}><option value="">Select an indicator</option>{definitions.map((definition) => <option key={definition.id} value={definition.id}>{definition.label} ({definition.unit})</option>)}</select>{errors.definition && <span id="manual-definition-error" className="block text-sm font-medium">{errors.definition}</span>}</label>
      <label className="block text-sm">Recorded value<input name="value" aria-invalid={!!errors.value} aria-describedby={errors.value ? "manual-value-error" : "manual-draft-status"} type="number" step="any" required className={input} value={fields.value} onChange={(event) => change("value", event.target.value)} />{errors.value && <span id="manual-value-error" className="block text-sm font-medium">{errors.value}</span>}</label>
      <label className="block text-sm">Evidence title<input name="sourceTitle" aria-invalid={!!errors.sourceTitle} aria-describedby={errors.sourceTitle ? "manual-sourceTitle-error" : "manual-draft-status"} required maxLength={200} className={input} value={fields.sourceTitle} onChange={(event) => change("sourceTitle", event.target.value)} />{errors.sourceTitle && <span id="manual-sourceTitle-error" className="block text-sm font-medium">{errors.sourceTitle}</span>}</label>
      <label className="block text-sm">Evidence location or reference<input name="sourceLocator" aria-invalid={!!errors.sourceLocator} aria-describedby={errors.sourceLocator ? "manual-sourceLocator-error" : "manual-draft-status"} required maxLength={1000} className={input} value={fields.sourceLocator} onChange={(event) => change("sourceLocator", event.target.value)} />{errors.sourceLocator && <span id="manual-sourceLocator-error" className="block text-sm font-medium">{errors.sourceLocator}</span>}</label>
      <label className="block text-sm">Reason for submission or correction<textarea name="reason" aria-invalid={!!errors.reason} aria-describedby={errors.reason ? "manual-reason-error" : "manual-draft-status"} required maxLength={2000} className={input} value={fields.reason} onChange={(event) => change("reason", event.target.value)} />{errors.reason && <span id="manual-reason-error" className="block text-sm font-medium">{errors.reason}</span>}</label>
      <button className="rounded-lg border border-brand px-4 py-2 text-sm text-brand disabled:opacity-50" disabled={!canSubmit || draftVersion !== version || definitions.length === 0}>Submit a new evidence version</button>
    </fieldset>
    <button type="button" className="text-sm underline" disabled={busy || !loaded || unreadable !== null} onClick={() => {
      if (!window.confirm("Discard this working device draft? Submitted versions and retained recovery copies are unchanged.")) return;
      try { localStorage.removeItem(key); setFields(emptyDraft); setDraftVersion(version); setErrors({}); setMessage("Working device draft discarded. Submitted evidence and retained recovery copies are unchanged."); }
      catch { setMessage("The device draft could not be removed. Keep this page open and check storage access."); }
    }}>Discard working device draft</button>
  </form>;
}
