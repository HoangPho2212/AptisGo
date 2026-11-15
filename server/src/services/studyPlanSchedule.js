const { DAY_MS } = require('./roadmapGenerator');

const MIN_DAY_NUMBER = 1;

/**
 * Milliseconds since the Unix epoch at 00:00 UTC of the given date.
 *
 * @param {Date} date
 * @returns {number}
 */
function utcStartOfDayTimestamp(date) {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/**
 * @param {unknown} value
 * @returns {Date|null}
 */
function toDate(value) {
  if (value instanceof Date) {
    return value;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    return new Date(value);
  }

  return null;
}

/**
 * Study plans carry a day number, not a calendar date. Day 1 is the UTC day on
 * which the goal was created; every following UTC day adds one. The result is
 * clamped to the stored roadmap so it always points at an existing plan.
 *
 * @param {{
 *   createdAt?: Date|string|number|null,
 *   totalDays?: number,
 *   now?: Date
 * }} input
 * @returns {number} 1-based day number
 */
function calculateCurrentDayNumber({ createdAt, totalDays, now = new Date() } = {}) {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) {
    return MIN_DAY_NUMBER;
  }

  const created = toDate(createdAt);

  if (!created || !Number.isFinite(created.getTime())) {
    return MIN_DAY_NUMBER;
  }

  const total = Number.isInteger(totalDays) && totalDays > 0 ? totalDays : MIN_DAY_NUMBER;
  const elapsedDays = Math.floor(
    (utcStartOfDayTimestamp(now) - utcStartOfDayTimestamp(created)) / DAY_MS
  );
  const dayNumber = elapsedDays + 1;

  if (!Number.isFinite(dayNumber)) {
    return MIN_DAY_NUMBER;
  }

  return Math.min(total, Math.max(MIN_DAY_NUMBER, dayNumber));
}

module.exports = {
  MIN_DAY_NUMBER,
  calculateCurrentDayNumber,
};
