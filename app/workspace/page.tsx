import { AccountWorkspace } from "@/app/components/account-workspace";

export const metadata = { title: "School workspace" };

export default function WorkspacePage() {
  return <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
    <a href="/" className="text-sm underline underline-offset-4">Back to TANAW</a>
    <p className="mt-10 text-xs uppercase tracking-widest text-brand">Project TANAW</p>
    <h1 className="mt-3 text-3xl font-semibold tracking-tight">School workspace</h1>
    <p className="mt-3 text-sm leading-6 text-foreground/70">Your active roles and assignments are checked against school membership.</p>
    <AccountWorkspace />
  </main>;
}
