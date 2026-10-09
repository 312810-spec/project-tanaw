"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";

import { ManualEvidenceForm } from "@/app/components/manual-evidence-form";
import { confirmLeavingWork, clearFormDirty } from "@/app/components/unsaved-work";
import { indicatorCoverage, workflowError } from "@/app/lib/workflow-ux";
import { workflowReminders } from "@/app/lib/workflow-reminders";
import type { EvidenceDraft } from "@/app/lib/submission-drafts";

type Assignee = { user_id: string; email: string; roles: string[]; subject_ids: string[]; active: boolean };
type Cycle = { id: string; instructional_block_id: string; deadline_at: string; locked_at: string | null };
type Slot = { id: string; author_id: string; subject_id: string; scope_label: string; required_indicator_ids: string[] | null };
type Submission = { id: string; slot_id: string; current_version: number; extension_until: string | null; extension_reason: string | null };
type Entry = { definitionId: string; value: number; sourceTitle: string; sourceLocator: string };
type Version = { version: number; evidence: { kind: string; entries: Entry[] }; reason: string; created_at: string };
type Definition = { id: string; label: string; unit: string };
type ManifestItem = { slot: string; submission: string; version: number; requiredIndicators?: string[] | null };
type PacketReview = { packet_id: string; stage: string; reviewer_id: string; self_review: boolean; acknowledged_missing: boolean };
type Feedback = { packet_version: number; action: string; comment: string; created_at: string };
type Round = { id: string; deadline_at: string; reason: string; closed_at: string | null };
type Snapshot = Version & { submission_id: string };
type Packet = { manifest: ManifestItem[]; id: string; version: number; locked_at: string | null; completeness: string | null; missing: { slotId: string; reason: string }[] };
type DistrictPacket = { cycle_id: string; packet_id: string; version: number; completeness: string; submission_count: number; missing_count: number };
const inputStyle = "w-full min-w-0 rounded-lg border border-foreground/20 bg-background p-3 text-sm";
function currentTime() { return Date.now(); }
const buttonStyle = "rounded-lg border border-brand px-4 py-2 text-sm text-brand disabled:opacity-50";

export function SchoolWorkflow({ schoolId, role, actorId }: { schoolId: string; role: string; actorId: string }) {
  const generation = useRef(0);
  const districtRequests = useRef<Record<string, string>>({});
  const [districtDecisions, setDistrictDecisions] = useState<{ id: string; packet_id: string; action: string; comment: string; created_at: string }[]>([]);
  const invalidate = useCallback(() => { generation.current++; }, []);
  const [now, setNow] = useState<number>(NaN);
  const [reviews, setReviews] = useState<{ submission_id: string; version: number }[]>([]);
  useEffect(() => { const update = () => setNow(Date.now()); const timer = setInterval(update, 30000); queueMicrotask(update); return () => clearInterval(timer); }, []);
  const [status, setStatus] = useState("Loading school workflow…");
  const [ready, setReady] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [stale, setStale] = useState(true);
  const [busy, setBusy] = useState(false);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [cycleId, setCycleId] = useState("");
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [definitions, setDefinitions] = useState<Definition[]>([]);
  const [packetReviews, setPacketReviews] = useState<PacketReview[]>([]);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [cycleLabels, setCycleLabels] = useState<Record<string, string>>({});
  const [packets, setPackets] = useState<Packet[]>([]);
  const [district, setDistrict] = useState<DistrictPacket[]>([]);
  const [submissionId, setSubmissionId] = useState("");
  const draftScope = useMemo(() => ({ actorId, schoolId, submissionId }), [actorId, schoolId, submissionId]);
  const [versions, setVersions] = useState<Version[]>([]);
  const [historyRevision, setHistoryRevision] = useState(0);
  const [versionReady, setVersionReady] = useState(false);
  const [acknowledge, setAcknowledge] = useState(false);
  const [missingReasons, setMissingReasons] = useState<Record<string, string>>({});
  const load = useCallback(async () => {
    const request = ++generation.current;
    setRefreshing(true); setStale(true);
    setStatus("Refreshing school workflow… Actions are paused until verification finishes.");
    try {
      const client = createSupabaseBrowserClient();
      if (role === "districtCoordinator") {
        const result = await client.rpc("tanaw_district_packets", { target_school: schoolId });
        if (request !== generation.current) return;
        if (result.error) throw result.error;
        const ids = (result.data ?? []).map((packet: DistrictPacket) => packet.packet_id);
        const history = ids.length ? await client.from("tanaw_district_decisions").select("id,packet_id,action,comment,created_at").in("packet_id", ids).order("decision_revision", { ascending: false }).limit(1000) : { data: [], error: null };
        if (request !== generation.current) return;
        if (history.error) throw history.error;
        setDistrictDecisions(history.data ?? []);
        setDistrict(result.data ?? []); setReady(true); setStale(false); setStatus("Locked packet status loaded. Learner records are restricted to the school."); return true;
      }
      if (role === "smeaCoordinator") {
        const directory = await client.rpc("tanaw_member_directory", { target_school: schoolId });
        if (request !== generation.current) return;
        if (directory.error) throw new Error("Assigned accounts unavailable");
        setAssignees((directory.data ?? []).filter((member: Assignee) => member.active && member.roles.some((assignedRole) => ["teacher", "smeaCoordinator"].includes(assignedRole))));
      }
      const cycleResult = await client.from("tanaw_reporting_cycles").select("id,instructional_block_id,deadline_at,locked_at").eq("school_id", schoolId).order("deadline_at", { ascending: false });
      if (request !== generation.current) return;
      if (cycleResult.error) throw cycleResult.error;
      const list: Cycle[] = cycleResult.data ?? [];
      setCycles(list);
      const labels = list.length ? await client.from("tanaw_instructional_blocks").select("id,school_year,label").in("id", list.map((entry) => entry.instructional_block_id)) : { data: [], error: null };
      if (labels.error) throw labels.error;
      setCycleLabels(Object.fromEntries((labels.data ?? []).map((block) => [block.id, block.school_year + " · " + block.label])));
      const selected = list.some((cycle) => cycle.id === cycleId) ? cycleId : list[0]?.id ?? "";
      if (selected !== cycleId) { setCycleId(selected); return false; }
      if (!selected) { setReady(true); setStale(false); setStatus("The coordinator has not created a reporting cycle yet."); return true; }
      const calendar = await client.from("tanaw_instructional_blocks").select("school_year,label").eq("id", list.find((cycle) => cycle.id === selected)!.instructional_block_id).single();
      if (calendar.error || !calendar.data) throw new Error("Verified calendar reference unavailable");
      const [slotResult, definitionResult, packetResult] = await Promise.all([
        client.from("tanaw_submission_slots").select("id,author_id,subject_id,scope_label,required_indicator_ids", { count: "exact" }).eq("cycle_id", selected).limit(500),
        client.from("smea_indicator_definitions").select("id,label,unit").eq("school_id", schoolId).eq("definition_status", "verified").eq("school_year", calendar.data.school_year).eq("reporting_period", calendar.data.label),
        client.from("tanaw_school_packets").select("id,version,locked_at,completeness,missing,manifest").eq("cycle_id", selected).order("version", { ascending: false }).limit(20),
      ]);
      if (request !== generation.current) return;
      if (slotResult.error || definitionResult.error || packetResult.error) throw new Error("Workflow access could not be verified");
      if (slotResult.count !== slotResult.data?.length) throw new Error("Assignment page is incomplete");
      const visibleSlots: Slot[] = (slotResult.data ?? []).filter((slot) => role !== "teacher" || slot.author_id === actorId);
      setSlots(visibleSlots); setDefinitions(definitionResult.data ?? []); setPackets(packetResult.data ?? []);
      const submissionResult = visibleSlots.length ? await client.from("tanaw_submissions").select("id,slot_id,current_version,extension_until,extension_reason", { count: "exact" }).in("slot_id", visibleSlots.map((slot) => slot.id)).limit(500) : { data: [], error: null, count: 0 };
      if (request !== generation.current) return;
      if (submissionResult.error || submissionResult.count !== submissionResult.data?.length) throw new Error("Submission page is incomplete");
      const reviewResult = submissionResult.data?.length ? await client.from("tanaw_submission_reviews").select("submission_id,version", { count: "exact" }).in("submission_id", submissionResult.data.map((submission) => submission.id)).limit(1000) : { data: [], error: null, count: 0 };
      if (request !== generation.current) return;
      if (reviewResult.error || reviewResult.count !== reviewResult.data?.length) throw new Error("Review page is incomplete");
      const packetIds = (packetResult.data ?? []).map((packet) => packet.id);
      const snapshotIds = [...new Set([...(submissionResult.data ?? []).map((sub) => sub.id), ...(packetResult.data ?? []).flatMap((packet) => (packet.manifest as ManifestItem[]).filter((entry) => entry.version > 0).map((entry) => entry.submission))])];
      const [packetReviewResult, roundResult, feedbackResult, snapshotResult] = await Promise.all([
        packetIds.length ? client.from("tanaw_packet_reviews").select("packet_id,stage,reviewer_id,self_review,acknowledged_missing").in("packet_id", packetIds) : { data: [], error: null },
        client.from("tanaw_amendment_rounds").select("id,deadline_at,reason,closed_at").eq("cycle_id", selected).order("created_at", { ascending: false }).limit(20),
        client.rpc("tanaw_school_feedback", { target_cycle: selected }),
        snapshotIds.length ? client.from("tanaw_submission_versions").select("submission_id,version,evidence,reason,created_at", { count: "exact" }).in("submission_id", snapshotIds).limit(5000) : { data: [], error: null, count: 0 },
      ]);
      if (request !== generation.current) return;
      if (packetReviewResult.error || roundResult.error || feedbackResult.error || snapshotResult.error || snapshotResult.count !== snapshotResult.data?.length) throw new Error("Packet review details unavailable");
      setPacketReviews(packetReviewResult.data ?? []); setRounds(roundResult.data ?? []); setFeedback(feedbackResult.data ?? []); setSnapshots(snapshotResult.data ?? []);
      setReviews(reviewResult.data ?? []); setNow(Date.now());
      setSubmissions(submissionResult.data ?? []); setHistoryRevision((revision) => revision + 1); setReady(true); setStale(false); setStatus("School workflow loaded."); return true;
    } catch { if (request === generation.current) setStatus("Workflow refresh failed. Previously loaded information may be out of date; actions are paused. Retry refresh."); return false; }
    finally { if (request === generation.current) setRefreshing(false); }
  }, [schoolId, role, actorId, cycleId]);
  useEffect(() => { let cancelled = false; queueMicrotask(() => { if (!cancelled) { setSubmissionId(""); setMissingReasons({}); setAcknowledge(false); void load(); } }); return () => { cancelled = true; invalidate(); }; }, [load, invalidate]);
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => { if (!cancelled) { setVersions([]); setVersionReady(false); } });
    if (!submissionId || !ready) return () => { cancelled = true; };
    void (async () => {
      const result = await createSupabaseBrowserClient().from("tanaw_submission_versions").select("version,evidence,reason,created_at").eq("submission_id", submissionId).order("version", { ascending: false }).limit(20);
      if (cancelled) return;
      if (result.error) { setStatus("Evidence history could not be verified. Refresh before submitting or reviewing."); return; }
      setVersions(result.data ?? []); setVersionReady(true);
    })();
    return () => { cancelled = true; };
  }, [submissionId, ready, historyRevision]);
  const selected = submissions.find((submission) => submission.id === submissionId);
  const selectedSlot = slots.find((slot) => slot.id === selected?.slot_id);
  const currentVersion = versions.find((version) => version.version === selected?.current_version);
  const cycle = cycles.find((entry) => entry.id === cycleId);
  const latest = packets[0];
  const openRound = rounds.find((round) => !round.closed_at);
  const activeAmendment = !!openRound && new Date(openRound.deadline_at).getTime() > now;
  const submissionCoverage = selectedSlot ? indicatorCoverage(selectedSlot, currentVersion?.evidence.entries ?? [], definitions.map((def) => def.id)) : null;
  const latestReviews = packetReviews.filter((review) => review.packet_id === latest?.id);
  const manifestCurrent = !!latest && latest.manifest.length === slots.length && latest.manifest.every((entry) => {
    const slot = slots.find((slot) => slot.id === entry.slot), submission = submissions.find((sub) => sub.id === entry.submission);
    return (entry.version === 0 || snapshots.some((snapshot) => snapshot.submission_id === entry.submission && snapshot.version === entry.version)) && submission?.current_version === entry.version && JSON.stringify(entry.requiredIndicators ?? null) === JSON.stringify(slot?.required_indicator_ids ?? null);
  });
  const lockReady = manifestCurrent && latestReviews.some((review) => review.stage === "school") && latestReviews.some((review) => review.stage === "head" && !review.self_review && (!latest.missing.length || review.acknowledged_missing));
  const reminders = cycle ? workflowReminders(cycle.deadline_at, !!cycle.locked_at, submissions, reviews, now) : null;
  async function action(name: string, args: Record<string, unknown>) {
    if (!ready || busy || refreshing || stale) return false;
    if (!navigator.onLine) { setStatus("Connect to the internet for submission and review actions."); return false; }
    if (name === "tanaw_lock_packet" && !window.confirm(`Lock school packet version ${latest?.version} (${args.target_packet})?\nThis records an explicit school Lock. Corrections require an amendment and new reviews. District acceptance remains a separate decision.`)) return false;
    if (name === "tanaw_district_review_request") {
      if (!["accept", "return"].includes(String(args.decision))) { setStatus("Choose a district decision before recording it."); return false; }
      if (args.decision === "return" && !String(args.review_comment).trim()) { setStatus("Explain what the school needs to correct before returning this packet."); return false; }
      if (!window.confirm(`Record ${args.decision} for packet ${args.target_packet}?\nComments: ${args.review_comment || "None"}\nThis decision is recorded in the district review history.`)) return false;
    }
    const consequence: Record<string, string> = {
      tanaw_open_amendment: "Open an amendment for cycle " + cycleId + " until " + args.amendment_deadline + "? Previous locked packets remain preserved. Changed evidence needs new reviews. An expired prior round will be closed.",
      tanaw_extend_submission: "Extend submission " + args.target_submission + " until " + args.until_time + "? This changes only this assignment’s cutoff. Reason: " + args.change_reason,
      tanaw_handover_unsubmitted: "Hand over submission " + args.target_submission + " to account " + args.target_author + "? Authorship history is preserved; device drafts stay with the original account. Reason: " + args.change_reason,
      tanaw_set_slot_requirements: "Change required indicators for submission " + args.target_submission + "? Previous packet snapshots will require preparation and fresh reviews. Reason: " + args.change_reason,
    };
    if (consequence[name] && !window.confirm(consequence[name])) return false;
    const request = generation.current;
    setBusy(true); setStatus("Recording action…");
    try {
      const { error } = await createSupabaseBrowserClient().rpc(name, args);
      if (request !== generation.current) return false;
      if (error) { setStatus(workflowError(error.code, error.message)); return false; }
      const refreshed = await load(); setStatus(refreshed ? "Action recorded with its history." : "Action recorded, but the view could not be refreshed. Retry refresh before taking another action."); return true;
    } catch { if (request === generation.current) setStatus("Connection interrupted. Refresh to check whether the action was recorded before retrying."); return false; }
    finally { setBusy(false); }
  }
  async function submitManual(form: EvidenceDraft) {
    if (!selected || !versionReady || (selected.current_version > 0 && !currentVersion)) return false;
    const definitionId = form.definition; const raw = form.value;
    const value = Number(raw);
    if (!definitions.some((definition) => definition.id === definitionId) || !raw.trim() || !Number.isFinite(value)) { setStatus("Select a verified indicator and enter a recorded numeric value. Leave missing evidence unsubmitted."); return false; }
    const entry: Entry = { definitionId, value, sourceTitle: form.sourceTitle.trim(), sourceLocator: form.sourceLocator.trim() };
    const entries = [...(currentVersion?.evidence.entries ?? []).filter((item) => item.definitionId !== definitionId), entry];
    return action("tanaw_submit_evidence", { target_submission: selected.id, expected_version: selected.current_version, new_evidence: { kind: "manualIndicators", entries }, change_reason: form.reason });
  }
  function assign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const formElement = event.currentTarget; const form = new FormData(formElement);
    void action("tanaw_assign_submission", { target_cycle: cycleId, target_author: String(form.get("author")), target_subject: String(form.get("subject")), target_scope: String(form.get("scope")), change_reason: String(form.get("reason")) }).then((saved) => { if (saved) clearFormDirty(formElement); });
  }
  function timedAction(event: FormEvent<HTMLFormElement>, name: string) {
    event.preventDefault(); const formElement = event.currentTarget; const form = new FormData(formElement); const deadline = String(form.get("deadline"));
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(deadline)) return;
    const until = new Date(deadline + ":00+08:00");
    if (!Number.isFinite(until.getTime()) || until.getTime() <= currentTime()) { setStatus("Choose a future cutoff in Philippine time."); return; }
    void action(name, name === "tanaw_open_amendment" ? { target_cycle: cycleId, amendment_deadline: until.toISOString(), change_reason: String(form.get("reason")) } : { target_submission: submissionId, until_time: until.toISOString(), change_reason: String(form.get("reason")) }).then((saved) => { if (saved) clearFormDirty(formElement); });
  }
  return <section aria-busy={busy || refreshing} className="space-y-5 rounded-xl border border-foreground/15 p-5" aria-labelledby="school-workflow-heading">
    <h2 id="school-workflow-heading" className="text-lg font-semibold">Submissions and packet review</h2>
    <p role="status" aria-live="polite" className="text-sm">{status}</p>
    <fieldset disabled={busy || refreshing || stale} className="space-y-5 min-w-0">
    {role !== "districtCoordinator" && cycles.length > 0 && <div><label htmlFor="workflow-cycle" className="block text-sm font-medium">Reporting cycle</label><select id="workflow-cycle" className={inputStyle} value={cycleId} disabled={busy} onChange={(event) => { if (confirmLeavingWork()) setCycleId(event.target.value); }}>{cycles.map((entry) => <option key={entry.id} value={entry.id}>{cycleLabels[entry.instructional_block_id] ?? entry.id} · {new Date(entry.deadline_at).toLocaleDateString("en-PH", { timeZone: "Asia/Manila" })}</option>)}</select></div>}
    {ready && role === "districtCoordinator" && <>
      {district.length === 0 && <p className="text-sm">No locked school packets are available.</p>}
      {district.map((packet) => <article key={packet.packet_id} className="space-y-3 border-t border-foreground/10 pt-4">
        <h3 className="font-medium">Packet version {packet.version} · {packet.completeness}</h3>
        <p className="text-sm">Process counts only. Governed indicator results are not connected; acceptance is unavailable. Return the packet with a practical correction request if needed.</p>
        <p className="text-sm">{packet.submission_count} coverage-complete assignment(s) · {packet.missing_count} incomplete assignment(s)</p>
        {districtDecisions.filter((entry) => entry.packet_id === packet.packet_id).map((entry) => <p key={entry.id} className="break-words text-sm">Recorded {entry.action} · {new Date(entry.created_at).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}<br />{entry.comment}</p>)}
        <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); const formElement = event.currentTarget; const form = new FormData(formElement); void action("tanaw_district_review_request", { target_packet: packet.packet_id, decision: String(form.get("decision")), review_comment: String(form.get("comment")), request_id: districtRequests.current[JSON.stringify([packet.packet_id, form.get("decision"), form.get("comment")])] ??= crypto.randomUUID(), expected_decision_id: districtDecisions.find((entry) => entry.packet_id === packet.packet_id)?.id ?? null }).then((saved) => { if (saved) clearFormDirty(formElement); }); }}>
          <label className="block text-sm">Decision<select name="decision" required defaultValue="" className={inputStyle} disabled={busy}><option value="" disabled>Choose a decision</option><option value="accept" disabled>Accept — governed results not connected</option><option value="return">Return with comments</option></select></label>
          <label className="block text-sm">Review comments<textarea name="comment" className={inputStyle} maxLength={2000} disabled={busy} /></label>
          <button className={buttonStyle} disabled={busy}>Record district decision</button>
        </form>
      </article>)}
    </>}
    {ready && cycleId && role !== "districtCoordinator" && <>
      {feedback.length > 0 && <aside aria-label="District feedback" className="space-y-3 rounded-lg border border-foreground/20 p-4"><h3 className="font-semibold">District decisions and correction requests</h3>{feedback.map((entry, index) => <p key={index} className="break-words text-sm">Packet {entry.packet_version} · {entry.action} · {new Date(entry.created_at).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}<br />{entry.comment || "No comment recorded."}</p>)}</aside>}
      {cycle?.locked_at && <aside className="rounded-lg bg-foreground/5 p-4 text-sm"><p>{activeAmendment ? "Active amendment" : openRound ? "Amendment expired; ask the coordinator to start a new round." : "Packet locked; corrections require an amendment."}</p>{openRound && <p>Cutoff: {new Date(openRound.deadline_at).toLocaleString("en-PH", { timeZone: "Asia/Manila" })} Philippine time · {openRound.reason}</p>}<p>The device clock is advisory. The server controls eligibility.</p></aside>}
      {reminders && <aside aria-label="Deadline reminders" className="space-y-2 rounded-lg bg-foreground/5 p-4"><h3 className="text-sm font-semibold">{reminders.deadline}</h3><p className="text-sm">{reminders.missing} missing submission(s) · {reminders.awaitingSubjectReview} awaiting current-version subject review · {reminders.activeExtensions} active extension(s)</p><p className="text-xs text-foreground/60">Counts cover your visible assignments. Deadline alerts use this device’s clock; the server controls editing and final actions.</p></aside>}
      {slots.length === 0 && <p className="text-sm">No visible submission assignments for this cycle.</p>}
      {submissions.length > 0 && <div><label htmlFor="workflow-submission" className="block text-sm font-medium">Assigned submission</label><select id="workflow-submission" className={inputStyle} value={submissionId} disabled={busy} onChange={(event) => { if (confirmLeavingWork()) setSubmissionId(event.target.value); }}><option value="">Select a submission</option>{submissions.map((submission) => { const slot = slots.find((entry) => entry.id === submission.slot_id); return <option key={submission.id} value={submission.id}>{slot?.scope_label} · {slot?.subject_id} · Author {assignees.find((member) => member.user_id === slot?.author_id)?.email ?? slot?.author_id} · {submission.current_version ? "Version " + submission.current_version : "Missing"}</option>; })}</select></div>}
      {selected && <>
        {submissionCoverage && <p className="text-sm">{!submissionCoverage.configured ? "Required indicators have not been configured; this assignment cannot establish packet completeness." : submissionCoverage.complete ? "Required indicators recorded for this assignment. Reviews remain separate." : submissionCoverage.missing.length + " required indicator(s) still missing: " + submissionCoverage.missing.map((id) => definitions.find((def) => def.id === id)?.label ?? id).join(", ")}</p>}
        {role === "smeaCoordinator" && (!cycle?.locked_at || activeAmendment) && <details><summary className="cursor-pointer text-sm font-medium">Configure this assignment’s required indicators</summary><form className="mt-3 space-y-3" onSubmit={(event) => { event.preventDefault(); const element = event.currentTarget; const form = new FormData(element); void action("tanaw_set_slot_requirements", { target_submission: selected.id, expected_version: selected.current_version, indicator_ids: form.getAll("indicators"), change_reason: String(form.get("reason")) }).then((saved) => { if (saved) clearFormDirty(element); }); }}><p className="text-sm">Choose requirements from the verified period registry. Changes invalidate earlier packet snapshots and need fresh packet reviews.</p>{definitions.map((definition) => <label key={definition.id} className="flex gap-2 text-sm"><input type="checkbox" name="indicators" value={definition.id} defaultChecked={selectedSlot?.required_indicator_ids?.includes(definition.id)} />{definition.label}</label>)}<label className="block text-sm">Reason<textarea name="reason" required maxLength={2000} className={inputStyle} /></label><button className={buttonStyle}>Save indicator requirements</button></form></details>}
        <p className="text-sm">{versions.length} recent source version(s). Current version: {selected.current_version || "not submitted"}.</p>
        {!versionReady && <p role="status" className="text-sm">Verifying evidence history…</p>}
        {selected.extension_until && <p className="text-sm">Submission extension cutoff: {new Date(selected.extension_until).toLocaleString("en-PH", { timeZone: "Asia/Manila" })} Philippine time. Reason: {selected.extension_reason}. The server determines whether submission is allowed.</p>}
        {reviews.some((review) => review.submission_id === selected.id && review.version === selected.current_version) && <p className="text-sm">Subject review is recorded for this version.</p>}
        {currentVersion && <div className="space-y-2 rounded-lg bg-foreground/5 p-4"><h3 className="font-medium">Current recorded evidence</h3>{currentVersion.evidence.entries.map((entry) => <p key={entry.definitionId} className="break-words text-sm">{definitions.find((definition) => definition.id === entry.definitionId)?.label ?? "Recorded indicator"}: {entry.value} · {entry.sourceTitle} · {entry.sourceLocator}</p>)}</div>}
        {versions.length > 0 && <details><summary className="cursor-pointer text-sm font-medium">Inspect recent evidence versions</summary><ol className="mt-3 space-y-4">{versions.map((entry) => <li key={entry.version} className="rounded-lg border border-foreground/20 p-3 text-sm"><h4 className="font-medium">Version {entry.version} · {new Date(entry.created_at).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}</h4><p className="break-words">Reason: {entry.reason}</p>{entry.evidence.entries.map((evidence) => <p key={evidence.definitionId} className="break-words">{definitions.find((definition) => definition.id === evidence.definitionId)?.label ?? evidence.definitionId}: {evidence.value} · {evidence.sourceTitle} · {evidence.sourceLocator}</p>)}</li>)}</ol></details>}
        {(role === "teacher" || (role === "smeaCoordinator" && selectedSlot?.author_id === actorId)) && <ManualEvidenceForm key={submissionId} scope={draftScope} version={selected.current_version} definitions={definitions} busy={busy || !versionReady || refreshing || stale} onSubmit={submitManual} />}
        {role === "subjectCoordinator" && <button type="button" className={buttonStyle} disabled={busy || !versionReady || !currentVersion || selectedSlot?.author_id === actorId || reviews.some((review) => review.submission_id === selected.id && review.version === selected.current_version)} onClick={() => void action("tanaw_review_submission", { target_submission: submissionId, expected_version: selected.current_version })}>Record subject review of this version</button>}
        {role === "smeaCoordinator" && selected.current_version === 0 && !cycle?.locked_at && <details><summary className="cursor-pointer text-sm font-medium">Hand over an unsubmitted assignment</summary><form className="mt-3 space-y-3" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); void action("tanaw_handover_unsubmitted", { target_submission: selected.id, target_author: String(form.get("author")), expected_author: selectedSlot?.author_id, change_reason: String(form.get("reason")) }); }}>
          <p className="text-xs leading-5 text-foreground/65">The original account and handover reason remain in history. Device drafts stay with the original account; deadlines and extensions stay unchanged.</p>
          <label className="block text-sm">New assigned account<select name="author" required className={inputStyle} disabled={busy}><option value="">Select a replacement</option>{assignees.filter((member) => member.user_id !== selectedSlot?.author_id && (member.roles.includes("smeaCoordinator") || member.subject_ids.includes(selectedSlot?.subject_id ?? ""))).map((member) => <option key={member.user_id} value={member.user_id}>{member.email || member.user_id}</option>)}</select></label>
          <label className="block text-sm">Handover reason<textarea name="reason" required maxLength={2000} className={inputStyle} disabled={busy} /></label><button className={buttonStyle} disabled={busy}>Record assignment handover</button>
        </form></details>}
        {role === "smeaCoordinator" && !cycle?.locked_at && <form className="space-y-3" onSubmit={(event) => timedAction(event, "tanaw_extend_submission")}><h3 className="font-medium">Submission extension</h3><label className="block text-sm">Extension cutoff (Philippine time)<input name="deadline" type="datetime-local" step="60" required className={inputStyle} disabled={busy} /></label><label className="block text-sm">Reason<textarea name="reason" required maxLength={2000} className={inputStyle} disabled={busy} /></label><button className={buttonStyle} disabled={busy}>Grant this submission an extension</button></form>}
      </>}
      {role === "smeaCoordinator" && !cycle?.locked_at && <details><summary className="cursor-pointer text-sm font-medium">Assign a submission</summary><form onSubmit={assign} className="mt-3 space-y-3"><label className="block text-sm">Assigned account<select name="author" required className={inputStyle} disabled={busy}><option value="">Select an active account</option>{assignees.map((member) => <option key={member.user_id} value={member.user_id}>{member.email || member.user_id}</option>)}</select></label><label className="block text-sm">Assigned subject<input name="subject" list="workflow-subjects" required className={inputStyle} disabled={busy} /><datalist id="workflow-subjects">{[...new Set(assignees.flatMap((member) => member.subject_ids))].sort().map((id) => <option key={id} value={id} />)}</datalist><span className="text-xs text-foreground/65">Use an existing provisioned subject scope. The server verifies the selected author’s assignment.</span></label><label className="block text-sm">Class or reporting scope<input name="scope" required className={inputStyle} disabled={busy} /></label><label className="block text-sm">Assignment reason<textarea name="reason" required maxLength={2000} className={inputStyle} disabled={busy} /></label><button className={buttonStyle} disabled={busy}>Assign submission</button></form></details>}
      {role === "smeaCoordinator" && <div data-work-draft className="space-y-3">
        {slots.filter((slot) => !indicatorCoverage(slot, snapshots.find((version) => version.submission_id === submissions.find((submission) => submission.slot_id === slot.id)?.id && version.version === submissions.find((submission) => submission.slot_id === slot.id)?.current_version)?.evidence.entries ?? [], definitions.map((def) => def.id)).complete).map((slot) => <label key={slot.id} className="block text-sm">Reason for incomplete {slot.scope_label}<input className={inputStyle} value={missingReasons[slot.id] ?? ""} disabled={busy} onChange={(event) => setMissingReasons({ ...missingReasons, [slot.id]: event.target.value })} /></label>)}
        <button type="button" className={buttonStyle} disabled={busy || slots.length === 0 || slots.some((slot) => !slot.required_indicator_ids?.length)} onClick={() => void action("tanaw_prepare_packet", { target_cycle: cycleId, missing_reasons: slots.filter((slot) => !indicatorCoverage(slot, snapshots.find((version) => version.submission_id === submissions.find((submission) => submission.slot_id === slot.id)?.id && version.version === submissions.find((submission) => submission.slot_id === slot.id)?.current_version)?.evidence.entries ?? [], definitions.map((def) => def.id)).complete).map((slot) => ({ slotId: slot.id, reason: missingReasons[slot.id] ?? "" })) })}>Prepare a new school packet version</button>
        {cycle?.locked_at && <details><summary className="cursor-pointer text-sm font-medium">Start an amendment</summary><form className="mt-3 space-y-3" onSubmit={(event) => timedAction(event, "tanaw_open_amendment")}><p className="text-sm">Previous locked packets remain preserved. Changed submissions need new subject and packet reviews.</p><label className="block text-sm">Amendment cutoff (Philippine time)<input name="deadline" type="datetime-local" step="60" required className={inputStyle} disabled={busy} /></label><label className="block text-sm">Amendment reason<textarea name="reason" required maxLength={2000} className={inputStyle} disabled={busy} /></label><button className={buttonStyle} disabled={busy || activeAmendment}>{activeAmendment ? "An amendment is already active" : "Open amendment round"}</button></form></details>}
      </div>}
      {latest && (role === "smeaCoordinator" || role === "schoolHead") && <article className="space-y-3 border-t border-foreground/10 pt-4"><h3 className="font-medium">Latest school packet · Version {latest.version}</h3><p className="text-sm">{latest.locked_at ? "Locked · " + latest.completeness : "Awaiting reviews and explicit Lock"}</p>{latest.missing.map((missing) => <p key={missing.slotId} className="break-words text-sm">Missing: {slots.find((slot) => slot.id === missing.slotId)?.scope_label ?? "Assigned submission"} · {missing.reason}</p>)}
        <p className="text-sm">{manifestCurrent ? "Snapshot matches current assignments and requirements." : "Snapshot differs from current assignments or indicator requirements. Prepare a new packet before reviewing."}</p>
        <ul className="space-y-2 text-sm">{latestReviews.map((review) => <li key={review.stage}>{review.stage === "head" ? "School Head" : "School"} review recorded · reviewer {review.reviewer_id}{review.self_review ? " · coordinator self-review" : ""}{review.acknowledged_missing ? " · missing evidence acknowledged" : ""}</li>)}</ul>
        <details><summary className="cursor-pointer text-sm font-medium">Inspect exact packet snapshot</summary><div className="mt-3 space-y-4">{latest.manifest.map((item) => { const slot = slots.find((slot) => slot.id === item.slot); const evidence = snapshots.find((version) => version.submission_id === item.submission && version.version === item.version); return <article key={item.slot} className="rounded-lg border border-foreground/20 p-3 text-sm"><h4 className="font-medium">{slot?.scope_label ?? item.slot} · {slot?.subject_id} · Version {item.version || "not submitted"}</h4><p>Required: {(item.requiredIndicators ?? []).map((id) => definitions.find((def) => def.id === id)?.label ?? id).join(", ") || "Not configured in this snapshot"}</p>{evidence ? evidence.evidence.entries.map((entry) => <p key={entry.definitionId} className="break-words">{definitions.find((def) => def.id === entry.definitionId)?.label ?? entry.definitionId}: {entry.value} · {entry.sourceTitle} · {entry.sourceLocator}</p>) : <p>{item.version ? "Snapshot evidence unavailable; refresh before review." : "No evidence version submitted."}</p>}</article>; })}</div></details>
        {!latest.locked_at && <><label className="flex gap-2 text-sm"><input type="checkbox" checked={acknowledge} onChange={(event) => setAcknowledge(event.target.checked)} disabled={busy} />I acknowledge the listed missing submissions.</label><button type="button" className={buttonStyle} disabled={busy || !manifestCurrent || latestReviews.some((review) => review.stage === (role === "schoolHead" ? "head" : "school")) || (role === "schoolHead" && !latestReviews.some((review) => review.stage === "school"))} onClick={() => void action("tanaw_review_packet", { target_packet: latest.id, review_stage: role === "schoolHead" ? "head" : "school", acknowledge_missing: acknowledge })}>Record {role === "schoolHead" ? "School Head" : "school"} review</button>{role === "smeaCoordinator" && <button type="button" className={buttonStyle} disabled={busy || !lockReady} onClick={() => void action("tanaw_lock_packet", { target_packet: latest.id })}>Lock this school packet</button>}</>}
      </article>}
    </>}
    </fieldset>
    <button type="button" className="text-sm underline underline-offset-4 disabled:opacity-50" disabled={busy || refreshing} onClick={() => { if (confirmLeavingWork()) void load(); }}>{refreshing ? "Refreshing workflow…" : "Refresh workflow"}</button>
    <p className="text-xs leading-5 text-foreground/60">Recorded evidence requires the assigned reviews. Deadline closure, school Lock and district acceptance are separate events.</p>
  </section>;
}
