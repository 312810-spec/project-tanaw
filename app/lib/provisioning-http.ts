import { reconcileReservedAuthBounded } from "./bounded-auth-recovery.ts";

export type ProvisionCommand = { schoolId: string; requestId: string; email: string; roles: string[]; subjectIds: string[]; reason: string };
export type Journal = { id: string; school_id: string; actor_id: string; reserved_user_id: string; email: string; roles: string[]; subject_ids: string[]; reason: string; completed_at: string | null; completed_user_id: string | null };
type Proof = { request_id: string; epoch: number; token: string };
export type ProvisionDependencies = {
  enabled: boolean; origin: string | undefined;
  authorize: (school: string, signal: AbortSignal) => Promise<{ actorId: string } | "unauthenticated" | "denied">;
  reserve: (command: ProvisionCommand, signal: AbortSignal) => Promise<string>;
  read: (school: string, request: string, signal: AbortSignal) => Promise<unknown>;
  claim: (request: string, signal: AbortSignal) => Promise<unknown>;
  owns: (proof: Proof, signal: AbortSignal) => Promise<boolean>;
  lookup: (userId: string, signal: AbortSignal) => Promise<unknown>;
  create: (journal: Journal, password: string, signal: AbortSignal) => Promise<unknown>;
  finish: (proof: Proof, signal: AbortSignal) => Promise<unknown>;
};
const uuid = (v: unknown): v is string => typeof v === "string" && /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(v);
const object = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown, max: number): v is string => typeof v === "string" && v.length > 0 && v.length <= max && v === v.trim() && !/[\x00-\x1f\x7f]/.test(v);
const list = (v: unknown, max: number): v is string[] => Array.isArray(v) && v.length <= max && Array.from(v).every(x => text(x, 200)) && new Set(v).size === v.length;
const same = (a: string[], b: string[]) => a.length === b.length && a.every(x => b.includes(x));
const roles = ["teacher", "subjectCoordinator", "smeaCoordinator", "schoolHead", "districtCoordinator"];
/** Structural development gate; a flag alone cannot enable a hosted backend. */
export function localProvisioningAvailable(config: { enabled?: string; origin?: string; supabaseUrl?: string; publicKey?: string; serviceKey?: string }): boolean {
  try {
    const parsed = new URL(config.origin ?? "");
    return config.enabled === "1" && config.supabaseUrl === "http://127.0.0.1:55321"
      && parsed.origin === config.origin && parsed.protocol === "http:" && parsed.hostname === "127.0.0.1"
      && !parsed.username && !parsed.password && Boolean(config.publicKey && config.serviceKey);
  } catch { return false; }
}
let active = 0;
const reply = (code: string, status: number, requestId?: string) => Response.json({ code, localOnly: true, ...(requestId ? { requestId } : {}) }, { status, headers: { "Cache-Control": "no-store, private", "X-Content-Type-Options": "nosniff" } });

function validJournal(v: unknown, school: string, request: string, actor: string): v is Journal {
  return object(v) && v.id === request && v.school_id === school && v.actor_id === actor && uuid(v.reserved_user_id)
    && text(v.email, 254) && list(v.roles, 5) && v.roles.length > 0 && v.roles.every(r => roles.includes(r))
    && list(v.subject_ids, 100) && text(v.reason, 2000)
    && ((v.completed_at === null && v.completed_user_id === null)
      || (typeof v.completed_at === "string" && Number.isFinite(Date.parse(v.completed_at)) && v.completed_user_id === v.reserved_user_id));
}
async function body(request: Request): Promise<unknown> {
  if (!request.body) throw Error("invalid-request");
  const reader = request.body.getReader(), chunks: Uint8Array[] = [];
  let rejectBoundary!: (error: Error) => void, size = 0;
  const deadline = performance.now() + 3000;
  const boundary = new Promise<never>((_, reject) => { rejectBoundary = reject; });
  const cancel = () => { rejectBoundary(Error("request-interrupted")); void reader.cancel().catch(() => {}); };
  const timer = setTimeout(cancel, 3000);
  request.signal.addEventListener("abort", cancel, { once: true });
  try {
    if (request.signal.aborted) throw Error("request-interrupted");
    while (true) {
      if (request.signal.aborted || performance.now() >= deadline) throw Error("request-interrupted");
      const chunk = await Promise.race([reader.read(), boundary]);
      if (request.signal.aborted || performance.now() >= deadline) throw Error("request-interrupted");
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > 8192) throw Error("request-too-large");
      chunks.push(chunk.value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } finally {
    clearTimeout(timer); request.signal.removeEventListener("abort", cancel);
    void reader.cancel().catch(() => {});
    try { reader.releaseLock(); } catch { /* A canceled read can still settle late. */ }
  }
}

/** Cookie identity and stored journal/SQL own authority. No production activation. */
export async function handleProvisioning(request: Request, deps: ProvisionDependencies): Promise<Response> {
  if (!deps.enabled) return reply("provisioning-unavailable", 503);
  if (request.method !== "POST") return reply("method-not-permitted", 405);
  // Next may normalize its internal Request URL. Bind admission to the pinned
  // browser Origin and HTTP Host, not an internal server URL reconstruction.
  if (!deps.origin || (request.headers.get("host") ?? new URL(request.url).host) !== new URL(deps.origin).host || request.headers.get("origin") !== deps.origin
      || request.headers.get("sec-fetch-site") === "cross-site") return reply("request-not-permitted", 403);
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json"
      || (request.headers.get("content-encoding") ?? "identity") !== "identity") return reply("unsupported-request-type", 415);
  const length = request.headers.get("content-length");
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > 8192)) return reply("request-too-large", 413);
  if (active >= 2) return reply("provisioning-busy", 429);
  active++;
  try {
    let input: unknown;
    try { input = await body(request); }
    catch (error) { const code = error instanceof Error ? error.message : ""; return reply(code === "request-too-large" ? code : "invalid-request", code === "request-too-large" ? 413 : code === "request-interrupted" ? 408 : 400); }
    if (!object(input) || !uuid(input.schoolId) || !uuid(input.requestId) || !["provision", "status"].includes(String(input.action))) return reply("invalid-request", 400);
    const { schoolId, requestId } = input;
    const allowed = input.action === "status" ? ["action", "schoolId", "requestId"] : ["action", "schoolId", "requestId", "email", "roles", "subjectIds", "reason", "password"];
    if (Object.keys(input).some(k => !allowed.includes(k)) || Object.keys(input).length !== allowed.length) return reply("invalid-request", 400);
    let command: ProvisionCommand | null = null;
    if (input.action === "provision") {
      if (!text(input.email, 254) || input.email !== input.email.toLowerCase() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)
          || !list(input.roles, 5) || !input.roles.length || !input.roles.every(r => roles.includes(r)) || !list(input.subjectIds, 100)
          || !text(input.reason, 2000) || typeof input.password !== "string" || input.password.length < 12 || input.password.length > 128) return reply("invalid-request", 400);
      command = { schoolId, requestId, email: input.email, roles: [...input.roles], subjectIds: [...input.subjectIds], reason: input.reason };
    }
    const controller = new AbortController(), deadline = performance.now() + 15000;
    let rejectBoundary!: (error: Error) => void, admitted = false;
    const boundary = new Promise<never>((_, reject) => { rejectBoundary = reject; });
    const cancel = () => { rejectBoundary(Error("operation-pending")); controller.abort(); };
    const timer = setTimeout(cancel, 15000);
    request.signal.addEventListener("abort", cancel, { once: true });
    const stage = async <T>(operation: () => Promise<T>): Promise<T> => {
      if (request.signal.aborted || controller.signal.aborted || performance.now() >= deadline) throw Error("operation-pending");
      const result = await Promise.race([operation(), boundary]);
      if (request.signal.aborted || controller.signal.aborted || performance.now() >= deadline) throw Error("operation-pending");
      return result;
    };
    try {
      const access = await stage(() => deps.authorize(schoolId, controller.signal));
      if (typeof access === "string") return reply("provisioning-access-denied", access === "unauthenticated" ? 401 : 403);
      if (!uuid(access.actorId)) return reply("provisioning-unavailable", 503);
      admitted = true;
      const read = async () => {
        const found = await stage(() => deps.read(schoolId, requestId, controller.signal));
        if (!validJournal(found, schoolId, requestId, access.actorId)) throw Error("request-unavailable");
        return found;
      };
      if (command) {
        const reserved = await stage(() => deps.reserve(command!, controller.signal));
        if (!uuid(reserved)) throw Error("request-unavailable");
        const found = await read();
        if (found.reserved_user_id !== reserved || found.email !== command.email || found.reason !== command.reason
          || !same(found.roles, command.roles) || !same(found.subject_ids, command.subjectIds)) throw Error("request-unavailable");
      }
      let journal = await read();
      const receipt = async () => {
        journal = await read();
        const current = await stage(() => deps.authorize(schoolId, controller.signal));
        if (typeof current === "string" || current.actorId !== access.actorId) return reply("provisioning-access-denied", 403);
        return reply(journal.completed_at ? "account-complete" : "account-pending", journal.completed_at ? 200 : 202, requestId);
      };
      if (journal.completed_at || !command) return await receipt();
      const claim = await stage(() => deps.claim(requestId, controller.signal));
      if (!object(claim)) throw Error("operation-pending");
      if (claim.status === "complete" || claim.status === "busy") return await receipt();
      if (claim.status !== "claimed" || !Number.isSafeInteger(claim.epoch) || Number(claim.epoch) <= 0 || !uuid(claim.token)
          || typeof claim.expiresAt !== "string" || Date.parse(claim.expiresAt) <= Date.now() + 6000 || !Number.isFinite(Date.parse(claim.expiresAt))) throw Error("operation-pending");
      const proof = { request_id: requestId, epoch: Number(claim.epoch), token: claim.token };
      const recovered = await stage(() => reconcileReservedAuthBounded({ userId: journal.reserved_user_id, email: journal.email, requestId, schoolId }, {
        ownsRequest: signal => deps.owns(proof, signal), lookup: (id, signal) => deps.lookup(id, signal),
        create: signal => deps.create(journal, String(input.password), signal),
      }, { timeoutMs: 5000, signal: controller.signal }));
      if (recovered.status === "identityConflict") return reply("account-identity-conflict", 409, requestId);
      if (recovered.status !== "verified" || recovered.userId !== journal.reserved_user_id) return reply("account-pending", 202, requestId);
      await stage(() => deps.finish(proof, controller.signal));
      return await receipt();
    } catch (error) {
      const code = object(error) ? error.code : undefined;
      if (code === "42501") return reply("provisioning-access-denied", 403);
      if (code === "22023" || code === "40001") return reply("account-request-conflict", 409, requestId);
      if (error instanceof Error && error.message === "request-unavailable") return reply("request-unavailable", 404);
      return reply(admitted ? "account-pending" : "provisioning-unavailable", admitted ? 202 : 503, admitted ? requestId : undefined);
    } finally { clearTimeout(timer); request.signal.removeEventListener("abort", cancel); controller.abort(); }
  } finally { active--; }
}
