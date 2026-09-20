@AGENTS.md

# Project TANAW

West 1 District MEA Platform.

For the complete project safety and operating rules, read:

`docs/operating-rules.md`

## Governance

Teacher → Subject Coordinator → School SMEA Coordinator → School Head → District MEA Coordinator

Authority sequence:

Submit → Certify → Finalize → Endorse → Approve → Lock

The district consumes governed school packets, not district-wide raw teacher submissions.

## Development rule

Issue → Workaround → Record.

When a non-obvious problem requires a workaround, record it so the same failure is not repeated.

## Data integrity

- **Missing is not zero.**
- **Submitted is not approved.**
- Do not silently infer later governance states from the presence of data.

## Supabase development

Normal development targets local Supabase only.

Local API:

`http://127.0.0.1:55321`

Project TANAW permanently uses the 5532x local Supabase port range.

Hosted Supabase project:

`qiqwfdmscbanetxfoqvp`

Treat the hosted project as protected infrastructure.

Do not perform hosted database mutations, production schema changes, destructive operations, or deployment changes without explicit owner approval.

## Project isolation

Do not modify TNHS or LIKHA repositories or their configuration while working on Project TANAW.

Prefer Project TANAW project-local configuration over unrelated user-global project configuration whenever Claude Code officially supports it.

Do not rewrite LIKHA or TNHS user-global configuration merely to make Project TANAW work.

## Next.js

Project TANAW currently uses Next.js 16.

Before version-sensitive Next.js implementation, consult:

`node_modules/next/dist/docs/`

Treat relevant deprecation notices as blocking until they are resolved.
