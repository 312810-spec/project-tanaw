"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";

export type DistrictDecision = {
  id: string;
  action: string;
  comment: string;
  created_at: string;
  revision: string;
};

export function DistrictDecisionHistory({ packetId, latest }: { packetId: string; latest: DistrictDecision }) {
  const [older, setOlder] = useState<DistrictDecision[]>([]);
  const [more, setMore] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function loadOlder() {
    setBusy(true);
    setMessage("");
    try {
      const cursor = older.at(-1)?.revision ?? latest.revision;
      const { data, error } = await createSupabaseBrowserClient().rpc("tanaw_district_decision_page", {
        target_packet: packetId,
        before_revision: cursor,
      });
      if (error || !data) throw new Error("District decision history unavailable");
      setOlder([...older, ...data.slice(0, 20)]);
      setMore(data.length > 20);
      if (!data.length) setMessage("No older decisions for this packet.");
    } catch {
      setMessage("Older decisions could not be loaded. Retry history.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="space-y-2" aria-busy={busy}>
    {[latest, ...older].map((entry) => <p key={entry.id} className="break-words text-sm">Recorded {entry.action} · {new Date(entry.created_at).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}<br />{entry.comment}</p>)}
    {more && <button type="button" className="text-sm underline" disabled={busy} onClick={() => void loadOlder()}>Load older decisions</button>}
    {message && <p role="status" className="text-sm">{message}</p>}
  </div>;
}
