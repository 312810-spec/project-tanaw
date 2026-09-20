# Project TANAW — Operating Rules and Safety Record

**Project:** Project TANAW — West 1 District MEA Platform

**Development rule:** Issue → Workaround → Record. This file is the Record.

---

## 1. Supabase ports — permanent 5532x range

Another local Supabase project on this machine owns the default 5432x range, so the two stacks cannot run at once. Project TANAW therefore uses the 5532x range, set in `supabase/config.toml`.

| Service             | Port  |
|---------------------|-------|
| Shadow DB           | 55320 |
| API                 | 55321 |
| DB / Postgres       | 55322 |
| Studio              | 55323 |
| SMTP / Inbucket     | 55324 |
| Analytics           | 55327 |
| Pooler (if enabled) | 55329 |

Do not return Project TANAW to the 5432x range without first checking which project owns those ports on the host.

---

## 2. Local-first development target

Normal development targets local Supabase only.

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:55321
```

`.env.local` uses the local Supabase publishable key (or legacy anon key where applicable). The hosted project is not the normal development target.

---

## 3. Hosted Supabase is protected infrastructure

Hosted project reference: `qiqwfdmscbanetxfoqvp`

Never place the following in source, `.env.example`, any `NEXT_PUBLIC_*` variable, or any committed file:

- `service_role` credentials
- `sb_secret_*` credentials
- database passwords
- privileged connection strings

Hosted deployment credentials belong in protected deployment environment variables, not in this repository.

---

## 4. Database safety

The following require explicit owner approval before running:

- `supabase db reset --linked`
- `supabase db push` against hosted infrastructure
- `supabase db pull` from hosted infrastructure
- ambiguous or unscoped database resets
- destructive `DROP`, `TRUNCATE`, and destructive `DELETE` migrations
- production schema changes

For a routine local reset, prefer:

`supabase db reset --local`

Before an approved hosted push, require:

`supabase db push --dry-run`

Never run `supabase db reset --linked` against hosted Project TANAW.

---

## 5. Git safety

Do not `git push --force` to `main` without explicit owner approval.

Do not delete migration history that the schema relies on without review.

---

## 6. Migrations

- Write migration files first.
- Review them before application.
- Apply them to local Supabase first.
- Applying migrations to hosted infrastructure is a separate action that requires explicit owner approval.
- Do not delete migration files casually; migration history is part of the schema audit trail.

---

## 7. Secrets hygiene

Project-local secrets guard:

`.claude/hooks/secrets-guard.mjs`

Privileged credentials must not be written into source files, committed files, or client-exposed environment variables. This includes `service_role` credentials, `sb_secret_*` values, database passwords, and privileged connection strings.

Supabase publishable and legacy anon keys are client-safe by design. Authorization must be enforced through Row Level Security (RLS), not by treating the public key as a secret.

`.env.local` must remain gitignored.

Do not claim that the secrets-guard hook mechanically enforces these rules until its behavior has been verified during Phase 0.1.

---

## 8. Next.js version rule

Project TANAW currently uses Next.js 16.

Before version-sensitive Next.js implementation, consult the installed documentation under:

`node_modules/next/dist/docs/`

Treat relevant deprecation notices as blocking until they are resolved.

---

## 9. Product governance context

**Product:** Project TANAW — West 1 District MEA Platform

**Governance chain:**

Teacher → Subject Coordinator → School SMEA Coordinator → School Head → District MEA Coordinator

**Authority sequence:**

Submit → Certify → Finalize → Endorse → Approve → Lock

**Evidence flow:**

Evidence → Subject MEA Packet → School MEA Packet → District MEA Packet → Division Outputs

The district consumes governed school packets, not district-wide raw teacher submissions.

---

## 10. Scope protection

Do not modify TNHS or LIKHA repositories or their configuration while working on Project TANAW.

Project TANAW must keep project-specific configuration inside the Project TANAW repository whenever supported, so inherited global configuration from unrelated projects does not silently control this project.

Do not rewrite user-global configuration that belongs to another project merely to make Project TANAW work. Prefer a Project TANAW project-local override when Claude Code officially supports it.

---

## 11. Verification and enforcement claims

Do not state that a hook, Claude Code setting, permission rule, MCP configuration, or other mechanism enforces a Project TANAW policy unless that exact behavior has been verified.

A documented policy and a mechanically enforced control are not the same thing.

If enforcement has not been verified, describe the rule as an operator or project policy rather than claiming that tooling blocks it.

When a workaround is required, follow:

Issue → Workaround → Record

Record non-obvious constraints and verified workarounds in this file so the same failure is not repeated.

---

## 12. Data integrity and status semantics

**Missing is not zero.**

Absent, unavailable, invalid, incomplete, or unverified evidence must not be silently converted to a numeric zero.

A zero is a valid recorded value only when the source evidence explicitly supports zero.

**Submitted is not approved.**

Submission records that evidence entered the governance workflow. It does not imply certification, finalization, endorsement, approval, or locking.

Preserve the authority sequence:

Submit → Certify → Finalize → Endorse → Approve → Lock

Status transitions must remain explicit and auditable. Do not infer a later governance state from the presence of data alone.

---

## 13. Auto Mode isolation

Auto Mode remains disabled for Project TANAW.

Verified against the official Claude Code auto-mode configuration reference: the auto mode classifier does not read `autoMode` from project settings in `.claude/settings.json` or `.claude/settings.local.json`. Both files live inside the repository, so a checked-in repo or a build step could otherwise inject its own allow rules. The classifier reads `autoMode` from user settings, managed settings, and per-invocation configuration supplied through the `--settings` flag or Agent SDK.

Consequences for Project TANAW:

- Do not add an `autoMode` block to Project TANAW project settings. It is not read by the classifier and cannot isolate this project.
- Do not rewrite the user-global `autoMode` configuration to make Project TANAW work. That configuration belongs to another project on this machine.
- Because entries from the scopes the classifier does read are combined, user-scope `autoMode.environment` entries remain in effect for Project TANAW Auto Mode sessions. Project settings provide no documented mechanism to narrow or clear those user-scope entries.
- Continue manual approvals for all Project TANAW work during Phase 0.1.
- A TANAW-specific Auto Mode configuration approach may be considered later only if official Claude Code documentation establishes a safe project-scoped or per-invocation isolation mechanism and its precedence is verified.

What still works at project scope: `permissions.deny` and `permissions.ask` in `.claude/settings.json` are evaluated before the classifier runs. A matching deny rule blocks the call and neither the classifier nor user intent can override it; a matching ask rule forces a prompt and cannot be auto-approved. These are treated here as operator policy and as a checkpoint, not as a substitute for keeping Auto Mode disabled. Content-scoped rules are pattern-limited: a command written a different way than the rule expects may not match, so the checkpoint is not a complete guarantee.

Unresolved, recorded as an owner-visible limitation: the official documentation does not state whether the `--settings` flag replaces or combines with persistent user-scope `autoMode` settings. Until that is documented, it must not be relied on as a Project TANAW isolation mechanism, and no behavior is inferred from it.

---

## 14. Claude-security plugin follow-up

The user-global `claude-security` plugin registration is version 0.11.0 and remains
enabled. A legacy project-scoped registration at version 0.10.2.3 is still present and
is bound to another project on this machine.

Phase 0.1 recommendation, recorded without any plugin change:

- Keep the current user-global `claude-security` installation under review.
- The legacy project-scoped duplicate at 0.10.2.3 is version-skewed against the
  user-scope 0.11.0 registration. Its cleanup requires owner approval and must be
  performed outside Project TANAW work.
- Do not alter that other project's registrations from Project TANAW.
- Do not install a duplicate Project TANAW security plugin during Phase 0.1.

