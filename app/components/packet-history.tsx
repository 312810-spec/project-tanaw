"use client";

import { useEffect, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";
import { readPages } from "@/app/lib/read-pages";

type Packet = { id: string; version: number; locked_at: string | null; completeness: string | null; created_at: string; manifest: { submission: string; version: number; definitions?: { id: string; label: string; unit: string }[] }[] };
type Evidence = { submission_id: string; version: number; evidence: { entries: { definitionId: string; value: number; sourceTitle: string; sourceLocator: string }[] }; reason: string; created_at: string };

/** Historical inspection only. These records never become review/Lock action targets. */
export function PacketHistory({ cycleId }: { cycleId: string }) {
  const generation = useRef(0);
  const [packets, setPackets] = useState<Packet[]>([]);
  const [selected, setSelected] = useState<Packet | null>(null);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [more, setMore] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Load packet history to inspect an earlier immutable version.");
  useEffect(() => () => { generation.current++; }, [cycleId]);
  async function load() {
    if (busy || !more) return;
    const request = generation.current;
    setBusy(true);
    try {
      let query = createSupabaseBrowserClient().from("tanaw_school_packets").select("id,version,locked_at,completeness,created_at,manifest").eq("cycle_id", cycleId).order("version", { ascending: false }).limit(20);
      if (packets.length) query = query.lt("version", packets[packets.length - 1].version);
      const result = await query;
      if (request !== generation.current) return;
      if (result.error) throw result.error;
      setPackets((old) => [...old, ...(result.data ?? []).filter((packet) => !old.some((p) => p.id === packet.id))]);
      setMore((result.data?.length ?? 0) === 20);
      setMessage(result.data?.length ? "Historical packet versions loaded. Select one to inspect its exact evidence." : "No older packet versions are available.");
    } catch { setMessage("Packet history could not be loaded. Keep the current task open and retry."); }
    finally { setBusy(false); }
  }
  async function inspect(id: string) {
    const packet = packets.find((packet) => packet.id === id) ?? null;
    const request = ++generation.current;
    setSelected(packet); setEvidence([]);
    if (!packet) return;
    setBusy(true); setMessage("Verifying the selected historical snapshot…");
    try {
      const rows = await readPages<Evidence>((from, to) => createSupabaseBrowserClient().rpc("tanaw_packet_evidence", { target_packet: packet.id }, { count: "exact" }).range(from, to));
      if (request !== generation.current) return;
      setEvidence(rows); setMessage("Exact historical evidence loaded. Inspection does not change or approve this packet.");
    } catch { if (request === generation.current) setMessage("Historical evidence could not be verified. Retry inspection; no record was changed."); }
    finally { if (request === generation.current) setBusy(false); }
  }
  return <details className="rounded-lg border border-foreground/20 p-4"><summary className="font-medium">School packet history</summary>
    <div className="mt-3 space-y-3"><p role="status" className="text-sm">{message}</p>
      {more && <button type="button" disabled={busy} className="text-sm underline" onClick={() => void load()}>{busy ? "Loading…" : packets.length ? "Load older packets" : "Load packet history"}</button>}
      {packets.length > 0 && <label className="block text-sm">Historical packet<select disabled={busy} value={selected?.id ?? ""} onChange={(event) => void inspect(event.target.value)} className="w-full rounded-lg border border-foreground/20 bg-background p-3"><option value="">Select a historical version</option>{packets.map((packet) => <option key={packet.id} value={packet.id}>Version {packet.version} · {packet.locked_at ? "Locked · " + packet.completeness : "Prepared"}</option>)}</select></label>}
      {selected && <article className="space-y-3 text-sm"><h4 className="font-semibold">Historical packet version {selected.version}</h4><p>{selected.locked_at ? "Immutable locked snapshot" : "Earlier prepared snapshot — current reviews use the latest eligible packet"}</p>
        {evidence.map((version) => { const item = selected.manifest.find((item) => item.submission === version.submission_id && item.version === version.version); return <div key={version.submission_id + version.version} className="rounded-lg bg-foreground/5 p-3"><p>Source version {version.version} · {version.reason}</p>{version.evidence.entries.map((entry) => <p key={entry.definitionId}>{item?.definitions?.find((definition) => definition.id === entry.definitionId)?.label ?? entry.definitionId}: {entry.value} · {entry.sourceTitle} · {entry.sourceLocator}</p>)}</div>; })}
      </article>}
    </div>
  </details>;
}
