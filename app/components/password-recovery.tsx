"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";
const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
const input = "w-full rounded-lg border border-foreground/20 bg-background px-4 py-3";

export function PasswordRecovery({ change = false }: { change?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [done, setDone] = useState(false);
  const [message, setMessage] = useState(change ? "Checking your recovery session…" : "");
  useEffect(() => {
    if (!change || !configured) return;
    let cancelled = false;
    void createSupabaseBrowserClient().auth.getUser().then(({ data, error }) => {
      if (cancelled) return;
      setAuthorized(!error && !!data.user);
      setMessage(!error && data.user ? "Recovery session verified. Choose your new password." : "Open a valid recovery link from your email to continue.");
    }).catch(() => { if (!cancelled) setMessage("Recovery session could not be verified. Reconnect or request a new link."); });
    return () => { cancelled = true; };
  }, [change]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!configured || busy || done) return;
    if (!navigator.onLine) { setMessage("Connect to the internet to recover your account."); return; }
    const form = new FormData(event.currentTarget);
    const client = createSupabaseBrowserClient();
    setBusy(true);
    try {
      if (!change) {
        const { error } = await client.auth.resetPasswordForEmail(String(form.get("email") ?? "").trim(), { redirectTo: window.location.origin + "/auth/callback" });
        setMessage(error ? "The request could not be completed. Wait before retrying or contact the SMEA Coordinator." : "If this address has an account, a recovery link will arrive. Open it in this browser to continue.");
      } else {
        if (!authorized) return;
        const password = String(form.get("password") ?? "");
        if (password.length < 12 || password !== String(form.get("confirmation") ?? "")) { setMessage("Use at least 12 characters and enter the same password twice."); return; }
        const { data, error: identityError } = await client.auth.getUser();
        if (identityError || !data.user) { setAuthorized(false); setMessage("Your recovery session expired. Request a new link."); return; }
        const { error } = await client.auth.updateUser({ password });
        if (error) { setMessage("The password could not be changed. Request a new recovery link or contact the coordinator."); return; }
        setDone(true); setMessage("Password changed. Your school access and assignments are unchanged.");
      }
    } catch { setMessage("Connection interrupted. Check your connection before retrying."); }
    finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="mt-8 space-y-5">
    {!configured && <p role="status">Password recovery is unavailable until this installation is configured.</p>}
    <p role="status" aria-live="polite">{message}</p>
    {!done && <fieldset disabled={!configured || busy || (change && !authorized)} className="space-y-5">
      {change ? <>
        <label className="block text-sm">New password<input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required className={input} /></label>
        <label className="block text-sm">Confirm new password<input name="confirmation" type="password" autoComplete="new-password" minLength={12} maxLength={128} required className={input} /></label>
      </> : <label className="block text-sm">Account email<input name="email" type="email" autoComplete="email" required className={input} /></label>}
      <button className="rounded-lg bg-brand px-4 py-3 text-white disabled:opacity-50">{change ? "Save new password" : "Send recovery link"}</button>
    </fieldset>}
    <Link href={done ? "/workspace" : "/login"} className="inline-block text-sm underline underline-offset-4">{done ? "Open school workspace" : "Back to sign in"}</Link>
  </form>;
}
