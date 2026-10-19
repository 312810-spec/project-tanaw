"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { clearFormDirty } from "@/app/components/unsaved-work";
import type { ProvisionCommand } from "@/app/lib/provisioning-http";

const labels = { teacher: "Teacher", subjectCoordinator: "Subject Coordinator", smeaCoordinator: "SMEA Coordinator", schoolHead: "School Head", districtCoordinator: "District MEA Coordinator" };
const field = "w-full rounded-lg border border-foreground/20 bg-background p-3 text-sm";
const button = "rounded-lg border border-brand px-4 py-2 text-sm text-brand disabled:opacity-50";
const uuid = (value: string) => /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(value);

/** The journal owns completion. This view never persists credentials or retries writes automatically. */
export function AccountProvisioning({ schoolId, actorId }: { schoolId: string; actorId: string }) {
  const storageKey = `tanaw-provision-request:${actorId}:${schoolId}`;
  const [capability, setCapability] = useState<"checking" | "available" | "unavailable">("checking");
  const [requestId, setRequestId] = useState("");
  const [complete, setComplete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Checking local account creation…");
  const [command, setCommand] = useState<ProvisionCommand | null>(null);
  const [locked, setLocked] = useState(false);
  const active = useRef<AbortController | null>(null);
  const mounted = useRef(false);
  const inFlight = useRef(false);
  const form = useRef<HTMLFormElement>(null);
  const status = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    let cancelled = false;
    queueMicrotask(() => {
    if (cancelled) return;
    try {
      const stored = sessionStorage.getItem(storageKey);
      if (stored && uuid(stored)) { setLocked(true); setRequestId(stored); setMessage("A previous request needs a status check. Its creation details and password were not saved on this device."); }
      else if (stored) { setLocked(true); setMessage("The saved request ID is unreadable. Reconcile the request with the coordinator before creating another account."); }
    } catch { setMessage("Browser recovery storage is unavailable. Allow session storage before creating an account."); }
    });
    void fetch("/api/accounts/provision", { cache: "no-store", signal: controller.signal }).then(async response => {
      const data = await response.json();
      if (!cancelled) setCapability(response.ok && data.available === true && data.localOnly === true ? "available" : "unavailable");
    }).catch(() => { if (!cancelled) setCapability("unavailable"); }).finally(() => clearTimeout(timer));
    return () => { cancelled = true; mounted.current = false; controller.abort(); active.current?.abort(); };
  }, [storageKey]);

  async function send(payload: Record<string, unknown>, id: string) {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setComplete(false);
    setMessage(payload.action === "status" ? "Checking the stored request…" : "Creating account… Keep this request open until its status is confirmed.");
    const controller = new AbortController(); active.current = controller;
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch("/api/accounts/provision", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), cache: "no-store", signal: controller.signal });
      const data = await response.json();
      if (!mounted.current) return;
      const receipt = data.localOnly === true && data.requestId === id;
      if (response.status === 200 && data.code === "account-complete" && receipt) {
        setComplete(true); setMessage("Account creation confirmed. Credential delivery and email ownership have not been verified. This local synthetic account is not approved for school use.");
      } else if (response.status === 202 && data.code === "account-pending" && receipt) {
        setMessage("Account outcome is pending. Check this request again before retrying; do not start another account request.");
      } else if (response.status === 401 || response.status === 403) {
        setMessage("Current access does not permit this request. Refresh school access or sign in with the original coordinator account; keep this request ID.");
      } else if (response.status === 404) {
        setMessage("No accessible receipt was found. This does not prove creation failed. Keep this request ID for reconciliation.");
      } else if (response.status === 409) {
        setMessage("The request conflicts with a stored request or identity. Keep this request ID for coordinator reconciliation; do not create a replacement.");
      } else if ([400, 408, 413, 415].includes(response.status)) {
        setMessage("The request was rejected. Keep the request ID and check its status before making any replacement.");
      } else {
        setMessage("Account status is unavailable. Keep this request ID and check again when the service is available.");
      }
    } catch { if (mounted.current) setMessage("Connection interrupted. Creation may have continued. Check this request’s status before retrying."); }
    finally {
      clearTimeout(timer); inFlight.current = false;
      if (mounted.current) { setBusy(false); status.current?.focus(); }
    }
  }
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || locked || capability !== "available") return;
    if (!navigator.onLine) { setMessage("Connect before creating an account. Nothing was sent."); return; }
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "").trim().toLowerCase();
    const roles = data.getAll("roles").map(String);
    const subjectIds = [...new Set(String(data.get("subjects") ?? "").split(",").map(x => x.trim()).filter(Boolean))];
    const reason = String(data.get("creationReason") ?? "").trim();
    if (!roles.length || subjectIds.length > 100 || subjectIds.some(x => x.length > 200 || /[\x00-\x1f\x7f]/.test(x)) || !reason || /[\x00-\x1f\x7f]/.test(reason)) { setMessage("Select at least one role and enter a reason without line breaks. Subject identifiers must be at most 200 characters each (100 maximum)."); return; }
    if (!window.confirm(`Create a local synthetic account?\nEmail: ${email}\nRoles: ${roles.map(x => labels[x as keyof typeof labels]).join(", ")}\nSubjects: ${subjectIds.join(", ") || "None"}\nReason: ${reason}\nThis does not deliver credentials or approve school use.`)) return;
    const id = crypto.randomUUID();
    try { sessionStorage.setItem(storageKey, id); if (sessionStorage.getItem(storageKey) !== id) throw Error("storage"); }
    catch { setMessage("The recovery request ID could not be saved. Nothing was sent. Allow session storage and try again."); return; }
    const prepared = { schoolId, requestId: id, email, roles, subjectIds, reason };
    setCommand(prepared);
    setLocked(true); setRequestId(id);
    const password = String(data.get("password") ?? "");
    const passwordInput = event.currentTarget.elements.namedItem("password");
    if (passwordInput instanceof HTMLInputElement) passwordInput.value = "";
    clearFormDirty(event.currentTarget);
    await send({ action: "provision", ...prepared, password }, id);
  }
  async function retry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || complete || !command || !requestId || capability !== "available") return;
    if (!navigator.onLine) { setMessage("Connect before retrying this same request."); return; }
    if (!window.confirm("Retry the same request and unchanged account details? An existing account password will not be reset.")) return;
    const password = String(new FormData(event.currentTarget).get("retryPassword") ?? "");
    event.currentTarget.reset(); clearFormDirty(event.currentTarget);
    await send({ action: "provision", ...command, password }, requestId);
  }
  function next() {
    if (!complete || inFlight.current) return;
    try { sessionStorage.removeItem(storageKey); } catch { setMessage("The saved request ID could not be cleared. Keep this confirmed receipt and retry later."); return; }
    setCommand(null); setLocked(false); setRequestId(""); setComplete(false);
    form.current?.reset(); if (form.current) clearFormDirty(form.current);
    setMessage("Ready for a new local synthetic account request.");
  }
  return <section aria-labelledby="provision-heading" aria-busy={busy} className="space-y-4 rounded-xl border border-foreground/15 p-5">
    <h2 id="provision-heading" className="text-lg font-semibold">Create a local test account</h2>
    <p className="text-sm text-foreground/70">Synthetic development only. The server checks your current school coordinator assignment for every request. Credential delivery and production onboarding remain unavailable.</p>
    <p ref={status} tabIndex={-1} role="status" aria-live="polite" className="text-sm">{message}</p>
    {capability === "unavailable" && <p className="text-sm">Local account creation is unavailable on this installation. Existing assigned accounts can still be managed below.</p>}
    {requestId && <div className="context-panel space-y-2"><p className="text-sm font-medium">Recovery request ID</p><p className="break-all select-all font-mono text-sm">{requestId}</p><p className="text-xs">Only this ID is kept in this browser tab for this coordinator and school. Keep it before closing the tab; account details and passwords are not stored.</p></div>}
    <form ref={form} onSubmit={create} className="space-y-4">
      <fieldset disabled={capability !== "available" || busy || locked} className="min-w-0 space-y-4">
        <label className="block text-sm">New account email<input name="email" type="email" required maxLength={254} autoComplete="off" className={field} /></label>
        <fieldset className="space-y-2"><legend className="mb-2 text-sm font-medium">New account roles</legend>{Object.entries(labels).map(([value, label]) => <label key={value} className="flex items-center gap-2 text-sm"><input type="checkbox" name="roles" value={value} defaultChecked={value === "teacher"} />{label}</label>)}</fieldset>
        <label className="block text-sm">New account subject identifiers<input name="subjects" maxLength={2000} className={field} /><span className="text-xs text-foreground/65">Exact school identifiers, comma separated. Leave empty if no subject scope is assigned.</span></label>
        <label className="block text-sm">Reason for creating account<input name="creationReason" required maxLength={2000} className={field} /></label>
        <label className="block text-sm">Initial test password<input name="password" type="password" required minLength={12} maxLength={128} autoComplete="new-password" aria-describedby="test-password-help" className={field} /></label>
        <p id="test-password-help" className="text-xs text-foreground/65">12–128 characters. Use a synthetic password. It is cleared when sent, never saved in recovery storage and never included in downloaded notes.</p>
        <button className={button}>Review and create test account</button>
      </fieldset>
    </form>
    {requestId && <div className="space-y-4">
      <button type="button" className={button} disabled={busy || capability !== "available"} onClick={() => {
        if (!navigator.onLine) { setMessage("Connect to check the stored account request."); return; }
        void send({ action: "status", schoolId, requestId }, requestId);
      }}>Check account request status</button>
      {!complete && command && <details><summary className="cursor-pointer text-sm">Retry the same request after checking status</summary><form onSubmit={retry} className="mt-3 space-y-3"><p className="text-xs">Unchanged account details and the same request ID will be sent. Re-enter the initial password only for an account that has not yet been created.</p><label className="block text-sm">Re-enter initial test password<input name="retryPassword" type="password" autoComplete="new-password" minLength={12} maxLength={128} required className={field} /></label><button disabled={busy || capability !== "available"} className={button}>Retry this account request</button></form></details>}
      {!complete && !command && <p className="text-sm">Recovered request: check status only. Creation details were not retained after leaving. A pending request needs coordinator reconciliation; do not recreate it with a new ID.</p>}
      {complete && <button type="button" disabled={busy} onClick={next} className={button}>Prepare another test account</button>}
    </div>}
  </section>;
}
