// Synthetic local subprocess fixture. Never an app endpoint or production worker.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline';
import { createClient } from '@supabase/supabase-js';

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
  const admin = createClient(url, privateKey, options);
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
      const existing = await admin.auth.admin.getUserById(reserved.data);
      assert.ok(!existing.error || existing.error.status === 404);
      let user = existing.data.user;
      if (!user) {
        const created = await admin.auth.admin.createUser({ id: reserved.data, email: stored.data.email,
          password: randomUUID() + randomUUID(), email_confirm: true,
          app_metadata: { tanaw_provision_request_id: request.id, tanaw_provision_school_id: request.school } });
        assert.equal(created.error, null); user = created.data.user;
      }
      assert.equal(user.id, reserved.data); assert.equal(user.email, stored.data.email);
      assert.equal(user.app_metadata.tanaw_provision_request_id, request.id);
      assert.equal(user.app_metadata.tanaw_provision_school_id, request.school);
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
