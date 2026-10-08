import assert from 'node:assert/strict';
import test from 'node:test';
import { workflowReminders } from '../app/lib/workflow-reminders.ts';
const deadline = '2026-01-10T00:00:00Z', now = Date.parse(deadline);
test('deadline closes at the exact cutoff; locked remains distinct', () => {
  assert.equal(workflowReminders(deadline, false, [], [], now - 1).deadline, 'Submission deadline within 48 hours');
  assert.equal(workflowReminders(deadline, false, [], [], now).deadline, 'Submission deadline closed');
  assert.equal(workflowReminders(deadline, true, [], [], now).deadline, 'School packet locked');
});
test('missing is unsubmitted and stale reviews do not clear reminders', () => {
  const result = workflowReminders(deadline, false, [{ id: 'a', current_version: 0, extension_until: null }, { id: 'b', current_version: 2, extension_until: null }], [{ submission_id: 'b', version: 1 }], now);
  assert.equal(result.missing, 1); assert.equal(result.awaitingSubjectReview, 1);
});
test('extensions expire at cutoff and cannot override Lock', () => {
  const submissions = [{ id: 'a', current_version: 0, extension_until: deadline }];
  assert.equal(workflowReminders(deadline, false, submissions, [], now - 1).activeExtensions, 1);
  assert.equal(workflowReminders(deadline, false, submissions, [], now).activeExtensions, 0);
  assert.equal(workflowReminders(deadline, true, submissions, [], now - 1).activeExtensions, 0);
});
test('invalid device time cannot infer an open deadline or extension', () => {
  assert.equal(workflowReminders(deadline, false, [], [], NaN).deadline, 'Deadline status unavailable');
});
