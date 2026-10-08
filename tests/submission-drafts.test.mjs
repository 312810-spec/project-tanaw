import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeDraft, draftKey, emptyDraft } from '../app/lib/submission-drafts.ts';
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
