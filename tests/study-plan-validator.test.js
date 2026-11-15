const test = require('node:test');
const assert = require('node:assert/strict');

const {
  isTaskId,
  validateTaskCompletionInput,
} = require('../server/src/validators/studyPlanValidator');

const TASK_ID = '507f1f77bcf86cd799439041';

test('Study plan validator: accepts the documented boolean body', () => {
  for (const isCompleted of [true, false]) {
    const { value, errors } = validateTaskCompletionInput({ isCompleted });

    assert.deepEqual(errors, []);
    assert.deepEqual(value, { isCompleted });
  }
});

test('Study plan validator: rejects a non-object body', () => {
  for (const body of [null, undefined, [], 'task', 42, true]) {
    const { value, errors } = validateTaskCompletionInput(body);

    assert.deepEqual(errors, ['request body must be a JSON object']);
    assert.equal(value.isCompleted, null);
  }
});

test('Study plan validator: requires a real boolean', () => {
  for (const isCompleted of [undefined, null, 'true', 'false', 1, 0, {}, []]) {
    const { value, errors } = validateTaskCompletionInput({ isCompleted });

    assert.deepEqual(
      errors,
      ['isCompleted must be a boolean'],
      `${JSON.stringify(isCompleted)} must not be accepted`
    );
    assert.equal(value.isCompleted, null);
  }
});

test('Study plan validator: an empty body reports the missing field', () => {
  const { errors } = validateTaskCompletionInput({});

  assert.deepEqual(errors, ['isCompleted must be a boolean']);
});

test('Study plan validator: ignores unknown body fields', () => {
  const { value, errors } = validateTaskCompletionInput({
    isCompleted: true,
    taskId: TASK_ID,
    points: 999,
  });

  assert.deepEqual(errors, []);
  assert.deepEqual(value, { isCompleted: true });
});

test('Study plan validator: accepts a 24-character hexadecimal task id', () => {
  assert.equal(isTaskId(TASK_ID), true);
  assert.equal(isTaskId('507F1F77BCF86CD799439041'), true);
});

test('Study plan validator: rejects malformed task ids', () => {
  for (const value of [
    '1',
    '',
    '   ',
    '507f1f77bcf8',
    '507f1f77bcf86cd79943904',
    '507f1f77bcf86cd7994390411',
    'zzzf1f77bcf86cd799439041',
    '507f1f77bcf86cd79943904g',
    null,
    undefined,
    507,
    {},
    [],
  ]) {
    assert.equal(isTaskId(value), false, `${JSON.stringify(value)} must be rejected`);
  }
});

test('Study plan validator: rejects an ObjectId instance because ids arrive as strings', () => {
  const parent = require('../server/src/models/StudyPlan');

  assert.equal(isTaskId(new parent.base.Types.ObjectId()), false);
});
