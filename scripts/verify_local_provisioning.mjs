// CI integration fixture only. No production provisioning endpoint or bootstrap.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
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
const schema = 'tanaw_provision_test_' + randomUUID().replaceAll('-', '');
const school = randomUUID(), otherSchool = randomUUID(), coordinator = randomUUID();
const users = new Set();
const quote = value => "'" + String(value).replaceAll("'", "''") + "'";
function sql(statement) {
  const result = spawnSync('docker', ['exec', '-i', 'supabase_db_project-tanaw', 'psql', '-X', '-qAt', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'], {
    input: "set statement_timeout='15s';\n" + statement, encoding: 'utf8', timeout: 20000,
  });
  // Do not echo Auth responses, SQL payloads, keys or passwords on failure.
  assert.equal(result.status, 0, 'Synthetic provisioning SQL must succeed');
  return result.stdout.trim();
}
const makeRequest = () => ({ id: randomUUID(), userId: randomUUID(), email: `${randomUUID()}@fixture.invalid`, password: randomUUID() + randomUUID() });
async function create(attributes) {
  users.add(attributes.id);
  const result = await admin.auth.admin.createUser(attributes);
  assert.equal(result.error, null, 'Synthetic account creation must succeed');
  return result.data.user;
}
function authorize(targetSchool) {
  return sql(`select count(*) from public.tanaw_memberships where school_id=${quote(targetSchool)} and user_id=${quote(coordinator)} and active and 'smeaCoordinator'=any(roles);`) === '1';
}
async function provision(request, { targetSchool = school, loseAuthResponse = false, failMembership = false } = {}) {
  // This harness's actor/scope/roles are fixed server-side fixture constants.
  assert.ok(authorize(targetSchool), 'Current coordinator access required before Auth or receipt recovery');
  assert.match(request.email, /^[a-f0-9-]+@fixture\.invalid$/);
  const payload = JSON.stringify({ email: request.email, userId: request.userId, roles: ['teacher'], subjects: ['math'] });
  const prior = sql(`select payload::text from ${schema}.requests where id=${quote(request.id)};`);
  if (prior) assert.deepEqual(JSON.parse(prior), JSON.parse(payload), 'Changed request must not reuse a reservation');
  else sql(`insert into ${schema}.requests(id,actor_id,school_id,user_id,payload) values(${quote(request.id)},${quote(coordinator)},${quote(targetSchool)},${quote(request.userId)},${quote(payload)}::jsonb);`);
  const complete = sql(`select complete from ${schema}.requests where id=${quote(request.id)};`);
  if (complete === 't') return request.userId;

  // A reserved ID is authoritative for this fixture; never adopt by email lookup.
  const found = await admin.auth.admin.getUserById(request.userId);
  assert.ok(!found.error || found.error.status === 404, 'Unknown Auth lookup failure must not trigger creation');
  let user = found.data.user;
  if (!user) {
    users.add(request.userId);
    const created = await admin.auth.admin.createUser({ id: request.userId, email: request.email, password: request.password,
      email_confirm: true, app_metadata: { fixture_request: request.id, fixture_school: targetSchool } });
    assert.equal(created.error, null, 'Creation collision or unknown Auth failure must stop provisioning');
    user = created.data.user;
    if (loseAuthResponse) throw new Error('synthetic-lost-auth-response');
  }
  assert.equal(user.id, request.userId);
  assert.equal(user.email, request.email);
  assert.equal(user.app_metadata.fixture_request, request.id, 'Reserved account must belong to this request');
  assert.equal(user.app_metadata.fixture_school, targetSchool);
  assert.ok(authorize(targetSchool), 'Access rechecked after Auth operation');

  // Test-only operator transaction: execute the real authenticated membership RPC
  // and journal completion together. This is not a shipped worker or request RPC.
  sql(`begin;
    select set_config('request.jwt.claim.sub',${quote(coordinator)},true);
    do $fixture$ begin
      if not tanaw_private.has_school_role(${quote(targetSchool)},array['smeaCoordinator']) then raise exception 'Access revoked'; end if;
      perform public.tanaw_manage_member(${quote(targetSchool)},${quote(request.userId)},array['teacher'],array['math'],true,'Synthetic provisioning request',0);
      ${failMembership ? "raise exception 'synthetic interruption';" : ''}
      update ${schema}.requests set complete=true where id=${quote(request.id)};
    end $fixture$;
    commit;`);
  return request.userId;
}

try {
  await create({ id: coordinator, email: `${coordinator}@fixture.invalid`, password: randomUUID() + randomUUID(), email_confirm: true });
  sql(`create schema ${schema};
    create table ${schema}.requests(id uuid primary key,actor_id uuid not null,school_id uuid not null,user_id uuid not null unique,payload jsonb not null,complete boolean not null default false);
    revoke all on schema ${schema} from public,anon,authenticated;
    revoke all on ${schema}.requests from public,anon,authenticated;
    insert into public.tanaw_schools(id,name) values(${quote(school)},'Synthetic provisioning school'),(${quote(otherSchool)},'Synthetic other school');
    insert into public.tanaw_memberships(school_id,user_id,roles,subject_ids) values(${quote(school)},${quote(coordinator)},array['smeaCoordinator'],'{}');`);
  const request = makeRequest();
  await assert.rejects(provision(request, { loseAuthResponse: true }), /synthetic-lost-auth-response/);
  assert.equal(sql(`select count(*) from public.tanaw_memberships where user_id=${quote(request.userId)};`), '0');
  const unassigned = client(publicKey);
  assert.equal((await unassigned.auth.signInWithPassword({ email: request.email, password: request.password })).error, null);
  const inaccessible = await unassigned.from('tanaw_schools').select('id');
  assert.equal(inaccessible.error, null); assert.deepEqual(inaccessible.data, [], 'Auth identity alone grants no school access');
  await unassigned.auth.signOut();
  // Auth succeeds but failed membership transaction leaves no access/audit/receipt.
  await assert.rejects(provision(request, { failMembership: true }));
  assert.equal(sql(`select (select count(*) from public.tanaw_memberships where user_id=${quote(request.userId)}),(select count(*) from public.tanaw_membership_events where target_user_id=${quote(request.userId)}),(select complete from ${schema}.requests where id=${quote(request.id)});`), '0|0|f');
  assert.equal(await provision({ ...request, password: randomUUID() + randomUUID() }), request.userId);
  const resumed = client(publicKey);
  assert.equal((await resumed.auth.signInWithPassword({ email: request.email, password: request.password })).error, null, 'Recovery must not reset the original password');
  await resumed.auth.signOut();
  assert.equal(await provision(request), request.userId, 'Lost completion response recovers without another grant');
  assert.equal(sql(`select revision,(select count(*) from public.tanaw_membership_events where target_user_id=${quote(request.userId)}) from public.tanaw_memberships where school_id=${quote(school)} and user_id=${quote(request.userId)};`), '1|1');
  await assert.rejects(provision({ ...request, email: `${randomUUID()}@fixture.invalid` }), /Changed request/);
  const other = makeRequest();
  await assert.rejects(provision(other, { targetSchool: otherSchool }), /Current coordinator access/);
  assert.equal((await admin.auth.admin.getUserById(other.userId)).data.user, null);
  const collision = makeRequest(), existingId = randomUUID();
  await create({ id: existingId, email: collision.email, password: randomUUID() + randomUUID(), email_confirm: true });
  await assert.rejects(provision(collision), /Creation collision/);
  assert.equal(sql(`select count(*) from public.tanaw_memberships where user_id=${quote(existingId)};`), '0', 'Existing email identity must not be adopted');
  sql(`update public.tanaw_memberships set active=false where school_id=${quote(school)} and user_id=${quote(coordinator)};`);
  await assert.rejects(provision(request), /Current coordinator access/);
  console.log('PASS local Auth reservation recovery, no-access orphan, membership rollback, exact retry, request conflict, cross-school denial, email collision and revoked-coordinator denial');
} finally {
  // Only generated fixture identities/schools/schema qualify for cleanup.
  sql(`drop schema if exists ${schema} cascade;
    delete from public.tanaw_membership_events where school_id in (${quote(school)},${quote(otherSchool)});
    delete from public.tanaw_memberships where school_id in (${quote(school)},${quote(otherSchool)});
    delete from public.tanaw_schools where id in (${quote(school)},${quote(otherSchool)});`);
  for (const id of users) {
    const found = await admin.auth.admin.getUserById(id);
    if (found.data.user) assert.equal((await admin.auth.admin.deleteUser(id)).error, null, 'Synthetic Auth cleanup required');
  }
}
console.log('PASS provisioning fixture removed; production bootstrap and provisioning remain unavailable');
