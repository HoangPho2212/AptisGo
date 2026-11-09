const test = require('node:test');
const assert = require('node:assert/strict');

const {
  DEFAULT_DAILY_MINUTES,
  MIN_DAILY_MINUTES,
  MAX_DAILY_MINUTES,
  validateGoalInput,
} = require('../server/src/validators/goalValidator');

test('Goal validator: exports the documented cadence bounds', () => {
  assert.equal(DEFAULT_DAILY_MINUTES, 45);
  assert.equal(MIN_DAILY_MINUTES, 15);
  assert.equal(MAX_DAILY_MINUTES, 240);
});

test('Goal validator: applies target certificate and cadence defaults', () => {
  const { value, errors } = validateGoalInput({ deadline: '2027-06-30' });

  assert.deepEqual(errors, []);
  assert.deepEqual(value, {
    targetCertificate: 'B2',
    deadline: '2027-06-30',
    dailyMinutesTarget: 45,
  });
});

test('Goal validator: accepts every allowed target certificate', () => {
  for (const targetCertificate of ['B1', 'B2', 'C1']) {
    const { value, errors } = validateGoalInput({
      targetCertificate,
      deadline: '2027-06-30',
      dailyMinutesTarget: 60,
    });

    assert.deepEqual(errors, []);
    assert.equal(value.targetCertificate, targetCertificate);
    assert.equal(value.dailyMinutesTarget, 60);
  }
});

test('Goal validator: rejects a non-object body', () => {
  for (const body of [null, undefined, [], 'goal', 42]) {
    const { errors } = validateGoalInput(body);
    assert.deepEqual(errors, ['request body must be a JSON object']);
  }
});

test('Goal validator: requires a deadline string', () => {
  for (const body of [{}, { deadline: '' }, { deadline: '   ' }, { deadline: null }]) {
    const { errors } = validateGoalInput(body);
    assert.deepEqual(errors, ['deadline is required']);
  }

  assert.deepEqual(validateGoalInput({ deadline: 20270630 }).errors, [
    'deadline must be a valid ISO date',
  ]);
});

test('Goal validator: rejects an unsupported target certificate', () => {
  for (const targetCertificate of ['A1', 'A2', 'C2', 'b2', null, 2]) {
    const { errors } = validateGoalInput({
      targetCertificate,
      deadline: '2027-06-30',
    });

    assert.deepEqual(errors, ['targetCertificate must be one of: B1, B2, C1']);
  }
});

test('Goal validator: requires an integer daily cadence inside 15-240', () => {
  for (const dailyMinutesTarget of [14, 241, 45.5, '45', null, NaN, Infinity]) {
    const { errors } = validateGoalInput({
      deadline: '2027-06-30',
      dailyMinutesTarget,
    });

    assert.deepEqual(errors, ['dailyMinutesTarget must be an integer between 15 and 240']);
  }

  for (const dailyMinutesTarget of [15, 45, 120, 240]) {
    const { value, errors } = validateGoalInput({
      deadline: '2027-06-30',
      dailyMinutesTarget,
    });

    assert.deepEqual(errors, []);
    assert.equal(value.dailyMinutesTarget, dailyMinutesTarget);
  }
});

test('Goal validator: trims the deadline and ignores unknown fields', () => {
  const { value, errors } = validateGoalInput({
    deadline: '  2027-06-30  ',
    targetCertificate: 'C1',
    unexpected: true,
  });

  assert.deepEqual(errors, []);
  assert.equal(value.deadline, '2027-06-30');
  assert.equal(value.targetCertificate, 'C1');
});
