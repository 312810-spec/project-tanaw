import { PasswordRecovery } from "@/app/components/password-recovery";
export const metadata = { title: "Recover your account" };
export default function ForgotPasswordPage() {
  return <main className="mx-auto w-full max-w-md flex-1 px-6 py-12"><h1 className="text-3xl font-semibold tracking-tight">Recover your account</h1><p className="mt-3 text-sm leading-6 text-foreground/70">Use the email assigned by your SMEA Coordinator. Recovery does not restore disabled school access.</p><PasswordRecovery /></main>;
}
