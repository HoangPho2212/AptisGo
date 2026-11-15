const test = require('node:test');
const assert = require('node:assert/strict');

const {
  calculatePercent,
  calculateTaskProgress,
} = require('../server/src/services/studyPlanProgress');

test('Study plan progress: percent is zero when there are no tasks', () => {
  assert.equal(calculatePercent(0, 0), 0);
  assert.equal(calculatePercent(0, 0), 0);
});

test('Study plan progress: percent never divides by zero or returns NaN', () => {
  for (const [completed, total] of [
    [1, 0],
    [-1, 0],
    [NaN, 3],
    [1, NaN],
    [1, Infinity],
    [Infinity, 3],
  ]) {
    const percent = calculatePercent(completed, total);

    assert.equal(Number.isFinite(percent), true, `${completed}/${total} must be finite`);
    assert.equal(percent, 0, `${completed}/${total} must fall back to 0`);
  }
});

test('Study plan progress: percent keeps one decimal place', () => {
  assert.equal(calculatePercent(1, 3), 33.3);
  assert.equal(calculatePercent(2, 3), 66.7);
  assert.equal(calculatePercent(1, 4), 25);
  assert.equal(calculatePercent(0, 3), 0);
  assert.equal(calculatePercent(3, 3), 100);
});

test('Study plan progress: a single completion in a long roadmap stays visible', () => {
  assert.equal(calculatePercent(1, 699), 0.1);
  assert.equal(calculatePercent(7, 699), 1);
});

test('Study plan progress: percent is clamped to the 0-100 range', () => {
  assert.equal(calculatePercent(5, 3), 100);
  assert.equal(calculatePercent(-2, 3), 0);
  assert.equal(calculatePercent(3, -3), 0);
});

test('Study plan progress: an empty plan reports zeroed totals', () => {
  assert.deepEqual(calculateTaskProgress([]), {
    completedTasks: 0,
    totalTasks: 0,
    percent: 0,
    completedPoints: 0,
    totalPoints: 0,
  });

  assert.deepEqual(calculateTaskProgress(), {
    completedTasks: 0,
    totalTasks: 0,
    percent: 0,
    completedPoints: 0,
    totalPoints: 0,
  });
});

test('Study plan progress: counts completed tasks and earned points', () => {
  const progress = calculateTaskProgress([
    { isCompleted: true, points: 10 },
    { isCompleted: false, points: 10 },
    { isCompleted: false, points: 10 },
  ]);

  assert.deepEqual(progress, {
    completedTasks: 1,
    totalTasks: 3,
    percent: 33.3,
    completedPoints: 10,
    totalPoints: 30,
  });
});

test('Study plan progress: a fully completed plan reports 100 percent', () => {
  const progress = calculateTaskProgress([
    { isCompleted: true, points: 10 },
    { isCompleted: true, points: 10 },
  ]);

  assert.deepEqual(progress, {
    completedTasks: 2,
    totalTasks: 2,
    percent: 100,
    completedPoints: 20,
    totalPoints: 20,
  });
});

test('Study plan progress: only a real boolean true counts as completed', () => {
  const progress = calculateTaskProgress([
    { isCompleted: true, points: 10 },
    { isCompleted: 'true', points: 10 },
    { isCompleted: 1, points: 10 },
  ]);

  assert.equal(progress.completedTasks, 1);
  assert.equal(progress.completedPoints, 10);
});

test('Study plan progress: a task without points contributes zero points', () => {
  const progress = calculateTaskProgress([
    { isCompleted: true },
    { isCompleted: false, points: 10 },
  ]);

  assert.deepEqual(progress, {
    completedTasks: 1,
    totalTasks: 2,
    percent: 50,
    completedPoints: 0,
    totalPoints: 10,
  });
});
