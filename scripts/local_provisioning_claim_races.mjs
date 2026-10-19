// Isolated synthetic fixture only. No production worker or privileged endpoint.
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { reconcileReservedAuth } from '../app/lib/provisioning-auth-recovery.ts';

export async function verifyClaimRaces({ admin, url, privateKey, school, coordinator, makeRequest, reserve, prepareAuth, row, sql, quote, contended, users }) {
  assert.equal(url, 'http://127.0.0.1:55321', 'Claim races must target the isolated local stack');
  const claim = (request, seconds = 60) => admin.rpc('tanaw_claim_account_work', { request_id: request.id, lease_seconds: seconds }).abortSignal(AbortSignal.timeout(20000));
  const finish = (proof, client = admin) => client.rpc('tanaw_finish_account_work', proof).abortSignal(AbortSignal.timeout(20000));
  const owned = proof => admin.rpc('tanaw_account_work_owned', proof).abortSignal(AbortSignal.timeout(20000));
  const proofFor = (request, winner) => ({ request_id: request.id, epoch: winner.epoch, token: winner.token });
  const winnerOf = (results, epoch) => {
    for (const result of results) assert.equal(result.error, null, 'Contended claim RPC failed');
    const winners = results.filter(r => r.data?.status === 'claimed');
    assert.equal(winners.length, 1, 'Exactly one claimant may own the request');
    assert.equal(winners[0].data.epoch, epoch);
    const busy = results.filter(r => r.data?.status === 'busy');
    assert.equal(busy.length, 1);
    assert.equal(JSON.stringify(Object.keys(busy[0].data).sort()), '["status"]', 'Busy reply must not reveal token/epoch');
    return winners[0].data;
  };
  const noMembership = (request, id) => {
    assert.equal(sql(`select (select count(*) from public.tanaw_memberships where user_id=${quote(id)}),
      (select count(*) from public.tanaw_membership_events where target_user_id=${quote(id)}),
      (select completed_at is null from public.tanaw_provisioning_requests where id=${quote(request.id)});`), '0|0|t');
  };
  const oneMembership = (request, id) => {
    assert.equal(sql(`select revision,(select count(*) from public.tanaw_membership_events where target_user_id=${quote(id)}),
      (select actor_id=${quote(coordinator)}::uuid from public.tanaw_membership_events where target_user_id=${quote(id)}),
      (select completed_user_id=${quote(id)}::uuid and completed_at is not null from public.tanaw_provisioning_requests where id=${quote(request.id)})
      from public.tanaw_memberships where school_id=${quote(school)} and user_id=${quote(id)};`), '1|1|t|t');
  };

  const request = makeRequest();
  const reserved = await reserve(request); assert.equal(reserved.error, null);
  const id = reserved.data;
  const first = winnerOf(await contended('tanaw_claim_account_work', [() => claim(request), () => claim(request)]), 1);
  const oldProof = proofFor(request, first);
  noMembership(request, id);
  // Test operator expires only this generated claim. This is not real clock expiry.
  sql(`update public.tanaw_provisioning_worker_claims set expires_at=clock_timestamp()-interval '1 second' where request_id=${quote(request.id)};`);
  const successor = winnerOf(await contended('tanaw_claim_account_work', [() => claim(request), () => claim(request)]), 2);
  assert.ok(successor.token !== first.token, 'Successor token must change');
  const currentProof = proofFor(request, successor);
  assert.equal((await owned(oldProof)).data, false);
  // An external Auth call started by a stale worker can still land after takeover.
  // Reproduce that late write directly; it must never imply school membership.
  users.add(id);
  const created = await admin.auth.admin.createUser({ id, email: request.email, password: request.password, email_confirm: true,
    app_metadata: { tanaw_provision_request_id: request.id, tanaw_provision_school_id: school } });
  assert.equal(created.error, null);
  noMembership(request, id);
  for (const stale of [oldProof, { ...currentProof, token: oldProof.token }, { ...currentProof, epoch: oldProof.epoch }])
    assert.equal((await finish(stale)).error?.code, '42501', 'Stale/mixed proof cannot complete after late Auth creation');
  let creates = 0, lookups = 0;
  const recovered = await reconcileReservedAuth({ userId: id, email: request.email, requestId: request.id, schoolId: school }, {
    async ownsRequest() { const result = await owned(currentProof); return !result.error && result.data === true; },
    async lookup(target) {
      lookups++; assert.equal(target, id);
      const result = await admin.auth.admin.getUserById(target);
      return result.error ? { status: 'unavailable' } : { status: 'found', user: result.data.user };
    },
    async create() { creates++; throw new Error('Existing reserved identity must not be recreated'); },
  });
  assert.deepEqual(recovered, { status: 'verified', userId: id });assert.equal(creates, 0);assert.equal(lookups, 1);
  let responseDiscarded = false;
  const losingClient = createClient(url, privateKey, { auth: { persistSession: false, autoRefreshToken: false }, global: {
    async fetch(input, init) {
      const response = await fetch(input, init);
      const requestUrl = input instanceof Request ? input.url : String(input);
      if (new URL(requestUrl).pathname.endsWith('/rpc/tanaw_finish_account_work') && response.ok) {
        await response.arrayBuffer(); responseDiscarded = true;
        throw new TypeError('synthetic-finish-response-discarded');
      }
      return response;
    },
  } });
  const finishes = await contended('tanaw_finish_account_work', [() => finish(currentProof), () => finish(currentProof, losingClient)]);
  assert.equal(finishes[0].error, null);assert.equal(finishes[0].data, id);
  assert.ok(responseDiscarded && finishes[1].error, 'Client must observe a failed response after actual server success');
  oneMembership(request, id);
  const retried = await finish(currentProof);assert.equal(retried.error, null);assert.equal(retried.data, id);
  const complete = await claim(request);assert.equal(complete.error, null);assert.deepEqual(complete.data, { status: 'complete', userId: id });
  oneMembership(request, id);
  console.log('PASS observed initial/successor claim contention, stale late-Auth denial, exact-UUID recovery and lost duplicate-finish response with one attributed membership');

  const expiring = makeRequest(), expiringId = await prepareAuth(expiring);
  const lease = await claim(expiring, 10);assert.equal(lease.error, null);assert.equal(lease.data.status, 'claimed');
  const expiredProof = proofFor(expiring, lease.data);
  const blockedFinish = await contended('tanaw_finish_account_work', [() => finish(expiredProof)], {
    lockIdentity: school + ':' + expiringId,
    async beforeRelease() {
      const expired = () => sql(`select expires_at<=clock_timestamp() from public.tanaw_provisioning_worker_claims where request_id=${quote(expiring.id)};`) === 't';
      assert.equal(expired(), false, 'Finish must reach target lock before lease expiry');
      const deadline = Date.now() + 13000;
      while (!expired() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 100));
      assert.equal(expired(), true, 'Database clock must report expiry before releasing target lock');
    },
  });
  assert.equal(blockedFinish[0].error?.code, '42501', 'Elapsed ownership must be rechecked after target lock wait');
  noMembership(expiring, expiringId);
  const renewed = await claim(expiring);assert.equal(renewed.error, null);assert.equal(renewed.data.epoch, 2);
  assert.ok(renewed.data.token !== lease.data.token, 'Recovery token must change');
  const resumed = await finish(proofFor(expiring, renewed.data));assert.equal(resumed.error, null);assert.equal(resumed.data, expiringId);
  oneMembership(expiring, expiringId);assert.ok((await row(expiring)).completed_at);
  console.log('PASS observed finish target-lock wait through real database-clock expiry, zero partial writes and successor recovery');
}
