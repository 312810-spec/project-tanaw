"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";

type Cycle = { id: string; instructional_block_id: string; deadline_at: string; locked_at: string | null };
type Slot = { id: string; author_id: string; subject_id: string; scope_label: string };
type Submission = { id: string; slot_id: string; current_version: number; extension_until: string | null };
type Entry = { definitionId: string; value: number; sourceTitle: string; sourceLocator: string };
type Version = { version: number; evidence: { kind: string; entries: Entry[] }; reason: string; created_at: string };
type Definition = { id: string; label: string; unit: string };
type Packet = { id: string; version: number; locked_at: string | null; completeness: string | null; missing: { slotId: string; reason: string }[] };
type DistrictPacket = { packet_id: string; version: number; completeness: string; submission_count: number; missing_count: number };
const inputStyle = "w-full min-w-0 rounded-lg border border-foreground/20 bg-background p-3 text-sm";
const buttonStyle = "rounded-lg border border-brand px-4 py-2 text-sm text-brand disabled:opacity-50";

export function SchoolWorkflow({ schoolId, role, actorId }: { schoolId: string; role: string; actorId: string }) {
  const generation = useRef(0);
  const [status, setStatus] = useState("Loading school workflow…");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [cycleId, setCycleId] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [definitions, setDefinitions] = useState<Definition[]>([]);
  const [packets, setPackets] = useState<Packet[]>([]);
  const [district, setDistrict] = useState<DistrictPacket[]>([]);
  const [submissionId, setSubmissionId] = useState("");
  const [versions, setVersions] = useState<Version[]>([]);
  const [versionReady, setVersionReady] = useState(false);
  const [acknowledge, setAcknowledge] = useState(false);
  const [missingReasons, setMissingReasons] = useState<Record<string, string>>({});
  const load = useCallback(async () => {
    const request = ++generation.current;
    setReady(false); setVersionReady(false); setSlots([]); setSubmissions([]); setPackets([]); setDistrict([]); setVersions([]);
    try {
      const client = createSupabaseBrowserClient();
      if (role === "districtCoordinator") {
        const result = await client.rpc("tanaw_district_packets", { target_school: schoolId });
        if (request !== generation.current) return;
        if (result.error) throw result.error;
        setDistrict(result.data ?? []); setReady(true); setStatus("Locked packet status loaded. Learner records are restricted to the school."); return;
      }
      const cycleResult = await client.from("tanaw_reporting_cycles").select("id,instructional_block_id,deadline_at,locked_at").eq("school_id", schoolId).order("deadline_at", { ascending: false });
      if (request !== generation.current) return;
      if (cycleResult.error) throw cycleResult.error;
      const list: Cycle[] = cycleResult.data ?? [];
      setCycles(list);
      const selected = list.some((cycle) => cycle.id === cycleId) ? cycleId : list[0]?.id ?? "";
      if (selected !== cycleId) { setCycleId(selected); return; }
      if (!selected) { setReady(true); setStatus("The coordinator has not created a reporting cycle yet."); return; }
      const calendar = await client.from("tanaw_instructional_blocks").select("school_year,label").eq("id", list.find((cycle) => cycle.id === selected)!.instructional_block_id).single();
      if (calendar.error || !calendar.data) throw new Error("Verified calendar reference unavailable");
      const [slotResult, definitionResult, packetResult] = await Promise.all([
        client.from("tanaw_submission_slots").select("id,author_id,subject_id,scope_label", { count: "exact" }).eq("cycle_id", selected).limit(500),
        client.from("smea_indicator_definitions").select("id,label,unit").eq("school_id", schoolId).eq("definition_status", "verified").eq("school_year", calendar.data.school_year).eq("reporting_period", calendar.data.label),
        client.from("tanaw_school_packets").select("id,version,locked_at,completeness,missing").eq("cycle_id", selected).order("version", { ascending: false }).limit(20),
      ]);
      if (request !== generation.current) return;
      if (slotResult.error || definitionResult.error || packetResult.error) throw new Error("Workflow access could not be verified");
      if (slotResult.count !== slotResult.data?.length) throw new Error("Assignment page is incomplete");
      const visibleSlots: Slot[] = (slotResult.data ?? []).filter((slot) => role !== "teacher" || slot.author_id === actorId);
      setSlots(visibleSlots); setDefinitions(definitionResult.data ?? []); setPackets(packetResult.data ?? []);
      const submissionResult = visibleSlots.length ? await client.from("tanaw_submissions").select("id,slot_id,current_version,extension_until", { count: "exact" }).in("slot_id", visibleSlots.map((slot) => slot.id)).limit(500) : { data: [], error: null, count: 0 };
      if (request !== generation.current) return;
      if (submissionResult.error || submissionResult.count !== submissionResult.data?.length) throw new Error("Submission page is incomplete");
      setSubmissions(submissionResult.data ?? []); setReady(true); setStatus("School workflow loaded.");
    } catch { if (request === generation.current) setStatus("Workflow could not be loaded completely. Refresh access before taking an action."); }
  }, [schoolId, role, actorId, cycleId]);
  useEffect(() => { setSubmissionId(""); setMissingReasons({}); setAcknowledge(false); void load(); return () => { generation.current++; }; }, [load]);
  useEffect(() => {
    let cancelled = false;
    setVersions([]); setVersionReady(false);
    if (!submissionId || !ready) return;
    void (async () => {
      const result = await createSupabaseBrowserClient().from("tanaw_submission_versions").select("version,evidence,reason,created_at").eq("submission_id", submissionId).order("version", { ascending: false }).limit(20);
      if (cancelled) return;
      if (result.error) { setStatus("Evidence history could not be verified. Refresh before submitting or reviewing."); return; }
      setVersions(result.data ?? []); setVersionReady(true);
    })();
    return () => { cancelled = true; };
  }, [submissionId, ready]);
  const selected = submissions.find((submission) => submission.id === submissionId);
  const selectedSlot = slots.find((slot) => slot.id === selected?.slot_id);
  const currentVersion = versions.find((version) => version.version === selected?.current_version);
  const cycle = cycles.find((entry) => entry.id === cycleId);
  const latest = packets[0];
  async function action(name: string, args: Record<string, unknown>) {
    if (!ready || busy) return;
    if (!navigator.onLine) { setStatus("Connect to the internet for submission and review actions."); return; }
    const request = generation.current;
    setBusy(true); setStatus("Recording action…");
    try {
      const { error } = await createSupabaseBrowserClient().rpc(name, args);
      if (request !== generation.current) return;
      if (error) { setStatus(error.code === "40001" ? "The record changed. Refresh and review the current version before retrying." : "Action was not accepted. Check your assignment, deadline and required reviews, then refresh."); return; }
      await load(); setStatus("Action recorded with its history.");
    } catch { if (request === generation.current) setStatus("Connection interrupted. Refresh to check whether the action was recorded before retrying."); }
    finally { setBusy(false); }
  }
  function submitManual(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selected || !versionReady || (selected.current_version > 0 && !currentVersion)) return;
    const form = new FormData(event.currentTarget);
    const definitionId = String(form.get("definition")); const raw = String(form.get("value") ?? "");
    const value = Number(raw);
    if (!raw.trim() || !Number.isFinite(value)) { setStatus("Enter a recorded numeric value. Leave missing evidence unsubmitted."); return; }
    const entry: Entry = { definitionId, value, sourceTitle: String(form.get("sourceTitle") ?? "").trim(), sourceLocator: String(form.get("sourceLocator") ?? "").trim() };
    const entries = [...(currentVersion?.evidence.entries ?? []).filter((item) => item.definitionId !== definitionId), entry];
    void action("tanaw_submit_evidence", { target_submission: selected.id, expected_version: selected.current_version, new_evidence: { kind: "manualIndicators", entries }, change_reason: String(form.get("reason") ?? "") });
  }
  function assign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    void action("tanaw_assign_submission", { target_cycle: cycleId, target_author: String(form.get("author")), target_subject: String(form.get("subject")), target_scope: String(form.get("scope")), change_reason: String(form.get("reason")) });
  }
  function timedAction(event: FormEvent<HTMLFormElement>, name: string) {
    event.preventDefault(); const form = new FormData(event.currentTarget); const deadline = String(form.get("deadline"));
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(deadline)) return;
    const until = new Date(deadline + ":00+08:00");
    if (!Number.isFinite(until.getTime()) || until.getTime() <= Date.now()) { setStatus("Choose a future cutoff in Philippine time."); return; }
    void action(name, name === "tanaw_open_amendment" ? { target_cycle: cycleId, amendment_deadline: until.toISOString(), change_reason: String(form.get("reason")) } : { target_submission: submissionId, until_time: until.toISOString(), change_reason: String(form.get("reason")) });
  }
  return <section className="space-y-5 rounded-xl border border-foreground/15 p-5" aria-labelledby="school-workflow-heading">
    <h2 id="school-workflow-heading" className="text-lg font-semibold">Submissions and packet review</h2>
    <p role="status" aria-live="polite" className="text-sm">{status}</p>
    {role !== "districtCoordinator" && cycles.length > 0 && <div><label htmlFor="workflow-cycle" className="block text-sm font-medium">Reporting cycle</label><select id="workflow-cycle" className={inputStyle} value={cycleId} disabled={busy} onChange={(event) => setCycleId(event.target.value)}>{cycles.map((entry, index) => <option key={entry.id} value={entry.id}>Cycle {index + 1} · {new Date(entry.deadline_at).toLocaleDateString("en-PH", { timeZone: "Asia/Manila" })}</option>)}</select></div>}
    {ready && role === "districtCoordinator" && <>
      {district.length === 0 && <p className="text-sm">No locked school packets are available.</p>}
      {district.map((packet) => <article key={packet.packet_id} className="space-y-3 border-t border-foreground/10 pt-4">
        <h3 className="font-medium">Packet version {packet.version} · {packet.completeness}</h3>
        <p className="text-sm">{packet.submission_count} submitted · {packet.missing_count} missing</p>
        <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); void action("tanaw_district_review", { target_packet: packet.packet_id, decision: String(form.get("decision")), review_comment: String(form.get("comment")) }); }}>
          <label className="block text-sm">Decision<select name="decision" className={inputStyle} disabled={busy}><option value="accept">Accept</option><option value="return">Return with comments</option></select></label>
          <label className="block text-sm">Review comments<textarea name="comment" className={inputStyle} maxLength={2000} disabled={busy} /></label>
          <button className={buttonStyle} disabled={busy}>Record district decision</button>
        </form>
      </article>)}
    </>}
    {ready && cycleId && role !== "districtCoordinator" && <>
      {slots.length === 0 && <p className="text-sm">No visible submission assignments for this cycle.</p>}
      {submissions.length > 0 && <div><label htmlFor="workflow-submission" className="block text-sm font-medium">Assigned submission</label><select id="workflow-submission" className={inputStyle} value={submissionId} disabled={busy} onChange={(event) => setSubmissionId(event.target.value)}><option value="">Select a submission</option>{submissions.map((submission) => { const slot = slots.find((entry) => entry.id === submission.slot_id); return <option key={submission.id} value={submission.id}>{slot?.scope_label} · {slot?.subject_id} · {submission.current_version ? "Version " + submission.current_version : "Missing"}</option>; })}</select></div>}
      {selected && versionReady && <>
        <p className="text-sm">{versions.length} recent source version(s). Current version: {selected.current_version || "not submitted"}.</p>
        {currentVersion && <div className="space-y-2 rounded-lg bg-foreground/5 p-4"><h3 className="font-medium">Current recorded evidence</h3>{currentVersion.evidence.entries.map((entry) => <p key={entry.definitionId} className="break-words text-sm">{definitions.find((definition) => definition.id === entry.definitionId)?.label ?? "Recorded indicator"}: {entry.value} · {entry.sourceTitle} · {entry.sourceLocator}</p>)}</div>}
        {(role === "teacher" || role === "smeaCoordinator") && <form onSubmit={submitManual} className="space-y-3">
          <p className="text-sm text-foreground/65">Manual entry is for indicators without a class-record spreadsheet source. Class-record uploads remain unavailable while approved computations are being verified.</p>
          <label className="block text-sm">Verified indicator<select name="definition" className={inputStyle} required disabled={busy || definitions.length === 0}><option value="">Select an indicator</option>{definitions.map((definition) => <option key={definition.id} value={definition.id}>{definition.label} ({definition.unit})</option>)}</select></label>
          <label className="block text-sm">Recorded value<input name="value" type="number" step="any" required className={inputStyle} disabled={busy} /></label>
          <label className="block text-sm">Evidence title<input name="sourceTitle" required maxLength={200} className={inputStyle} disabled={busy} /></label>
          <label className="block text-sm">Evidence location or reference<input name="sourceLocator" required maxLength={1000} className={inputStyle} disabled={busy} /></label>
          <label className="block text-sm">Reason for submission or correction<textarea name="reason" required maxLength={2000} className={inputStyle} disabled={busy} /></label>
          <button className={buttonStyle} disabled={busy || definitions.length === 0}>Submit a new evidence version</button>
        </form>}
        {role === "subjectCoordinator" && <button type="button" className={buttonStyle} disabled={busy || !currentVersion || selectedSlot?.author_id === actorId} onClick={() => void action("tanaw_review_submission", { target_submission: submissionId, expected_version: selected.current_version })}>Record subject review of this version</button>}
        {role === "smeaCoordinator" && !cycle?.locked_at && <form className="space-y-3" onSubmit={(event) => timedAction(event, "tanaw_extend_submission")}><h3 className="font-medium">Submission extension</h3><label className="block text-sm">Extension cutoff (Philippine time)<input name="deadline" type="datetime-local" step="60" required className={inputStyle} disabled={busy} /></label><label className="block text-sm">Reason<textarea name="reason" required maxLength={2000} className={inputStyle} disabled={busy} /></label><button className={buttonStyle} disabled={busy}>Grant this submission an extension</button></form>}
      </>}
      {role === "smeaCoordinator" && !cycle?.locked_at && <details><summary className="cursor-pointer text-sm font-medium">Assign a submission</summary><form onSubmit={assign} className="mt-3 space-y-3"><label className="block text-sm">Assigned account ID<input name="author" required className={inputStyle} disabled={busy} /></label><label className="block text-sm">Assigned subject<input name="subject" required className={inputStyle} disabled={busy} /></label><label className="block text-sm">Class or reporting scope<input name="scope" required className={inputStyle} disabled={busy} /></label><label className="block text-sm">Assignment reason<textarea name="reason" required maxLength={2000} className={inputStyle} disabled={busy} /></label><button className={buttonStyle} disabled={busy}>Assign submission</button></form></details>}
      {role === "smeaCoordinator" && <>
        {slots.filter((slot) => submissions.find((submission) => submission.slot_id === slot.id)?.current_version === 0).map((slot) => <label key={slot.id} className="block text-sm">Reason for missing {slot.scope_label}<input className={inputStyle} value={missingReasons[slot.id] ?? ""} disabled={busy} onChange={(event) => setMissingReasons({ ...missingReasons, [slot.id]: event.target.value })} /></label>)}
        <button type="button" className={buttonStyle} disabled={busy || slots.length === 0} onClick={() => void action("tanaw_prepare_packet", { target_cycle: cycleId, missing_reasons: slots.filter((slot) => submissions.find((submission) => submission.slot_id === slot.id)?.current_version === 0).map((slot) => ({ slotId: slot.id, reason: missingReasons[slot.id] ?? "" })) })}>Prepare a new school packet version</button>
        {cycle?.locked_at && <details><summary className="cursor-pointer text-sm font-medium">Start an amendment</summary><form className="mt-3 space-y-3" onSubmit={(event) => timedAction(event, "tanaw_open_amendment")}><p className="text-sm">Previous locked packets remain preserved. Changed submissions need new subject and packet reviews.</p><label className="block text-sm">Amendment cutoff (Philippine time)<input name="deadline" type="datetime-local" step="60" required className={inputStyle} disabled={busy} /></label><label className="block text-sm">Amendment reason<textarea name="reason" required maxLength={2000} className={inputStyle} disabled={busy} /></label><button className={buttonStyle} disabled={busy}>Open amendment round</button></form></details>}
      </>}
      {latest && (role === "smeaCoordinator" || role === "schoolHead") && <article className="space-y-3 border-t border-foreground/10 pt-4"><h3 className="font-medium">Latest school packet · Version {latest.version}</h3><p className="text-sm">{latest.locked_at ? "Locked · " + latest.completeness : "Awaiting reviews and explicit Lock"}</p>{latest.missing.map((missing) => <p key={missing.slotId} className="break-words text-sm">Missing: {slots.find((slot) => slot.id === missing.slotId)?.scope_label ?? "Assigned submission"} · {missing.reason}</p>)}
        {!latest.locked_at && <><label className="flex gap-2 text-sm"><input type="checkbox" checked={acknowledge} onChange={(event) => setAcknowledge(event.target.checked)} disabled={busy} />I acknowledge the listed missing submissions.</label><button type="button" className={buttonStyle} disabled={busy} onClick={() => void action("tanaw_review_packet", { target_packet: latest.id, review_stage: role === "schoolHead" ? "head" : "school", acknowledge_missing: acknowledge })}>Record {role === "schoolHead" ? "School Head" : "school"} review</button>{role === "smeaCoordinator" && <button type="button" className={buttonStyle} disabled={busy} onClick={() => void action("tanaw_lock_packet", { target_packet: latest.id })}>Lock this school packet</button>}</>}
      </article>}
    </>}
    <button type="button" className="text-sm underline underline-offset-4 disabled:opacity-50" disabled={busy} onClick={() => void load()}>Refresh workflow</button>
    <p className="text-xs leading-5 text-foreground/60">Recorded evidence requires the assigned reviews. Deadline closure, school Lock and district acceptance are separate events.</p>
  </section>;
}
