import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
const source = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
function worker(network) {
  const handlers = {}; const deleted = [];
  runInNewContext(source, {
    self: { location: { origin: 'https://fixture.invalid' }, clients: { claim: async () => {} }, addEventListener: (name, handler) => { handlers[name] = handler; } },
    URL, Response, Request: class { constructor(url, options) { this.url = url; this.credentials = options.credentials; } },
    fetch: network,
    caches: { match: async () => new Response('Public fallback'), keys: async () => ['unrelated-user-cache', 'tanaw-offline-shell-v0', 'tanaw-offline-shell-v1', 'tanaw-offline-shell-v2'], delete: async (key) => { deleted.push(key); }, open: async () => ({ add: async (request) => { assert.equal(request.url, '/offline.html'); assert.equal(request.credentials, 'omit'); } }) },
  });
  return { handlers, deleted };
}
test('service worker never intercepts writes, API, auth or foreign requests', () => {
  const { handlers } = worker(() => { throw new Error('Should not fetch'); });
  for (const request of [
    { method: 'POST', mode: 'navigate', url: 'https://fixture.invalid/workspace' },
    { method: 'GET', mode: 'navigate', url: 'https://fixture.invalid/api/supabase-health' },
    { method: 'GET', mode: 'navigate', url: 'https://fixture.invalid/auth/callback' },
    { method: 'GET', mode: 'cors', url: 'https://fixture.invalid/workspace' },
    { method: 'GET', mode: 'navigate', url: 'https://other.invalid/workspace' },
  ]) handlers.fetch({ request, respondWith: () => assert.fail('Protected request was intercepted') });
});
test('online navigation passes through, disconnected navigation receives public fallback', async () => {
  for (const online of [true, false]) {
    let response;
    const { handlers } = worker(async (_request, options) => { assert.equal(options.cache, "no-store"); if (!online) throw new Error('Offline'); return new Response('Network response'); });
    handlers.fetch({ request: { method: 'GET', mode: 'navigate', url: 'https://fixture.invalid/workspace' }, respondWith: (promise) => { response = promise; } });
    assert.equal(await (await response).text(), online ? 'Network response' : 'Public fallback');
  }
});
test('installation caches a credential-free public page; activation preserves unrelated caches', async () => {
  const { handlers, deleted } = worker(async () => new Response('ok'));
  let operation;
  handlers.install({ waitUntil: (promise) => { operation = promise; } }); await operation;
  handlers.activate({ waitUntil: (promise) => { operation = promise; } }); await operation;
  assert.deepEqual(deleted, ['tanaw-offline-shell-v0', 'tanaw-offline-shell-v1']);
});
