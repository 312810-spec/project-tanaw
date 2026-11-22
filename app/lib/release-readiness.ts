import { checkCoPreviewWorker } from "./ecr-worker.ts";

const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
type Config = { origin?: string; previewEnabled: boolean; python?: string };

function validOrigin(origin?: string): boolean {
  if (!origin) return false;
  try {
    const url = new URL(origin);
    return url.origin === origin && (url.protocol === "https:" ||
      (url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)));
  } catch {
    return false;
  }
}

export async function releaseReadiness(config: Config, checkDatabase: (signal: AbortSignal) => Promise<boolean>): Promise<Response> {
  let databaseReady = false;
  if (validOrigin(config.origin)) {
    try {
      databaseReady = await checkDatabase(AbortSignal.timeout(3000));
    } catch {
      // Keep deployment configuration and upstream errors out of the response.
    }
  }
  const ready = databaseReady && (!config.previewEnabled || await previewReady(config.python));
  return Response.json({ ready }, { status: ready ? 200 : 503, headers });
}

let workerProbe: { python: string; result: Promise<boolean>; until: number } | undefined;
function previewReady(python = ""): Promise<boolean> {
  if (workerProbe?.python === python && workerProbe.until > Date.now()) return workerProbe.result;
  const result = checkCoPreviewWorker(python, AbortSignal.timeout(3000)).catch(() => false);
  workerProbe = { python, result, until: Date.now() + 10_000 };
  return result;
}
