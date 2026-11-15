import { describe, expect, it } from 'vitest';

import {
  MAX_ROADMAP_DAYS,
  calculateRemainingDays,
  calculateRoadmapPreview,
  calculateTasksPerDay,
  parseDeadlineEnd,
  todayIsoDate,
  validateDeadline,
} from '../client/src/goals/goalCadence.js';

const NOW = new Date('2026-11-15T10:00:00.000Z');

describe('goal cadence', () => {
  it('reads a date-only deadline as the end of its UTC day', () => {
    expect(parseDeadlineEnd('2026-12-15').toISOString()).toBe('2026-12-15T23:59:59.999Z');
  });

  it('rejects malformed and impossible dates', () => {
    expect(parseDeadlineEnd('15-12-2026')).toBeNull();
    expect(parseDeadlineEnd('2026-02-31')).toBeNull();
    expect(parseDeadlineEnd('2026-12-15T00:00:00.000Z')).toBeNull();
    expect(parseDeadlineEnd('')).toBeNull();
    expect(parseDeadlineEnd(null)).toBeNull();
  });

  it('rounds remaining days up from the end of the deadline day', () => {
    expect(calculateRemainingDays('2026-12-15', NOW)).toBe(31);
  });

  it('keeps a same-day deadline at one day remaining', () => {
    expect(calculateRemainingDays('2026-11-15', NOW)).toBe(1);
  });

  it('reports zero remaining days for a past deadline', () => {
    expect(calculateRemainingDays('2026-11-14', NOW)).toBe(0);
  });

  it('derives tasks per day from the daily minutes target', () => {
    expect(calculateTasksPerDay(45)).toBe(3);
    expect(calculateTasksPerDay(15)).toBe(1);
    expect(calculateTasksPerDay(20)).toBe(2);
    expect(calculateTasksPerDay(240)).toBe(8);
    expect(calculateTasksPerDay(600)).toBe(8);
    expect(calculateTasksPerDay(0)).toBe(1);
    expect(calculateTasksPerDay('45')).toBe(1);
  });

  it('previews the roadmap the server will generate', () => {
    expect(
      calculateRoadmapPreview({ deadline: '2026-12-15', dailyMinutesTarget: 45 }, NOW)
    ).toEqual({ remainingDays: 31, tasksPerDay: 3, totalTasks: 93 });
  });

  it('refuses to preview an invalid, past, or over-long roadmap', () => {
    expect(
      calculateRoadmapPreview({ deadline: '2026-02-31', dailyMinutesTarget: 45 }, NOW)
    ).toBeNull();
    expect(
      calculateRoadmapPreview({ deadline: '2026-11-14', dailyMinutesTarget: 45 }, NOW)
    ).toBeNull();
    expect(
      calculateRoadmapPreview({ deadline: '2035-01-01', dailyMinutesTarget: 45 }, NOW)
    ).toBeNull();
    expect(MAX_ROADMAP_DAYS).toBe(1825);
  });

  it('returns the API validation messages', () => {
    expect(validateDeadline('', NOW)).toBe('deadline is required');
    expect(validateDeadline(null, NOW)).toBe('deadline is required');
    expect(validateDeadline('2026-02-31', NOW)).toBe('deadline must be a valid ISO date');
    expect(validateDeadline('2026-11-14', NOW)).toBe('Deadline must be a future date');
    expect(validateDeadline('2026-12-15', NOW)).toBeNull();
  });

  it('formats the minimum selectable date in local time', () => {
    expect(todayIsoDate(new Date(2026, 10, 15, 22, 0, 0))).toBe('2026-11-15');
  });
});
