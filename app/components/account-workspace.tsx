"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { confirmLeavingWork, useUnsavedWork } from "@/app/components/unsaved-work";
import { SchoolWorkflow } from "@/app/components/school-workflow";
import { MemberManagement } from "@/app/components/member-management";
import { ReportingCycles } from "@/app/components/reporting-cycles";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";

type Membership = { school_id: string; school_name?: string; roles: string[]; subject_ids: string[] };
const roleLabels: Record<string, string> = {
  teacher: "Teacher", subjectCoordinator: "Subject Coordinator",
  smeaCoordinator: "SMEA Coordinator", schoolHead: "School Head",
  districtCoordinator: "District MEA Coordinator",
};
const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

export function AccountWorkspace() {
  useUnsavedWork();
  const generation = useRef(0);
  const invalidate = useCallback(() => { generation.current++; }, []);
  const [status, setStatus] = useState("Checking your account…");
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [selected, setSelected] = useState("");
  const [role, setRole] = useState("");
  const [actorId, setActorId] = useState("");
  const [signedIn, setSignedIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [accessVerified, setAccessVerified] = useState(false);
  const selection = useRef({ school: "", role: "" });
  useEffect(() => { selection.current = { school: selected, role }; }, [selected, role]);
  const load = useCallback(async () => {
    const request = ++generation.current;
    setAccessVerified(false);
    if (!configured) { setStatus("This installation is not configured for sign-in yet."); return; }
    setBusy(true); setStatus("Verifying school access… Unsaved forms remain open until access is resolved.");
    try {
      const client = createSupabaseBrowserClient();
      const { data: identity, error: identityError } = await client.auth.getUser();
      if (request !== generation.current) return;
      if (identityError || !identity.user) { setMemberships([]); setSelected(""); setRole(""); setSignedIn(false); setActorId(""); setStatus("Sign in with your assigned account to continue."); return; }
      setSignedIn(true); setActorId(identity.user.id);
      const { data, error } = await client.from("tanaw_memberships")
        .select("school_id,roles,subject_ids").eq("user_id", identity.user.id).eq("active", true);
      if (request !== generation.current) return;
      if (error) { setStatus("School access could not be loaded. Contact your SMEA Coordinator or try again."); return; }
      const rows: Membership[] = (data ?? []).filter((row) =>
        typeof row.school_id === "string" && Array.isArray(row.roles) &&
        row.roles.every((r: unknown) => typeof r === "string" && Object.hasOwn(roleLabels, r)) &&
        Array.isArray(row.subject_ids) && row.subject_ids.every((s: unknown) => typeof s === "string"));
      const schools = rows.length ? await client.from("tanaw_schools").select("id,name").in("id", rows.map((row) => row.school_id)) : { data: [], error: null };
      if (request !== generation.current) return;
      if (schools.error) { setStatus("School identities could not be verified. Retry access refresh."); return; }
      const named = rows.map((row) => ({ ...row, school_name: schools.data?.find((school) => school.id === row.school_id)?.name }));
      setMemberships(named);
      if (rows.length === 0) { setSelected(""); setRole(""); setStatus("Your account has no active school assignment. Contact the SMEA Coordinator."); return; }
      const preferred = named.find((row) => row.school_id === selection.current.school) ?? named[0];
      setSelected(preferred.school_id);
      setRole(preferred.roles.includes(selection.current.role) ? selection.current.role : preferred.roles[0] ?? "");
      setAccessVerified(true);
      setStatus("School access loaded.");
    } catch { if (request === generation.current) setStatus("Unable to connect. Your school access has not been verified."); }
    finally { if (request === generation.current) setBusy(false); }
  }, []);
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => { if (!cancelled) void load(); });
    if (!configured) return;
    const client = createSupabaseBrowserClient();
    const { data: subscription } = client.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        generation.current++; setBusy(false);
        setMemberships([]); setSelected(""); setRole(""); setSignedIn(false); setActorId("");
        setStatus("Signed out. Sign in to continue.");
      }
    });
    return () => { cancelled = true; invalidate(); subscription.subscription.unsubscribe(); };
  }, [load, invalidate]);
  const membership = memberships.find((m) => m.school_id === selected);
  async function signOut() {
    if (!confirmLeavingWork()) return;
    generation.current++;
    setBusy(true);
    try {
      const { error } = await createSupabaseBrowserClient().auth.signOut();
      if (error) { setStatus("Sign-out could not be completed. Try again."); return; }
      setMemberships([]); setSelected(""); setRole(""); setSignedIn(false); setActorId(""); setStatus("Signed out.");
    } catch { setStatus("Sign-out could not be completed. Try again."); }
    finally { setBusy(false); }
  }
  return (
    <div className="mt-8 space-y-6">
      <p role="status" aria-live="polite" className="rounded-lg border border-foreground/15 p-4 text-sm">{status}</p>
      {membership && <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2"><label htmlFor="school" className="block text-sm font-medium">Assigned school</label>
          <select id="school" value={selected} disabled={busy} onChange={(event) => {
            if (!confirmLeavingWork()) return;
            const next = memberships.find((m) => m.school_id === event.target.value);
            setSelected(event.target.value); setRole(next?.roles[0] ?? "");
          }} className="w-full rounded-lg border border-foreground/20 bg-background p-3">
            {memberships.map((m) => <option key={m.school_id} value={m.school_id}>{m.school_name ?? m.school_id}</option>)}
          </select>
        </div>
        <div className="space-y-2"><label htmlFor="role" className="block text-sm font-medium">Workspace</label>
          <select id="role" value={role} disabled={busy} onChange={(event) => { if (confirmLeavingWork()) setRole(event.target.value); }} className="w-full rounded-lg border border-foreground/20 bg-background p-3">
            {membership.roles.map((r) => <option key={r} value={r}>{roleLabels[r]}</option>)}
          </select>
        </div>
        <p className="text-sm text-foreground/70 sm:col-span-2">{membership.subject_ids.length} assigned subject scope(s). Role selection changes this view; database permissions come from your coordinator-managed assignments.</p>
      </div>}
      {membership && <nav aria-label="Workspace tasks" className="flex flex-wrap gap-3 text-sm"><a href="#school-workflow-heading" className="underline">Submissions and review</a><a href="#cycles-heading" className="underline">Reporting calendar</a>{role === "smeaCoordinator" && <a href="#member-management-heading" className="underline">School access</a>}</nav>}
      <fieldset disabled={busy || !accessVerified} className="min-w-0 space-y-6">
      {membership && actorId && <SchoolWorkflow key={membership.school_id + role} schoolId={membership.school_id} role={role} actorId={actorId} />}
      {membership && <ReportingCycles key={membership.school_id} schoolId={membership.school_id} canManage={membership.roles.includes("smeaCoordinator") && role === "smeaCoordinator"} />}
      {membership && actorId && role === "smeaCoordinator" && <MemberManagement key={membership.school_id} schoolId={membership.school_id} actorId={actorId} />}
      </fieldset>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={() => { if (confirmLeavingWork()) void load(); }} disabled={busy} className="rounded-lg border border-brand px-4 py-2 text-sm text-brand disabled:opacity-50">Refresh access</button>
        {signedIn ? <button type="button" onClick={() => void signOut()} disabled={busy} className="rounded-lg border border-foreground/20 px-4 py-2 text-sm disabled:opacity-50">Sign out</button> : <a href="/login" className="rounded-lg bg-action px-4 py-2 text-sm text-on-action">Sign in</a>}
      </div>
      <p className="text-xs leading-5 text-foreground/60">Class-record import is still being verified. No school results are shown until authorized records are available.</p>
    </div>
  );
}
