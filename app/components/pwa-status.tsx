"use client";

import { useEffect, useState } from "react";
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
export function PwaStatus() {
  const [offline, setOffline] = useState(false);
  const [install, setInstall] = useState<InstallEvent | null>(null);
  const [message, setMessage] = useState("");
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    const prompt = (event: Event) => { event.preventDefault(); setInstall(event as InstallEvent); };
    const installed = () => { setInstall(null); setMessage("TANAW is installed on this device."); };
    window.addEventListener("online", update); window.addEventListener("offline", update);
    window.addEventListener("beforeinstallprompt", prompt); window.addEventListener("appinstalled", installed);
    queueMicrotask(update);
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => setMessage("Offline page is unavailable. Keep your workspace open and check each draft’s save status."));
    }
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); window.removeEventListener("beforeinstallprompt", prompt); window.removeEventListener("appinstalled", installed); };
  }, []);
  return <aside aria-label="Connection and installation" className="mx-auto w-full max-w-6xl px-6 py-3 text-sm">
    {offline && <p role="status">Offline · keep the workspace open to prepare device drafts. Reconnect for submission, reviews and locking.</p>}
    {message && <p role="status">{message}</p>}
    {install && <button type="button" className="rounded-lg border border-brand px-3 py-2 text-brand" onClick={async () => { await install.prompt(); const choice = await install.userChoice; setInstall(null); if (choice.outcome === "accepted") setMessage("Installation requested."); }}>Install TANAW</button>}
  </aside>;
}
