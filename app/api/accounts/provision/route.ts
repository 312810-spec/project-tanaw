import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/utils/supabase/server";
import { handleProvisioning, localProvisioningAvailable } from "@/app/lib/provisioning-http";

export const runtime = "nodejs";
function available() {
  return localProvisioningAvailable({ enabled: process.env.TANAW_LOCAL_PROVISIONING_ENABLED,
    origin: process.env.TANAW_APP_ORIGIN, supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    publicKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, serviceKey: process.env.TANAW_LOCAL_PROVISIONING_SERVICE_KEY });
}
const headers = { "Cache-Control": "no-store, private", "X-Content-Type-Options": "nosniff" };
export async function GET() { return Response.json({ available: available(), localOnly: true }, { headers }); }

export async function POST(request: Request) {
  // Never construct a privileged adapter for a hosted/disabled configuration.
  if (!available()) return Response.json({ code: "provisioning-unavailable", localOnly: true }, { status: 503, headers });
  let actor = "";
  let callerPromise: ReturnType<typeof createSupabaseServerClient> | undefined;
  const user = (signal: AbortSignal) => callerPromise ??= createSupabaseServerClient(signal);
  const admin = (signal: AbortSignal) => createClient("http://127.0.0.1:55321", process.env.TANAW_LOCAL_PROVISIONING_SERVICE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (input, init) => fetch(input, { ...init, signal }) },
  });
  return handleProvisioning(request, {
    enabled: true, origin: process.env.TANAW_APP_ORIGIN,
    async authorize(school, signal) {
      // The identity endpoint is also bound to this request's cancellation.
      if (signal.aborted) throw Error("request-ended");
      const caller = await user(signal), identity = await caller.auth.getUser();
      if (signal.aborted) throw Error("request-ended");
      if (identity.error || !identity.data.user) return "unauthenticated";
      const current = await caller.from("tanaw_memberships").select("roles").eq("school_id", school).eq("user_id", identity.data.user.id).eq("active", true).abortSignal(signal).maybeSingle();
      if (current.error || !current.data?.roles.includes("smeaCoordinator")) return "denied";
      actor = identity.data.user.id; return { actorId: actor };
    },
    async reserve(c, signal) {
      const caller = await user(signal);
      const r = await caller.rpc("tanaw_reserve_account", { target_school: c.schoolId, request_id: c.requestId, account_email: c.email, assigned_roles: c.roles, assigned_subjects: c.subjectIds, change_reason: c.reason }).abortSignal(signal);
      if (r.error) throw r.error; return r.data;
    },
    async read(school, id, signal) {
      const caller = await user(signal);
      const r = await caller.from("tanaw_provisioning_requests").select("id,school_id,actor_id,reserved_user_id,email,roles,subject_ids,reason,completed_at,completed_user_id").eq("id", id).eq("school_id", school).eq("actor_id", actor).abortSignal(signal).maybeSingle();
      if (r.error) throw r.error; return r.data;
    },
    async claim(id, signal) { const r = await admin(signal).rpc("tanaw_claim_account_work", { request_id: id, lease_seconds: 60 }).abortSignal(signal); if (r.error) throw r.error; return r.data; },
    async owns(proof, signal) { const r = await admin(signal).rpc("tanaw_account_work_owned", proof).abortSignal(signal); if (r.error) throw r.error; return r.data === true; },
    async lookup(id, signal) {
      const r = await admin(signal).auth.admin.getUserById(id);
      if (r.error) return { status: r.error.status === 404 ? "missing" : "unavailable" };
      return r.data.user ? { status: "found", user: r.data.user } : { status: "unavailable" };
    },
    async create(journal, password, signal) {
      const r = await admin(signal).auth.admin.createUser({ id: journal.reserved_user_id, email: journal.email, password, email_confirm: true,
        app_metadata: { tanaw_provision_request_id: journal.id, tanaw_provision_school_id: journal.school_id } });
      if (r.error) throw r.error;
    },
    async finish(proof, signal) { const r = await admin(signal).rpc("tanaw_finish_account_work", proof).abortSignal(signal); if (r.error) throw r.error; return r.data; },
  });
}
