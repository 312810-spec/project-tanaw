# Bounded Auth recovery

19 October 2026. Baseline `3d2014964899afc85cd5f020a91bde6cf60e1fab`.
Development foundation; production provisioning remains gated.

## Observation and acceptance

The original `reconcileReservedAuth` seam expects bounded adapters. A synthetic
ownership callback that never settles leaves that seam pending at a 30 ms
observation boundary. This reproduces a missing caller-side guarantee, not a
live Auth outage or an activated production defect.

`reconcileReservedAuthBounded` adds an explicit total invocation budget and shared
AbortSignal around the existing exact-identity/ownership logic. The caller must
supply integer `timeoutMs` from 1 to 30000, a technical guard rather than an
approved production lease/provider policy. No default or automatic renewal.
An optional parent AbortSignal can end the invocation earlier. Invalid options
or prior cancellation call no adapter and return pending without an identity.

| Condition | Required observation |
|---|---|
| Ownership, initial lookup, create or final lookup never settles | Invocation settles pending; shared signal aborts; identity is withheld. |
| Parent cancellation during lookup | Pending even if the provider later returns a matching identity; no later stage starts. |
| Late create ignores cancellation | No later ownership/read/create callback from that invocation; later independent recovery reads the reserved UUID and does not create again. |
| Several stages consume time | One monotonic deadline; no reset per callback. |
| JS blocks timer delivery | Deadline rechecked before every stage and before returning verified output. |
| Normal uncertain write | Original exact UUID/email/request/school, ownership and static error behavior remain. |
| Actual isolated Auth composition | Worker uses the wrapper with an explicit 5000 ms synthetic budget and forwards its signal to ownership HTTP and Auth fetch calls. Existing create-response loss, kill/restart and one-receipt checks must pass in fresh CI. |

Timers/listeners are removed on settlement; successful completion aborts the
finished invocation's signal too. Late promise rejections are observed, not
leaked. No new callback can start after deadline/cancellation, but code already
running in an adapter can continue if it ignores abort. JavaScript scheduling
prevents a hard real-time/preemption guarantee; settlement occurs when the event
loop can run. No benchmark latency bound is claimed.

An external Auth write can still commit after a timeout. Pending does not mean
absent, canceled or safe to recreate. Keep the durable reserved UUID and use a
new authorized invocation to reconcile it; school access still requires the
separate fenced completion RPC. The wrapper grants no membership and supplies
no worker, credential, endpoint, retry scheduler or claim-renewal policy. A
production caller must choose a reviewed budget below its remaining ownership
and request limits. Real network partitions and external cancellation guarantees
remain unverified. Do not delete or reset uncertain identities automatically.
