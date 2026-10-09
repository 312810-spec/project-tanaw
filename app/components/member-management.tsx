"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { confirmLeavingWork, clearFormDirty } from "@/app/components/unsaved-work";
import { workflowError } from "@/app/lib/workflow-ux";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";

type Member = { user_id: string; email: string; roles: string[]; subject_ids: string[]; active: boolean; revision: number };
type Event = { id: string; target_user_id: string; actor_id: string; reason: string; occurred_at: string };
const roles = { teacher: "Teacher", subjectCoordinator: "Subject Coordinator", smeaCoordinator: "SMEA Coordinator", schoolHead: "School Head", districtCoordinator: "District MEA Coordinator" };
const input = "w-full rounded-lg border border-foreground/20 bg-background p-3 text-sm";

export function MemberManagement({ schoolId, actorId }: { schoolId: string; actorId: string }) {
  const generation = useRef(0);
  const invalidate = useCallback(() => { generation.current++; }, []);
  const [members, setMembers] = useState<Member[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [ready, setReady] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [stale, setStale] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Loading assigned accounts…");
  const load = useCallback(async () => {
    const request = ++generation.current;
    setRefreshing(true); setStale(true);
    setMessage("Refreshing assigned accounts… Changes are paused until access is verified.");
    try {
      const client = createSupabaseBrowserClient();
      const [directory, history] = await Promise.all([
        client.rpc("tanaw_member_directory", { target_school: schoolId }),
        client.from("tanaw_membership_events").select("id,target_user_id,actor_id,reason,occurred_at").eq("school_id", schoolId).order("occurred_at", { ascending: false }).limit(10),
      ]);
      if (request !== generation.current) return;
      if (directory.error || history.error) throw new Error("Access unavailable");
      setMembers(directory.data ?? []); setEvents(history.data ?? []);
      setReady(true); setStale(false); setMessage("Assigned accounts loaded. Changes require a recorded reason."); return true;
    } catch { if (request === generation.current) setMessage("Account access refresh failed. Previously loaded information may be out of date; retry refresh before making changes."); return false; }
    finally { if (request === generation.current) setRefreshing(false); }
  }, [schoolId]);
  useEffect(() => { let cancelled = false; queueMicrotask(() => { if (!cancelled) void load(); }); return () => { cancelled = true; invalidate(); }; }, [load, invalidate]);
  const selected = members.find((member) => member.user_id === selectedId);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || busy || refreshing || stale || !selected || selected.user_id === actorId) return;
    if (!navigator.onLine) { setMessage("Connect to the internet to change account access."); return; }
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const subjects = [...new Set(String(form.get("subjects") ?? "").split(",").map((value) => value.trim()).filter(Boolean))];
    const assignedRoles = form.getAll("roles").map(String);
    if (!assignedRoles.length) { setMessage("Select at least one role. Use Disable access to suspend the account."); return; }
    if (!window.confirm(`Change access for ${selected.email || selected.user_id}?\nRoles: ${assignedRoles.map((role) => roles[role as keyof typeof roles]).join(", ")}\nSubjects: ${subjects.join(", ") || "None"}\nAccess: ${form.get("active") === "on" ? "Enabled" : "Disabled"}\nReason: ${form.get("reason")}\nSubmitted records stay preserved. This does not hand over unfinished work.`)) return;
    const request = generation.current;
    setBusy(true); setMessage("Saving access change…");
    try {
      const { error } = await createSupabaseBrowserClient().rpc("tanaw_manage_member", {
        target_school: schoolId, target_user: selected.user_id, new_roles: assignedRoles,
        new_subject_ids: subjects, is_active: form.get("active") === "on",
        change_reason: String(form.get("reason") ?? "").trim(), expected_revision: selected.revision,
      });
      if (request !== generation.current) return;
      if (error) { setMessage(workflowError(error.code, error.message)); return; }
      clearFormDirty(formElement);
      const refreshed = await load(); setMessage(refreshed ? "Access updated. Authorship and submitted records remain preserved." : "Access updated, but the directory could not be refreshed. Retry refresh before making another change.");
    } catch { if (request === generation.current) setMessage("Connection interrupted. Refresh to check the access history before retrying."); }
    finally { setBusy(false); }
  }
  return <section aria-busy={busy || refreshing} aria-labelledby="member-management-heading" className="space-y-4 rounded-xl border border-foreground/15 p-5">
    <h2 id="member-management-heading" className="text-lg font-semibold">Manage school access</h2>
    <p role="status" aria-live="polite" className="text-sm">{message}</p>
    <fieldset disabled={busy || refreshing || stale} className="min-w-0 space-y-4">
    {ready && <>
      <label className="block text-sm">Assigned account<select className={input} value={selectedId} disabled={busy} onChange={(event) => { if (confirmLeavingWork(event.currentTarget.closest("section"))) setSelectedId(event.target.value); }}><option value="">Select an account</option>{members.map((member) => <option key={member.user_id} value={member.user_id}>{member.email || member.user_id}{member.active ? "" : " · disabled"}</option>)}</select></label>
      {selected && selected.user_id === actorId && <p className="text-sm">Your own privileges cannot be changed from this workspace.</p>}
      {selected && selected.user_id !== actorId && <form key={selected.user_id + selected.revision} onSubmit={save} className="space-y-4">
        <fieldset disabled={busy} className="space-y-2"><legend className="mb-2 text-sm font-medium">Assigned roles</legend>{Object.entries(roles).map(([value, label]) => <label key={value} className="flex items-center gap-2 text-sm"><input type="checkbox" name="roles" value={value} defaultChecked={selected.roles.includes(value)} />{label}</label>)}</fieldset>
        <label className="block text-sm">Subject scopes (exact identifiers, comma separated)<input name="subjects" list="known-subject-scopes" defaultValue={selected.subject_ids.join(", ")} className={input} maxLength={2000} disabled={busy} /><datalist id="known-subject-scopes">{[...new Set(members.flatMap((member) => member.subject_ids))].sort().map((id) => <option key={id} value={id} />)}</datalist><span className="text-xs text-foreground/60">Suggestions come from provisioned school scopes. Separate multiple exact identifiers with commas; a new identifier needs an explicit school assignment.</span></label>
        <label className="flex items-center gap-2 text-sm"><input name="active" type="checkbox" defaultChecked={selected.active} disabled={busy} />Access enabled</label>
        <label className="block text-sm">Reason for access change<textarea name="reason" required maxLength={2000} className={input} disabled={busy} /></label>
        <p className="text-xs leading-5 text-foreground/65">Disabling access preserves records. Reassign unfinished work through a separate recorded handover before regular use.</p>
        <button className="rounded-lg border border-brand px-4 py-2 text-sm text-brand disabled:opacity-50" disabled={busy}>Save account access</button>
      </form>}
      <details><summary className="cursor-pointer text-sm font-medium">Recent access history</summary><ul className="mt-3 space-y-3">{events.map((entry) => <li key={entry.id} className="break-words text-sm">{members.find((member) => member.user_id === entry.target_user_id)?.email || entry.target_user_id} · {entry.reason}<br /><span className="text-xs text-foreground/60">{new Date(entry.occurred_at).toLocaleString("en-PH", { timeZone: "Asia/Manila" })} · by {members.find((member) => member.user_id === entry.actor_id)?.email || entry.actor_id}</span></li>)}</ul>{!events.length && <p className="mt-3 text-sm">No access changes recorded.</p>}</details>
    </>}
    </fieldset>
    <button type="button" disabled={busy || refreshing} className="text-sm underline underline-offset-4" onClick={() => { if (confirmLeavingWork()) void load(); }}>Refresh assigned accounts</button>
    <p className="text-xs leading-5 text-foreground/60">This view manages provisioned accounts. Secure creation and recovery require the configured authentication service.</p>
  </section>;
}
