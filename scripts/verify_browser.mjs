import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.TANAW_PLAYWRIGHT_MODULE || "playwright");
const origin = "http://127.0.0.1:3000";
const output = "artifacts/ui";
await mkdir(output, { recursive: true });
const server = spawn("npm", ["run", "start", "--", "--hostname", "127.0.0.1", "--port", "3000"], { stdio: "ignore", detached: true });
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
    for (const [name, path] of [["home", "/"], ["login", "/login"], ["workspace", "/workspace"]]) {
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
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      assert.equal(overflow, false, path + " must fit " + device);
      await page.screenshot({ path: output + "/" + name + "-" + device + ".png", fullPage: true });
      checks.push({ device, path, status: "passed" });
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
