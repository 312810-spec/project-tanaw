import { isAbsolute } from "node:path";
import { createSupabaseServerClient } from "@/utils/supabase/server";
import { handleEcrUpload } from "@/app/lib/ecr-upload";
import { runCoPreviewWorker } from "@/app/lib/ecr-worker";

export const runtime = "nodejs";

function available() {
  return process.env.TANAW_ECR_PREVIEW_ENABLED === "1" && isAbsolute(process.env.TANAW_ECR_PYTHON ?? "") && Boolean(process.env.TANAW_APP_ORIGIN);
}
export async function GET() {
  return Response.json({ available: available() }, { headers: { "Cache-Control": "no-store, private", "X-Content-Type-Options": "nosniff" } });
}

export async function POST(request: Request) {
  const python = process.env.TANAW_ECR_PYTHON ?? "";
  return handleEcrUpload(request, {
    enabled: available(),
    origin: process.env.TANAW_APP_ORIGIN,
    async authorize(submission) {
      const client = await createSupabaseServerClient();
      const { data: identity, error } = await client.auth.getUser();
      if (error || !identity.user) return "unauthenticated";
      const current = await client.from("tanaw_submissions").select("slot_id").eq("id", submission).maybeSingle();
      if (current.error || !current.data) return "denied";
      const slot = await client.from("tanaw_submission_slots").select("school_id,author_id,subject_id").eq("id", current.data.slot_id).eq("author_id", identity.user.id).maybeSingle();
      if (slot.error || !slot.data) return "denied";
      const membership = await client.from("tanaw_memberships").select("roles,subject_ids").eq("school_id", slot.data.school_id).eq("user_id", identity.user.id).eq("active", true).maybeSingle();
      if (membership.error || !membership.data) return "denied";
      const { roles, subject_ids: subjects } = membership.data;
      return roles.includes("smeaCoordinator") || (roles.includes("teacher") && subjects.includes(slot.data.subject_id)) ? "allowed" : "denied";
    },
    preview: (bytes, term, signal) => runCoPreviewWorker(bytes, term, python, signal),
  });
}
