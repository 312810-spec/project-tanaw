@AGENTS.md

# Project TANAW

## Engineering prioritization — owner instruction, 20 October 2026

For consequential engineering choices, use FORGE and a documented weighted
decision score. State criteria/weights, evidence, alternatives, hard gates and
recheck triggers. Scores are prioritization judgments, not correctness evidence
or permission to invent official sources, approvals or actual-use observations.
The owner delegates routine implementation choices; proceed within the authorized
scope. Current scoring/selection: `docs/workaround-decisions-2026-10-20.md`.

> Current implementation reference: `docs/confirmed-decisions-2026-10-08.md` governs the review sequence: Submit → Subject review → School review → Independent School Head review → Explicit SMEA Coordinator Lock → District review. Earlier phase descriptions below are historical; district acceptance is separate from Lock and awaits governed result content. Autonomous UX repair and branch publishing are authorized in the current task; hosted changes and deployment still require separate authorization.

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
