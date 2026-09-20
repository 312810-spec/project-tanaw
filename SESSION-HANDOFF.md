# Project TANAW — Session Handoff

The single source of truth for "where is this project right now."
Updated at the end of every wave.

---

## Baseline

| Field | Value |
|---|---|
| Repository | `312810-spec/project-tanaw` |
| Branch | `main` (local — **never pushed**) |
| HEAD | the Phase 0.2 commit; confirm with `git log --oneline -1` |
| Known-good prior baseline | `fdcc5e2` — Phase 0.1 baseline |
| Working tree | clean after the Phase 0.2 commit |
| Backend target | LOCAL Supabase — `http://127.0.0.1:55321` (permanent 5532x range) |
| Next.js | `16.3.5` — consult `node_modules/next/dist/docs/` before version-sensitive code |

---

## Completed

**Phase 0.1** (`fdcc5e2`) — operating rules (sections 1–14), the read-only rules
audit, the `secrets-guard` and `nextjs-docs-nudge` hooks, project-local
`.claude/settings.json` deny rules, local Supabase config on the 5532x range,
`.env.example`, and the dependency baseline.

**Phase 0.2** (current HEAD) — converted documented Phase 0.1 policies into
committed, executable controls:

- Folded the two deferred Phase 0.1 lessons into operating-rules **§7** and
  **§11** and registered them as audit literals, so neither can be silently
  dropped by a later edit.
- Added `scripts/verify_baseline.py`, exposed as `npm run verify`: rules audit,
  repo-wide secret scan, hook syntax, typecheck, and git hygiene. Read-only.
- Added `npm run typecheck`.
- Documented the wave lifecycle in `docs/wave-workflow.md`.
- Created this handoff.

---

## Known constraints

- Hosted Supabase (`qiqwfdmscbanetxfoqvp`) is protected infrastructure. No hosted
  mutations, schema changes, destructive operations, or deployment changes
  without explicit owner approval.
- `supabase db reset --linked`, `db push --linked`, and `db pull --linked` are
  denied in `.claude/settings.json`; `git push` and `supabase db reset` require
  approval.
- Auto Mode is disabled for this project. All work takes manual approvals.
  Project settings cannot isolate Auto Mode; do not add an `autoMode` block.
- `docs/operating-rules.md` must contain **exactly sections 1–14** in sequence —
  the audit enforces this. New lessons are folded into existing sections, never
  appended as new ones.
- Do not modify TNHS or LIKHA repositories or their configuration.
- Missing is not zero. Submitted is not approved. Governance states are never
  inferred from the presence of data.

---

## Verification state

| Check | Command | Result |
|---|---|---|
| Operating-rules audit | `npm run verify` | 7/7 PASS |
| Secret scan (commit-candidates) | `npm run verify` | 0 hits |
| Hook syntax | `npm run verify` | both hooks parse cleanly |
| TypeScript | `npm run verify` / `npm run typecheck` | exit 0 |
| Git hygiene | `npm run verify` | `.env.local` ignored, `.env.example` tracked, no leftovers |
| Production build | `npm run build` | exit 0 — static `/` and `/_not-found` |

---

## Recorded issues and workarounds

1. **Fixed value shipped as a placeholder.** Phase 0.1's `.env.example` wrote
   `NEXT_PUBLIC_SUPABASE_URL=<http://127.0.0.1:55321>`, which breaks any copy of
   the template, because the value being "asked for" is already known.
   *Workaround:* fixed non-secret values stay literal; only genuinely variable
   values use a placeholder. Recorded in operating-rules §7, enforced as an
   audit literal.
2. **Audit label mismatched its validation.** The check validating sections 1–14
   was labeled "sections 1-12" — a false statement about what the control does.
   *Workaround:* audit documentation stays synchronized with the validation it
   actually performs. Recorded in operating-rules §11, enforced as an audit
   literal.

---

## Next wave

Phase 0.3 is **not started** and is **not authorized** by this handoff. These are
candidates for the owner to confirm, not a plan:

- Bring up the local Supabase stack and confirm the 5532x ports are free.
- First migration (local only): written and reviewed before application, per
  operating-rules §6. `supabase/migrations/` does not exist yet.
- Supabase browser/server client foundation — `@supabase/ssr` and
  `@supabase/supabase-js` are already dependencies but unused.
- Replace the stock Create Next App landing page and `metadata` ("Create Next
  App") with Project TANAW identity.

---

## Explicit non-goals

No push to GitHub. No Vercel deployment. No hosted Supabase changes. No full
SMEA feature implementation, dashboards, or ECR processing. No authentication or
data-model work beyond genuine foundation requirements. No large dependency
additions. No speculative directories or abstractions.

---

## How to continue

See `docs/wave-workflow.md`.
