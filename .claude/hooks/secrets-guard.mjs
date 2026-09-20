#!/usr/bin/env node
/**
 * Project TANAW — Secrets Guard (PreToolUse, Write|Edit)
 *
 * Blocks writes that carry privileged Supabase credentials into source.
 * Client-safe publishable/anon keys are explicitly permitted.
 *
 * The block reason names the RULE and the FILE only. It never echoes the
 * matched value, so a blocked write cannot leak the secret it caught.
 *
 * Exit 2 blocks the tool call. Any other exit is non-blocking.
 */
import process from "node:process";

// Files where a placeholder is expected and a live value is suspicious.
const PLACEHOLDER = /^<[^>]*>$|^\$\{|^(your|paste|insert|replace|todo|xxxx|local)[- _]/i;

// Value-bearing patterns. Each carries a human rule name for the block message.
const RULES = [
  {
    name: "service_role key (full database access)",
    pattern: /\b(?:SUPABASE_SERVICE_KEY|SUPABASE_SECRET_KEY|SERVICE_ROLE_KEY|NEXT_PUBLIC_.*SERVICE)\s*=\s*(?:sb_secret_\S+|eyJ[A-Za-z0-9_-]{10,})/,
  },
  { name: "sb_secret_ prefixed credential", pattern: /sb_secret_[A-Za-z0-9_-]{8,}/ },
  {
    name: "SUPABASE_DB_URL / DATABASE_URL with embedded password",
    pattern: /\b(?:SUPABASE_DB_URL|DATABASE_URL)\s*=\s*(?:postgres(?:ql)?):\/\/[^\s"']:[^\s"'@]+@/,
  },
  { name: "postgres connection string with password", pattern: /postgres(?:ql)?:\/\/[^\s"']:[^\s"'@]+@[^\s"']+/ },
  { name: "DB / JWT secret with a live value", pattern: /\b(?:POSTGRES_PASSWORD|JWT_SECRET|SUPABASE_JWT_SECRET)\s*=\s*(?!<)(\S{6,})/ },
];

// Client-safe. These must never be blocked.
const SAFE = {
  publishable: /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY\s*=\s*(?:sb_publishable_\S+|<[^>]*>)/,
  anon: /NEXT_PUBLIC_SUPABASE_ANON_KEY\s*=\s*(?:eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|<[^>]*>)/,
};

function looksLikePlaceholder(value) {
  return PLACEHOLDER.test(value.trim());
}

/** Scan one blob of text. Returns a rule name if it violates policy, else null. */
function scan(text) {
  if (typeof text !== "string" || text.length === 0) return null;

  for (const rule of RULES) {
    const m = text.match(rule.pattern);
    if (!m) continue;

    // A bare <placeholder> or ${VAR} is documentation, not a credential.
    if (looksLikePlaceholder(m[0])) continue;

    // Explicit client-safe exemptions take precedence.
    const line = text.slice(0, m.index).split("\n").pop() + text.slice(m.index, text.indexOf("\n", m.index));
    if (SAFE.publishable.test(line) || SAFE.anon.test(line)) continue;

    return rule.name;
  }
  return null;
}

async function main() {
  let raw = "";
  for await (const chunk of process.stdin) raw += chunk;

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    // Malformed stdin is never a reason to block.
    process.exit(0);
  }

  const input = payload.tool_input ?? {};
  const filePath = input.file_path ?? "";

  // Writing to a path that itself names a privileged secret file is a violation.
  if (/(^|[\\/])(?:\.env\.production|\.env\.prod|service[-_]?role|secrets?\.(?:json|ya?ml|env))$/i.test(filePath)) {
    block(`privileged secret file path: ${filePath}`);
  }

  const blobs = [input.content, input.new_string];
  for (const blob of blobs) {
    const hit = scan(blob);
    if (hit) block(`${hit} (in ${filePath || "the edit"})`);
  }

  process.exit(0);
}

function block(reason) {
  const msg = `TANAW secrets guard blocked this write: ${reason}. Client-safe publishable/anon keys are allowed; service_role keys, sb_secret_ values, and DB URLs with passwords are not. Hosted credentials belong in Vercel env vars, never in the repo.`;
  // Structured deny so the reason renders cleanly in the UI.
  try {
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "deny",
          permissionDecisionReason: msg,
        },
      })
    );
  } catch {
    process.stderr.write(msg);
  }
  process.exit(2);
}

main().catch(() => process.exit(0));
