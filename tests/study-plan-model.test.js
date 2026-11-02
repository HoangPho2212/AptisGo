const test = require('node:test');
const assert = require('node:assert/strict');

const StudyPlan = require('../server/src/models/StudyPlan');

const STUDENT_ID = '507f1f77bcf86cd799439012';
const VALID_TASK = {
  title: 'Reading Part 1 practice',
  skill: 'reading',
  partNumber: 1,
};
const VALID_PLAN = {
  student: STUDENT_ID,
  dayNumber: 1,
  dailyTasks: [VALID_TASK],
};

async function errorsFor(overrides) {
  const plan = new StudyPlan({ ...VALID_PLAN, ...overrides });

  try {
    await plan.validate();
    return [];
  } catch (error) {
    return Object.keys(error.errors);
  }
}

function hasError(errors, field) {
  return errors.some(
    (key) => key === field || key.startsWith(`${field}.`) || key.endsWith(`.${field}`)
  );
}

test('StudyPlan schema: embeds daily tasks for data locality', () => {
  const tasksPath = StudyPlan.schema.path('dailyTasks');

  assert.ok(tasksPath, 'dailyTasks path must exist');
  assert.ok(tasksPath.schema, 'dailyTasks must be a document array with an embedded schema');
  assert.ok(tasksPath.schema.path('title'));
  assert.ok(tasksPath.schema.path('skill'));
  assert.ok(tasksPath.schema.path('partNumber'));
  assert.equal(tasksPath.schema.path('isCompleted').options.default, false);
  assert.equal(StudyPlan.schema.path('tasks'), undefined);
});

test('StudyPlan schema: applies defaults and timestamps', async () => {
  const plan = new StudyPlan({
    student: STUDENT_ID,
    dayNumber: 1,
  });

  await plan.validate();

  assert.equal(plan.student.toString(), STUDENT_ID);
  assert.equal(plan.dayNumber, 1);
  assert.deepEqual(plan.dailyTasks, []);
  assert.equal(StudyPlan.schema.path('student').options.ref, 'User');
  assert.ok(StudyPlan.schema.path('createdAt'), 'timestamps must be enabled');
  assert.ok(StudyPlan.schema.path('updatedAt'), 'timestamps must be enabled');
});

test('StudyPlan schema: student and dayNumber are required', async () => {
  assert.ok(hasError(await errorsFor({ student: undefined }), 'student'));
  assert.ok(hasError(await errorsFor({ dayNumber: undefined }), 'dayNumber'));
});

test('StudyPlan schema: daily tasks default to incomplete with ten points', async () => {
  const plan = new StudyPlan(VALID_PLAN);

  await plan.validate();
  const task = plan.dailyTasks[0];

  assert.equal(task.title, VALID_TASK.title);
  assert.equal(task.skill, 'reading');
  assert.equal(task.partNumber, 1);
  assert.equal(task.points, 10);
  assert.equal(task.isCompleted, false);
  assert.ok(task._id, 'embedded tasks keep their own _id');
});

test('StudyPlan schema: task title, skill, and partNumber are required', async () => {
  for (const field of ['title', 'skill', 'partNumber']) {
    const task = { ...VALID_TASK };
    delete task[field];
    const errors = await errorsFor({ dailyTasks: [task] });

    assert.ok(hasError(errors, field), `missing dailyTasks[].${field} must fail validation`);
  }
});

test('StudyPlan schema: task skill is a strict enum', async () => {
  assert.ok(
    hasError(await errorsFor({ dailyTasks: [{ ...VALID_TASK, skill: 'grammar' }] }), 'skill'),
    'grammar must not be accepted as a study-plan skill'
  );

  for (const skill of ['core', 'listening', 'reading', 'writing', 'speaking']) {
    assert.deepEqual(await errorsFor({ dailyTasks: [{ ...VALID_TASK, skill }] }), []);
  }
});

test('StudyPlan schema: indexes the student reference', () => {
  const indexes = StudyPlan.schema.indexes();

  assert.ok(
    indexes.some(([fields]) => fields.student === 1),
    'student must be indexed'
  );
});
