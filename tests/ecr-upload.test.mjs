import test from "node:test";
import assert from "node:assert/strict";
import { handleEcrUpload, readBoundedEcrBody, ECR_UPLOAD_LIMIT } from "../app/lib/ecr-upload.ts";
import { checkCoPreviewWorker, runCoPreviewWorker } from "../app/lib/ecr-worker.ts";
import { spawnSync } from "node:child_process";

function pythonExecutable() {
  const command = process.platform === "win32" ? "python" : "python3";
  const result = spawnSync(command, ["-c", "import sys; print(sys.executable)"], { encoding: "utf8" });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

const origin = "http://localhost:3000", submission = "11111111-1111-4111-8111-111111111111";
const request = (options = {}) => new Request(`${origin}/api/ecr/preview?submission=${submission}&term=TERM%201`, {
  method: "POST", headers: { origin, "content-type": "application/octet-stream", ...options.headers }, body: "PRIVATE_SYNTHETIC_UPLOAD", ...options,
});
const successful = { ok: true, term: "TERM 1", sourceHash: "a".repeat(64), rowSlots: 100, occupiedRows: 1, excludedBlankRows: 99 };
const dependencies = (overrides = {}) => ({ enabled: true, origin, authorize: async () => "allowed", preview: async () => successful, ...overrides });
async function checked(input, deps, status, code) {
  const result = await handleEcrUpload(input, deps);
  assert.equal(result.status, status);
  assert.equal(result.headers.get("cache-control"), "no-store, private");
  const value = await result.json();
  assert.equal(value.code, code); assert.equal(value.canImport, false); assert.equal(value.runtimeImportEnabled, false);
  assert.doesNotMatch(JSON.stringify(value), /PRIVATE_SYNTHETIC/);
  return value;
}
test("successful preview returns only allowlisted counts and remains non-importable", async () => {
  let authorizations = 0;
  const data = await checked(request(), dependencies({ authorize: async () => { authorizations++; return "allowed"; }, preview: async () => ({ ...successful, learnerName: "PRIVATE_SYNTHETIC_NAME" }) }), 200, "recognized-diagnostic-only");
  assert.equal(authorizations, 2); assert.equal(data.occupiedRows, 1); assert.equal(data.computationComparison, "not-performed");
  assert.equal("learnerName" in data, false);
});
test("disabled capability, cross-origin or missing origin never reads/parses a file", async () => {
  const never = async () => { assert.fail("parser must not run"); };
  await checked(request(), dependencies({ enabled: false, preview: never }), 503, "preview-unavailable");
  await checked(request({ headers: { origin: "http://foreign.invalid", "content-type": "application/octet-stream" } }), dependencies({ preview: never }), 403, "request-not-permitted");
  await checked(request({ headers: { "content-type": "application/octet-stream" } }), dependencies({ preview: never }), 403, "request-not-permitted");
});
test("unauthenticated, non-owner and authorization errors never consume the body", async () => {
  for (const [access, status] of [["unauthenticated", 401], ["denied", 403]]) {
    const input = request(); await checked(input, dependencies({ authorize: async () => access, preview: async () => assert.fail("parser must not run") }), status, "preview-access-denied");
    assert.equal(input.bodyUsed, false);
  }
  await checked(request(), dependencies({ authorize: async () => { throw new Error("PRIVATE_SYNTHETIC_AUTH"); } }), 503, "preview-unavailable");
});
test("handover/revocation while parsing withholds the summary", async () => {
  let count = 0;
  await checked(request(), dependencies({ authorize: async () => ++count === 1 ? "allowed" : "denied" }), 403, "preview-access-denied");
});
test("a reporting term conflict rejects before upload and after a concurrent change", async () => {
  const input = request();
  await checked(input, dependencies({
    authorize: async (id, term) => {
      assert.equal(id, submission);
      assert.equal(term, "TERM 1");
      return "term-mismatch";
    },
    preview: async () => assert.fail("parser must not run"),
  }), 409, "reporting-period-mismatch");
  assert.equal(input.bodyUsed, false);
  let count = 0;
  await checked(request(), dependencies({ authorize: async () => ++count === 1 ? "allowed" : "term-mismatch" }), 409, "reporting-period-mismatch");
});
test("wrong target/term/duplicate parameters cannot reach parser", async () => {
  for (const query of ["submission=bad&term=TERM%201", `submission=${submission}&term=TERM%204`, `submission=${submission}&term=TERM%201&term=TERM%202`]) {
    const input = new Request(`${origin}/api/ecr/preview?${query}`, { method: "POST", headers: { origin, "content-type": "application/octet-stream" }, body: "synthetic" });
    await checked(input, dependencies(), 400, "invalid-preview-target");
  }
});
test("unsupported or compressed uploads and oversized declared payloads are rejected", async () => {
  for (const headers of [{ "content-type": "application/json" }, { "content-type": "application/octet-stream", "content-encoding": "gzip" }]) {
    await checked(request({ headers: { origin, ...headers } }), dependencies(), 415, "unsupported-upload-type");
  }
  await checked(request({ headers: { origin, "content-type": "application/octet-stream", "content-length": String(ECR_UPLOAD_LIMIT + 1) } }), dependencies(), 413, "upload-too-large");
});
test("stream cap applies without content-length and cancels the source", async () => {
  let cancelled = false;
  const body = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(5)); }, cancel() { cancelled = true; } });
  const input = request({ body, duplex: "half" });
  await assert.rejects(readBoundedEcrBody(input, 4), /^Error: upload-too-large$/);
  assert.equal(cancelled, true);
});
test("empty and stalled streams fail without waiting indefinitely", async () => {
  await checked(request({ body: "" }), dependencies(), 400, "empty-upload");
  const body = new ReadableStream({});
  await assert.rejects(readBoundedEcrBody(request({ body, duplex: "half" }), 4, 5), /^Error: upload-timeout$/);
});
test("upload timeout releases the reader even if source cleanup never settles", { timeout: 1000 }, async () => {
  let cancelled = false;
  const body = new ReadableStream({
    cancel() {
      cancelled = true;
      return new Promise(() => {});
    },
  });
  const input = request({ body, duplex: "half" });
  await assert.rejects(readBoundedEcrBody(input, 4, 5), /^Error: upload-timeout$/);
  assert.equal(cancelled, true);
  assert.equal(input.body.locked, false);
});
test("disconnect cancels a stalled body and worker without echoing input", async () => {
  const controller = new AbortController();
  const reading = readBoundedEcrBody(request({ body: new ReadableStream({}), duplex: "half", signal: controller.signal }), 4, 1000);
  controller.abort();
  await assert.rejects(reading, /upload-interrupted/);
  const python = pythonExecutable();
  const workerController = new AbortController();
  const running = runCoPreviewWorker(new Uint8Array(), "TERM 1", python, workerController.signal);
  workerController.abort();
  await assert.rejects(running, /preview-unavailable/);
});
test("invalid worker summaries, private exceptions and unknown codes stay private", async () => {
  for (const value of [null, { ...successful, occupiedRows: 101 }, { ...successful, sourceHash: "PRIVATE_SYNTHETIC_HASH" }, { ok: false, code: "PRIVATE_SYNTHETIC_ERROR" }, { ...successful, term: "TERM 2" }]) {
    await checked(request(), dependencies({ preview: async () => value }), 503, "preview-unavailable");
  }
  await checked(request(), dependencies({ preview: async () => { throw new Error("PRIVATE_SYNTHETIC_PATH"); } }), 503, "preview-unavailable");
  await checked(request(), dependencies({ preview: async () => ({ ok: false, code: "workbook-rejected", raw: "PRIVATE_SYNTHETIC_RAW" }) }), 422, "workbook-rejected");
});
test("per-process concurrency bounds pending buffers/workers and releases slots", async () => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let started = 0;
  const deps = dependencies({ preview: async () => { started++; await gate; return successful; } });
  const first = handleEcrUpload(request(), deps), second = handleEcrUpload(request(), deps);
  while (started < 2) await new Promise(resolve => setTimeout(resolve, 1));
  await checked(request(), dependencies(), 429, "preview-busy");
  release(); await Promise.all([first, second]);
  await checked(request(), dependencies(), 200, "recognized-diagnostic-only");
});
test("real isolated Python worker rejects unregistered input without echoing private bytes", async () => {
  const result = await runCoPreviewWorker(new TextEncoder().encode("PRIVATE_SYNTHETIC_NOT_ZIP"), "TERM 1", pythonExecutable(), new AbortController().signal);
  assert.deepEqual(result, { ok: false, code: "workbook-rejected" });
});
test("worker readiness loads the packaged registry without a workbook", async () => {
  assert.equal(await checkCoPreviewWorker(pythonExecutable(), AbortSignal.timeout(3000)), true);
});
test("bridge rejects nonabsolute executable, unsupported term and aborted request", async () => {
  await assert.rejects(runCoPreviewWorker(new Uint8Array(), "TERM 1", "python3", new AbortController().signal), /preview-unavailable/);
  await assert.rejects(runCoPreviewWorker(new Uint8Array(), "PRIVATE_SYNTHETIC_TERM", "/usr/bin/python3", new AbortController().signal), /preview-unavailable/);
  const abort = new AbortController(); abort.abort();
  await assert.rejects(runCoPreviewWorker(new Uint8Array(), "TERM 1", "/usr/bin/python3", abort.signal), /preview-unavailable/);
});
