# FORGE UX recovery batch

10 October 2026 · Base commit `3bc80811e5bcc184440fa4c7c6a6c991fc1169d8`

The goal is to protect unsent evidence and make action outcomes truthful while
the live browser is unavailable. This implements a bounded first batch from the
9 October TANAW audit. It is not closure of the full audit or a browser repair.

| Finding | Implementation | Remaining verification / scope |
|---|---|---|
| F08 | Unreadable drafts block editing until a separate retained copy is verified. Originals and retained copies can be downloaded. A different earlier retained copy blocks replacement. | Pure storage failure/retention regression tests pass; browser recovery interaction untested. |
| F09 | Separate action surface, action text, accent text and focus tokens. Dark action text contrast is 6.23:1; light accent text is 5.85:1. Raise homepage secondary text opacity and cover native input/select/textarea/summary focus. | Computed rendered colors, focus placement, zoom and full accessibility review untested. |
| F11–F12 | Explicit refresh/stale states, disabled actions until read verification, retained prior content and distinct confirmed-write/failed-refresh feedback in workflow, members and cycles. | RPC-success/read-failure behavior is source reviewed and compiles; authenticated interaction tests untested. |
| F06 | Native consequence review before school Lock, district decision, account-access change and cycle deadline save. District decision starts with no default; returns require comments. | Native dialog behavior and other consequential actions still need review. |
| F10 | Current-version subject review is visible and its repeat button is disabled. | District decision idempotency remains open. |
| F13 | Selected submission shows its extension cutoff with server-authority wording. | Amendment status and effective-cutoff reconciliation remain open. |
| F16 | Recent evidence versions expose values, reasons, source references and timestamps. | Correction prefilling, explicit diffs and full paginated history remain open. |
| F18 | Missing verified indicators explain the blocker and coordinator next step. | Empty-state interaction untested. |
| F19 | Offline fallback and registration failure no longer guarantee unverified device saves. Offline manual submit retries device persistence and reports the real outcome. | Browser storage denial/offline interaction untested. |
| F20 | Reporting-cycle footer points to the implemented Lock/extension workspace. | Homepage and older governance copy still need reconciliation. |
| F07 | In-scope refresh no longer blanks the loaded forms; member selection remains selected. | Dirty changes across school/role/cycle/target changes and membership revision conflicts remain open. |

## Evidence and tradeoffs

The draft archive uses the same account/school/submission scope as the working
draft. It is never uploaded automatically. A single occupied recovery key fails
closed rather than silently destroying an earlier copy. This can require manual
recovery before another unreadable draft can be replaced.

Native confirmation reuses browser focus and dismissal behavior without adding
a new UI dependency. It is source implemented; actual browser interaction is not
claimed. Existing server authorization, version guards and governance are unchanged.

Previously loaded data stays visible during failed refresh but is explicitly stale
and cannot authorize further actions. Recovery requires another successful read.
Evidence history is re-requested after a successful workflow refresh.

## Validation

- Production build, TypeScript and lint pass for this batch.
- 72 domain tests pass, including two new draft recovery regressions.
- Declared color ratios were calculated from the sRGB tokens; no rendered
  accessibility compliance claim is made.
- No hosted database change, deployment, fresh browser test or screenshot capture.
- Historical CI run `37782042838` succeeded at commit
  `7e2456e7aee2a9a164d0be6c7402a094b6ffb150`; it does not test this branch.

## Remaining order

1. F01 required indicator coverage and F02 expired amendment recovery need server
   contract changes and isolated database regression verification.
2. F03 exact packet snapshot/review display, F04 district result content and F05
   persistent decision/comment visibility need governed data contracts.
3. Complete F07 dirty-work protection and F10 retry reconciliation, then finish
   F13–F17 identity, controlled subject scopes, cutoff and validation details.
4. Reconcile F20–F22 copy, task hierarchy and password-recovery states.
5. Exercise all new state transitions and responsive/keyboard behavior when
   supported browser access is available. Do not use historical screenshots as
   before/after evidence for this branch.
