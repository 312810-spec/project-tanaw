/**
 * Project TANAW — application identity shell.
 *
 * This is a foundation-stage shell, not a working product surface. The
 * capabilities listed below are planned and are presented as such; none of
 * them are implemented yet. No Supabase query, auth, or data workflow runs
 * on this page.
 */

const GOVERNANCE_CHAIN = [
  "Submit",
  "Certify",
  "Finalize",
  "Endorse",
  "Approve",
  "Lock",
] as const;

const PLANNED = [
  {
    title: "Governed packet consolidation",
    body: "School MEA packets travel the governance chain — teacher to district — instead of raw district-wide submissions.",
  },
  {
    title: "Evidence to district outputs",
    body: "Evidence is assembled into subject, school, and district MEA packets that the district actually consumes.",
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
            className="ml-auto hidden items-center rounded-full border border-gold/50 px-3 py-1 font-mono text-[11px] uppercase tracking-wider text-gold sm:inline-flex"
            aria-label="Build stage: foundation"
          >
            Foundation stage
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
            <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-foreground/50">
              Authority sequence
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

        <div className="mt-20 flex flex-col gap-5">
          <div className="flex items-baseline gap-3">
            <h2 className="text-xl font-semibold tracking-tight">
              Planned capabilities
            </h2>
            <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-foreground/50">
              Not yet available
            </span>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {PLANNED.map(({ title, body }) => (
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
          <p className="max-w-2xl text-sm leading-relaxed text-foreground/50">
            The Supabase client foundation and a local connectivity probe are in
            place, but the capabilities above are design intent only. They are
            listed here so the platform&rsquo;s direction is clear, not to imply
            working features.
          </p>
        </div>
      </main>

      <footer className="mt-auto border-t border-black/[.08] dark:border-white/[.12]">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-1 px-6 py-6 text-xs text-foreground/55 sm:flex-row sm:items-center sm:justify-between">
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
