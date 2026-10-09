# TANAW FORGE UX implementation and verification

10 October 2026 · Review branch `fix/forge-ux-recovery`

The 9 October audit identified 22 findings. This branch implements the source
changes and safe mitigations below. It does not claim that rendered behavior has
been verified, that all product features are available, or that the live browser
has been repaired. No official data, formulas, assignments or approvals are seeded.

## Finding coverage

| Finding | Result in this branch | Verification / limits |
|---|---|---|
| F01 · Required indicator coverage | Each assignment needs an explicit nonempty set of verified period indicators. Packet preparation requires reasons for partial or absent evidence. Manifest captures requirements and coverage, so changes invalidate prior reviews. | Synthetic SQL fixture exercises unknown and partial requirements. Existing slots remain unconfigured until the coordinator explicitly sets requirements; no inferred coverage. |
| F02 · Expired amendment recovery | Under the cycle lock, a new reasoned amendment closes an expired round and preserves its row and earlier packet history. An active round prevents another open round. | Synthetic SQL expiry/reopen check. |
| F03 · Exact snapshot and prerequisites | School review shows each packet’s exact source versions, values, source references and requirements; recorded reviews, coordinator self-review, missing acknowledgment, independent Head eligibility and stale manifest are visible. Lock is gated by current prerequisites. | Server retains authoritative checks. Browser workflow untested. |
| F04 · Unsupported district acceptance | Process counts are explicitly labeled. Acceptance is blocked in UI and RPC until governed indicator result content exists; district returns remain available. | SQL acceptance denial tested. This mitigates unsafe approval; it does not implement governed district results. |
| F05 · Persistent decisions and comments | District history is loaded; school-scoped feedback RPC exposes packet version, action, comment and date to assigned school roles without raw district evidence access. | SQL teacher feedback and cross-school denial checks. |
| F06 · Consequence review | Access changes, deadlines, Lock, district decisions, extension, handover, requirement changes and amendment opening show target/consequence/reason in native confirmations. District decision has no default; returns require comments. | Source implemented; browser dialog/focus interaction untested. |
| F07 · Unsent work | In-scope refresh retains forms and targets. Input changes warn before school/role/cycle/target switches, destructive refresh, navigation and unload. A failed access refresh preserves forms but pauses actions. Confirmed writes clear their dirty marker. | Source reviewed. Intentional confirmation can discard edits; no privilege change is replayed automatically. Browser adversarial tests untested. |
| F08 · Unreadable drafts | Editing is paused until a separate recovery copy is verified. Original/recovery download is available. Existing different recovery copies and storage failures fail closed. | Pure retention, occupied archive, quota and failed verification regressions pass. |
| F09 · Contrast and input access | Separate action/on-action, accent and focus tokens; secondary text strengthened; visible focus covers input/select/textarea/summary. Buttons and summaries have a 44px minimum height. | Declared dark action contrast 6.23:1; light accent 5.85:1. Rendered colors, target spacing, zoom and full accessibility review untested. |
| F10 · Retry reconciliation | Completed subject/packet review is shown and repeat review is disabled; server reconciles repeat reviews. District writes use durable request identity plus expected previous decision; exact retries and unchanged decisions reconcile without duplicate history. | SQL interrupted-response, changed-payload, stale-decision and reloaded-retry checks. |
| F11 · Confirmed writes vs failed reads | Workflow, members and deadline actions report both facts when an RPC succeeds but refresh fails. Prior data stays visible as stale and actions pause until a successful refresh. | Source reviewed and compiles; UI transport-failure injection untested. |
| F12 · Loading | Refresh has progress text, busy semantics and disabled repeat refresh/actions. Previously loaded content remains instead of a blank task. | Request generation guards preserved. Browser timing behavior untested. |
| F13 · Cutoff and amendment eligibility | Selected evidence shows effective base/extension cutoff and reason. Locked cycles show active/expired amendment and its cutoff. Local preparation remains possible when online submission is blocked. | Clock is advisory; server decides eligibility. Boundary/skew UI tests untested. |
| F14 · Identity | School selector uses stored school name or actual ID. Cycle selector uses stored year/block; submission labels include scope, subject and author identity. | No fabricated names or numbered stand-ins. Browser truncation review untested. |
| F15 · Controlled subject choice | Access editor chooses existing scopes with checkboxes and provides a separate explicit new-scope field. Assignment subject selector uses provisioned account/school scopes. | No invented subject catalog; server still validates author scope. |
| F16 · Evidence corrections/history | Recent versions show values, reasons, sources and dates. Selecting an indicator prefills its recorded fields; changes show recorded/proposed value and source. Switching an edited indicator asks before replacement. | Previous evidence/version guards preserved. Diff interaction and full history pagination untested; view shows the recent 20 versions. |
| F17 · Actionable errors | Conflict, duplicate, permission, requirement and uncertain-response errors identify checks and reconciliation before retry. Return comments are required in the action handler. | Pure error-copy checks pass; UI validation interaction untested. |
| F18 · Empty indicator registry | Manual entry explains the absent verified registry and coordinator next step. Unconfigured assignment requirements explain disabled packet preparation. | No numeric zero or approval inferred. |
| F19 · Offline truthfulness | Offline fallback avoids unconditional save guarantees. Offline submit attempts device persistence and reports its result. Working draft is cleared only after confirmed submission; recovery archive remains. | Pure storage/service-worker tests pass. Browser quota/offline interaction untested. |
| F20 · Current copy | Homepage describes implemented workspace and unavailable class-record/results features. Current governance note supersedes old phase vocabulary in active operating documents. Calendar footer points to implemented extension/Lock workflow. | Historical checkpoints retain their original context. No deployment availability claim. |
| F21 · Task hierarchy | Primary submissions/review precede calendar/access management. Task navigation links target section headings. | Narrow-screen and focus navigation review untested. |
| F22 · Recovery outcomes | Unconfigured recovery has a resolved unavailable message; failed callback explains invalid/expired/browser mismatch without exposing tokens; password rules are visible. Successful recovery request shows completion and a 60-second resend cooldown. | Production build and source checks; actual mail/session behavior untested. |

## Verification

- Local domain regression suite: **75 passed, zero failed**.
- Local Python source-audit suite: **9 passed**.
- Lint, TypeScript, production build and repository baseline checks run for the
  branch. Local Docker stack check is skipped because Docker is unavailable here.
- Database-only GitHub Actions workflow `tanaw-ux-verify.yml` creates an isolated
  Supabase stack. It does not install or launch a browser and does not target the
  hosted project. The initial migration/test revision passed in run
  `37968255519`, commit `7624cb4314918fe86e990b857a2fd7efcdeb5c31`.
- Later refinements must pass the corresponding branch CI run before being treated
  as tested. Match the run commit to the source revision being reviewed.
- The authenticated browser fixture was updated for the new explicit requirements,
  confirmations, offline copy and district return gate. It was syntax checked,
  **not executed** in this session.

## Material decisions and tradeoffs

Requirements are configured explicitly by the SMEA Coordinator from the verified
registry. This adds an assignment setup step and deliberately prevents existing
unconfigured assignments from being represented as complete. Requirements and
coverage are part of the packet manifest; edits require new packet preparation
and reviews. Old locked packets remain immutable historical records.

District acceptance is unavailable until an approved result projection is wired.
Process counts do not establish substantive result correctness. No raw teacher
records are exposed to district roles and no unofficial aggregation is invented.
Previously recorded district decisions remain visible history.

A district request carries an immutable request identity and an expected current
decision. A request replay cannot silently replace another recorded decision.
Existing clients using the old non-idempotent endpoint receive an actionable
refresh requirement. New decisions use a monotonic revision for ordering rather
than relying on equal timestamps.

Recovery archives are scoped by account, school and submission and stay on the
device. A different occupied archive blocks replacement instead of destroying an
earlier recovery copy. Unsent access-management forms remain session work; they
are never persisted and replayed as privilege changes.

## Remaining acceptance gates

1. Supported browser access: rendered mobile/desktop, keyboard/focus, native
   confirmation, offline/quota, dirty-work navigation, transport-failure and
   recovery-email/session checks. No fresh screenshot or full accessibility
   compliance claim is made.
2. Approved governed district result contract and implementation, required before
   acceptance can be enabled. Class-record import and AI graphs are separate
   pending product features, not delivered by this UX repair.
3. Main merge and hosted rollout are separate actions. No production database
   mutation or deployment was performed. The branch contains migration changes
   that must be reviewed and applied before its new UI can operate.
