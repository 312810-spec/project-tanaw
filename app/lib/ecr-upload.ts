/** Raw-file transport and privacy contract. No persistence or import acceptance. */
export const ECR_UPLOAD_LIMIT = 32 * 1024 * 1024;
type Access = "allowed" | "unauthenticated" | "denied";
type Dependencies = {
  enabled: boolean;
  origin: string | undefined;
  authorize: (submission: string) => Promise<Access>;
  preview: (data: Uint8Array, term: string, signal: AbortSignal) => Promise<unknown>;
};
let activeUploads = 0;
const object = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const response = (code: string, status: number, detail: Record<string, unknown> = {}) => Response.json({ code, canImport: false, runtimeImportEnabled: false, ...detail }, {
  status, headers: { "Cache-Control": "no-store, private", "X-Content-Type-Options": "nosniff" },
});

export async function readBoundedEcrBody(request: Request, limit = ECR_UPLOAD_LIMIT, timeoutMs = 30_000): Promise<Uint8Array> {
  if (!request.body) throw new Error("empty-upload");
  const reader = request.body.getReader(), chunks: Uint8Array[] = [];
  let size = 0, timedOut = false;
  const timer = setTimeout(() => { timedOut = true; void reader.cancel().catch(() => {}); }, timeoutMs);
  const abort = () => { void reader.cancel().catch(() => {}); };
  request.signal.addEventListener("abort", abort, { once: true });
  try {
    while (true) {
      if (request.signal.aborted) throw new Error("upload-interrupted");
      const chunk = await reader.read();
      if (timedOut) throw new Error("upload-timeout");
      if (request.signal.aborted) throw new Error("upload-interrupted");
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > limit) throw new Error("upload-too-large");
      chunks.push(chunk.value);
    }
    if (!size) throw new Error("empty-upload");
    const result = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength; }
    return result;
  } finally { clearTimeout(timer); request.signal.removeEventListener("abort", abort); await reader.cancel().catch(() => {}); reader.releaseLock(); }
}

export async function handleEcrUpload(request: Request, dependencies: Dependencies): Promise<Response> {
  if (!dependencies.enabled) return response("preview-unavailable", 503);
  const url = new URL(request.url), submission = url.searchParams.get("submission"), term = url.searchParams.get("term");
  if (!dependencies.origin || request.headers.get("origin") !== dependencies.origin) return response("request-not-permitted", 403);
  if (!submission || !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(submission) || !term || !["TERM 1", "TERM 2", "TERM 3"].includes(term) || url.searchParams.getAll("submission").length !== 1 || url.searchParams.getAll("term").length !== 1) return response("invalid-preview-target", 400);
  if (!["application/octet-stream", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"].includes(request.headers.get("content-type") ?? "") || (request.headers.get("content-encoding") ?? "identity") !== "identity") return response("unsupported-upload-type", 415);
  const length = request.headers.get("content-length");
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > ECR_UPLOAD_LIMIT)) return response("upload-too-large", 413);
  try {
    const access = await dependencies.authorize(submission);
    if (access !== "allowed") return response("preview-access-denied", access === "unauthenticated" ? 401 : 403);
  } catch { return response("preview-unavailable", 503); }
  if (activeUploads >= 2) return response("preview-busy", 429);
  activeUploads++;
  try {
    const bytes = await readBoundedEcrBody(request);
    const result = await dependencies.preview(bytes, term, request.signal);
    // A revoked account or handed-over assignment cannot receive even a summary.
    if (await dependencies.authorize(submission) !== "allowed") return response("preview-access-denied", 403);
    if (!object(result)) return response("preview-unavailable", 503);
    if (result.ok === false && result.code === "workbook-rejected") return response("workbook-rejected", 422);
    if (result.ok !== true || result.term !== term || typeof result.sourceHash !== "string" || !/^[a-f0-9]{64}$/.test(result.sourceHash) || result.rowSlots !== 100 || !Number.isInteger(result.occupiedRows) || !Number.isInteger(result.excludedBlankRows) || Number(result.occupiedRows) < 0 || Number(result.excludedBlankRows) < 0 || Number(result.occupiedRows) + Number(result.excludedBlankRows) !== 100) return response("preview-unavailable", 503);
    return response("recognized-diagnostic-only", 200, { term, sourceHash: result.sourceHash, rowSlots: 100, occupiedRows: result.occupiedRows, excludedBlankRows: result.excludedBlankRows,
      computationComparison: "not-performed", remainingGates: ["approved-computation-version", "authorized-roster-mapping", "verified-scope-period", "private-staging-and-atomic-import"] });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "upload-too-large") return response(code, 413);
    if (code === "empty-upload") return response(code, 400);
    if (code === "upload-timeout") return response(code, 408);
    return response("preview-unavailable", 503);
  } finally { activeUploads--; }
}
