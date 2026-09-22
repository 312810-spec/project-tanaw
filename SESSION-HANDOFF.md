# Project TANAW — Session Handoff

The single source of truth for "where is this project right now."
Updated at the end of every wave.

---

## Baseline

| Field | Value |
|---|---|
| Repository | `312810-spec/project-tanaw` |
| Branch | `main` (**pushed** — origin/main tracks HEAD) |
| HEAD | `0b0ef07` — the Phase 0.6B governance-record commit; confirm with `git log --oneline -1` |
| Known-good prior baseline | `aca8d03` — Phase 0.3 local Supabase bring-up |
| Working tree | **clean** — Phase 0.6B is committed and pushed |
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

**Phase 0.4** (`3540188`) — the bring-up verification itself became a
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

**Phase 0.5** — read-only audit complete. No implementation work and no commit;
the audit examined the Phase 0.1–0.4 baseline against the operating rules and
the wave workflow and produced no code changes.

**Phase 0.6A** — **complete, committed, and pushed.** Two commits, in this
order:

1. `dda366f` — `feat: add read-only tanaw-reviewer and opt-in design skill`
   (implementation): `.claude/agents/tanaw-reviewer.md`,
   `.claude/skills/frontend-design/SKILL.md`,
   `.claude/skills/frontend-design/LICENSE.txt`,
   `.claude/skills/frontend-design/PROVENANCE.md`.
2. `7f5eff5` — `docs: record Phase 0.6A verification state, blocker verdicts,
   and commit separation` (memory-only): `SESSION-HANDOFF.md`.

Both are on `origin/main`, which matches `HEAD` exactly (0 ahead, 0 behind).

- The reviewer agent implements wave step **F (Review)** from
  `docs/wave-workflow.md` as a project-local, read-only, advisory agent
  (`tools: Read, Grep, Glob`, `permissionMode: plan`). It carries **no pinned
  model** — see "Recorded issues and workarounds" #6 for why.
- The `frontend-design` skill is vendored as an explicitly opt-in reference:
  it declares `disable-model-invocation: true` in its frontmatter, the single
  deliberate change from upstream. That is a declaration of opt-in intent,
  **not** a verified enforcement — no mechanism in this repo tests it, so per
  operating-rules §11 it is policy, not a control.
  **License provenance resolved.** The upstream is the local
  `claude-plugins-official` marketplace plugin `frontend-design` (author
  declared as Anthropic in its `plugin.json`). `LICENSE.txt` is verified
  **byte-identical** to the upstream original (sha256 `0d542e0c…` both sides),
  so it is not a defect and is not changed. It terminates at
  "END OF TERMS AND CONDITIONS" because **the upstream does too** — restoring
  the canonical appendix would diverge from the authoritative source. Provenance
  is recorded in `.claude/skills/frontend-design/PROVENANCE.md`, which asserts
  no copyright line of its own because the upstream ships none.
- One correction was applied to the reviewer file during verification: the
  `model: sonnet` frontmatter line was removed because the session's API gateway
  rejects that model with HTTP 400. See "Recorded issues and workarounds" #6.

**Final staged-scope audit.** Both blockers adjudicated:

- **Blocker A (LICENSE) — RESOLVED.** Re-verified against the authoritative
  upstream: `LICENSE.txt` is byte-identical (sha256 `0d542e0c…`) and terminates
  at "END OF TERMS AND CONDITIONS" because the upstream does too. Not a defect;
  left unchanged. Provenance recorded in `PROVENANCE.md`. No copyright line
  invented.
- **Blocker B (Lesson #6) — PROPOSED, NOT IMPLEMENTED, and remains
  owner-gated.** `docs/operating-rules.md` and
  `scripts/audit_operating_rules.py` are **unchanged** (verified: zero diff
  from the `3540188` baseline to `7f5eff5`). `PHRASES` still ends at
  `"npm run verify:stack"` (Phase 0.4). The proposed §11 wording and its
  literal are in the wave report.

**Commit separation, as executed.** Project TANAW isolates memory/handoff
changes into their own commit. Phase 0.6A was committed in that separated form
and both commits are pushed:

- *Implementation/audit commit:* `dda366f` — `.claude/agents/tanaw-reviewer.md`,
  `.claude/skills/frontend-design/SKILL.md`,
  `.claude/skills/frontend-design/LICENSE.txt`,
  `.claude/skills/frontend-design/PROVENANCE.md`.
- *Memory-only commit:* `7f5eff5` — `SESSION-HANDOFF.md` alone.

This standing rule continues to apply to future waves: never combine an
implementation commit and a memory commit.

**Phase 0.6B** — **complete, committed, and pushed.** Two commits, in this
order, both separate per the rule above:

1. `3a836bd` — `feat: add Supabase client foundation and local connectivity
   probe` (implementation): `utils/supabase/client.ts`,
   `utils/supabase/server.ts`, `app/api/supabase-health/route.ts`.
2. `0b0ef07` — `docs: record Phase 0.6B connectivity findings` (memory-only):
   `docs/operating-rules.md`.

Both are on `origin/main`, which matches `HEAD` exactly (0 ahead, 0 behind).

- The Supabase client foundation uses `@supabase/ssr` 0.12.7 with the
  non-deprecated `getAll`/`setAll` cookie interface. Browser client
  (`createSupabaseBrowserClient`) and server client
  (`createSupabaseServerClient`) are both request-scoped factories, not
  module-scope singletons. Only the **publishable (anon) key** is used anywhere;
  no `service_role` and no `sb_secret_*` value exists in the wave.
- `app/api/supabase-health/route.ts` is a **read-only PostgREST reachability
  probe, not a key-validation mechanism.** It queries a deliberately
  non-existent relation (`_tanaw_connectivity_probe`) and treats a truthy
  `error.code` as proof that PostgREST answered. It mutates nothing, creates no
  schema, and returns only `{ reachable, detail }` — no URL, key, cookie, or raw
  database error reaches the response.
- **Verified live during review:** `npm run build` exit 0 with the route
  registered as `ƒ /api/supabase-health` (dynamic); the endpoint returned
  `{"reachable":true}` against the live stack and `{"reachable":false}` against
  a genuinely dead host.
- **Three findings were found by independent review, corrected, and recorded**
  in operating-rules §8 (see "Recorded issues and workarounds" #11, #12, #13):
  the probe's comments misattributed the response to PostgreSQL `42P01` when the
  actual behavior is `PGRST205`; the comments overstated the probe as proof of
  key validity when a wrong key also answers structurally (`PGRST301`); and
  `NEXT_PUBLIC_*` values are inlined at build time, so a runtime override is
  silently ignored by an already-built artifact. All three were **comment /
  documentation corrections only** — no probe logic changed.
- Phase 0.6B introduced **no** migrations, schema, Auth, RLS, middleware/Proxy,
  or UI changes, and no dependency or package changes.
- Atria-only execution was maintained throughout the wave; no Claude-family
  model or other provider was selected, invoked, or used as a fallback.
- Lesson #6 remains **OWNER-GATED and NOT IMPLEMENTED**; this wave did not touch
  it.

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

Re-run during the Phase 0.6A verification wave (against the staged tree plus the
unstaged `model:` line removal): `git diff --check` exit 0, `npm run verify`
6/6 PASS with local stack reachability 10/10 against a live stack. See the wave
report for `npm run build`.

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
6. **A project agent's pinned model was rejected by the session's API gateway.**
   `.claude/agents/tanaw-reviewer.md` declared `model: sonnet`, which this
   machine's gateway (`ANTHROPIC_BASE_URL=https://api.atria-asi.ai`) rejects
   with `HTTP 400 A supported model is required`. The agent was discovered and
   launched correctly — the failure was model routing, not discovery and not
   the agent definition.
   *Workaround:* the pinned model line was removed so the agent inherits the
   session model. Agent definitions in this repo pin **tools and permission
   mode**, which are the restrictions that actually matter; a pinned model is
   neither a restriction nor a requirement, and pinning one couples the
   definition to a gateway that may not serve it. Not yet registered as an
   operating-rules literal — see "Blocker B" in the wave report for the proposed
   §11 wording and `PHRASES` entry, which remain **owner-gated**.
7. **A reviewer finding about the vendored LICENSE was disproven by direct
   comparison.** The reviewer inferred that `LICENSE.txt` was "not the full
   canonical Apache-2.0 text" because it ends at "END OF TERMS AND CONDITIONS".
   The inference was reasonable but wrong: the authoritative upstream (the local
   `claude-plugins-official` plugin `frontend-design`) ships exactly that text,
   and the vendored copy is **byte-identical** to it (sha256 `0d542e0c…`).
   *Fix:* no license change — the perceived defect is upstream's own form, and
   altering it would diverge from the authoritative source. Provenance was
   recorded in `.claude/skills/frontend-design/PROVENANCE.md` instead.
   *Record:* a claim about a vendored third-party file is only as strong as the
   comparison it rests on. "Differs from the text I recall" is not the same as
   "differs from the source," and the reviewer itself flagged this correctly as
   *inferred, not inspected*. The resolution needed the authoritative local
   copy, which existed on this machine.
8. **Reviewer isolation is tool-level, not context-level — record the
   distinction, do not call it a tool-isolation failure.** During the smoke test
   the reviewer received injected instruction text from `codebase-memory-mcp`
   even though none of that server's tools were available to it. No prohibited
   capability was invoked and nothing was called; the injected text had no
   effect.
   *Record:* three separate claims, kept separate per operating-rules §11 —
   **tool capability isolation: observed** (the reviewer's available set was
   exactly `Read`, `Grep`, `Glob`, `SubagentHandback`); **context/instruction
   isolation: not equivalent to tool isolation and not established** (third-party
   MCP instruction text does reach a nominally isolated agent's context);
   **no prohibited capability successfully invoked: observed**. Capability
   *absent* is not capability *blocked*: the reviewer could not report that a
   write or command was refused, because no such tool existed to attempt either
   with. The reviewer is a soft trust boundary, correct as an advisory reviewer,
   and must not be described as a hard one.
9. **A full SHA-256 digest was mistranscribed outside the repository.** A
   checkpoint specification quoted the LICENSE digest as ending `…5762194`; the
   verified value is `0d542e0c8804e39aa7f37eb00da5a762149dc682d7829451287e11b938e94594`.
   *Workaround:* compared the file byte-for-byte against the authoritative
   upstream source (`cmp`), which is the stronger check, and used the real digest.
   *Record:* no project record ever contained the wrong value — this file and
   `PROVENANCE.md` both quote only the 8-character prefix `0d542e0c…`, which
   remained correct throughout, so no record needed correcting. The mismatch was
   **not** a license defect and does not indicate any divergence from upstream.
   A prefix is deliberately used instead of a full digest so a transcription slip
   cannot become a false integrity finding.
10. **This handoff described a superseded staged count.** The working-tree row
    said "exactly three staged Phase 0.6A files," which was accurate early in the
    wave before the scope expanded.
    *Fix:* the row then stated five staged files — four implementation/audit
    files plus this handoff. **That five-file staged state was itself
    transient:** it was subsequently committed and pushed as the two separated
    commits `dda366f` (implementation) and `7f5eff5` (memory-only), so the
    working tree is now clean and no files remain staged.
    *Record:* staged-scope counts go stale the moment the scope changes; a
    handoff that states a count must be re-read against `git status` at the end
    of the wave, not written once mid-wave. The same applies to commit state —
    a handoff written before the commits land must be reconciled against the
    actual post-commit repository, or it preserves a truthful-but-superseded
    snapshot that a later session could mistake for current.
11. **The connectivity probe's comments named the wrong error.** They attributed
    the non-existent-relation response to PostgreSQL `42P01` (`undefined_table`).
    PostgREST actually resolves the relation through its **schema cache** and
    answers `PGRST205` (HTTP 404) *before* PostgreSQL is reached, so `42P01`
    never occurs on this path.
    *Fix:* comments corrected in `app/api/supabase-health/route.ts` to describe
    the schema-cache mechanism. No probe logic changed — the code already tests
    a truthy `error.code`, which matched `PGRST205` all along.
    *Record:* prefer testing a **property** (a truthy structured error code) over
    naming a specific error constant, so the code stays correct when the
    underlying error changes. Recorded in operating-rules §8.
12. **The probe conflated reachability with key validity.** Its comments claimed
    the structured answer proved the gateway "accepted the publishable key."
    Verified false: a **deliberately wrong key** is also answered structurally —
    `PGRST301`, HTTP 401 — with a truthy code, so the probe reports
    `reachable: true` either way. A green probe proves the endpoint answered; it
    does not prove the key is valid.
    *Fix:* comments corrected to make the distinction explicit. The endpoint was
    deliberately **not** broadened into a key-validation endpoint.
    *Record:* a wrong publishable key can hide behind a green health check; a
    future "reachable but failing" diagnosis should check the key
    (`supabase status`) rather than assume RLS or the stack is at fault.
    Recorded in operating-rules §8.
13. **`NEXT_PUBLIC_*` values are inlined at build time.** A dead-stack endpoint
    test that overrode `NEXT_PUBLIC_SUPABASE_URL` at process start still hit the
    live stack: the built artifact had already baked in the live value and
    silently ignored the override, so the test looked like a pass for the wrong
    reason.
    *Workaround:* rebuild (`npm run build`) with the intended environment value
    before exercising an environment-dependent route; never treat a runtime
    override as sufficient evidence about an already-built artifact.
    *Record:* recorded in operating-rules §8.

---

## Next wave

Phase 0.6B is **complete, committed, and pushed**; there is nothing pending
authorization from it. The one remaining owner-gated item is Lesson #6 (see
"Recorded issues and workarounds" #6), which is a standalone governance decision
and does not block the work below. These are candidates for the owner to
confirm, not a plan:

- First migration (local only): written and reviewed before application, per
  operating-rules §6. `supabase/migrations/` does not exist yet. No tables back
  the health probe — it deliberately queries a relation it does not create.
- Replace the stock Create Next App landing page and `metadata` ("Create Next
  App") with Project TANAW identity.
- Consume the client foundation: the browser and server clients exist but are
  not yet imported by any component or route other than the health probe.

---

## Explicit non-goals

No push to GitHub without explicit owner authorization (the Phase 0.6A push was
authorized and completed; `git push` remains an approval-gated action in
`.claude/settings.json`). No Vercel deployment. No hosted Supabase changes. No full
SMEA feature implementation, dashboards, or ECR processing. No authentication or
data-model work beyond genuine foundation requirements. No large dependency
additions. No speculative directories or abstractions.

---

## How to continue

See `docs/wave-workflow.md`.
