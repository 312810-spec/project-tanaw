# Project TANAW — Session Handoff

The single source of truth for "where is this project right now."
Updated at the end of every wave.

---

## Baseline

| Field | Value |
|---|---|
| Repository | `312810-spec/project-tanaw` |
| Branch | `main` (local — **never pushed**) |
| HEAD | the Phase 0.4 commit; confirm with `git log --oneline -1` |
| Known-good prior baseline | `aca8d03` — Phase 0.3 local Supabase bring-up |
| Working tree | clean after the Phase 0.4 commit |
| Local stack | **running** — API `127.0.0.1:55321`, DB `55322`, Studio `55323`. If ports go unreachable after a Docker/Windows restart, see operating-rules §1 before assuming a config defect. |
| Backend target | LOCAL Supabase — `http://127.0.0.1:55321` (permanent 5532x range) |
| Next.js | `16.3.5` — consult `node_modules/next/dist/docs/` before version-sensitive code |

---

## Completed

**Phase 0.1** (`fdcc5e2`) — operating rules (sections 1–14), the read-only rules
audit, the `secrets-guard` and `nextjs-docs-nudge` hooks, project-local
`.claude/settings.json` deny rules, local Supabase config on the 5532x range,
`.env.example`, and the dependency baseline.

**Phase 0.2** — converted documented Phase 0.1 policies into
committed, executable controls:

- Folded the two deferred Phase 0.1 lessons into operating-rules **§7** and
  **§11** and registered them as audit literals, so neither can be silently
  dropped by a later edit.
- Added `scripts/verify_baseline.py`, exposed as `npm run verify`: rules audit,
  repo-wide secret scan, hook syntax, typecheck, and git hygiene. Read-only.
- Added `npm run typecheck`.
- Documented the wave lifecycle in `docs/wave-workflow.md`.
- Created this handoff.

**Phase 0.3** (`aca8d03`) — local Supabase bring-up on the 5532x range:

- Local stack is **running and independently verified reachable**. See
  "Verification state" below — both the runtime port bindings and live probes,
  not just the CLI's exit code.
- `.env.local` holds the local publishable key (client-safe; gitignored). The
  stack's key is stable across restarts, so no re-capture was needed.
- Three non-obvious failures were diagnosed, worked around, and recorded in
  operating-rules **§1** and **§11** as enforced audit literals. Two of the
  three are the kind of defect that silently looks successful, which is why
  they are registered rather than merely described.

**Phase 0.4** (current HEAD) — the bring-up verification itself became a
committed control:

- Added `scripts/verify_local_stack.py`, exposed as `npm run verify:stack` and
  wired into `npm run verify` as its sixth check. It runs **both** halves of
  the operating-rules §11 requirement — runtime binding inspection
  (`NetworkSettings.Ports`) and an independent TCP/HTTP probe — for the five
  runtime-published ports, and fails if either half fails.
- The silent failure Phase 0.3 exposed by hand is now caught mechanically.
  Verified three ways: a live positive run (10/10), a **live negative test**
  (stopped Inbucket → the gate failed on 55324 alone and exited 1, then passed
  again after restart), and a simulated negative run reproducing the exact
  Phase 0.3 state — healthy containers, empty `NetworkSettings.Ports`,
  10/10 sub-checks failing.
- Boundaries stated in the tool itself, because §11 forbids overstating a
  control: only the five runtime-published ports are required (55320 shadow
  and 55329 pooler are not probed), and the gate **SKIPs** when no project
  container exists — it detects a *half-published* stack, not a stopped one.
  A skip is reported as a skip, never as a pass.
- `supabase status` is deliberately not called by the gate: it prints
  `SECRET_KEY`, `SERVICE_ROLE_KEY`, and the JWT to stdout. The gate reaches
  the same information through read-only `docker inspect`.
- One literal registered in `scripts/audit_operating_rules.py`
  (`npm run verify:stack`) so the §11 update cannot be silently dropped.

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
| Local stack reachability | `npm run verify` / `npm run verify:stack` | 10/10 — bindings and probes both green |
| Production build | `npm run build` | exit 0 — static `/` and `/_not-found` |

Gate self-verification (Phase 0.4), run against the real stack:

| Test | Result |
|---|---|
| Live positive run | 10/10 PASS, exit 0 |
| Live negative (Inbucket stopped) | failed on 55324 alone — both binding and probe — exit 1; 8/10 |
| Live negative recovery | restarted container → 10/10 PASS, exit 0 |
| Simulated Phase 0.3 state (healthy containers, empty `NetworkSettings.Ports`) | 10/10 sub-checks FAIL, exit 1 |
| Docker absent / no containers | SKIP (exit 2), reported as skip not pass |

Local Supabase stack (Phase 0.3), verified **after** the bring-up:

| Check | Result |
|---|---|
| Windows excluded TCP ranges | only administered `50000–50059` remains; 5532x fully free |
| Runtime port bindings | all five live — `db→55322`, `kong→55321`, `studio→55323`, `inbucket→55324`, `analytics→55327` (both IPv4 and IPv6) |
| API gateway | `GET http://127.0.0.1:55321/` → 404 (Kong's normal root response) |
| REST endpoint | `GET /rest/v1/` → 200; authenticated query with the publishable key → 200 with a valid OpenAPI document |
| Studio | `GET http://127.0.0.1:55323/` → 307 redirect (expected) |
| Postgres | TCP connect on `127.0.0.1:55322` open |
| Privileged values in repo | `supabase status` prints `SECRET_KEY` / `SERVICE_ROLE_KEY` / JWT — **none** were written to any file; `.env.local` carries only the publishable key |

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
3. **Windows dynamically reserved the entire 5532x range.** Hyper-V/WSL2 took
   `55292–55391`, swallowing all seven TANAW ports at once. Docker failed to
   bind with `access permissions` errors, and the first bring-up reported
   success while publishing no host ports at all.
   *Workaround:* `net stop winnat` / `net start winnat` from an elevated prompt
   releases the dynamic reservations and re-allocates them off 5532x. TANAW's
   ports were **not** changed — the host reservation was fixed instead.
   Recorded in operating-rules §1, enforced as an audit literal.
4. **`supabase status` exit 0 did not mean the stack was reachable.** Containers
   reported `healthy` with bindings in `HostConfig.PortBindings` but empty
   `NetworkSettings.Ports` — nothing listened on 55321.
   *Workaround:* a bring-up is verified only by inspecting the runtime bindings
   *and* an independent TCP/HTTP probe. Recorded in operating-rules §11,
   enforced as an audit literal.
5. **The rules audit reported a valid table as malformed.** Rewriting
   `operating-rules.md` with a CRLF-emitting writer left a trailing `\r` that
   the separator regex could not match. A false failure in the verification
   gate itself, discovered by the negative test for lesson 4.
   *Fix:* `check_table` strips a trailing carriage return before validating.
   Recorded in operating-rules §11, enforced as an audit literal.

---

## Next wave

Phase 0.5 is **not started** and is **not authorized** by this handoff. These are
candidates for the owner to confirm, not a plan:

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
