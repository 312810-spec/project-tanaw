// Cache only the public fallback. School pages, tokens, APIs and records are never cached.
const CACHE = "tanaw-offline-shell-v1";
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add(new Request("/offline.html", { credentials: "omit" }))));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith("tanaw-offline-shell-") && key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return;
  if (request.method !== "GET" || request.mode !== "navigate" || url.origin !== self.location.origin) return;
  event.respondWith(fetch(request).catch(async () => (await caches.match("/offline.html")) || new Response("TANAW is offline. Reconnect to reopen your workspace. Device drafts are preserved.", { status: 503, headers: { "Content-Type": "text/plain" } })));
});
