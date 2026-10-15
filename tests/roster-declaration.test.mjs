import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareRosterDeclaration, rosterDeclarationFailure } from '../app/lib/roster-declaration.ts';
const draft = (extra = {}) => ({ sourceTitle: 'Synthetic source', sourceLocator: 'fixture:roster', sourceRevision: 'r1', classReference: 'Class A', term: 'TERM 1', sourceHash: 'a'.repeat(64), learnerKeysText: 'key-01\nkey-02', ...extra });
test('explicit keys preserve spelling and CRLF; one final separator is allowed', () => {
  const { payload, errors } = prepareRosterDeclaration(draft({ learnerKeysText: '001\r\nKey-A\r\n', unexpected: 'PRIVATE' }), 'Fixture');
  assert.deepEqual(errors, {}); assert.deepEqual(payload.learnerKeys, ['001', 'Key-A']);
  assert.equal(payload.schoolYear, 'Fixture'); assert.equal(Object.keys(payload).length, 9);
  assert.doesNotMatch(JSON.stringify(payload), /PRIVATE/);
});
test('missing, duplicate, padded, blank, control and oversized keys fail without generating identities', () => {
  for (const learnerKeysText of ['', 'a\na', ' a', 'a ', 'a\n\nb', 'a\n\n', 'a\rb', 'a\u0085b', 'a'.repeat(201), Array.from({ length: 1001 }, (_, i) => String(i)).join('\n')]) {
    const result = prepareRosterDeclaration(draft({ learnerKeysText }), 'Fixture');
    assert.equal(result.payload, null); assert.ok(result.errors.learnerKeysText);
  }
  assert.ok(prepareRosterDeclaration(draft({ learnerKeysText: Array.from({length: 1000}, (_, i) => 'key-' + i).join('\n') }), 'Fixture').payload);
});
test('source metadata, explicit term, hash and assignment year are bounded', () => {
  for (const [field, value] of [['sourceTitle', ''], ['sourceTitle', ' x'], ['sourceTitle', 'x'.repeat(201)], ['sourceLocator', 'x'.repeat(1001)], ['sourceRevision', 'r\t1'], ['classReference', 'x\u007f'], ['term', 'TERM 4'], ['term', ''], ['sourceHash', 'A'.repeat(64)], ['sourceHash', 'a'.repeat(63)]]) {
    assert.equal(prepareRosterDeclaration(draft({ [field]: value }), 'Fixture').payload, null, field);
  }
  for (const year of ['', ' Fixture', 'x'.repeat(101)]) assert.ok(prepareRosterDeclaration(draft(), year).errors.schoolYear);
  for (const term of ['TERM 1', 'TERM 2', 'TERM 3']) assert.equal(prepareRosterDeclaration(draft({term}), 'Fixture').payload.term, term);
});
test('UTF-8 payload cap applies independently of character limits', () => {
  const learnerKeysText = Array.from({length: 1000}, (_, i) => '界'.repeat(190) + i).join('\n');
  assert.ok(prepareRosterDeclaration(draft({learnerKeysText}), 'Fixture').errors.learnerKeysText);
});
test('known failures offer recovery without implying approval', () => {
  assert.match(rosterDeclarationFailure('40001'), /revision changed/);
  assert.match(rosterDeclarationFailure('42501'), /Refresh school access/);
  assert.match(rosterDeclarationFailure('22023'), /Unsaved fields remain/);
});
