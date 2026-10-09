import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeDraft, draftKey, emptyDraft, preserveUnreadableDraft } from '../app/lib/submission-drafts.ts';
const scope = { actorId: 'teacher-a', schoolId: 'school-a', submissionId: 'submission-a' };
const saved = { schema: 1, scope, sourceVersion: 0, fields: { ...emptyDraft, value: '0' } };
test('draft round trip preserves recorded zero and source revision', () => {
  assert.deepEqual(decodeDraft(JSON.stringify(saved), scope), saved);
});
test('draft cannot cross account, school or submission boundaries', () => {
  for (const field of Object.keys(scope)) {
    const other = { ...scope, [field]: 'other' };
    assert.notEqual(draftKey(other), draftKey(scope));
    assert.equal(decodeDraft(JSON.stringify(saved), other), null);
  }
});
test('corrupt, unknown or oversized drafts fail closed', () => {
  for (const raw of ['{', '{}', JSON.stringify({ ...saved, schema: 2 }), JSON.stringify({ ...saved, sourceVersion: -1 }), JSON.stringify({ ...saved, fields: { ...saved.fields, reason: 'x'.repeat(2001) } })]) assert.equal(decodeDraft(raw, scope), null);
});
test('key encoding avoids separator collisions', () => {
  assert.notEqual(draftKey({ ...scope, actorId: 'a:b', schoolId: 'c' }), draftKey({ ...scope, actorId: 'a', schoolId: 'b:c' }));
});
test('unreadable original survives replacement of the working draft', () => {
  const key = draftKey(scope), raw = '{unreadable';
  const values = new Map([[key, raw]]);
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const retained = preserveUnreadableDraft(storage, key, raw);
  storage.setItem(key, JSON.stringify(saved));
  assert.equal(storage.getItem(retained), raw);
  assert.deepEqual(decodeDraft(storage.getItem(key), scope), saved);
});
test('failed retention and occupied recovery keys never destroy either original', () => {
  const key = draftKey(scope), values = new Map([[key, 'new original'], [key + ':unreadable', 'earlier original']]);
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  assert.throws(() => preserveUnreadableDraft(storage, key, 'new original'));
  assert.equal(storage.getItem(key), 'new original');
  assert.equal(storage.getItem(key + ':unreadable'), 'earlier original');
  assert.throws(() => preserveUnreadableDraft({ getItem: () => null, setItem: () => {} }, key, 'original'));
  assert.throws(() => preserveUnreadableDraft({ getItem: () => null, setItem: () => { throw new Error('quota'); } }, key, 'original'));
});
