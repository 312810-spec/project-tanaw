import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.TANAW_PLAYWRIGHT_MODULE || "playwright");
const origin = "http://127.0.0.1:3000";
const output = "artifacts/ui";
await mkdir(output, { recursive: true });
const startServer = () => spawn("npm", ["run", "start", "--", "--hostname", "127.0.0.1", "--port", "3000"], { stdio: "ignore", detached: true });
let server = startServer();
async function stopServer() {
  if (server.exitCode !== null) return;
  const exited = new Promise((resolve) => server.once('exit', resolve));
  try { process.kill(-server.pid, 'SIGTERM'); } catch { return; }
  await exited;
}
let browser;
const checks = [];
try {
  let ready = false;
  for (let attempt = 0; attempt < 150; attempt++) {
    if (server.exitCode !== null) throw new Error("Application server exited before readiness");
    try { const response = await fetch(origin); if (response.ok) { ready = true; break; } } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  assert.ok(ready, "Production server must become reachable");
  browser = await chromium.launch({ executablePath: process.env.TANAW_CHROMIUM_EXECUTABLE || undefined });
  for (const [device, viewport] of [["desktop", { width: 1440, height: 1000 }], ["mobile", { width: 390, height: 844 }]]) {
    const context = await browser.newContext({ viewport, colorScheme: "light" });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/*", (route) => {
      const url = new URL(route.request().url());
      return url.origin === origin || url.protocol === "data:" ? route.continue() : route.abort();
    });
    for (const [name, path] of [["home", "/"], ["login", "/login"], ["workspace", "/workspace"], ["forgot-password", "/forgot-password"], ["reset-password", "/reset-password"]]) {
      const response = await page.goto(origin + path, { waitUntil: "networkidle" });
      assert.equal(response?.status(), 200, path + " must load");
      await page.locator("h1").waitFor({ state: "visible" });
      if (name === "login") {
        await page.getByText("Sign-in is unavailable until this installation is configured.").waitFor();
        assert.equal(await page.getByLabel("Email address").isDisabled(), true);
        assert.equal(await page.getByRole("button", { name: "Sign in", exact: true }).isDisabled(), true);
      }
      if (name === "workspace") {
        await page.getByText("This installation is not configured for sign-in yet.").waitFor();
        assert.equal(await page.locator("select").count(), 0, "Unverified account must not see assignments");
      }
      if (name === "forgot-password") assert.equal(await page.getByLabel("Account email").isDisabled(), true);
      if (name === "reset-password") assert.equal(await page.getByLabel("New password", { exact: true }).isDisabled(), true);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      assert.equal(overflow, false, path + " must fit " + device);
      await page.screenshot({ path: output + "/" + name + "-" + device + ".png", fullPage: true });
      checks.push({ device, path, status: "passed" });
    }
    const callback = await page.request.get(origin + '/auth/callback?next=https://other.invalid', { maxRedirects: 0 });
    assert.equal(new URL(callback.headers().location).pathname, '/forgot-password');
    assert.equal(new URL(callback.headers().location).origin, origin);
    assert.equal(callback.headers()['cache-control'], 'no-store');
    const manifestResponse = await page.request.get(origin + '/manifest.webmanifest');
    assert.equal(manifestResponse.status(), 200);
    const manifest = await manifestResponse.json();
    assert.equal(manifest.start_url, '/workspace'); assert.equal(manifest.display, 'standalone');
    for (const size of [192, 512]) {
      const icon = await page.request.get(origin + '/api/app-icon?size=' + size);
      assert.equal(icon.status(), 200); assert.match(icon.headers()['content-type'], /image\/png/);
      const png = await icon.body(); assert.equal(png.readUInt32BE(16), size); assert.equal(png.readUInt32BE(20), size);
    }
    await page.evaluate(async () => { await navigator.serviceWorker.ready; if (!navigator.serviceWorker.controller) await new Promise((resolve) => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true })); });
    const cacheEntries = await page.evaluate(async () => (await Promise.all((await caches.keys()).filter((key) => key.startsWith('tanaw-offline-shell-')).map(async (key) => (await (await caches.open(key)).keys()).map((request) => new URL(request.url).pathname)))).flat());
    assert.deepEqual(cacheEntries, ['/offline.html'], 'Only the public offline fallback may be cached');
    // Disconnect the origin itself: older Chromium does not consistently apply
    // context.setOffline to service-worker-owned fetches.
    await stopServer();
    await context.setOffline(true);
    await page.goto(origin + '/workspace');
    await page.getByRole('heading', { name: "You're offline" }).waitFor();
    assert.equal(await page.locator('form').count(), 0, 'Offline reload cannot expose authenticated actions');
    await page.screenshot({ path: output + '/offline-' + device + '.png', fullPage: true });
    await context.setOffline(false);
    if (device === 'desktop') {
      server = startServer();
      let reconnected = false;
      for (let attempt = 0; attempt < 150; attempt++) { try { if ((await fetch(origin)).ok) { reconnected = true; break; } } catch {} await new Promise((resolve) => setTimeout(resolve, 200)); }
      assert.ok(reconnected, 'Origin must restart for the mobile check');
    }
    assert.deepEqual(errors, [], "Pages must have no uncaught browser errors");
    await context.close();
  }
  console.log("Browser smoke checks passed: desktop/mobile home, login and workspace.");
} finally {
  await writeFile(output + "/checks.json", JSON.stringify({ checks, scope: "Unconfigured public routes; authenticated workflows remain untested" }, null, 2));
  if (browser) await browser.close();
  if (server.pid) { try { process.kill(-server.pid, "SIGTERM"); } catch {} }
}
