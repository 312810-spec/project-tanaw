"use client";
import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";
import { clearFormDirty } from "@/app/components/unsaved-work";
import { emptyRosterDraft, prepareRosterDeclaration, rosterDeclarationFailure, type RosterDraft, type RosterPayload } from "@/app/lib/roster-declaration";

type Entry = { id: string; revision: number; state: string; created_at: string; created_by: string };
const fields = [["sourceTitle", "Roster source title", 200], ["sourceLocator", "Roster source location or reference", 1000], ["sourceRevision", "Roster source revision", 200], ["classReference", "Explicit class reference", 200]] as const;
const inputStyle = "w-full min-w-0 rounded-lg border border-foreground/20 bg-background p-3 text-sm";
const buttonStyle = "rounded-lg border border-brand px-4 py-2 text-sm text-brand disabled:opacity-50";
export function RosterSourceDeclaration({ submissionId, slotId, schoolYear, scopeLabel, paused }: { submissionId: string; slotId: string; schoolYear: string; scopeLabel: string; paused: boolean }) {
  const id = useId(), form = useRef<HTMLFormElement>(null), fileInput = useRef<HTMLInputElement>(null), status = useRef<HTMLParagraphElement>(null);
  const epoch = useRef(0), reads = useRef(0), hashes = useRef(0);
  const attempt = useRef<{ requestId: string; payload: RosterPayload; expectedRevision: number } | null>(null);
  const [draft, setDraft] = useState<RosterDraft>({ ...emptyRosterDraft }), [errors, setErrors] = useState<Partial<Record<keyof RosterDraft | "schoolYear", string>>>({});
  const [entries, setEntries] = useState<Entry[]>([]), [latest, setLatest] = useState(0), [more, setMore] = useState(false), [ready, setReady] = useState(false);
  const [reading, setReading] = useState(false), [saving, setSaving] = useState(false), [hashing, setHashing] = useState(false), [uncertain, setUncertain] = useState(false);
  const [message, setMessage] = useState("Load roster-source history before recording a declaration.");
  const load = useCallback(async (before?: number, quiet = false): Promise<boolean> => {
    const request = ++reads.current, scope = epoch.current;
    setReading(true); if (before === undefined) setReady(false);
    try {
      let query = createSupabaseBrowserClient().from("tanaw_roster_declarations").select("id,revision,state,created_at,created_by").eq("slot_id", slotId).order("revision", { ascending: false }).limit(20);
      if (before !== undefined) query = query.lt("revision", before);
      const result = await query;
      if (scope !== epoch.current || request !== reads.current) return false;
      if (result.error) throw new Error();
      const rows: Entry[] = result.data ?? [];
      if (before === undefined) { setEntries(rows); setLatest(rows[0]?.revision ?? 0); setReady(true); }
      else setEntries((old) => [...old, ...rows.filter((row) => !old.some((prior) => prior.id === row.id))]);
      setMore(rows.length === 20);
      if (!quiet) setMessage("Pending source history loaded. Declarations are not approved rosters or active mappings.");
      return true;
    } catch {
      if (scope === epoch.current && request === reads.current && !quiet) setMessage("Source history could not be loaded. Unsaved fields remain here. Refresh history or retry the same unconfirmed request.");
      return false;
    } finally { if (scope === epoch.current && request === reads.current) setReading(false); }
  }, [slotId]);
  const invalidateReads = useCallback(() => { reads.current++; }, []);
  useEffect(() => {
    const scope = epoch.current;
    if (!paused) queueMicrotask(() => { if (scope === epoch.current) void load(); });
    return invalidateReads;
  }, [paused, load, invalidateReads]);
  useEffect(() => () => { epoch.current++; reads.current++; hashes.current++; }, []);
  function change(field: keyof RosterDraft, value: string) { setDraft((old) => ({ ...old, [field]: value })); setErrors((old) => ({ ...old, [field]: undefined })); }
  async function hashFile(file: File | undefined) {
    const request = ++hashes.current, scope = epoch.current;
    change("sourceHash", ""); setHashing(false);
    if (!file) return;
    if (file.size <= 0 || file.size > 32 * 1024 * 1024) { setErrors((old) => ({ ...old, sourceHash: "Choose a nonempty source file no larger than 32 MiB." })); return; }
    setHashing(true); setMessage("Calculating the source-file reference on this device. The source file is not uploaded.");
    try {
      const bytes = await file.arrayBuffer();
      if (bytes.byteLength > 32 * 1024 * 1024) throw new Error();
      const digest = await crypto.subtle.digest("SHA-256", bytes);
      if (request !== hashes.current || scope !== epoch.current) return;
      change("sourceHash", Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join(""));
      setMessage("Source-file reference calculated locally. Its provenance and learner keys still require verification.");
    } catch { if (request === hashes.current && scope === epoch.current) setErrors((old) => ({ ...old, sourceHash: "The file reference could not be calculated. Choose the source file again." })); }
    finally { if (request === hashes.current && scope === epoch.current) setHashing(false); }
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (paused || saving || reading || hashing || (!ready && !uncertain)) return;
    if (!attempt.current) {
      const checked = prepareRosterDeclaration(draft, schoolYear); setErrors(checked.errors);
      if (!checked.payload) { setMessage("Check the highlighted source fields. Nothing has been recorded."); const first = Object.keys(checked.errors)[0]; form.current?.querySelector<HTMLElement>('[name="' + first + '"]')?.focus(); return; }
      if (!window.confirm("Record a pending roster-source declaration for " + scopeLabel + " · " + schoolYear + " · " + checked.payload.term + "?\nSource: " + checked.payload.sourceTitle + " · " + checked.payload.sourceRevision + ". Explicit keys: " + checked.payload.learnerKeys.length + ".\nLatest reviewed source revision: " + latest + ". This does not approve a roster or enable imports.")) return;
      attempt.current = { requestId: crypto.randomUUID(), payload: checked.payload, expectedRevision: latest };
    }
    const pending = attempt.current, scope = epoch.current;
    setSaving(true); setMessage("Recording pending source declaration…");
    try {
      const result = await createSupabaseBrowserClient().rpc("tanaw_declare_roster_source", { target_submission: submissionId, expected_revision: pending.expectedRevision, request_id: pending.requestId, source: pending.payload });
      if (scope !== epoch.current) return;
      if (result.error) {
        if (["40001", "42501", "22023"].includes(result.error.code)) { attempt.current = null; setUncertain(false); setReady(false); setMessage(rosterDeclarationFailure(result.error.code)); }
        else { setUncertain(true); setMessage("The outcome is unconfirmed. Keep this page open and retry the same pending declaration. No new request will be created."); }
        return;
      }
      if (typeof result.data !== "string" || !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(result.data)) throw new Error();
      attempt.current = null; setUncertain(false); setDraft({ ...emptyRosterDraft }); setErrors({}); hashes.current++;
      if (fileInput.current) fileInput.current.value = "";
      if (form.current) clearFormDirty(form.current);
      const refreshed = await load(undefined, true);
      if (scope === epoch.current) { setMessage(refreshed ? "Pending source declaration recorded. It is not an approved roster. Learner-key fields were cleared from this form." : "Pending source declaration recorded, but history refresh failed. Refresh history before recording another declaration. Learner-key fields were cleared from this form."); status.current?.focus(); }
    } catch { if (scope === epoch.current) { setUncertain(true); setMessage("The outcome is unconfirmed. Keep this page open and retry the same pending declaration. No new request will be created."); } }
    finally { if (scope === epoch.current) setSaving(false); }
  }
  return <details className="min-w-0 rounded-lg border border-foreground/20 p-4">
    <summary className="cursor-pointer font-medium">Record a pending roster source</summary>
    <div className="mt-4 space-y-3">
      <p className="text-sm">{scopeLabel} · {schoolYear || "Reporting year unavailable"}. Declarations stay pending; they do not approve identities, activate mappings or change grades.</p>
      <p ref={status} tabIndex={-1} role="status" aria-live="polite" className="text-sm">{message}</p>
      {paused && <p className="text-sm">Source actions are paused. Refresh school access and workflow information.</p>}
      <button type="button" className={buttonStyle} disabled={paused || reading || saving} onClick={() => void load()}>Refresh roster-source history</button>
      <p className="text-sm">Latest loaded revision: {latest}. {entries.length} revision(s) loaded. All are pending.</p>
      <ol className="space-y-2">{entries.map((entry) => <li key={entry.id} className="break-words text-sm">Revision {entry.revision} · Pending · {new Date(entry.created_at).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}</li>)}</ol>
      {more && <button type="button" className={buttonStyle} disabled={paused || reading || saving} onClick={() => void load(entries.at(-1)?.revision)}>Load older roster-source revisions</button>}
      <form ref={form} onSubmit={save} noValidate aria-label="Pending roster-source declaration" aria-busy={saving || hashing} className="space-y-3">
        <p id={id + "-help"} className="text-xs text-foreground/70">The source file is read on this device only. Recording sends source details, its declared reference and explicit learner keys to the school&apos;s pending registry. Unsaved fields stay only in this open assignment, not device storage.</p>
        <fieldset disabled={paused || saving || reading || uncertain} className="space-y-3">
          <label className="block text-sm">Assigned reporting year<input name="schoolYear" readOnly value={schoolYear} className={inputStyle} aria-invalid={!!errors.schoolYear} aria-describedby={errors.schoolYear ? id + "-year" : id + "-help"} />{errors.schoolYear && <span id={id + "-year"} className="block font-medium">{errors.schoolYear}</span>}</label>
          {fields.map(([field, label, limit]) => <label key={field} className="block text-sm">{label}<input name={field} required maxLength={limit} value={draft[field]} className={inputStyle} aria-invalid={!!errors[field]} aria-describedby={errors[field] ? id + "-" + field : id + "-help"} onChange={(event) => change(field, event.target.value)} />{errors[field] && <span id={id + "-" + field} className="block font-medium">{errors[field]}</span>}</label>)}
          <label className="block text-sm">Roster source term<select name="term" required value={draft.term} className={inputStyle} aria-invalid={!!errors.term} aria-describedby={errors.term ? id + "-term" : id + "-help"} onChange={(event) => change("term", event.target.value)}><option value="">Choose the source term</option>{["TERM 1", "TERM 2", "TERM 3"].map((term) => <option key={term}>{term}</option>)}</select>{errors.term && <span id={id + "-term"} className="block font-medium">{errors.term}</span>}</label>
          <label className="block text-sm">Roster source file (local reference only)<input ref={fileInput} name="sourceHash" type="file" className={inputStyle} aria-invalid={!!errors.sourceHash} aria-describedby={errors.sourceHash ? id + "-sourceHash" : id + "-help"} onChange={(event) => void hashFile(event.target.files?.[0])} />{errors.sourceHash && <span id={id + "-sourceHash"} className="block font-medium">{errors.sourceHash}</span>}</label>
          {draft.sourceHash && <details><summary className="cursor-pointer py-1 text-sm">Declared source-file reference</summary><p className="break-all text-xs">{draft.sourceHash}</p></details>}
          <label className="block text-sm">Explicit learner keys<textarea name="learnerKeysText" required rows={5} maxLength={250000} value={draft.learnerKeysText} className={inputStyle} aria-invalid={!!errors.learnerKeysText} aria-describedby={errors.learnerKeysText ? id + "-keys" : id + "-help"} onChange={(event) => change("learnerKeysText", event.target.value)} /><span className="text-xs text-foreground/70">Use source identifiers, not learner names; one per line. Keys are neither inferred nor certified by this form.</span>{errors.learnerKeysText && <span id={id + "-keys"} className="block font-medium">{errors.learnerKeysText}</span>}</label>
        </fieldset>
        <button className={buttonStyle} disabled={paused || saving || reading || hashing || !schoolYear || (!ready && !uncertain)}>{uncertain ? "Retry the same pending declaration" : "Record pending source declaration"}</button>
      </form>
    </div>
  </details>;
}
