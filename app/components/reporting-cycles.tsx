"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";

type Block = { id: string; school_year: string; label: string; end_date: string; source_order: string; source_url: string };
type Cycle = { id: string; instructional_block_id: string; deadline_at: string; revision: number; locked_at: string | null };
const deadlineLabel = (value: string) => new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

export function ReportingCycles({ schoolId, canManage }: { schoolId: string; canManage: boolean }) {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [status, setStatus] = useState("Loading reporting cycles…");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [blockId, setBlockId] = useState("");
  const [deadline, setDeadline] = useState("");
  const [reason, setReason] = useState("");
  const generation = useRef(0);
  const invalidate = useCallback(() => { generation.current++; }, []);
  const load = useCallback(async () => {
    const request = ++generation.current;
    setReady(false); setBlocks([]); setCycles([]); setStatus("Loading reporting cycles…");
    try {
      const client = createSupabaseBrowserClient();
      const [calendar, reports] = await Promise.all([
        client.from("tanaw_instructional_blocks").select("id,school_year,label,end_date,source_order,source_url").order("end_date"),
        client.from("tanaw_reporting_cycles").select("id,instructional_block_id,deadline_at,revision,locked_at").eq("school_id", schoolId).order("deadline_at"),
      ]);
      if (request !== generation.current) return;
      if (calendar.error || reports.error) { setStatus("Reporting cycles could not be verified. Refresh access or contact the coordinator."); return; }
      setBlocks(calendar.data ?? []); setCycles(reports.data ?? []); setReady(true);
      setStatus(calendar.data?.length ? "Reporting cycles loaded." : "No verified school calendar entries are available yet.");
    } catch { if (request === generation.current) setStatus("Unable to load reporting cycles. Check your connection."); }
  }, [schoolId]);
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => { if (!cancelled) { setBlockId(""); setDeadline(""); setReason(""); setBusy(false); void load(); } });
    return () => { cancelled = true; invalidate(); };
  }, [load, invalidate]);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || busy || !canManage || !blocks.some((block) => block.id === blockId)) return;
    if (!navigator.onLine) { setStatus("Connect to the internet to save a deadline."); return; }
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(deadline)) { setStatus("Enter a valid deadline in Philippine time."); return; }
    const instant = new Date(deadline + ":00+08:00");
    if (!Number.isFinite(instant.getTime()) || instant.getTime() <= Date.now() || !reason.trim()) {
      setStatus("Choose a future deadline and give a reason."); return;
    }
    const current = cycles.find((cycle) => cycle.instructional_block_id === blockId);
    if (current?.locked_at || (current && new Date(current.deadline_at).getTime() <= Date.now())) {
      setStatus("This cycle is locked or its deadline has closed. A submission extension is required after the cutoff."); return;
    }
    const request = generation.current;
    setBusy(true); setStatus("Saving deadline…");
    try {
      const { error } = await createSupabaseBrowserClient().rpc("tanaw_set_cycle_deadline", {
        target_school: schoolId, target_block: blockId, new_deadline: instant.toISOString(),
        expected_revision: current?.revision ?? 0, change_reason: reason.trim(),
      });
      if (request !== generation.current) return;
      if (error) {
        setStatus(error.code === "40001" ? "Another coordinator changed this cycle. Refresh before trying again." : "Deadline could not be saved. Refresh access and check whether the cycle has closed.");
        return;
      }
      setReason(""); setDeadline("");
      await load();
      setStatus("Deadline saved with its change history.");
    } catch { if (request === generation.current) setStatus("Connection interrupted. Refresh cycles before retrying to check whether the change was saved."); }
    finally { if (request <= generation.current) setBusy(false); }
  }
  return <section aria-labelledby="cycles-heading" className="space-y-5 rounded-xl border border-foreground/15 p-5">
    <h2 id="cycles-heading" className="text-lg font-semibold">Reporting cycles</h2>
    <p role="status" aria-live="polite" className="text-sm">{status}</p>
    {ready && cycles.length === 0 && <p className="text-sm text-foreground/60">No reporting cycles have been assigned to this school.</p>}
    {ready && cycles.map((cycle) => {
      const block = blocks.find((entry) => entry.id === cycle.instructional_block_id);
      return <article key={cycle.id} className="space-y-1 border-t border-foreground/10 pt-4 text-sm">
        <h3 className="font-medium">{block ? block.school_year + " · " + block.label : "Reporting cycle"}</h3>
        {block && <p>Instructional block ends: {block.end_date} · {block.source_order}</p>}
        <p>Submission deadline: {deadlineLabel(cycle.deadline_at)} Philippine time</p>
        <p>{cycle.locked_at ? "School packet locked" : "School packet not locked"} · Deadline revision {cycle.revision}</p>
      </article>;
    })}
    {canManage && ready && blocks.length > 0 && <form onSubmit={save} className="space-y-4 border-t border-foreground/10 pt-5">
      <div className="space-y-2"><label htmlFor="cycle-block" className="block text-sm font-medium">Verified instructional block</label>
        <select id="cycle-block" required value={blockId} disabled={busy} onChange={(event) => setBlockId(event.target.value)} className="w-full rounded-lg border border-foreground/20 bg-background p-3">
          <option value="">Select a block</option>
          {blocks.map((block) => <option key={block.id} value={block.id}>{block.school_year} · {block.label} · Ends {block.end_date}</option>)}
        </select>
      </div>
      <div className="space-y-2"><label htmlFor="cycle-deadline" className="block text-sm font-medium">Submission deadline (Philippine time)</label>
        <input id="cycle-deadline" type="datetime-local" required step="60" value={deadline} disabled={busy} onChange={(event) => setDeadline(event.target.value)} className="w-full min-w-0 rounded-lg border border-foreground/20 bg-background p-3" />
      </div>
      <div className="space-y-2"><label htmlFor="cycle-reason" className="block text-sm font-medium">Reason for assigning or changing the deadline</label>
        <textarea id="cycle-reason" required maxLength={2000} value={reason} disabled={busy} onChange={(event) => setReason(event.target.value)} className="w-full rounded-lg border border-foreground/20 bg-background p-3" />
      </div>
      <button type="submit" disabled={busy} className="rounded-lg bg-brand px-4 py-2 text-sm text-white disabled:opacity-50">{busy ? "Saving…" : "Save deadline"}</button>
    </form>}
    <button type="button" disabled={busy} onClick={() => void load()} className="text-sm underline underline-offset-4 disabled:opacity-50">Refresh cycles</button>
    <p className="text-xs leading-5 text-foreground/60">The school calendar provides instructional block dates. The coordinator assigns submission deadlines separately. Packet locking and per-submission extensions are still being connected.</p>
  </section>;
}
