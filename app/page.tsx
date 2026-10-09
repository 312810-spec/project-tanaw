import Link from "next/link";

/** Public introduction. Workspace availability depends on authentication and school assignments. */

const GOVERNANCE_CHAIN = [
  "Submit",
  "Subject review",
  "School review",
  "Head review",
  "School Lock",
  "District review",
] as const;

const CAPABILITIES = [
  {
    title: "School submissions and review",
    body: "Assigned accounts can record manual indicator evidence, review versions, and prepare a school packet with explicit review and Lock.",
  },
  {
    title: "District process review",
    body: "The district sees locked packet process status and can return correction requests. Acceptance waits for governed indicator results.",
  },
  {
    title: "Explicit status semantics",
    body: "Missing is not zero, and submitted is not approved. Status transitions stay visible and auditable.",
  },
] as const;

export default function Home() {
  return (
    <div className="flex flex-col flex-1 bg-background font-sans text-foreground">
      <header className="border-b border-black/[.08] dark:border-white/[.12]">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-6 py-4">
          <TanawMark className="h-9 w-9 shrink-0" />
          <div className="flex flex-col">
            <span className="text-sm font-semibold tracking-tight">
              Project TANAW
            </span>
            <span className="text-xs text-foreground/60">
              TNHS · West 1 District MEA Platform
            </span>
          </div>
          <span
            className="ml-auto hidden items-center rounded-full border border-gold/50 px-3 py-1 font-mono text-[11px] uppercase tracking-wider text-accent-text sm:inline-flex"
            aria-label="Build stage: development"
          >
            Development build
          </span>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-col px-6 py-20">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-4">
            <span className="font-mono text-xs uppercase tracking-[0.2em] text-brand">
              School MEA Consolidator
            </span>
            <h1 className="max-w-2xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
              Governed school data for West 1 District.
            </h1>
            <p className="max-w-xl text-lg leading-relaxed text-foreground/70">
              Project TANAW consolidates governed school MEA packets for TNHS.
              The district consumes certified packets through a clear authority
              sequence — never raw, unverified teacher submissions.
            </p>
          </div>

          <div className="mt-4 flex flex-col gap-3">
            <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-foreground/65">
              Confirmed review sequence
            </span>
            <ol className="flex flex-wrap items-center gap-x-2 gap-y-3">
              {GOVERNANCE_CHAIN.map((step, index) => (
                <li key={step} className="flex items-center gap-2">
                  <span className="rounded-md border border-black/[.1] bg-brand-soft px-3 py-1.5 text-sm font-medium dark:border-white/[.14]">
                    {step}
                  </span>
                  {index < GOVERNANCE_CHAIN.length - 1 && (
                    <span
                      className="text-foreground/30"
                      aria-hidden="true"
                    >
                      →
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </div>
        </div>

        <div className="mt-12">
          <Link href="/login" className="mb-4 mr-3 inline-flex rounded-md bg-action px-4 py-2 text-sm font-medium text-on-action">Sign in to your workspace</Link>
          <Link href="/review" className="inline-flex rounded-md border border-brand px-4 py-2 text-sm font-medium text-brand hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
            View evidence review foundation
          </Link>
          <p className="mt-2 text-xs text-foreground/60">Evidence preview is read-only. Sign-in, verified indicators and school assignments are required for the workspace.</p>
        </div>

        <div className="mt-20 flex flex-col gap-5">
          <div className="flex items-baseline gap-3">
            <h2 className="text-xl font-semibold tracking-tight">
              Workspace capabilities
            </h2>
            <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-foreground/65">
              Configured access required
            </span>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {CAPABILITIES.map(({ title, body }) => (
              <div
                key={title}
                className="flex flex-col gap-2 rounded-lg border border-black/[.08] p-5 dark:border-white/[.12]"
              >
                <h3 className="text-sm font-semibold">{title}</h3>
                <p className="text-sm leading-relaxed text-foreground/65">
                  {body}
                </p>
              </div>
            ))}
          </div>
          <p className="max-w-2xl text-sm leading-relaxed text-foreground/65">
            Class-record uploads, governed district results and AI-generated charts remain unavailable while their approved source and computation contracts are verified. No official data or approval is implied by this development build.
          </p>
        </div>
      </main>

      <footer className="mt-auto border-t border-black/[.08] dark:border-white/[.12]">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-1 px-6 py-6 text-xs text-foreground/65 sm:flex-row sm:items-center sm:justify-between">
          <span>Project TANAW — TNHS SMEA Consolidator</span>
          <span>Local development build · DepEd West 1 District</span>
        </div>
      </footer>
    </div>
  );
}

/**
 * Project TANAW wordmark. A stylized "T" formed by stacked evidence layers
 * (blue) rising to a single district packet (gold) — consolidation as one
 * shape rather than many. Inline so the shell adds no new public asset.
 */
function TanawMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      className={className}
      role="img"
      aria-label="Project TANAW mark"
    >
      <rect width="40" height="40" rx="9" fill="currentColor" className="text-brand" />
      {/* Evidence layers converging upward into one packet. */}
      <rect x="11" y="24" width="6" height="4" rx="1" fill="#ffffff" opacity="0.55" />
      <rect x="17" y="24" width="6" height="4" rx="1" fill="#ffffff" opacity="0.75" />
      <rect x="23" y="24" width="6" height="4" rx="1" fill="#ffffff" opacity="0.55" />
      <rect x="17" y="17" width="6" height="4" rx="1" fill="#ffffff" opacity="0.9" />
      {/* The single district packet. */}
      <rect x="14" y="10" width="12" height="4" rx="1" fill="var(--color-gold)" />
    </svg>
  );
}
