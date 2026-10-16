// CI integration fixture only. No production provisioning endpoint or bootstrap.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline';
import { createClient } from '@supabase/supabase-js';

const status = spawnSync('npx', ['--no-install', 'supabase', 'status', '--output', 'json'], { encoding: 'utf8', timeout: 30000 });
assert.equal(status.status, 0, 'Local status required');
const config = JSON.parse(status.stdout);
const url = config.API_URL ?? config.api_url;
assert.equal(url, 'http://127.0.0.1:55321', 'Only the isolated local stack is permitted');
const publicKey = config.PUBLISHABLE_KEY ?? config.ANON_KEY ?? config.anon_key;
const privateKey = config.SECRET_KEY ?? config.SERVICE_ROLE_KEY ?? config.service_role_key;
assert.ok(publicKey && privateKey, 'Local keys required; never print them');
const client = key => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const admin = client(privateKey);
const school = randomUUID(), otherSchool = randomUUID(), coordinator = randomUUID();
const coordinatorPassword = randomUUID() + randomUUID();
const users = new Set(), sessions = [];
const quote = value => "'" + String(value).replaceAll("'", "''") + "'";
const dbCommand = ['exec', '-i', 'supabase_db_project-tanaw', 'psql', '-X', '-qAt', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'];
function sql(statement) {
  const result = spawnSync('docker', dbCommand, { input: "set statement_timeout='15s';\n" + statement, encoding: 'utf8', timeout: 20000 });
  assert.equal(result.status, 0, 'Synthetic provisioning SQL must succeed');
  return result.stdout.trim();
}
const makeRequest = () => ({ id: randomUUID(), email: `${randomUUID()}@fixture.invalid`, password: randomUUID() + randomUUID() });
async function create(attributes) {
  users.add(attributes.id);
  const result = await admin.auth.admin.createUser(attributes);
  assert.equal(result.error, null, 'Synthetic account creation must succeed');
  return result.data.user;
}
let caller;
async function loginCoordinator() {
  const next = client(publicKey); sessions.push(next);
  assert.equal((await next.auth.signInWithPassword({ email: `${coordinator}@fixture.invalid`, password: coordinatorPassword })).error, null);
  caller = next;
}
function reserve(request, targetSchool = school) {
  return caller.rpc('tanaw_reserve_account', { target_school: targetSchool, request_id: request.id,
    account_email: request.email, assigned_roles: ['teacher'], assigned_subjects: ['math'],
    change_reason: 'Synthetic provisioning request' }).abortSignal(AbortSignal.timeout(20000));
}
function complete(request) {
  return caller.rpc('tanaw_complete_account', { request_id: request.id }).abortSignal(AbortSignal.timeout(20000));
}
async function row(request) {
  const result = await caller.from('tanaw_provisioning_requests').select('reserved_user_id,email,completed_at').eq('id', request.id).single();
  assert.equal(result.error, null, 'Creator must be able to read its durable reservation');
  return result.data;
}
async function prepareAuth(request, { loseAuthResponse = false } = {}) {
  const reservation = await reserve(request);
  assert.equal(reservation.error, null, 'Durable reservation must authorize before any Auth operation');
  const userId = reservation.data;
  const stored = await row(request);
  assert.equal(stored.reserved_user_id, userId);
  if (stored.completed_at) return userId;
  const found = await admin.auth.admin.getUserById(userId);
  assert.ok(!found.error || found.error.status === 404, 'Unknown Auth lookup failure must stop');
  let user = found.data.user;
  if (!user) {
    users.add(userId);
    const created = await admin.auth.admin.createUser({ id: userId, email: stored.email, password: request.password,
      email_confirm: true, app_metadata: { tanaw_provision_request_id: request.id, tanaw_provision_school_id: school } });
    assert.equal(created.error, null, 'Creation collision must stop without adopting by email');
    user = created.data.user;
    if (loseAuthResponse) throw new Error('synthetic-lost-auth-response');
  }
  assert.equal(user.id, userId); assert.equal(user.email, stored.email);
  assert.equal(user.app_metadata.tanaw_provision_request_id, request.id);
  assert.equal(user.app_metadata.tanaw_provision_school_id, school);
  return userId;
}
async function provision(request, options) {
  const id = await prepareAuth(request, options);
  const result = await complete(request);
  assert.equal(result.error, null, 'Authenticated completion must succeed');
  assert.equal(result.data, id);
  return id;
}
async function contended(functionName, operations) {
  assert.ok(['tanaw_reserve_account', 'tanaw_complete_account'].includes(functionName));
  const holder = spawn('docker', dbCommand, { stdio: ['pipe', 'pipe', 'ignore'] });
  const ready = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Lock holder did not become ready')), 15000);
    const lines = createInterface({ input: holder.stdout });
    lines.on('line', line => { if (line === 'LOCK_READY') { clearTimeout(timer); resolve(); } });
    holder.once('error', () => { clearTimeout(timer); reject(new Error('Lock holder failed')); });
    holder.once('exit', () => { clearTimeout(timer); reject(new Error('Lock holder exited before release')); });
  });
  const exited = new Promise(resolve => holder.once('exit', code => resolve(code)));
  holder.stdin.write(`begin; set local idle_in_transaction_session_timeout='20s';
    select pg_advisory_xact_lock(hashtextextended(${quote(school + ':' + coordinator)},0));
\\echo LOCK_READY
`);
  try {
    await ready;
    // Promise.all starts both HTTP requests while the actor lock is held.
    const work = Promise.all(operations.map(operation => operation()));
    const deadline = Date.now() + 10000;
    let waiting = false;
    while (Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 100));
      const count = sql(`select count(*) from pg_stat_activity where wait_event_type='Lock' and query like '%${functionName}%';`);
      if (Number(count) >= operations.length) { waiting = true; break; }
    }
    holder.stdin.end('commit;\n');
    assert.equal(await exited, 0, 'Lock holder must commit');
    const results = await work;
    assert.ok(waiting, 'Both HTTP RPCs must demonstrably wait on a database lock');
    return results;
  } finally {
    if (!holder.stdin.destroyed && !holder.stdin.writableEnded) holder.stdin.end('rollback;\n');
    await exited;
  }
}
try {
  await create({ id: coordinator, email: `${coordinator}@fixture.invalid`, password: coordinatorPassword, email_confirm: true });
  sql(`insert into public.tanaw_schools(id,name) values(${quote(school)},'Synthetic provisioning school'),(${quote(otherSchool)},'Synthetic other school');
    insert into public.tanaw_memberships(school_id,user_id,roles,subject_ids) values(${quote(school)},${quote(coordinator)},array['smeaCoordinator'],'{}');`);
  await loginCoordinator();
  const request = makeRequest();
  const reservations = await contended('tanaw_reserve_account', [() => reserve(request), () => reserve(request)]);
  for (const result of reservations) assert.equal(result.error, null);
  assert.equal(reservations[0].data, reservations[1].data, 'Concurrent exact reserve returns one UUID');
  const userId = reservations[0].data;
  assert.equal(sql(`select count(*) from public.tanaw_provisioning_requests where id=${quote(request.id)};`), '1');
  const duplicate = await reserve({ ...request, id: randomUUID() });
  assert.equal(duplicate.error?.code, '40001', 'Same email under another request cannot create another reservation');
  await assert.rejects(prepareAuth(request, { loseAuthResponse: true }), /synthetic-lost-auth-response/);
  assert.equal(sql(`select count(*) from public.tanaw_memberships where user_id=${quote(userId)};`), '0');
  const unassigned = client(publicKey); sessions.push(unassigned);
  assert.equal((await unassigned.auth.signInWithPassword({ email: request.email, password: request.password })).error, null);
  const inaccessible = await unassigned.from('tanaw_schools').select('id');
  assert.equal(inaccessible.error, null); assert.deepEqual(inaccessible.data, [], 'Auth alone grants no school access');
  // Resume from durable rows through a fresh authenticated coordinator client.
  await loginCoordinator();
  assert.equal(await prepareAuth({ ...request, password: randomUUID() + randomUUID() }), userId);
  assert.equal((await unassigned.auth.signInWithPassword({ email: request.email, password: request.password })).error, null, 'Recovery never resets original password');
  const completions = await contended('tanaw_complete_account', [() => complete(request), () => complete(request)]);
  for (const result of completions) { assert.equal(result.error, null); assert.equal(result.data, userId); }
  assert.equal(sql(`select revision,(select count(*) from public.tanaw_membership_events where target_user_id=${quote(userId)}) from public.tanaw_memberships where school_id=${quote(school)} and user_id=${quote(userId)};`), '1|1');
  assert.equal(await provision(request), userId, 'Lost completion response recovers one durable receipt');
  const changed = await reserve({ ...request, email: `${randomUUID()}@fixture.invalid` });
  assert.equal(changed.error?.code, '22023');
  assert.equal((await reserve(makeRequest(), otherSchool)).error?.code, '42501');
  const collision = makeRequest(), existingId = randomUUID();
  await create({ id: existingId, email: collision.email, password: randomUUID() + randomUUID(), email_confirm: true });
  await assert.rejects(prepareAuth(collision), /Creation collision/);
  assert.equal(sql(`select count(*) from public.tanaw_memberships where user_id=${quote(existingId)};`), '0');
  const disabled = await caller.rpc('tanaw_manage_member', { target_school: school, target_user: userId,
    new_roles: ['teacher'], new_subject_ids: ['math'], is_active: false, change_reason: 'Synthetic later disable', expected_revision: 1 });
  assert.equal(disabled.error, null);
  assert.equal((await complete(request)).error, null);
  assert.equal(sql(`select active,revision from public.tanaw_memberships where school_id=${quote(school)} and user_id=${quote(userId)};`), 'f|2');
  // Revoke coordinator after a real Auth account exists but before completion.
  const interrupted = makeRequest(), interruptedId = await prepareAuth(interrupted);
  sql(`update public.tanaw_memberships set active=false where school_id=${quote(school)} and user_id=${quote(coordinator)};`);
  assert.equal((await complete(interrupted)).error?.code, '42501');
  assert.equal(sql(`select count(*) from public.tanaw_memberships where user_id=${quote(interruptedId)};`), '0');
  assert.equal((await complete(request)).error?.code, '42501');
  const hidden = await caller.from('tanaw_provisioning_requests').select('id');
  assert.equal(hidden.error, null); assert.deepEqual(hidden.data, []);
  console.log('PASS real Auth + durable HTTP RPC recovery, observed reservation/completion contention, exact receipts, collision denial, later disable preservation and revocation');
} finally {
  for (const session of sessions) await session.auth.signOut();
  // Operator cleanup, restricted to generated schools/users. Not a runtime purge.
  sql(`delete from public.tanaw_provisioning_requests where school_id in (${quote(school)},${quote(otherSchool)});
    delete from public.tanaw_membership_events where school_id in (${quote(school)},${quote(otherSchool)});
    delete from public.tanaw_memberships where school_id in (${quote(school)},${quote(otherSchool)});
    delete from public.tanaw_schools where id in (${quote(school)},${quote(otherSchool)});`);
  for (const id of users) {
    const found = await admin.auth.admin.getUserById(id);
    if (found.data.user) assert.equal((await admin.auth.admin.deleteUser(id)).error, null, 'Synthetic Auth cleanup required');
  }
}
console.log('PASS provisioning fixture removed; production bootstrap and provisioning remain unavailable');
