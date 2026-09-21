# Project TANAW — Wave Workflow

Project TANAW works in **waves**: bounded, verifiable, committable increments.
This document is the process so the next session continues from the checkpoint
instead of reconstructing it.

---

## Wave lifecycle

| Step | Action | Rule |
|---|---|---|
| **A. Inspect** | Read only what is needed to understand current state. | Never modify files during inspection. |
| **B. Plan** | State what the wave accomplishes, what is explicitly out, and the smallest structurally sound implementation. | Scope boundaries are stated *before* implementing. |
| **C. Implement** | Write the change. Prefer structural code, reusable components, clear boundaries, minimal duplication, small coherent changes. | No speculative abstractions. No over-engineering. |
| **D. Verify** | Run the smallest meaningful set first, then the broader project checks. | Do not report a check as passed unless it was actually run, with its result. |
| **E. Issue → Workaround → Record** | On any failure: stop, identify the issue, apply the smallest safe workaround, verify it resolves the issue, record it. | Every non-obvious issue leaves institutional knowledge behind. |
| **F. Review** | Inspect the full diff: scope, accidental changes, secrets, generated artifacts, documentation consistency, audit compatibility. | Catch scope creep before it is committed, not after. |
| **G. Commit** | One coherent commit with a conventional message, only after verification is green. | One commit per wave, not one per file. |
| **H. Stop** | The wave ends at the commit. | No push, no next wave, no invented work. |

---

## Required verification

Before any wave commit:

```bash
npm run verify
```

Runs, in order: the operating-rules audit, a repo-wide secret scan, hook syntax
checks, a TypeScript typecheck, git hygiene (`.env.local` ignored,
`.env.example` tracked, no leftover artifacts), and local stack reachability
(runtime bindings plus independent probes, per operating-rules §11). It is
**read-only** — it writes no files and mutates no repository state — so it is
safe to run at any point.

The stack check reports **SKIP**, not PASS, when no `project-tanaw-*` container
exists: it detects a half-published stack, and a skipped check must never be
counted as a pass it did not earn.

When app code or configuration changed, also run:

```bash
npm run build      # full production build; slower, generates gitignored .next/
```

---

## Issue → Workaround → Record

Non-obvious problems and their workarounds are recorded in
`docs/operating-rules.md`, folded into the most appropriate **existing** section.

They are never appended as a new section, and never written to a throwaway log.

The operating-rules audit checks a set of required **literals**, including the
recorded lessons themselves. A lesson that has been folded in and registered as
a literal is therefore mechanically protected: a later edit that removes it
fails `npm run verify`. Unregistered lessons enjoy no such protection, so
recording a lesson means registering its literal too.

---

## Scope control

A wave ends when its stated deliverables are met. Work that surfaces mid-wave
but was not planned is noted in `SESSION-HANDOFF.md` as a candidate for a later
wave — it is not absorbed into the current one.

Explicitly out of scope until the owner authorizes it: the full SMEA application,
teacher/coordinator dashboards, ECR processing, authentication, production
Supabase configuration, deployment, GitHub or Vercel push, major UI design,
production data migration, and large dependency additions.

---

## Continuing from a checkpoint

1. Read `CLAUDE.md`, then `docs/operating-rules.md`.
2. Read `SESSION-HANDOFF.md` for the current baseline and the next wave.
3. Confirm the tree: `git status`, `git log --oneline -3`.
4. Run `npm run verify` to confirm the baseline is intact before starting.
5. Begin the next wave at step A.
