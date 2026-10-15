/** Node-only bridge. Never import into client UI. No shell or inherited secrets. */
import { spawn } from "node:child_process";
import { isAbsolute, join } from "node:path";

export async function runCoPreviewWorker(bytes: Uint8Array, term: string, python: string, signal: AbortSignal): Promise<unknown> {
  if (!isAbsolute(python) || !["TERM 1", "TERM 2", "TERM 3"].includes(term) || bytes.byteLength > 32 * 1024 * 1024 || signal.aborted) throw new Error("preview-unavailable");
  return new Promise((resolve, reject) => {
    const child = spawn(python, ["-I", "-B", join(process.cwd(), "scripts/ecr_co_worker.py"), term], {
      shell: false, stdio: ["pipe", "pipe", "ignore"],
      env: { NODE_ENV: process.env.NODE_ENV ?? "production", PATH: process.env.PATH ?? "", PYTHONDONTWRITEBYTECODE: "1", PYTHONIOENCODING: "utf-8" },
    });
    let output = "", finished = false;
    const finish = (value?: unknown, error?: Error) => {
      if (finished) return;
      finished = true; clearTimeout(timer); signal.removeEventListener("abort", abort);
      if (error) { child.kill("SIGKILL"); reject(error); } else resolve(value);
    };
    const abort = () => finish(undefined, new Error("preview-unavailable"));
    const timer = setTimeout(abort, 15_000);
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
    child.once("error", abort);
    child.stdin.on("error", abort);
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      output += chunk;
      if (Buffer.byteLength(output) > 16_384) abort();
    });
    child.once("close", (code) => {
      if (finished) return;
      try {
        const result = JSON.parse(output);
        if ((code === 0 && result?.ok === true) || (code === 1 && result?.ok === false && result?.code === "workbook-rejected")) finish(result);
        else abort();
      } catch { abort(); }
    });
    child.stdin.end(bytes);
  });
}
