"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";

import { PacketHistory } from "@/app/components/packet-history";
import { IndicatorRequirements } from "@/app/components/indicator-requirements";
import { ManualEvidenceForm } from "@/app/components/manual-evidence-form";
import { confirmLeavingWork, clearFormDirty } from "@/app/components/unsaved-work";
import { readPages } from "@/app/lib/read-pages";
import { indicatorCoverage, workflowError } from "@/app/lib/workflow-ux";
import { workflowReminders } from "@/app/lib/workflow-reminders";
import type { EvidenceDraft } from "@/app/lib/submission-drafts";

type Assignee = { user_id: string; email: string; roles: string[]; subject_ids: string[]; active: boolean };
type Cycle = { id: string; instructional_block_id: string; deadline_at: string; locked_at: string | null };
type Slot = { id: string; author_id: string; subject_id: string; scope_label: string; required_indicator_ids: string[] | null; requirements_revision: number };
type Submission = { id: string; slot_id: string; current_version: number; extension_until: string | null; extension_reason: string | null };
type Entry = { definitionId: string; value: number; sourceTitle: string; sourceLocator: string };
type Version = { version: number; evidence: { kind: string; entries: Entry[] }; reason: string; created_at: string };
type Definition = { id: string; label: string; unit: string; source_title: string; source_locator: string; source_id: string; school_year: string; reporting_period: string; numerator_definition: string | null; denominator_definition: string | null; formula_expression: string | null; rounding_rule: string | null };
type ManifestItem = { slot: string; submission: string; version: number; requiredIndicators?: string[] | null; requirementsRevision?: number; definitions?: { id: string; label: string; unit: string; sourceTitle: string; sourceLocator: string; sourceId: string; schoolYear: string; period: string; numerator: string | null; denominator: string | null; formula: string | null; rounding: string | null }[] };
type PacketReview = { packet_id: string; stage: string; reviewer_id: string; self_review: boolean; acknowledged_missing: boolean; created_at: string };
type Feedback = { packet_version: number; action: string; comment: string; created_at: string };
type Round = { id: string; deadline_at: string; reason: string; closed_at: string | null };
type Snapshot = Version & { submission_id: string };
type Packet = { amendment_round_id: string | null; prepared_by: string; manifest: ManifestItem[]; id: string; version: number; locked_at: string | null; completeness: string | null; missing: { slotId: string; reason: string }[] };
type DistrictPacket = { cycle_id: string; packet_id: string; version: number; completeness: string; submission_count: number; missing_count: number };
const inputStyle = "w-full min-w-0 rounded-lg border border-foreground/20 bg-background p-3 text-sm";
function currentTime() { return Date.now(); }
const buttonStyle = "rounded-lg border border-brand px-4 py-2 text-sm text-brand disabled:opacity-50";

export function SchoolWorkflow({ schoolId, role, actorId, schoolName, accessVerified = true }: { schoolId: string; role: string; actorId: string; schoolName?: string; accessVerified?: boolean }) {
  const statusRef = useRef<HTMLParagraphElement>(null);
  const [people, setPeople] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [taskFilter, setTaskFilter] = useState("all");
  const historyGeneration = useRef(0);
  const [historyMore, setHistoryMore] = useState(false);
  const [historyBusy, setHistoryBusy] = useState(false);
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
  const [assignmentAuthor, setAssignmentAuthor] = useState("");
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
  const latestPacketId = packets[0]?.id;
  useEffect(() => { let cancelled = false; queueMicrotask(() => { if (!cancelled) setAcknowledge(false); }); return () => { cancelled = true; }; }, [latestPacketId]);
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
        const cycleIds = [...new Set((result.data ?? []).map((packet: DistrictPacket) => packet.cycle_id))];
        const context = cycleIds.length ? await client.from("tanaw_reporting_cycles").select("id,instructional_block_id").in("id", cycleIds) : { data: [], error: null };
        const blocks = context.data?.length ? await client.from("tanaw_instructional_blocks").select("id,school_year,label").in("id", context.data.map((cycle) => cycle.instructional_block_id)) : { data: [], error: null };
        if (request !== generation.current) return;
        if (context.error || blocks.error) throw new Error("Packet period unavailable");
        setCycleLabels(Object.fromEntries((context.data ?? []).map((cycle) => { const block = blocks.data?.find((block) => block.id === cycle.instructional_block_id); return [cycle.id, block ? block.school_year + " · " + block.label : cycle.id]; })));
        setDistrictDecisions(history.data ?? []);
        setDistrict(result.data ?? []); setReady(true); setStale(false); setStatus("Locked packet status loaded. Learner records are restricted to the school."); return true;
      }
      const identities = await client.rpc("tanaw_workflow_people", { target_school: schoolId });
      if (request !== generation.current) return;
      if (identities.error) throw identities.error;
      setPeople(Object.fromEntries((identities.data ?? []).map((person: { user_id: string; label: string }) => [person.user_id, person.label])));
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
        readPages<Slot>((from, to) => client.from("tanaw_submission_slots").select("id,author_id,subject_id,scope_label,required_indicator_ids,requirements_revision", { count: "exact" }).eq("cycle_id", selected).order("id").range(from, to)),
        client.from("smea_indicator_definitions").select("id,label,unit,source_title,source_locator,source_id,school_year,reporting_period,numerator_definition,denominator_definition,formula_expression,rounding_rule").eq("school_id", schoolId).eq("definition_status", "verified").eq("school_year", calendar.data.school_year).eq("reporting_period", calendar.data.label),
        client.from("tanaw_school_packets").select("id,version,locked_at,completeness,missing,manifest,prepared_by,amendment_round_id").eq("cycle_id", selected).order("version", { ascending: false }).limit(20),
      ]);
      if (request !== generation.current) return;
      if (definitionResult.error || packetResult.error) throw new Error("Workflow access could not be verified");
      const visibleSlots: Slot[] = slotResult.filter((slot) => role !== "teacher" || slot.author_id === actorId);
      setSlots(visibleSlots); setDefinitions(definitionResult.data ?? []); setPackets(packetResult.data ?? []);
      const submissionRows = visibleSlots.length ? await readPages<Submission>((from, to) => client.from("tanaw_submissions").select("id,slot_id,current_version,extension_until,extension_reason", { count: "exact" }).in("slot_id", visibleSlots.map((slot) => slot.id)).order("id").range(from, to)) : [];
      if (request !== generation.current) return;
      const reviewRows = submissionRows.length ? await readPages<{ submission_id: string; version: number }>((from, to) => client.from("tanaw_submission_reviews").select("submission_id,version", { count: "exact" }).in("submission_id", submissionRows.map((submission) => submission.id)).order("submission_id").order("version").range(from, to)) : [];
      if (request !== generation.current) return;
      const packetIds = (packetResult.data ?? []).map((packet) => packet.id);

      const [packetReviewResult, roundResult, feedbackResult, snapshotResult] = await Promise.all([
        packetIds.length ? client.from("tanaw_packet_reviews").select("packet_id,stage,reviewer_id,self_review,acknowledged_missing,created_at").in("packet_id", packetIds) : { data: [], error: null },
        client.from("tanaw_amendment_rounds").select("id,deadline_at,reason,closed_at").eq("cycle_id", selected).order("created_at", { ascending: false }).limit(20),
        client.rpc("tanaw_school_feedback", { target_cycle: selected }),
        readPages<Snapshot>((from, to) => client.rpc("tanaw_workflow_evidence", { target_cycle: selected }, { count: "exact" }).range(from, to)),
      ]);
      if (request !== generation.current) return;
      if (packetReviewResult.error || roundResult.error || feedbackResult.error) throw new Error("Packet review details unavailable");
      setPacketReviews(packetReviewResult.data ?? []); setRounds(roundResult.data ?? []); setFeedback(feedbackResult.data ?? []); setSnapshots(snapshotResult);
      setReviews(reviewRows); setNow(Date.now());
      setSubmissions(submissionRows); setHistoryRevision((revision) => revision + 1); setReady(true); setStale(false); setStatus("School workflow loaded."); return true;
    } catch { if (request === generation.current) setStatus("Workflow refresh failed. Previously loaded information may be out of date; actions are paused. Retry refresh."); return false; }
    finally { if (request === generation.current) setRefreshing(false); }
  }, [schoolId, role, actorId, cycleId]);
  useEffect(() => { let cancelled = false; queueMicrotask(() => { if (!cancelled) { setSubmissionId(""); setMissingReasons({}); setAcknowledge(false); void load(); } }); return () => { cancelled = true; invalidate(); }; }, [load, invalidate]);
  useEffect(() => {
    let cancelled = false;
    historyGeneration.current++;
    queueMicrotask(() => { if (!cancelled) { setVersions([]); setVersionReady(false); } });
    if (!submissionId || !ready) return () => { cancelled = true; };
    void (async () => {
      const result = await createSupabaseBrowserClient().from("tanaw_submission_versions").select("version,evidence,reason,created_at").eq("submission_id", submissionId).order("version", { ascending: false }).limit(20);
      if (cancelled) return;
      if (result.error) { setStatus("Evidence history could not be verified. Refresh before submitting or reviewing."); return; }
      setVersions(result.data ?? []); setHistoryMore((result.data?.length ?? 0) === 20); setVersionReady(true);
    })();
    return () => { cancelled = true; };
  }, [submissionId, ready, historyRevision]);
  const selected = submissions.find((submission) => submission.id === submissionId);
  const selectedSlot = slots.find((slot) => slot.id === selected?.slot_id);
  const currentVersion = snapshots.find((version) => version.submission_id === selected?.id && version.version === selected?.current_version);
  const cycle = cycles.find((entry) => entry.id === cycleId);
  const latest = packets[0];
  const openRound = rounds.find((round) => !round.closed_at);
  const activeAmendment = !!openRound && new Date(openRound.deadline_at).getTime() > now;
  const submissionCoverage = selectedSlot ? indicatorCoverage(selectedSlot, currentVersion?.evidence.entries ?? [], definitions.map((def) => def.id)) : null;
  const latestReviews = packetReviews.filter((review) => review.packet_id === latest?.id);
  const manifestCurrent = !!latest && latest.manifest.length === slots.length && latest.manifest.every((entry) => {
    const slot = slots.find((slot) => slot.id === entry.slot), submission = submissions.find((sub) => sub.id === entry.submission);
    return (entry.version === 0 || snapshots.some((snapshot) => snapshot.submission_id === entry.submission && snapshot.version === entry.version)) && submission?.current_version === entry.version && entry.requirementsRevision === slot?.requirements_revision && JSON.stringify(entry.requiredIndicators ?? null) === JSON.stringify(slot?.required_indicator_ids ?? null) && Array.isArray(entry.definitions) && entry.definitions.every((saved) => { const def = definitions.find((d) => d.id === saved.id); return def && saved.label === def.label && saved.unit === def.unit && saved.sourceTitle === def.source_title && saved.sourceLocator === def.source_locator && saved.formula === def.formula_expression && saved.rounding === def.rounding_rule && saved.sourceId === def.source_id && saved.schoolYear === def.school_year && saved.period === def.reporting_period && saved.numerator === def.numerator_definition && saved.denominator === def.denominator_definition; });
  });
  const independentHead = latest?.prepared_by !== actorId && !slots.some((slot) => slot.author_id === actorId && submissions.some((submission) => submission.slot_id === slot.id && submission.current_version > 0));
  const roundCurrent = !cycle?.locked_at || (activeAmendment && latest?.amendment_round_id === openRound?.id);
  const lockReady = roundCurrent && manifestCurrent && latestReviews.some((review) => review.stage === "school") && latestReviews.some((review) => review.stage === "head" && !review.self_review && (!latest.missing.length || review.acknowledged_missing));
  const serverPaused = busy || refreshing || stale || !accessVerified;
  const reminders = cycle ? workflowReminders(cycle.deadline_at, !!cycle.locked_at, submissions, reviews, now) : null;
  async function action(name: string, args: Record<string, unknown>) {
    if (!ready || busy || refreshing || stale || !accessVerified) return false;
    if (!navigator.onLine) { setStatus("Connect to the internet for submission and review actions."); return false; }
    if (name === "tanaw_lock_packet" && !window.confirm(`Lock ${schoolName ?? schoolId} · ${cycle ? cycleLabels[cycle.instructional_block_id] : cycleId} · packet version ${latest?.version} (${args.target_packet})?\nCompleteness: ${latest?.missing.length ? "Incomplete" : "Complete"}. This records an explicit school Lock. Corrections require an amendment and new reviews. District acceptance remains a separate decision.`)) return false;
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
      if (error) { setStatus(workflowError(error.code, error.message)); statusRef.current?.focus(); return false; }
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
  async function olderHistory() {
    if (historyBusy || !historyMore || !selected || !versions.length) return;
    const target = submissionId, request = generation.current, historyRequest = historyGeneration.current;
    setHistoryBusy(true);
    try {
      const result = await createSupabaseBrowserClient().from("tanaw_submission_versions").select("version,evidence,reason,created_at").eq("submission_id", target).lt("version", versions[versions.length - 1].version).order("version", { ascending: false }).limit(20);
      if (request !== generation.current) return;
      if (historyRequest !== historyGeneration.current) return;
      if (result.error) throw result.error;
      setVersions((old) => [...old, ...(result.data ?? []).filter((entry) => !old.some((v) => v.version === entry.version))]);
      setHistoryMore((result.data?.length ?? 0) === 20);
    } catch { setStatus("Older history could not be loaded. Current evidence remains available; retry loading older versions."); }
    finally { setHistoryBusy(false); }
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
  const packetPanel = latest && (role === "smeaCoordinator" || role === "schoolHead") && <article className="space-y-3 border-t border-foreground/10 pt-4"><h3 className="font-medium">Latest school packet · Version {latest.version}</h3><p className="text-sm">{latest.locked_at ? "Locked · " + latest.completeness : "Awaiting reviews and explicit Lock"}</p>{latest.missing.map((missing) => <p key={missing.slotId} className="break-words text-sm">Missing or incomplete: {slots.find((slot) => slot.id === missing.slotId)?.scope_label ?? "Assigned submission"} · {missing.reason}</p>)}
        <p className="text-sm">{role === "schoolHead" && !independentHead ? "An independent School Head must review this packet because it includes your preparation or submission." : "School review must precede an independent School Head review; both are required for Lock."}</p>
        <p className="text-sm">{!latest.locked_at && !roundCurrent ? "This snapshot is outside the active amendment. Prepare a new packet version before reviewing." : "Packet and amendment history remain preserved."}</p>
        <p className="text-sm">{latest.locked_at ? "Historical locked snapshot. Later assignments or definitions do not rewrite this packet." : manifestCurrent ? "Snapshot matches current assignments and requirements." : "Snapshot differs from current assignments or indicator requirements. Prepare a new packet before reviewing."}</p>
        <ul className="space-y-2 text-sm">{latestReviews.map((review) => <li key={review.stage}>{review.stage === "head" ? "School Head" : "School"} review recorded · reviewer {people[review.reviewer_id] ?? review.reviewer_id} · {new Date(review.created_at).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}{review.self_review ? " · coordinator self-review" : ""}{review.acknowledged_missing ? " · missing evidence acknowledged" : ""}</li>)}</ul>
        <details><summary className="cursor-pointer text-sm font-medium">Inspect exact packet snapshot</summary><div className="mt-3 space-y-4">{latest.manifest.map((item) => { const slot = slots.find((slot) => slot.id === item.slot); const evidence = snapshots.find((version) => version.submission_id === item.submission && version.version === item.version); return <article key={item.slot} className="rounded-lg border border-foreground/20 p-3 text-sm"><h4 className="font-medium">{slot?.scope_label ?? item.slot} · {slot?.subject_id} · Version {item.version || "not submitted"}</h4><p>Required: {(item.requiredIndicators ?? []).map((id) => item.definitions?.find((def) => def.id === id)?.label ?? id).join(", ") || "Not configured in this snapshot"}</p>{evidence ? evidence.evidence.entries.map((entry) => <p key={entry.definitionId} className="break-words">{item.definitions?.find((def) => def.id === entry.definitionId)?.label ?? entry.definitionId}: {entry.value} · {entry.sourceTitle} · {entry.sourceLocator}</p>) : <p>{item.version ? "Snapshot evidence unavailable; refresh before review." : "No evidence version submitted."}</p>}</article>; })}</div></details>
        {!latest.locked_at && <aside className="status-panel" aria-label="Packet review prerequisites"><h4 className="font-semibold">Before this packet can be locked</h4><ul className="list-disc pl-5 text-sm"><li>{manifestCurrent ? "Current snapshot verified" : "Prepare a new snapshot matching current evidence and requirements"}</li><li>{roundCurrent ? "Current reporting or amendment round" : "An active amendment and newly prepared packet are required"}</li><li>{latestReviews.some((r) => r.stage === "school") ? "School review recorded" : "SMEA Coordinator must record school review"}</li><li>{latestReviews.some((r) => r.stage === "head" && !r.self_review && (!latest.missing.length || r.acknowledged_missing)) ? "Independent School Head review recorded" : "Independent School Head review and acknowledgment of incomplete evidence are required"}</li></ul></aside>}
        {!latest.locked_at && <><label className="flex gap-2 text-sm"><input type="checkbox" checked={acknowledge} onChange={(event) => setAcknowledge(event.target.checked)} disabled={serverPaused} />I acknowledge the listed missing submissions.</label><button type="button" className={buttonStyle} disabled={serverPaused || !manifestCurrent || !roundCurrent || (role === "schoolHead" && !independentHead) || latestReviews.some((review) => review.stage === (role === "schoolHead" ? "head" : "school")) || (role === "schoolHead" && !latestReviews.some((review) => review.stage === "school"))} onClick={() => void action("tanaw_review_packet", { target_packet: latest.id, review_stage: role === "schoolHead" ? "head" : "school", acknowledge_missing: acknowledge })}>Record {role === "schoolHead" ? "School Head" : "school"} review</button>{role === "smeaCoordinator" && <button type="button" className={buttonStyle} disabled={serverPaused || !lockReady} onClick={() => void action("tanaw_lock_packet", { target_packet: latest.id })}>Lock this school packet</button>}</>}
      </article>;
  const tasks = submissions.filter((sub) => { const slot = slots.find((slot) => slot.id === sub.slot_id); const coverage = slot ? indicatorCoverage(slot, snapshots.find((v) => v.submission_id === sub.id && v.version === sub.current_version)?.evidence.entries ?? [], definitions.map((d) => d.id)) : null; const reviewed = reviews.some((r) => r.submission_id === sub.id && r.version === sub.current_version); return [slot?.scope_label, slot?.subject_id, people[slot?.author_id ?? ""]].join(" ").toLowerCase().includes(search.toLowerCase()) && (taskFilter === "all" || (taskFilter === "missing" && !sub.current_version) || (taskFilter === "partial" && !coverage?.complete) || (taskFilter === "review" && sub.current_version > 0 && !reviewed) || (taskFilter === "reviewed" && reviewed)); });
  return <section aria-busy={busy || refreshing} className="space-y-5 rounded-xl border border-foreground/15 p-5" aria-labelledby="school-workflow-heading">
    <h2 id="school-workflow-heading" className="text-lg font-semibold">Submissions and packet review</h2>
    <p id="workflow-feedback" ref={statusRef} tabIndex={-1} role="status" aria-live="polite" className="status-panel">{status}</p>
    {(!accessVerified || stale) && ready && <p className="text-sm">This view is not currently verified. You may keep preparing the same scoped device draft; online actions require a successful access and workflow refresh.</p>}
    <div className="space-y-5 min-w-0">
    {role !== "districtCoordinator" && cycles.length > 0 && <div><label htmlFor="workflow-cycle" className="block text-sm font-medium">Reporting cycle</label><select id="workflow-cycle" className={inputStyle} value={cycleId} disabled={serverPaused} onChange={(event) => { if (confirmLeavingWork()) setCycleId(event.target.value); }}>{cycles.map((entry) => <option key={entry.id} value={entry.id}>{cycleLabels[entry.instructional_block_id] ?? entry.id} · {new Date(entry.deadline_at).toLocaleDateString("en-PH", { timeZone: "Asia/Manila" })}</option>)}</select></div>}
    {ready && role === "districtCoordinator" && <>
      {district.length === 0 && <p className="text-sm">No locked school packets are available.</p>}
      {district.map((packet) => <article key={packet.packet_id} className="space-y-3 border-t border-foreground/10 pt-4">
        <h3 className="font-medium">Packet version {packet.version} · {packet.completeness}</h3><p className="text-sm font-medium">{cycleLabels[packet.cycle_id] ?? packet.cycle_id}</p>
        <p className="text-sm">Process counts only. Governed indicator results are not connected; acceptance is unavailable. Return the packet with a practical correction request if needed.</p>
        <p className="text-sm">{packet.submission_count} assignment(s) not listed as missing · {packet.missing_count} missing/incomplete assignment(s)</p>
        {districtDecisions.filter((entry) => entry.packet_id === packet.packet_id).map((entry) => <p key={entry.id} className="break-words text-sm">Recorded {entry.action} · {new Date(entry.created_at).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}<br />{entry.comment}</p>)}
        <form aria-describedby="workflow-feedback" className="space-y-3" onSubmit={(event) => { event.preventDefault(); const formElement = event.currentTarget; const form = new FormData(formElement); void action("tanaw_district_review_request", { target_packet: packet.packet_id, decision: String(form.get("decision")), review_comment: String(form.get("comment")), request_id: districtRequests.current[JSON.stringify([packet.packet_id, form.get("decision"), form.get("comment")])] ??= crypto.randomUUID(), expected_decision_id: districtDecisions.find((entry) => entry.packet_id === packet.packet_id)?.id ?? null }).then((saved) => { if (saved) clearFormDirty(formElement); }); }}>
          <div className="space-y-1"><label htmlFor={"district-decision-" + packet.packet_id} className="block text-sm">Decision</label><select id={"district-decision-" + packet.packet_id} name="decision" required defaultValue="" className={inputStyle} disabled={serverPaused}><option value="" disabled>Choose a decision</option><option value="accept" disabled>Accept — governed results not connected</option><option value="return">Return with comments</option></select></div>
          <label className="block text-sm">Review comments<textarea name="comment" required className={inputStyle} maxLength={2000} disabled={serverPaused} /></label>
          <button className={buttonStyle} disabled={serverPaused}>Record district decision</button>
        </form>
      </article>)}
    </>}
    {ready && cycleId && role !== "districtCoordinator" && <>
      {role === "schoolHead" && packetPanel}
      {feedback.length > 0 && <aside aria-label="District feedback" className="space-y-3 rounded-lg border border-foreground/20 p-4"><h3 className="font-semibold">District decisions and correction requests</h3>{feedback.map((entry, index) => <p key={index} className="break-words text-sm">Packet {entry.packet_version} · {entry.action} · {new Date(entry.created_at).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}<br />{entry.comment || "No comment recorded."}</p>)}</aside>}
      {cycle?.locked_at && <aside className="rounded-lg bg-foreground/5 p-4 text-sm"><p>{activeAmendment ? "Active amendment" : openRound ? "Amendment expired; ask the coordinator to start a new round." : "Packet locked; corrections require an amendment."}</p>{openRound && <p>Cutoff: {new Date(openRound.deadline_at).toLocaleString("en-PH", { timeZone: "Asia/Manila" })} Philippine time · {openRound.reason}</p>}<p>The device clock is advisory. The server controls eligibility.</p></aside>}
      {reminders && <aside aria-label="Deadline reminders" className="space-y-2 rounded-lg bg-foreground/5 p-4"><h3 className="text-sm font-semibold">{reminders.deadline}</h3><p className="text-sm">{reminders.missing} missing submission(s) · {reminders.awaitingSubjectReview} awaiting current-version subject review · {reminders.activeExtensions} active extension(s)</p><p className="text-xs text-foreground/60">Counts cover your visible assignments. Deadline alerts use this device’s clock; the server controls editing and final actions.</p></aside>}
      {slots.length === 0 && <p className="text-sm">No visible submission assignments for this cycle.</p>}
      <section aria-labelledby="task-queue-title" className="task-queue">
        <h3 id="task-queue-title" className="font-semibold">{role === "teacher" ? "My evidence tasks" : role === "subjectCoordinator" ? "Subject review queue" : role === "schoolHead" ? "School evidence overview" : "School readiness tasks"}</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">Find an assignment<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} className={inputStyle} /></label>
          <label className="block text-sm">Task status<select value={taskFilter} onChange={(event) => setTaskFilter(event.target.value)} className={inputStyle}><option value="all">All visible tasks</option><option value="missing">Not submitted</option><option value="partial">Missing requirements or evidence</option><option value="review">Awaiting subject review</option><option value="reviewed">Subject reviewed</option></select></label>
        </div>
        <ul className="divide-y divide-foreground/15">{tasks.map((sub) => { const slot = slots.find((slot) => slot.id === sub.slot_id); const reviewed = reviews.some((r) => r.submission_id === sub.id && r.version === sub.current_version); return <li key={sub.id} className="py-3"><button type="button" aria-pressed={submissionId === sub.id} className="task-row" onClick={() => { if (sub.id === submissionId || confirmLeavingWork()) { setSubmissionId(sub.id); document.getElementById("workflow-submission")?.focus(); } }}><span className="font-medium">{slot?.scope_label} · {slot?.subject_id}</span><span className="text-sm">{people[slot?.author_id ?? ""] ?? slot?.author_id} · {sub.current_version ? "Version " + sub.current_version + (reviewed ? " · Subject reviewed" : " · Awaiting subject review") : "Not submitted"}</span></button></li>; })}</ul>
        {tasks.length === 0 && <p className="text-sm">No assignments match these filters. Clear your search or select all visible tasks.</p>}
        <p className="text-xs text-foreground/70">Filters cover authorized assignments in this reporting cycle. The selected draft stays open when you filter.</p>
      </section>
      {submissions.length > 0 && <div><label htmlFor="workflow-submission" className="block text-sm font-medium">Assigned submission</label><select id="workflow-submission" className={inputStyle} value={submissionId} disabled={serverPaused} onChange={(event) => { if (confirmLeavingWork()) setSubmissionId(event.target.value); }}><option value="">Select a submission</option>{submissions.map((submission) => { const slot = slots.find((entry) => entry.id === submission.slot_id); return <option key={submission.id} value={submission.id}>{slot?.scope_label} · {slot?.subject_id} · Author {people[slot?.author_id ?? ""] ?? slot?.author_id} · {submission.current_version ? "Version " + submission.current_version : "Missing"}</option>; })}</select></div>}
      {selected && <>
        {submissionCoverage && <p className="text-sm">{!submissionCoverage.configured ? "Required indicators have not been configured; this assignment cannot establish packet completeness." : submissionCoverage.complete ? "Required indicators recorded for this assignment. Reviews remain separate." : submissionCoverage.missing.length + " required indicator(s) still missing: " + submissionCoverage.missing.map((id) => definitions.find((def) => def.id === id)?.label ?? id).join(", ")}</p>}
        {role === "smeaCoordinator" && selectedSlot && (!cycle?.locked_at || activeAmendment) && <IndicatorRequirements key={selected.id} definitions={definitions} required={selectedSlot.required_indicator_ids} revision={selectedSlot.requirements_revision} busy={busy || refreshing || stale} onSave={(ids, reason, expectedRevision) => action("tanaw_set_slot_requirements", { target_submission: selected.id, expected_version: selected.current_version, indicator_ids: ids, expected_requirements_revision: expectedRevision, change_reason: reason })} />}
        <p className="text-sm">{versions.length} loaded source version(s). Current version: {selected.current_version || "not submitted"}.</p>
        {!versionReady && <p role="status" className="text-sm">Verifying evidence history…</p>}
        {selected.extension_until && <p className="text-sm">Submission extension cutoff: {new Date(selected.extension_until).toLocaleString("en-PH", { timeZone: "Asia/Manila" })} Philippine time. Reason: {selected.extension_reason}. The server determines whether submission is allowed.</p>}
        {reviews.some((review) => review.submission_id === selected.id && review.version === selected.current_version) && <p className="text-sm">Subject review is recorded for this version.</p>}
        {currentVersion && <div className="space-y-2 rounded-lg bg-foreground/5 p-4"><h3 className="font-medium">Current recorded evidence</h3>{currentVersion.evidence.entries.map((entry) => <p key={entry.definitionId} className="break-words text-sm">{definitions.find((definition) => definition.id === entry.definitionId)?.label ?? "Recorded indicator"}: {entry.value} · {entry.sourceTitle} · {entry.sourceLocator}</p>)}</div>}
        {versions.length > 0 && <details><summary className="cursor-pointer text-sm font-medium">Inspect recent evidence versions</summary><ol className="mt-3 space-y-4">{versions.map((entry) => <li key={entry.version} className="rounded-lg border border-foreground/20 p-3 text-sm"><h4 className="font-medium">Version {entry.version} · {new Date(entry.created_at).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}</h4><p className="break-words">Reason: {entry.reason}</p>{entry.evidence.entries.map((evidence) => <p key={evidence.definitionId} className="break-words">{definitions.find((definition) => definition.id === evidence.definitionId)?.label ?? evidence.definitionId}: {evidence.value} · {evidence.sourceTitle} · {evidence.sourceLocator}</p>)}</li>)}</ol>{historyMore && <button type="button" disabled={historyBusy} className="mt-3 underline" onClick={() => void olderHistory()}>{historyBusy ? "Loading older versions…" : "Load older versions"}</button>}</details>}
        {(role === "teacher" || (role === "smeaCoordinator" && selectedSlot?.author_id === actorId)) && <ManualEvidenceForm key={actorId + schoolId + submissionId} scope={draftScope} version={selected.current_version} definitions={definitions} recordedEntries={currentVersion?.evidence.entries ?? []} canSubmit={accessVerified && !refreshing && !stale && (!cycle?.locked_at || activeAmendment)} eligibility={cycle?.locked_at && !activeAmendment ? "Local preparation is available. Submission is paused until the coordinator opens an active amendment." : cycle ? "Submission cutoff: " + new Date(Math.max(new Date(cycle.deadline_at).getTime(), new Date(selected.extension_until ?? cycle.deadline_at).getTime())).toLocaleString("en-PH", { timeZone: "Asia/Manila" }) + " Philippine time. The server checks the deadline and permissions when you submit." : undefined} busy={busy} onSubmit={submitManual} />}
        {role === "subjectCoordinator" && <button type="button" className={buttonStyle} disabled={serverPaused || !versionReady || !currentVersion || selectedSlot?.author_id === actorId || reviews.some((review) => review.submission_id === selected.id && review.version === selected.current_version)} onClick={() => void action("tanaw_review_submission", { target_submission: submissionId, expected_version: selected.current_version })}>Record subject review of this version</button>}
        {role === "smeaCoordinator" && selected.current_version === 0 && !cycle?.locked_at && <details><summary className="cursor-pointer text-sm font-medium">Hand over an unsubmitted assignment</summary><form aria-describedby="workflow-feedback" className="mt-3 space-y-3" onSubmit={(event) => { event.preventDefault(); const element = event.currentTarget; const form = new FormData(element); void action("tanaw_handover_unsubmitted", { target_submission: selected.id, target_author: String(form.get("author")), expected_author: selectedSlot?.author_id, change_reason: String(form.get("reason")) }).then((saved) => { if (saved) clearFormDirty(element); }); }}>
          <p className="text-xs leading-5 text-foreground/65">The original account and handover reason remain in history. Device drafts stay with the original account; deadlines and extensions stay unchanged.</p>
          <label className="block text-sm">New assigned account<select name="author" required className={inputStyle} disabled={serverPaused}><option value="">Select a replacement</option>{assignees.filter((member) => member.user_id !== selectedSlot?.author_id && (member.roles.includes("smeaCoordinator") || member.subject_ids.includes(selectedSlot?.subject_id ?? ""))).map((member) => <option key={member.user_id} value={member.user_id}>{member.email || member.user_id}</option>)}</select></label>
          <label className="block text-sm">Handover reason<textarea name="reason" required maxLength={2000} className={inputStyle} disabled={serverPaused} /></label><button className={buttonStyle} disabled={serverPaused}>Record assignment handover</button>
        </form></details>}
        {role === "smeaCoordinator" && !cycle?.locked_at && <form aria-describedby="workflow-feedback" className="space-y-3" onSubmit={(event) => timedAction(event, "tanaw_extend_submission")}><h3 className="font-medium">Submission extension</h3><label className="block text-sm">Extension cutoff (Philippine time)<input name="deadline" type="datetime-local" step="60" required className={inputStyle} disabled={serverPaused} /></label><label className="block text-sm">Reason<textarea name="reason" required maxLength={2000} className={inputStyle} disabled={serverPaused} /></label><button className={buttonStyle} disabled={serverPaused}>Grant this submission an extension</button></form>}
      </>}
      {role === "smeaCoordinator" && !cycle?.locked_at && <details><summary className="cursor-pointer text-sm font-medium">Assign a submission</summary><form aria-describedby="workflow-feedback" onSubmit={assign} className="mt-3 space-y-3"><label className="block text-sm">Assigned account<select name="author" required value={assignmentAuthor} onChange={(event) => setAssignmentAuthor(event.target.value)} className={inputStyle} disabled={serverPaused}><option value="">Select an active account</option>{assignees.map((member) => <option key={member.user_id} value={member.user_id}>{member.email || member.user_id}</option>)}</select></label><label className="block text-sm">Assigned subject<select name="subject" required className={inputStyle} disabled={serverPaused} defaultValue=""><option value="" disabled>Select a provisioned subject</option>{[...new Set((assignees.find((member) => member.user_id === assignmentAuthor)?.roles.includes("smeaCoordinator") ? assignees.flatMap((member) => member.subject_ids) : assignees.find((member) => member.user_id === assignmentAuthor)?.subject_ids) ?? [])].sort().map((id) => <option key={id} value={id}>{id}</option>)}</select><span className="text-xs text-foreground/65">Subjects come from the selected account’s school assignment. Configure access first if the required subject is absent.</span></label><label className="block text-sm">Class or reporting scope<input name="scope" required className={inputStyle} disabled={serverPaused} /></label><label className="block text-sm">Assignment reason<textarea name="reason" required maxLength={2000} className={inputStyle} disabled={serverPaused} /></label><button className={buttonStyle} disabled={serverPaused}>Assign submission</button></form></details>}
      {role === "smeaCoordinator" && slots.some((slot) => !slot.required_indicator_ids?.length) && <p className="text-sm">Configure required indicators for each assignment before preparing a packet. A submitted value alone does not establish completeness.</p>}
      {role === "smeaCoordinator" && <div data-work-draft className="space-y-3">
        {slots.filter((slot) => !indicatorCoverage(slot, snapshots.find((version) => version.submission_id === submissions.find((submission) => submission.slot_id === slot.id)?.id && version.version === submissions.find((submission) => submission.slot_id === slot.id)?.current_version)?.evidence.entries ?? [], definitions.map((def) => def.id)).complete).map((slot) => <label key={slot.id} className="block text-sm">Reason for incomplete {slot.scope_label}<input maxLength={2000} className={inputStyle} value={missingReasons[slot.id] ?? ""} disabled={serverPaused} onChange={(event) => setMissingReasons({ ...missingReasons, [slot.id]: event.target.value })} /></label>)}
        <button type="button" className={buttonStyle} disabled={serverPaused || (cycle?.locked_at != null && !activeAmendment) || slots.length === 0 || slots.some((slot) => !slot.required_indicator_ids?.length)} onClick={(event) => { const draft = event.currentTarget.closest("[data-work-draft]"); void action("tanaw_prepare_packet", { target_cycle: cycleId, missing_reasons: slots.filter((slot) => !indicatorCoverage(slot, snapshots.find((version) => version.submission_id === submissions.find((submission) => submission.slot_id === slot.id)?.id && version.version === submissions.find((submission) => submission.slot_id === slot.id)?.current_version)?.evidence.entries ?? [], definitions.map((def) => def.id)).complete).map((slot) => ({ slotId: slot.id, reason: missingReasons[slot.id] ?? "" })) }).then((saved) => { if (saved && draft instanceof HTMLElement) delete draft.dataset.unsaved; }); }}>Prepare a new school packet version</button>
        {cycle?.locked_at && <details><summary className="cursor-pointer text-sm font-medium">Start an amendment</summary><form aria-describedby="workflow-feedback" className="mt-3 space-y-3" onSubmit={(event) => timedAction(event, "tanaw_open_amendment")}><p className="text-sm">Previous locked packets remain preserved. Changed submissions need new subject and packet reviews.</p><label className="block text-sm">Amendment cutoff (Philippine time)<input name="deadline" type="datetime-local" step="60" required className={inputStyle} disabled={serverPaused} /></label><label className="block text-sm">Amendment reason<textarea name="reason" required maxLength={2000} className={inputStyle} disabled={serverPaused} /></label><button className={buttonStyle} disabled={serverPaused || activeAmendment}>{activeAmendment ? "An amendment is already active" : "Open amendment round"}</button></form></details>}
      </div>}
      {role !== "schoolHead" && packetPanel}
      {(role === "smeaCoordinator" || role === "schoolHead") && <PacketHistory key={cycleId} cycleId={cycleId} />}
    </>}
    </div>
    <button type="button" className="text-sm underline underline-offset-4 disabled:opacity-50" disabled={busy || refreshing} onClick={() => { if (confirmLeavingWork()) void load(); }}>{refreshing ? "Refreshing workflow…" : "Refresh workflow"}</button>
    <p className="text-xs leading-5 text-foreground/60">Recorded evidence requires the assigned reviews. Deadline closure, school Lock and district acceptance are separate events.</p>
  </section>;
}
