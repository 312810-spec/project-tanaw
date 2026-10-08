import Link from "next/link";
import { SignInForm } from "@/app/components/sign-in-form";

export const metadata = { title: "Sign in" };

export default function SignInPage() {
  return <main className="mx-auto w-full max-w-md flex-1 px-6 py-12">
    <Link href="/" className="text-sm underline underline-offset-4">Back to TANAW</Link>
    <p className="mt-12 text-xs uppercase tracking-widest text-brand">Project TANAW</p>
    <h1 className="mt-3 text-3xl font-semibold tracking-tight">Your school workspace</h1>
    <p className="mt-3 text-sm leading-6 text-foreground/70">Sign in with the account assigned by your SMEA Coordinator.</p>
    <SignInForm />
  </main>;
}
