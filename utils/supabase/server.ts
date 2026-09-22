import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Server-side Supabase client.
 *
 * Call this per request inside Server Components, Route Handlers, or Server
 * Actions — it reads the request's cookies, so a client must not be created at
 * module scope and shared across requests.
 *
 * Only the publishable (anon) key is used. This client performs no
 * authentication and trusts no user identity; it merely forwards whatever
 * session cookies the request carries. Authorization is enforced by Row Level
 * Security on the local stack.
 */
export async function createSupabaseServerClient() {
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

  // next/headers cookies() is async in Next.js 16 and is request-scoped.
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        // Server Components cannot write cookies or response headers. The
        // documented pattern is to attempt the write and ignore the failure
        // here; token refresh is handled by the proxy instead.
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Expected in Server Components; no action.
        }
      },
    },
  });
}
