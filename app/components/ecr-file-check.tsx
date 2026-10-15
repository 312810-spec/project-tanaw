"use client";
import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";
import { clearFormDirty } from "@/app/components/unsaved-work";
import { fileCheckSelectionError, fileCheckFailure, parseFileCheckResult, type FileCheckResult } from "@/app/lib/ecr-file-check";

const inputStyle = "w-full min-w-0 rounded-lg border border-foreground/20 bg-background p-3 text-sm";
const buttonStyle = "rounded-lg border border-brand px-4 py-2 text-sm text-brand disabled:opacity-50";
export function EcrFileCheck({ submissionId, paused }: { submissionId: string; paused: boolean }) {
  const id = useId(), form = useRef<HTMLFormElement>(null), fileInput = useRef<HTMLInputElement>(null), termInput = useRef<HTMLSelectElement>(null);
  const upload = useRef<AbortController | null>(null), capability = useRef<AbortController | null>(null), generation = useRef(0);
  const [availability, setAvailability] = useState<"checking" | "available" | "unavailable" | "error">("checking");
  const [online, setOnline] = useState<boolean | null>(null), [file, setFile] = useState<File | null>(null), [term, setTerm] = useState("");
  const [checking, setChecking] = useState(false), [message, setMessage] = useState(""), [result, setResult] = useState<FileCheckResult | null>(null);
  const [errors, setErrors] = useState<{ file?: string; term?: string }>({});
  const invalidateUpload = useCallback(() => { generation.current++; upload.current?.abort(); upload.current = null; }, []);
  const stop = useCallback((notice: string) => {
    invalidateUpload();
    setChecking(false); setResult(null); setMessage(notice);
  }, [invalidateUpload]);
  const loadAvailability = useCallback(async () => {
    capability.current?.abort(); const controller = new AbortController(); capability.current = controller;
    try {
      const response = await fetch("/api/ecr/preview", { cache: "no-store", signal: controller.signal });
      const value: unknown = await response.json();
      if (!controller.signal.aborted) setAvailability(response.ok && typeof value === "object" && value !== null && "available" in value && typeof value.available === "boolean" ? value.available ? "available" : "unavailable" : "error");
    } catch { if (!controller.signal.aborted) setAvailability("error"); }
  }, []);
  useEffect(() => {
    let mounted = true;
    queueMicrotask(() => { if (mounted) { setOnline(navigator.onLine); void loadAvailability(); } });
    const connected = () => setOnline(true);
    const disconnected = () => { setOnline(false); stop("Offline. Your file remains selected in this open assignment. Reconnect before checking it again."); };
    window.addEventListener("online", connected); window.addEventListener("offline", disconnected);
    return () => { mounted = false; invalidateUpload(); capability.current?.abort(); window.removeEventListener("online", connected); window.removeEventListener("offline", disconnected); };
  }, [loadAvailability, stop, invalidateUpload]);
  useEffect(() => { if (paused) queueMicrotask(() => stop("File checks are paused while school access or workflow information is being refreshed.")); }, [paused, stop]);
  function changed() { stop(""); setErrors({}); if (form.current) clearFormDirty(form.current); }
  async function check(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (paused || online !== true || availability !== "available" || checking) return;
    const fileError = fileCheckSelectionError(file), termError = ["TERM 1", "TERM 2", "TERM 3"].includes(term) ? null : "Choose the term shown in this workbook.";
    setErrors({ file: fileError ?? undefined, term: termError ?? undefined });
    if (fileError || termError || !file) { setMessage("Check the highlighted fields. No file was sent."); (fileError ? fileInput.current : termInput.current)?.focus(); return; }
    const request = ++generation.current, controller = new AbortController(); upload.current = controller;
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 60_000);
    setChecking(true); setResult(null); setMessage("Checking this file. No records are being submitted.");
    try {
      const response = await fetch("/api/ecr/preview?" + new URLSearchParams({ submission: submissionId, term }), { method: "POST", body: file, headers: { "Content-Type": "application/octet-stream" }, signal: controller.signal, cache: "no-store" });
      if (request !== generation.current) return;
      if (!response.ok) { setMessage(fileCheckFailure(response.status)); return; }
      const value: unknown = await response.json();
      if (request !== generation.current) return;
      const parsed = parseFileCheckResult(value, term);
      if (!parsed) { setMessage(fileCheckFailure(503)); return; }
      setResult(parsed); setMessage("File format recognized. Grades were not calculated or submitted.");
    } catch {
      if (request === generation.current) setMessage(timedOut ? "The file check timed out. Your file remains selected; try again." : "The file check was interrupted. Your file remains selected in this open assignment; try again.");
    } finally { clearTimeout(timer); if (request === generation.current) { upload.current = null; setChecking(false); } }
  }
  const canUse = availability === "available" && online === true && !paused;
  return <details className="min-w-0 rounded-lg border border-foreground/20 p-4">
    <summary className="cursor-pointer font-medium">Check a class-record file</summary>
    <form ref={form} onSubmit={check} noValidate aria-label="Class-record file check" className="mt-4 space-y-3" aria-busy={checking}>
      <p id={id + "-help"} className="text-sm">Checking sends this workbook for a temporary format check. It does not save a school record, submit grades or approve an import.</p>
      <p className="text-xs text-foreground/70">The file stays selected only in this open assignment. Choose it again after switching assignments or reloading. Reconnection never sends it automatically.</p>
      <div role="status" aria-live="polite" aria-atomic="true" className="break-words text-sm">
        {availability === "checking" && <p>Checking whether file checks are available…</p>}
        {availability === "unavailable" && <p>File checks are not enabled on this server. Manual evidence entry remains available.</p>}
        {availability === "error" && <p>File-check availability could not be verified. Retry after reconnecting.</p>}
        {online === false && <p>You are offline. File checks need a connection.</p>}
        {paused && <p>Refresh school access and workflow information before checking a file.</p>}
        {message && <p>{message}</p>}
      </div>
      {(availability === "unavailable" || availability === "error") && <button type="button" className={buttonStyle} disabled={online !== true || checking} onClick={() => { setAvailability("checking"); void loadAvailability(); }}>Retry file-check availability</button>}
      <fieldset disabled={!canUse || checking} className="space-y-3">
        <label className="block text-sm">Class-record workbook<input ref={fileInput} type="file" accept=".xlsx" required aria-invalid={!!errors.file} aria-describedby={id + "-help" + (errors.file ? " " + id + "-file-error" : "")} className={inputStyle} onChange={(event) => { changed(); setFile(event.target.files?.[0] ?? null); setTerm(""); }} />{errors.file && <span id={id + "-file-error"} className="block font-medium">{errors.file}</span>}</label>
        {file && <p className="break-all text-sm">Selected file: {file.name}</p>}
        <label className="block text-sm">Workbook term<select ref={termInput} required value={term} className={inputStyle} aria-invalid={!!errors.term} aria-describedby={errors.term ? id + "-term-error" : id + "-help"} onChange={(event) => { changed(); setTerm(event.target.value); }}><option value="">Choose the workbook term</option>{["TERM 1", "TERM 2", "TERM 3"].map((value) => <option key={value} value={value}>{value}</option>)}</select>{errors.term && <span id={id + "-term-error"} className="block font-medium">{errors.term}</span>}</label>
        <button className={buttonStyle}>Check file format</button>
      </fieldset>
      {checking && <button type="button" className={buttonStyle} onClick={() => stop("File check canceled. Your file remains selected; no records were submitted.")}>Cancel file check</button>}
      {file && !checking && <button type="button" className={buttonStyle} onClick={() => { changed(); setFile(null); setTerm(""); if (fileInput.current) fileInput.current.value = ""; }}>Clear selected file</button>}
      {result && !paused && <section aria-label="File-check result" className="context-panel space-y-2">
        <h4 className="font-semibold">Format recognized · {result.term}</h4>
        <p className="text-sm">{result.occupiedRows} occupied learner slot(s). {result.excludedBlankRows} blank slot(s) excluded.</p>
        {result.occupiedRows === 0 && <p className="text-sm">No occupied learner slots were found.</p>}
        <p className="text-sm">Learner mapping, reporting-period matching and approved computations are still pending. Nothing has been submitted.</p>
        <details><summary className="cursor-pointer text-sm">File reference</summary><p className="break-all text-xs">{result.sourceHash}</p></details>
      </section>}
    </form>
  </details>;
}
