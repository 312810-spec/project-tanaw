// Synthetic local subprocess fixture. Never an app endpoint or production worker.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline';
import { createClient } from '@supabase/supabase-js';
import { reconcileReservedAuthBounded } from '../app/lib/bounded-auth-recovery.ts';

const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(value);
let holder;
const emit = status => process.stdout.write(JSON.stringify({ status }) + '\n');
// Bound fixture lifetime even if a network request or stdin stalls.
const watchdog = setTimeout(() => process.exit(2), 25000);
try {
  assert.equal(process.argv[2], '--synthetic-local-only');
  const input = createInterface({ input: process.stdin });
  const line = await new Promise(resolve => input.once('line', resolve));
  input.close();
  assert.ok(line.length <= 16384);
  const request = JSON.parse(line);
  assert.ok(uuid(request.id) && uuid(request.school));
  assert.match(request.email, /^[a-f0-9-]+@fixture\.invalid$/);
  assert.ok(typeof request.token === 'string' && request.token.length < 8192);
  const status = spawnSync('npx', ['--no-install', 'supabase', 'status', '--output', 'json'], { encoding: 'utf8', timeout: 15000 });
  assert.equal(status.status, 0);
  const config = JSON.parse(status.stdout), url = config.API_URL ?? config.api_url;
  assert.equal(url, 'http://127.0.0.1:55321');
  const publicKey = config.PUBLISHABLE_KEY ?? config.ANON_KEY ?? config.anon_key;
  const privateKey = config.SECRET_KEY ?? config.SERVICE_ROLE_KEY ?? config.service_role_key;
  assert.ok(publicKey && privateKey);
  const options = { auth: { persistSession: false, autoRefreshToken: false } };
  const caller = createClient(url, publicKey, { ...options, global: { headers: { Authorization: 'Bearer ' + request.token } } });
  const admin = signal => createClient(url, privateKey, { ...options, global: {
    fetch: (input, init) => fetch(input, { ...init, signal }),
  } });
  const identity = await caller.auth.getUser(request.token);
  assert.equal(identity.error, null);

  // This fixed local operator session coordinates the fixture only. Its lock
  // lifetime is the DB connection, not a production lease/fencing guarantee.
  holder = spawn('docker', ['exec', '-i', '-e', `PGAPPNAME=tanaw-provision-fixture-${request.id}`,
    'supabase_db_project-tanaw', 'psql', '-X', '-qAt', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'],
  { stdio: ['pipe', 'pipe', 'ignore'] });
  const held = new Promise((resolve, reject) => {
    const lines = createInterface({ input: holder.stdout });
    lines.on('line', value => { if (value === 't' || value === 'f') resolve(value === 't'); });
    holder.once('error', () => reject(new Error('fixture-lock-unavailable')));
    holder.once('exit', () => reject(new Error('fixture-lock-ended')));
  });
  holder.stdin.write(`set idle_session_timeout='30s'; select pg_try_advisory_lock(hashtextextended('tanaw-provision-fixture:${request.id}',0));\n`);
  if (!await held) emit('busy');
  else {
    const reserved = await caller.rpc('tanaw_reserve_account', { target_school: request.school, request_id: request.id,
      account_email: request.email, assigned_roles: ['teacher'], assigned_subjects: ['math'], change_reason: 'Synthetic provisioning request' });
    assert.equal(reserved.error, null);
    const stored = await caller.from('tanaw_provisioning_requests').select('actor_id,school_id,email,completed_at,reserved_user_id').eq('id', request.id).single();
    assert.equal(stored.error, null);
    assert.equal(stored.data.actor_id, identity.data.user.id);
    assert.equal(stored.data.reserved_user_id, reserved.data);
    assert.equal(stored.data.school_id, request.school);
    if (!stored.data.completed_at) {
      let responseLossInjected = false;
      const recovered = await reconcileReservedAuthBounded({ userId: reserved.data, email: stored.data.email,
        requestId: request.id, schoolId: request.school }, {
        async ownsRequest(signal) {
          if (holder.exitCode !== null) return false;
          const current = await caller.from('tanaw_provisioning_requests').select('actor_id,reserved_user_id').eq('id', request.id).maybeSingle().abortSignal(signal);
          return !current.error && current.data?.actor_id === identity.data.user.id
            && current.data?.reserved_user_id === reserved.data && holder.exitCode === null;
        },
        async lookup(id, signal) {
          const found = await admin(signal).auth.admin.getUserById(id);
          if (found.error) return { status: found.error.status === 404 ? 'missing' : 'unavailable' };
          return found.data.user ? { status: 'found', user: found.data.user } : { status: 'unavailable' };
        },
        async create(signal) {
          const created = await admin(signal).auth.admin.createUser({ id: reserved.data, email: stored.data.email,
            password: randomUUID() + randomUUID(), email_confirm: true,
            app_metadata: { tanaw_provision_request_id: request.id, tanaw_provision_school_id: request.school } });
          if (created.error) throw new Error('fixture-create-uncertain');
          if (request.loseCreateResponse === true) {
            responseLossInjected = true;
            throw new Error('fixture-create-response-lost');
          }
        },
      }, { timeoutMs: 5000 });
      assert.equal(recovered.status, 'verified'); assert.equal(recovered.userId, reserved.data);
      if (request.loseCreateResponse === true) assert.equal(responseLossInjected, true);
      if (request.pauseAfterAuth === true) {
        emit('auth-ready');
        await new Promise((_, reject) => setTimeout(() => reject(new Error('fixture-pause-expired')), 20000));
      }
    }
    assert.equal(holder.exitCode, null, 'Fixture lock connection must still exist');
    const completed = await caller.rpc('tanaw_complete_account', { request_id: request.id });
    assert.equal(completed.error, null); assert.equal(completed.data, reserved.data);
    emit('complete');
  }
} catch {
  emit('failed'); process.exitCode = 1;
} finally {
  if (holder) {
    const ended = holder.exitCode === null ? new Promise(resolve => holder.once('exit', resolve)) : Promise.resolve();
    if (!holder.stdin.destroyed && !holder.stdin.writableEnded) holder.stdin.end('\\q\n');
    await ended;
  }
  clearTimeout(watchdog);
}
