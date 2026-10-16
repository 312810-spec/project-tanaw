/** Privilege-free orchestration seam; callers must load immutable server records.
 * No role grant, password update, email search, loop or production activation.
 */
type Reservation = { userId: string; email: string; requestId: string; schoolId: string };
type Dependencies = {
  ownsRequest: () => Promise<boolean>;
  lookup: (userId: string) => Promise<unknown>;
  create: () => Promise<unknown>;
};
export type AuthRecovery = { status: "verified" | "pending" | "identityConflict" | "ownershipLost" | "invalidReservation"; userId: string | null };
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const uuid = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(value);

/** lookup returns {status: 'found', user} | {status: 'missing'} | {status: 'unavailable'}.
 * A rejected/timed-out create can still have committed. Never trust its response
 * or search by email: independently read the fixed UUID after any create outcome.
 * ownsRequest is a trusted caller check, not a lease or external-provider fence.
 */
export async function reconcileReservedAuth(input: unknown, dependencies: Dependencies): Promise<AuthRecovery> {
  const result = (status: AuthRecovery["status"], userId: string | null = null): AuthRecovery => ({ status, userId });
  if (!object(input) || !uuid(input.userId) || !uuid(input.requestId) || !uuid(input.schoolId)
    || typeof input.email !== "string" || input.email.length > 254 || input.email !== input.email.trim().toLowerCase()
    || !/^[^\s@\x00-\x1f\x7f]+@[^\s@\x00-\x1f\x7f]+\.[^\s@\x00-\x1f\x7f]+$/.test(input.email)) return result("invalidReservation");
  // Copy primitives so caller/adapter mutation cannot change the verification target.
  const expected: Reservation = { userId: input.userId, email: input.email, requestId: input.requestId, schoolId: input.schoolId };
  const owned = async () => { try { return await dependencies.ownsRequest() === true; } catch { return false; } };
  const read = async (): Promise<unknown> => { try { return await dependencies.lookup(expected.userId); } catch { return null; } };
  const inspect = (value: unknown): AuthRecovery => {
    if (!object(value) || value.status !== "found") return result("pending");
    const user = value.user;
    if (!object(user) || user.id !== expected.userId || user.email !== expected.email || !object(user.app_metadata)
      || user.app_metadata.tanaw_provision_request_id !== expected.requestId
      || user.app_metadata.tanaw_provision_school_id !== expected.schoolId) return result("identityConflict");
    return result("verified", expected.userId);
  };
  if (!await owned()) return result("ownershipLost");
  let observed = await read();
  if (!await owned()) return result("ownershipLost");
  if (object(observed) && observed.status === "missing") {
    // At most one create attempt per invocation, and only after definitive absence.
    try { await dependencies.create(); } catch { /* uncertain write; reconcile below */ }
    if (!await owned()) return result("ownershipLost");
    observed = await read();
    if (!await owned()) return result("ownershipLost");
  }
  return inspect(observed);
}
