import { PasswordRecovery } from "@/app/components/password-recovery";
export const metadata = { title: "Choose a new password", robots: { index: false, follow: false } };
export default function ResetPasswordPage() {
  return <main className="mx-auto w-full max-w-md flex-1 px-6 py-12"><h1 className="text-3xl font-semibold tracking-tight">Choose a new password</h1><p className="mt-3 text-sm leading-6 text-foreground/70">A verified authentication session is required.</p><PasswordRecovery change /></main>;
}
