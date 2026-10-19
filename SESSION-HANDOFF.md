# TANAW — active checkpoint

20 October 2026. Repo `312810-spec/project-tanaw`; baseline main
`9d45bd48ef5e52135e50d86d81ac74f89e93776b` (PR #51 merged). Branch
`forge/local-provisioning-http-20261020`. Inspect current PR/head/CI before
continuing. Engineering decisions, publishing and verified integration are
authorized. Hosted mutation/deployment/actual-use gates remain separate.
Keep projects isolated and preserve unrelated work.

## Decision and current bounded work

Owner delegates consequential choices using FORGE and a scoring mechanism.
Read `docs/workaround-decisions-2026-10-20.md`: impact 30%, dependency unlock
25%, evidence 20%, feasibility 15%, reversibility 10%; ordinal 1–5. Provisioning
HTTP boundary scored 90, source intake 84, renewed research 79, private staging
73. These are prioritization judgments, not correctness/approval grades. Hard
authority/privacy/actual-use gates override scores. Re-score on new evidence.

Selected boundary reuses trusted SQL/recovery rather than parallel role grants.
New POST `/api/accounts/provision`: origin/type/body/concurrency admission →
fresh cookie identity/active school SMEA role → immutable reservation → private
worker claim → bounded exact-UUID Auth recovery → fenced finish → reread receipt.
Status POST reads current authorized journal only. Client actor/UUID/proof/metadata
injection rejected. Password goes only to first creation; never journaled,
returned, logged or used to reset an existing password.

Disabled by default and structurally restricted to exact local backend 55321 and
loopback HTTP origin. Process-only local service credential; never .env.local or
public variables. Hosted configuration stays unavailable even with flag set.
Development email auto-confirm is only synthetic sign-in, not identity/email
ownership or credential delivery. Coordinator UI/secure handoff remain pending.

Local HTTP tests cover admission, unknown fields, wrong scope/actor/bindings,
busy/expired claims, uncertain finish/status recovery, private error output,
revocation, transport limits/cancel, process concurrency and false receipt denial.
Actual Next/Auth integration cases added to authenticated browser fixture:
anonymous/teacher/origin/cross-school/actor rejection; duplicate HTTP completion;
one attributed membership; status and immutable replay; original password retained.
Default public browser checks assert unavailable. Require fresh same-head CI;
Docker is absent locally and no live pass may be inferred from unit tests.

## Verified carryovers

PR #51 df33eb2 passed domain 39280900148 (176 Node / 40 Python), public 39280900165
and isolated 39280900249. Prior queue resolved. Shared total deadline and abort
forwarding composed with real Auth, lost-response and kill/restart checks.
PR #50 f9db28c passed actual claim contention/late-write/lost-response/real expiry;
its 10 s probe was query-canceled, then 3 s probe preserved strict 42501 and
zero-write/successor checks. References: bounded-auth-recovery.md and
provisioning-claim-races.md.

PR #49 synthetic editable exports retain native cells/tables and version
references, with all renders checked; official bindings and native Microsoft
edit/save/reopen remain gated. PR #48 SMEA exact own-submission review and empty
form version feedback passed; independent Head remains mandatory.

## Continuation / acceptance limits

Inspect current local-HTTP PR and CI; repair failures and integrate only with
unchanged-head domain, build, SQL/Auth/concurrency and authenticated/public-browser
checks. Then sync main. Decisions/criteria are in the scoring record; use
`docs/remaining-tasks.md` as sole ledger. Never mark the whole app complete.

T11 production timeout/renewal/quota policy, secure onboarding and initial
coordinator remain. Pending is uncertain, not canceled/absent/rolled back.
T01–T07 source/formula/mapping/calendar/retention gates persist; T08–T10 need
authorized governed results and official output bindings. T12 sender setup,
T13 physical Android/TalkBack and T14 designated actual pilot remain external
observations/inputs. Live AI stays deferred; Drive is development reference.
