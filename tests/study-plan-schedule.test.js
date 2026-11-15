const test = require('node:test');
const assert = require('node:assert/strict');

const { calculateCurrentDayNumber } = require('../server/src/services/studyPlanSchedule');

const DAY_MS = 86_400_000;

test('calculateCurrentDayNumber returns 1 on the goal creation UTC day', () => {
  const createdAt = new Date('2026-11-15T08:00:00.000Z');
  const now = new Date('2026-11-15T22:45:00.000Z');

  assert.equal(calculateCurrentDayNumber({ createdAt, totalDays: 31, now }), 1);
});

test('calculateCurrentDayNumber rolls over at UTC midnight', () => {
  const createdAt = new Date('2026-11-15T23:30:00.000Z');
  const now = new Date('2026-11-16T00:10:00.000Z');

  assert.equal(calculateCurrentDayNumber({ createdAt, totalDays: 31, now }), 2);
});

test('calculateCurrentDayNumber counts elapsed UTC days', () => {
  const createdAt = new Date('2026-11-01T12:00:00.000Z');
  const now = new Date('2026-11-30T12:00:00.000Z');

  assert.equal(calculateCurrentDayNumber({ createdAt, totalDays: 60, now }), 30);
});

test('calculateCurrentDayNumber clamps to the last stored day', () => {
  const createdAt = new Date('2026-09-01T00:00:00.000Z');
  const now = new Date('2026-11-15T00:00:00.000Z');

  assert.equal(calculateCurrentDayNumber({ createdAt, totalDays: 31, now }), 31);
});

test('calculateCurrentDayNumber returns 1 for a future or invalid createdAt', () => {
  const now = new Date('2026-11-15T00:00:00.000Z');

  assert.equal(
    calculateCurrentDayNumber({
      createdAt: new Date(now.getTime() + DAY_MS),
      totalDays: 31,
      now,
    }),
    1
  );
  assert.equal(calculateCurrentDayNumber({ createdAt: 'not-a-date', totalDays: 31, now }), 1);
  assert.equal(calculateCurrentDayNumber({ createdAt: null, totalDays: 31, now }), 1);
});

test('calculateCurrentDayNumber returns 1 when totalDays is missing or zero', () => {
  const createdAt = new Date('2026-11-01T00:00:00.000Z');
  const now = new Date('2026-11-15T00:00:00.000Z');

  assert.equal(calculateCurrentDayNumber({ createdAt, totalDays: 0, now }), 1);
  assert.equal(calculateCurrentDayNumber({ createdAt, totalDays: Number.NaN, now }), 1);
  assert.equal(calculateCurrentDayNumber({ createdAt, now }), 1);
});

test('calculateCurrentDayNumber accepts an ISO string createdAt', () => {
  const now = new Date('2026-11-17T09:00:00.000Z');

  assert.equal(
    calculateCurrentDayNumber({ createdAt: '2026-11-15T09:00:00.000Z', totalDays: 31, now }),
    3
  );
});
