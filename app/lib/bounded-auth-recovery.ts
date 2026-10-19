import { reconcileReservedAuth } from "./provisioning-auth-recovery.ts";
import type { AuthRecovery } from "./provisioning-auth-recovery.ts";

type BoundedDependencies = {
  ownsRequest: (signal: AbortSignal) => Promise<boolean>;
  lookup: (userId: string, signal: AbortSignal) => Promise<unknown>;
  create: (signal: AbortSignal) => Promise<unknown>;
};
const pending = (): AuthRecovery => ({ status: "pending", userId: null });

/** One explicit total budget, never a fresh timeout per provider operation.
 * Abort is advisory: a late external write can still commit. No membership,
 * lease renewal, retry scheduler, endpoint or provider credential is supplied.
 * Adapters must use the signal; ignored cancellation cannot start later stages.
 */
export async function reconcileReservedAuthBounded(input: unknown, dependencies: BoundedDependencies, options: unknown): Promise<AuthRecovery> {
  if (options === null || typeof options !== "object" || Array.isArray(options)) return pending();
  const budget = options as Record<string, unknown>;
  if (typeof budget.timeoutMs !== "number" || !Number.isSafeInteger(budget.timeoutMs)
      || budget.timeoutMs < 1 || budget.timeoutMs > 30000
      || (budget.signal !== undefined && !(budget.signal instanceof AbortSignal))) return pending();
  const parent = budget.signal as AbortSignal | undefined;
  if (parent?.aborted) return pending();
  const controller = new AbortController();
  const deadline = performance.now() + budget.timeoutMs;
  let closed = false;
  let resolveBoundary!: (result: AuthRecovery) => void;
  const boundary = new Promise<AuthRecovery>(resolve => { resolveBoundary = resolve; });
  const stop = () => {
    if (closed) return;
    closed = true;
    resolveBoundary(pending());
    controller.abort();
  };
  const timer = setTimeout(stop, budget.timeoutMs);
  parent?.addEventListener("abort", stop, { once: true });
  const call = async <T>(operation: (signal: AbortSignal) => Promise<T>): Promise<T> => {
    // Check the monotonic deadline too: timers cannot preempt blocked JS.
    if (closed || parent?.aborted || performance.now() >= deadline) {
      stop(); throw new Error("Recovery budget unavailable");
    }
    return operation(controller.signal);
  };
  try {
    const work = reconcileReservedAuth(input, {
      ownsRequest: () => call(signal => dependencies.ownsRequest(signal)),
      lookup: userId => call(signal => dependencies.lookup(userId, signal)),
      create: () => call(signal => dependencies.create(signal)),
    });
    // Promise.race observes late rejections even if an adapter ignores abort.
    const result = await Promise.race([work, boundary]);
    if (closed || parent?.aborted || performance.now() >= deadline) { stop(); return pending(); }
    return result;
  } finally {
    clearTimeout(timer);
    parent?.removeEventListener("abort", stop);
    closed = true;
    controller.abort();
  }
}
