import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcileReservedAuth } from '../app/lib/provisioning-auth-recovery.ts';
const id = n => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
const expected = () => ({ userId: id(1), requestId: id(2), schoolId: id(3), email: 'synthetic@fixture.invalid' });
const identity = e => ({ id: e.userId, email: e.email, app_metadata: { tanaw_provision_request_id: e.requestId, tanaw_provision_school_id: e.schoolId } });
test('lost create response recovers only through a separate exact-UUID lookup', async () => {
  const e = expected(); let stored = null, creates = 0; const lookedUp = [];
  const out = await reconcileReservedAuth(e, { ownsRequest: async () => true,
    lookup: async key => { lookedUp.push(key); return stored ? { status: 'found', user: stored } : { status: 'missing' }; },
    create: async () => { creates++; stored = identity(e); throw new Error('PRIVATE transport failure'); } });
  assert.deepEqual(out, { status: 'verified', userId: e.userId });
  assert.equal(creates, 1); assert.deepEqual(lookedUp, [e.userId, e.userId]);
  assert.doesNotMatch(JSON.stringify(out), /PRIVATE|email|metadata/);
});
test('unknown initial lookup never creates an account', async () => {
  for (const value of [null, {}, { status: 'unavailable' }, { status: 'invented' }]) {
    let creates = 0;
    const out = await reconcileReservedAuth(expected(), { ownsRequest: async () => true, lookup: async () => value, create: async () => creates++ });
    assert.equal(out.status, 'pending'); assert.equal(out.userId, null); assert.equal(creates, 0);
  }
});
test('uncertain write followed by missing/unavailable lookup stays pending without a retry loop', async () => {
  for (const after of [{ status: 'missing' }, { status: 'unavailable' }, null]) {
    let reads = 0, creates = 0;
    const out = await reconcileReservedAuth(expected(), { ownsRequest: async () => true,
      lookup: async () => ++reads === 1 ? { status: 'missing' } : after,
      create: async () => { creates++; throw new Error('PRIVATE'); } });
    assert.deepEqual(out, { status: 'pending', userId: null }); assert.equal(creates, 1); assert.equal(reads, 2);
  }
});
test('a later invocation recovers delayed creation without another create or password update', async () => {
  const e = expected(); let creates = 0;
  const out = await reconcileReservedAuth(e, { ownsRequest: async () => true,
    lookup: async () => ({ status: 'found', user: identity(e) }), create: async () => creates++ });
  assert.equal(out.status, 'verified'); assert.equal(creates, 0);
});
test('UUID, email and both trusted metadata bindings must all match', async () => {
  const e = expected();
  for (const mutate of [u => u.id = id(9), u => u.email = 'other@fixture.invalid', u => u.app_metadata = null,
    u => u.app_metadata.tanaw_provision_request_id = id(9), u => u.app_metadata.tanaw_provision_school_id = id(9)]) {
    const user = identity(e); mutate(user); let creates = 0;
    const out = await reconcileReservedAuth(e, { ownsRequest: async () => true, lookup: async () => ({ status: 'found', user }), create: async () => creates++ });
    assert.deepEqual(out, { status: 'identityConflict', userId: null }); assert.equal(creates, 0);
  }
});
test('successful create output is insufficient when independent lookup conflicts', async () => {
  const e = expected(); let reads = 0;
  const out = await reconcileReservedAuth(e, { ownsRequest: async () => true,
    lookup: async () => ++reads === 1 ? { status: 'missing' } : { status: 'found', user: { ...identity(e), id: id(8) } },
    create: async () => identity(e) });
  assert.equal(out.status, 'identityConflict'); assert.equal(out.userId, null);
});
test('ownership loss before or during uncertain creation withholds identity', async () => {
  for (const loseAt of [1, 2, 3, 4]) {
    let checks = 0, reads = 0, creates = 0;
    const out = await reconcileReservedAuth(expected(), { ownsRequest: async () => ++checks !== loseAt,
      lookup: async () => ++reads === 1 ? { status: 'missing' } : { status: 'found', user: identity(expected()) },
      create: async () => creates++ });
    assert.deepEqual(out, { status: 'ownershipLost', userId: null });
    if (loseAt <= 2) assert.equal(creates, 0);
  }
});
test('malformed reservation and adapter errors fail statically without leaking input', async () => {
  for (const value of [null, {}, { ...expected(), email: 'PRIVATE padded ' }, { ...expected(), requestId: 'PRIVATE' }]) {
    const out = await reconcileReservedAuth(value, { ownsRequest: async () => { throw Error('must not call'); }, lookup: async () => {}, create: async () => {} });
    assert.deepEqual(out, { status: 'invalidReservation', userId: null }); assert.doesNotMatch(JSON.stringify(out), /PRIVATE/);
  }
  const out = await reconcileReservedAuth(expected(), { ownsRequest: async () => true, lookup: async () => { throw Error('PRIVATE'); }, create: async () => { throw Error('must not call'); } });
  assert.deepEqual(out, { status: 'pending', userId: null });
});
