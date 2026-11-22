import test from 'node:test';
import assert from 'node:assert/strict';
import { indicatorCoverage, workflowError } from '../app/lib/workflow-ux.ts';
test('submitted evidence cannot establish completeness without scope requirements', () => {
  for (const required_indicator_ids of [null, []]) assert.equal(indicatorCoverage({ required_indicator_ids }, [{ definitionId: 'a' }]).complete, false);
});
test('partial coverage stays incomplete and a superseded requirement is not fulfilled', () => {
  const slot = { required_indicator_ids: ['a', 'b'] };
  assert.deepEqual(indicatorCoverage(slot, [{ definitionId: 'a' }], ['a', 'b']).missing, ['b']);
  assert.equal(indicatorCoverage(slot, [{ definitionId: 'a' }, { definitionId: 'b' }], ['a', 'b']).complete, true);
  assert.equal(indicatorCoverage(slot, [{ definitionId: 'a' }, { definitionId: 'b' }], ['a']).complete, false);
});
test('conflicts and uncertain writes provide reconciliation before retry', () => {
  assert.match(workflowError('40001'), /compare.*unsent/);
  assert.match(workflowError('23505'), /already exists.*recorded result/);
  assert.match(workflowError(undefined), /check its history before retrying/);
});
test('business errors identify recovery and unknown SQL messages are not exposed', () => {
  assert.match(workflowError('42501', 'Deadline closed'), /cutoff.*extension/);
  assert.match(workflowError('42501', 'Independent Head review required'), /independent School Head/);
  assert.doesNotMatch(workflowError('22023', 'private internal table secret'), /private|internal table|secret/);
});
