const test = require('node:test');
const assert = require('node:assert/strict');

const {
  MINUTES_PER_TASK,
  MIN_TASKS_PER_DAY,
  MAX_TASKS_PER_DAY,
  MAX_ROADMAP_DAYS,
  RoadmapError,
  parseDeadline,
  calculateRemainingDays,
  calculateTasksPerDay,
  buildDailyTasks,
  buildRoadmap,
} = require('../server/src/services/roadmapGenerator');

const NOW = new Date('2026-11-09T12:00:00.000Z');

test('Roadmap generator: exports the planning bounds', () => {
  assert.equal(MINUTES_PER_TASK, 15);
  assert.equal(MIN_TASKS_PER_DAY, 1);
  assert.equal(MAX_TASKS_PER_DAY, 8);
  assert.equal(MAX_ROADMAP_DAYS, 1825);
});

test('Roadmap generator: interprets a date-only deadline as end of the UTC day', () => {
  const deadline = parseDeadline('2026-11-18', NOW);

  assert.equal(deadline.toISOString(), '2026-11-18T23:59:59.999Z');
});

test('Roadmap generator: accepts an exact ISO datetime deadline', () => {
  const deadline = parseDeadline('2026-11-18T09:30:00.000Z', NOW);

  assert.equal(deadline.toISOString(), '2026-11-18T09:30:00.000Z');
});

test('Roadmap generator: accepts a Date instance', () => {
  const input = new Date('2026-11-18T09:30:00.000Z');
  const deadline = parseDeadline(input, NOW);

  assert.equal(deadline.toISOString(), input.toISOString());
});

test('Roadmap generator: rejects invalid calendar dates and unparseable values', () => {
  for (const value of [
    '2026-02-31',
    '2026-13-01',
    '2026-00-10',
    'not-a-date',
    '2026-06-30T25:00:00Z',
  ]) {
    assert.throws(
      () => parseDeadline(value, NOW),
      (error) =>
        error instanceof RoadmapError &&
        error.statusCode === 400 &&
        error.message === 'Deadline must be a valid ISO date'
    );
  }
});

test('Roadmap generator: rejects a past deadline with the STP TC04 message', () => {
  assert.throws(
    () => parseDeadline('2026-11-08', NOW),
    (error) =>
      error instanceof RoadmapError &&
      error.statusCode === 400 &&
      error.message === 'Deadline must be a future date'
  );
});

test('Roadmap generator: allows a date-only deadline later today', () => {
  const deadline = parseDeadline('2026-11-09', NOW);

  assert.equal(deadline.toISOString(), '2026-11-09T23:59:59.999Z');
  assert.equal(calculateRemainingDays(deadline, NOW), 1);
});

test('Roadmap generator: rounds remaining time up to whole days', () => {
  assert.equal(calculateRemainingDays(new Date('2026-11-10T12:00:00.000Z'), NOW), 1);
  assert.equal(calculateRemainingDays(new Date('2026-11-10T12:00:00.001Z'), NOW), 2);
  assert.equal(calculateRemainingDays(new Date('2026-11-18T23:59:59.999Z'), NOW), 10);
  assert.equal(calculateRemainingDays(new Date(NOW), NOW), 1);
});

test('Roadmap generator: derives tasks per day from the cadence and caps it', () => {
  assert.equal(calculateTasksPerDay(15), 1);
  assert.equal(calculateTasksPerDay(30), 2);
  assert.equal(calculateTasksPerDay(45), 3);
  assert.equal(calculateTasksPerDay(60), 4);
  assert.equal(calculateTasksPerDay(120), 8);
  assert.equal(calculateTasksPerDay(240), 8);
  assert.equal(calculateTasksPerDay(1), 1);
  assert.equal(calculateTasksPerDay(0), 1);
});

test('Roadmap generator: day one rotates through core, listening, and reading', () => {
  assert.deepEqual(buildDailyTasks(1, 3), [
    {
      title: 'Core Part 1: Grammar practice',
      skill: 'core',
      partNumber: 1,
      points: 10,
      isCompleted: false,
    },
    {
      title: 'Listening Part 1: Information matching',
      skill: 'listening',
      partNumber: 1,
      points: 10,
      isCompleted: false,
    },
    {
      title: 'Reading Part 1: Sentence completion',
      skill: 'reading',
      partNumber: 1,
      points: 10,
      isCompleted: false,
    },
  ]);
});

test('Roadmap generator: later days continue the rotation without repeats', () => {
  const dayTwo = buildDailyTasks(2, 3);

  assert.deepEqual(
    dayTwo.map((task) => task.title),
    [
      'Writing Part 1: Form completion',
      'Speaking Part 1: Personal information',
      'Core Part 2: Vocabulary practice',
    ]
  );

  const dayOneFull = buildDailyTasks(1, 8);
  assert.equal(dayOneFull.length, 8);
  assert.equal(new Set(dayOneFull.map((task) => task.title)).size, 8);
});

test('Roadmap generator: builds one plan day per remaining day', () => {
  const roadmap = buildRoadmap({
    targetCertificate: 'B2',
    deadline: '2026-11-18',
    dailyMinutesTarget: 45,
    now: NOW,
  });

  assert.equal(roadmap.deadline.toISOString(), '2026-11-18T23:59:59.999Z');
  assert.equal(roadmap.remainingDays, 10);
  assert.equal(roadmap.tasksPerDay, 3);
  assert.equal(roadmap.days.length, 10);
  assert.equal(roadmap.days[0].dayNumber, 1);
  assert.equal(roadmap.days[0].dailyTasks.length, 3);
  assert.equal(roadmap.days[9].dayNumber, 10);
  assert.equal(roadmap.days[9].dailyTasks.length, 3);
});

test('Roadmap generator: rejects a deadline beyond the five-year cap', () => {
  assert.throws(
    () =>
      buildRoadmap({
        targetCertificate: 'C1',
        deadline: '2032-01-01',
        dailyMinutesTarget: 45,
        now: NOW,
      }),
    (error) =>
      error instanceof RoadmapError &&
      error.statusCode === 400 &&
      error.message === 'Deadline must be within 1825 days'
  );
});

test('Roadmap generator: uses the cadence for the whole roadmap', () => {
  const roadmap = buildRoadmap({
    targetCertificate: 'C1',
    deadline: '2026-11-18',
    dailyMinutesTarget: 120,
    now: NOW,
  });

  assert.equal(roadmap.tasksPerDay, 8);
  for (const day of roadmap.days) {
    assert.equal(day.dailyTasks.length, 8);
  }
});
