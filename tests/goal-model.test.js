const test = require('node:test');
const assert = require('node:assert/strict');

const Goal = require('../server/src/models/Goal');

const STUDENT_ID = '507f1f77bcf86cd799439011';
const VALID_GOAL = {
  student: STUDENT_ID,
  targetCertificate: 'B2',
  deadline: '2027-06-30',
};

async function errorsFor(overrides) {
  const goal = new Goal({ ...VALID_GOAL, ...overrides });

  try {
    await goal.validate();
    return [];
  } catch (error) {
    return Object.keys(error.errors);
  }
}

test('Goal schema: applies defaults and timestamps', async () => {
  const goal = new Goal({
    student: STUDENT_ID,
    deadline: new Date('2027-06-30'),
  });

  await goal.validate();

  assert.equal(goal.student.toString(), STUDENT_ID);
  assert.equal(goal.targetCertificate, 'B2');
  assert.equal(goal.dailyMinutesTarget, 45);
  assert.equal(Goal.schema.path('student').options.ref, 'User');
  assert.ok(Goal.schema.path('createdAt'), 'timestamps must be enabled');
  assert.ok(Goal.schema.path('updatedAt'), 'timestamps must be enabled');
});

test('Goal schema: student and deadline are required', async () => {
  assert.ok((await errorsFor({ student: undefined })).includes('student'));
  assert.ok((await errorsFor({ deadline: undefined })).includes('deadline'));
});

test('Goal schema: targetCertificate is a strict B1/B2/C1 enum', async () => {
  assert.ok((await errorsFor({ targetCertificate: 'A2' })).includes('targetCertificate'));

  for (const targetCertificate of ['B1', 'B2', 'C1']) {
    assert.deepEqual(await errorsFor({ targetCertificate }), []);
  }
});

test('Goal schema: accepts valid dates and rejects unparseable dates', async () => {
  const goal = new Goal(VALID_GOAL);
  await goal.validate();
  assert.ok(goal.deadline instanceof Date);

  assert.ok((await errorsFor({ deadline: 'not-a-date' })).includes('deadline'));
});

test('Goal schema: defines a unique student index', () => {
  const indexes = Goal.schema.indexes();

  assert.ok(
    indexes.some(([fields, options]) => fields.student === 1 && options.unique === true),
    'student must have a unique index'
  );
});
