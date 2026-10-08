"use client";

import { useCallback, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";

type Membership = { school_id: string; roles: string[]; subject_ids: string[] };
const roleLabels: Record<string, string> = {
  teacher: "Teacher", subjectCoordinator: "Subject Coordinator",
  smeaCoordinator: "SMEA Coordinator", schoolHead: "School Head",
  districtCoordinator: "District MEA Coordinator",
};
const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

export function AccountWorkspace() {
  const [status, setStatus] = useState("Checking your account…");
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [selected, setSelected] = useState("");
  const [role, setRole] = useState("");
  const [signedIn, setSignedIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setMemberships([]); setSelected(""); setRole(""); setSignedIn(false);
    if (!configured) { setStatus("This installation is not configured for sign-in yet."); return; }
    setBusy(true);
    try {
      const client = createSupabaseBrowserClient();
      const { data: identity, error: identityError } = await client.auth.getUser();
      if (identityError || !identity.user) { setStatus("Sign in with your assigned account to continue."); return; }
      setSignedIn(true);
      const { data, error } = await client.from("tanaw_memberships")
        .select("school_id,roles,subject_ids").eq("user_id", identity.user.id).eq("active", true);
      if (error) { setStatus("School access could not be loaded. Contact your SMEA Coordinator or try again."); return; }
      const rows: Membership[] = (data ?? []).filter((row) =>
        typeof row.school_id === "string" && Array.isArray(row.roles) &&
        row.roles.every((r: unknown) => typeof r === "string" && Object.hasOwn(roleLabels, r)) &&
        Array.isArray(row.subject_ids) && row.subject_ids.every((s: unknown) => typeof s === "string"));
      setMemberships(rows);
      if (rows.length === 0) { setStatus("Your account has no active school assignment. Contact the SMEA Coordinator."); return; }
      setSelected(rows[0].school_id); setRole(rows[0].roles[0] ?? "");
      setStatus("School access loaded. Reporting actions are not connected yet.");
    } catch { setStatus("Unable to connect. Your school access has not been verified."); }
    finally { setBusy(false); }
  }, []);
  useEffect(() => {
    void load();
    if (!configured) return;
    const client = createSupabaseBrowserClient();
    const { data: subscription } = client.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setMemberships([]); setSelected(""); setRole(""); setSignedIn(false);
        setStatus("Signed out. Sign in to continue.");
      }
    });
    return () => subscription.subscription.unsubscribe();
  }, [load]);
  const membership = memberships.find((m) => m.school_id === selected);
  async function signOut() {
    setBusy(true);
    try {
      const { error } = await createSupabaseBrowserClient().auth.signOut();
      if (error) { setStatus("Sign-out could not be completed. Try again."); return; }
      setMemberships([]); setSelected(""); setRole(""); setSignedIn(false); setStatus("Signed out.");
    } catch { setStatus("Sign-out could not be completed. Try again."); }
    finally { setBusy(false); }
  }
  return (
    <div className="mt-8 space-y-6">
      <p role="status" aria-live="polite" className="rounded-lg border border-foreground/15 p-4 text-sm">{status}</p>
      {membership && <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2"><label htmlFor="school" className="block text-sm font-medium">Assigned school</label>
          <select id="school" value={selected} disabled={busy} onChange={(event) => {
            const next = memberships.find((m) => m.school_id === event.target.value);
            setSelected(event.target.value); setRole(next?.roles[0] ?? "");
          }} className="w-full rounded-lg border border-foreground/20 bg-background p-3">
            {memberships.map((m, index) => <option key={m.school_id} value={m.school_id}>School assignment {index + 1}</option>)}
          </select>
        </div>
        <div className="space-y-2"><label htmlFor="role" className="block text-sm font-medium">Workspace</label>
          <select id="role" value={role} disabled={busy} onChange={(event) => setRole(event.target.value)} className="w-full rounded-lg border border-foreground/20 bg-background p-3">
            {membership.roles.map((r) => <option key={r} value={r}>{roleLabels[r]}</option>)}
          </select>
        </div>
        <p className="text-sm text-foreground/70 sm:col-span-2">{membership.subject_ids.length} assigned subject scope(s). Role selection changes this view; database permissions come from your coordinator-managed assignments.</p>
      </div>}
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={() => void load()} disabled={busy} className="rounded-lg border border-brand px-4 py-2 text-sm text-brand disabled:opacity-50">Refresh access</button>
        {signedIn ? <button type="button" onClick={() => void signOut()} disabled={busy} className="rounded-lg border border-foreground/20 px-4 py-2 text-sm disabled:opacity-50">Sign out</button> : <a href="/login" className="rounded-lg bg-brand px-4 py-2 text-sm text-white">Sign in</a>}
      </div>
      <p className="text-xs leading-5 text-foreground/60">Class-record import, reporting cycles and packet review are still being connected. No school results are shown until authorized records are available.</p>
    </div>
  );
}
