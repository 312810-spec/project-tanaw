import { createClient } from "@supabase/supabase-js";
import { releaseReadiness } from "@/app/lib/release-readiness";

export const runtime = "nodejs";

export async function GET() {
  return releaseReadiness({
    origin: process.env.TANAW_APP_ORIGIN,
    previewEnabled: process.env.TANAW_ECR_PREVIEW_ENABLED === "1",
    python: process.env.TANAW_ECR_PYTHON,
  }, async (signal) => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) return false;
    const client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data, error } = await client.rpc("tanaw_release_ready").abortSignal(signal);
    return !error && data === true;
  });
}
