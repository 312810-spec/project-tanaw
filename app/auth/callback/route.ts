import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/utils/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const configuredOrigin = process.env.TANAW_APP_ORIGIN;
  if (!configuredOrigin) return NextResponse.json({ error: "Recovery callback is not configured" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  let origin: string;
  try { origin = new URL(configuredOrigin).origin; } catch { return NextResponse.json({ error: "Recovery callback is not configured" }, { status: 503 }); }
  const code = url.searchParams.get("code");
  // The destination is fixed. Never trust a next/redirect parameter from the link.
  if (code) {
    try {
      const client = await createSupabaseServerClient();
      const { error } = await client.auth.exchangeCodeForSession(code);
      if (!error) {
        const response = NextResponse.redirect(new URL("/reset-password", origin));
        response.headers.set("Cache-Control", "no-store"); response.headers.set("Referrer-Policy", "no-referrer");
        return response;
      }
    } catch { /* Invalid/unconfigured session returns the same recovery destination. */ }
  }
  const response = NextResponse.redirect(new URL("/forgot-password", origin));
  response.headers.set("Cache-Control", "no-store"); response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
