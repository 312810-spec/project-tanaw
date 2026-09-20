#!/usr/bin/env node
/**
 * Project TANAW — Next.js Documentation Nudge (UserPromptSubmit)
 *
 * This project pins Next.js 16.3.5, whose App Router APIs differ from
 * earlier major versions. AGENTS.md requires consulting the vendored docs
 * before writing version-sensitive Next.js code; this hook keeps that rule
 * visible at the start of a session instead of buried in a file.
 *
 * Fires once per session (gated on a marker in the transcript dir), then
 * stays quiet. Prints to stdout, which Claude reads as context.
 */
import process from "node:process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const MARKER = "tanaw-nextjs-nudge-shown";

function readStdin() {
  return new Promise((resolve) => {
    let raw = "";
    process.stdin.on("data", (c) => (raw += c));
    process.stdin.on("end", () => resolve(raw));
  });
}

async function main() {
  const raw = await readStdin();
  let payload = {};
  try {
    payload = JSON.parse(raw);
  } catch {
    process.exit(0);
  }

  // Only nudge when the prompt looks like it involves writing app code.
  const text = [
    payload.user_prompt ?? payload.prompt ?? "",
    JSON.stringify(payload.tool_input ?? {}),
  ].join(" ");

  const APP_CODE = /(app|page|layout|component|route|server action|hook|next\.js|nextjs|supabase client|middleware)/i;
  if (!APP_CODE.test(text)) process.exit(0);

  // One nudge per session.
  const scratch = payload.scratchpad_dir || payload.transcript_path || path.join(os.tmpdir(), "tanaw");
  const marker = path.join(scratch, MARKER);
  try {
    if (fs.existsSync(marker)) process.exit(0);
    fs.mkdirSync(scratch, { recursive: true });
    fs.writeFileSync(marker, new Date().toISOString());
  } catch {
    // If we cannot persist the marker, nudge anyway — safer to repeat than to stay silent.
  }

  process.stdout.write(
    "Project TANAW pins Next.js 16.3.5 — its App Router APIs differ from earlier majors. " +
      "Per AGENTS.md, consult the vendored docs at node_modules/next/dist/docs/ before writing " +
      "version-sensitive Next.js code, and treat deprecation notices as blocking. " +
      "Backend target is LOCAL Supabase only (127.0.0.1:5532x); the hosted project is protected infrastructure.\n"
  );
  process.exit(0);
}

main().catch(() => process.exit(0));
