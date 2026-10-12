import test from 'node:test';
import assert from 'node:assert/strict';
import { readPages } from '../app/lib/read-pages.ts';
import { workflowError } from '../app/lib/workflow-ux.ts';
test('more than a server page stays reachable with complete ordered identity', async () => {
  const source = Array.from({ length: 1205 }, (_, id) => ({ id }));
  const rows = await readPages(async (from, to) => ({ data: source.slice(from, to + 1), error: null, count: source.length }));
  assert.deepEqual(rows, source);
});
test('truncated, changed-count or failed pages never become successful reads', async () => {
  await assert.rejects(readPages(async () => ({ data: [{ id: 1 }], count: 10, error: null })), /Incomplete/);
  let calls = 0;
  await assert.rejects(readPages(async () => ({ data: calls++ ? [] : [1, 2], count: calls === 1 ? 3 : 4, error: null }), 2), /changed/);
  await assert.rejects(readPages(async () => ({ data: null, error: new Error('network') })), /network/);
});
test('business errors identify recovery and unknown SQL messages are not exposed', () => {
  assert.match(workflowError('42501', 'Deadline closed'), /cutoff.*extension/);
  assert.match(workflowError('42501', 'Independent Head review required'), /independent School Head/);
  assert.doesNotMatch(workflowError('22023', 'private internal table secret'), /private|internal table|secret/);
});
