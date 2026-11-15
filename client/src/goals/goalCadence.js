export const MIN_DAILY_MINUTES = 15;
export const MAX_DAILY_MINUTES = 240;
export const MINUTES_PER_TASK = 15;
export const MIN_TASKS_PER_DAY = 1;
export const MAX_TASKS_PER_DAY = 8;
export const MAX_ROADMAP_DAYS = 1825;
export const DAY_MS = 86_400_000;

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Parse a date-only deadline as the end of that UTC day, matching
 * `server/src/services/roadmapGenerator.js`.
 *
 * @param {unknown} deadline
 * @returns {Date|null}
 */
export function parseDeadlineEnd(deadline) {
  if (typeof deadline !== 'string') {
    return null;
  }

  const match = DATE_ONLY_PATTERN.exec(deadline.trim());

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const end = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));

  if (
    end.getUTCFullYear() !== year ||
    end.getUTCMonth() !== month - 1 ||
    end.getUTCDate() !== day
  ) {
    return null;
  }

  return end;
}

/**
 * @param {unknown} deadline
 * @param {Date} [now]
 * @returns {number} 0 when the deadline is invalid or already past
 */
export function calculateRemainingDays(deadline, now = new Date()) {
  const end = parseDeadlineEnd(deadline);

  if (!end) {
    return 0;
  }

  const difference = end.getTime() - now.getTime();

  if (difference <= 0) {
    return 0;
  }

  return Math.max(1, Math.ceil(difference / DAY_MS));
}

/**
 * @param {unknown} dailyMinutesTarget
 * @returns {number}
 */
export function calculateTasksPerDay(dailyMinutesTarget) {
  if (
    typeof dailyMinutesTarget !== 'number' ||
    !Number.isFinite(dailyMinutesTarget) ||
    dailyMinutesTarget <= 0
  ) {
    return MIN_TASKS_PER_DAY;
  }

  const tasks = Math.ceil(dailyMinutesTarget / MINUTES_PER_TASK);

  return Math.min(MAX_TASKS_PER_DAY, Math.max(MIN_TASKS_PER_DAY, tasks));
}

/**
 * @param {{ deadline?: unknown, dailyMinutesTarget?: unknown }} goal
 * @param {Date} [now]
 * @returns {{ remainingDays: number, tasksPerDay: number, totalTasks: number }|null}
 */
export function calculateRoadmapPreview(goal = {}, now = new Date()) {
  const remainingDays = calculateRemainingDays(goal.deadline, now);

  if (remainingDays === 0 || remainingDays > MAX_ROADMAP_DAYS) {
    return null;
  }

  const tasksPerDay = calculateTasksPerDay(goal.dailyMinutesTarget);

  return {
    remainingDays,
    tasksPerDay,
    totalTasks: remainingDays * tasksPerDay,
  };
}

/**
 * Local calendar date used as the date input minimum.
 *
 * @param {Date} [now]
 * @returns {string}
 */
export function todayIsoDate(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/**
 * @param {unknown} deadline
 * @param {Date} [now]
 * @returns {string|null} the API-compatible message, or null when valid
 */
export function validateDeadline(deadline, now = new Date()) {
  if (deadline === undefined || deadline === null) {
    return 'deadline is required';
  }

  if (typeof deadline !== 'string' || deadline.trim() === '') {
    return 'deadline is required';
  }

  const end = parseDeadlineEnd(deadline);

  if (!end) {
    return 'deadline must be a valid ISO date';
  }

  if (end.getTime() <= now.getTime()) {
    return 'Deadline must be a future date';
  }

  return null;
}
