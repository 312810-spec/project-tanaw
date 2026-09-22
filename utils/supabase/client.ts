import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client.
 *
 * Use this only in Client Components. `createBrowserClient` already applies a
 * singleton internally, so there is no need to cache the result ourselves.
 *
 * Only the publishable (anon) key is used. Authorization is enforced by Row
 * Level Security on the local stack, never by a secret key on the client.
 */
export function createSupabaseBrowserClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL is not set. Copy .env.example to .env.local and fill in the local Supabase values.",
    );
  }

  if (!supabaseKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is not set. Obtain it from `supabase status` while the local stack is running.",
    );
  }

  return createBrowserClient(supabaseUrl, supabaseKey);
}
