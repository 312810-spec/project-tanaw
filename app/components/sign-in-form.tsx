"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";

const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

export function SignInForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !configured) return;
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    setBusy(true); setMessage("");
    try {
      const client = createSupabaseBrowserClient();
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) { setMessage("Sign-in failed. Check your account details or contact the SMEA Coordinator."); return; }
      router.push("/workspace");
    } catch { setMessage("Unable to connect. Check your connection and try again."); }
    finally { setBusy(false); }
  }
  return (
    <form onSubmit={submit} className="mt-8 flex flex-col gap-5">
      {!configured && <p role="status" className="rounded-lg border border-gold/50 p-4 text-sm">Sign-in is unavailable until this installation is configured.</p>}
      <div className="flex flex-col gap-2">
        <label htmlFor="email" className="text-sm font-medium">Email address</label>
        <input id="email" name="email" type="email" autoComplete="username" required disabled={!configured || busy} className="rounded-lg border border-foreground/20 bg-background px-4 py-3" />
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="password" className="text-sm font-medium">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required disabled={!configured || busy} className="rounded-lg border border-foreground/20 bg-background px-4 py-3" />
      </div>
      <p role="status" aria-live="polite" className="min-h-6 text-sm">{message}</p>
      <button type="submit" disabled={!configured || busy} className="rounded-lg bg-brand px-4 py-3 font-medium text-white disabled:opacity-50">{busy ? "Signing in…" : "Sign in"}</button>
      <p className="text-xs leading-5 text-foreground/60">Accounts are assigned by the SMEA Coordinator. Contact your coordinator if your account or password recovery is not yet available.</p>
    </form>
  );
}
