import test from "node:test";
import assert from "node:assert/strict";
import { releaseReadiness } from "../app/lib/release-readiness.ts";

const config = { origin: "https://tanaw.fixture.invalid", previewEnabled: false };

test("readiness verifies the migrated database with a bounded request", async () => {
  const response = await releaseReadiness(config, async (signal) => {
    assert.ok(signal instanceof AbortSignal);
    return true;
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), { ready: true });
});

test("failed database, invalid origin and unavailable worker keep readiness closed", async () => {
  for (const response of [
    await releaseReadiness(config, async () => { throw new Error("private details"); }),
    await releaseReadiness(config, async () => false),
    await releaseReadiness({ ...config, origin: "https://tanaw.fixture.invalid/path" }, async () => true),
    await releaseReadiness({ ...config, previewEnabled: true, python: "invalid" }, async () => true),
  ]) {
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { ready: false });
  }
});
