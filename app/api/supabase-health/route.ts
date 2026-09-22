import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/utils/supabase/server";

/**
 * Read-only connectivity probe for the local Supabase stack.
 *
 * This is not an authentication endpoint and exposes no credentials or
 * environment values. It proves the client foundation can reach the LOCAL
 * stack by issuing a query that requires no table. PostgREST resolves the
 * requested relation through its schema cache; a relation absent from the
 * cache is answered with the structured error `PGRST205` (HTTP 404) without
 * ever reaching PostgreSQL. That structured answer is the signal, not the
 * data.
 *
 * Reachability is not key validity. A request carrying a wrong publishable key
 * is also answered with a structured error (`PGRST301`, HTTP 401), so a truthy
 * `error.code` proves the request reached PostgREST and produced a structured
 * response — it does not prove the key was accepted. A network failure, by
 * contrast, is reported by the client with an empty `error.code`.
 *
 * The probe mutates nothing and creates no schema.
 */
export async function GET() {
  let reachable = false;
  let detail = "";

  try {
    const supabase = await createSupabaseServerClient();

    // A relation that will not exist. We do not create it: the structured
    // error it produces is the signal, not the data.
    const { error } = await supabase
      .from("_tanaw_connectivity_probe")
      .select("id")
      .limit(1);

    if (error) {
      // A structured PostgREST error code (PGRST205 for a schema-cache miss,
      // PGRST301 for a rejected key) means the stack answered us. A
      // client-side network failure carries an empty code instead, which is
      // how a real outage stays distinguishable from this expected miss.
      if (error.code) {
        reachable = true;
        detail = "Local Supabase stack reachable; PostgREST answered the request.";
      } else {
        detail = "Local Supabase stack did not answer with a structured response.";
      }
    } else {
      reachable = true;
      detail = "Local Supabase stack reachable.";
    }
  } catch (err) {
    // A thrown error here is most likely a missing environment variable or an
    // unreachable host. Report the message only — it carries no credentials.
    detail = err instanceof Error ? err.message : "Unexpected error probing the local stack.";
  }

  return NextResponse.json({ reachable, detail });
}
