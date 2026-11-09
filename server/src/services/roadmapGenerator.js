const DAY_MS = 86_400_000;
const MINUTES_PER_TASK = 15;
const MIN_TASKS_PER_DAY = 1;
const MAX_TASKS_PER_DAY = 8;
const MAX_ROADMAP_DAYS = 1825;
const TASK_POINTS = 10;

const DAILY_TASK_TEMPLATES = Object.freeze([
  { skill: 'core', partNumber: 1, title: 'Core Part 1: Grammar practice' },
  { skill: 'listening', partNumber: 1, title: 'Listening Part 1: Information matching' },
  { skill: 'reading', partNumber: 1, title: 'Reading Part 1: Sentence completion' },
  { skill: 'writing', partNumber: 1, title: 'Writing Part 1: Form completion' },
  { skill: 'speaking', partNumber: 1, title: 'Speaking Part 1: Personal information' },
  { skill: 'core', partNumber: 2, title: 'Core Part 2: Vocabulary practice' },
  { skill: 'listening', partNumber: 2, title: 'Listening Part 2: Opinion matching' },
  { skill: 'reading', partNumber: 2, title: 'Reading Part 2: Sentence ordering' },
  { skill: 'writing', partNumber: 2, title: 'Writing Part 2: Short text' },
  { skill: 'speaking', partNumber: 2, title: 'Speaking Part 2: Picture description' },
  { skill: 'listening', partNumber: 3, title: 'Listening Part 3: Monologue completion' },
  { skill: 'reading', partNumber: 3, title: 'Reading Part 3: Opinion matching' },
  { skill: 'writing', partNumber: 3, title: 'Writing Part 3: Chat replies' },
  { skill: 'speaking', partNumber: 3, title: 'Speaking Part 3: Picture comparison' },
  { skill: 'listening', partNumber: 4, title: 'Listening Part 4: Long conversation' },
  { skill: 'reading', partNumber: 4, title: 'Reading Part 4: Heading matching' },
  { skill: 'writing', partNumber: 4, title: 'Writing Part 4: Formal email' },
  { skill: 'speaking', partNumber: 4, title: 'Speaking Part 4: Abstract discussion' },
]);

class RoadmapError extends Error {
  /**
   * @param {string} message
   * @param {number} [statusCode]
   */
  constructor(message, statusCode = 400) {
    super(message);
    this.name = 'RoadmapError';
    this.statusCode = statusCode;
  }
}

/**
 * @returns {never}
 */
function invalidDeadline() {
  throw new RoadmapError('Deadline must be a valid ISO date');
}

/**
 * Parse a date-only value as the end of its UTC day, or parse an exact ISO
 * datetime. Past deadlines are rejected with the STP TC04 message.
 *
 * @param {string | Date} value
 * @param {Date} [now]
 * @returns {Date}
 */
function parseDeadline(value, now = new Date()) {
  let deadline;

  if (value instanceof Date) {
    deadline = new Date(value.getTime());

    if (!Number.isFinite(deadline.getTime())) {
      invalidDeadline();
    }
  } else if (typeof value === 'string') {
    const trimmed = value.trim();
    const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);

    if (dateOnly) {
      const year = Number(dateOnly[1]);
      const month = Number(dateOnly[2]);
      const day = Number(dateOnly[3]);

      deadline = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));

      if (
        deadline.getUTCFullYear() !== year ||
        deadline.getUTCMonth() !== month - 1 ||
        deadline.getUTCDate() !== day
      ) {
        invalidDeadline();
      }
    } else {
      deadline = new Date(trimmed);

      if (!Number.isFinite(deadline.getTime())) {
        invalidDeadline();
      }
    }
  } else {
    invalidDeadline();
  }

  if (deadline.getTime() <= now.getTime()) {
    throw new RoadmapError('Deadline must be a future date');
  }

  return deadline;
}

/**
 * @param {Date} deadline
 * @param {Date} [now]
 * @returns {number}
 */
function calculateRemainingDays(deadline, now = new Date()) {
  const difference = deadline.getTime() - now.getTime();
  return Math.max(1, Math.ceil(difference / DAY_MS));
}

/**
 * @param {number} dailyMinutesTarget
 * @returns {number}
 */
function calculateTasksPerDay(dailyMinutesTarget) {
  if (!Number.isFinite(dailyMinutesTarget) || dailyMinutesTarget <= 0) {
    return MIN_TASKS_PER_DAY;
  }

  const requested = Math.ceil(dailyMinutesTarget / MINUTES_PER_TASK);
  return Math.min(MAX_TASKS_PER_DAY, Math.max(MIN_TASKS_PER_DAY, requested));
}

/**
 * @param {number} dayNumber
 * @param {number} tasksPerDay
 * @returns {Array<{
 *   title: string,
 *   skill: 'core'|'listening'|'reading'|'writing'|'speaking',
 *   partNumber: number,
 *   points: number,
 *   isCompleted: boolean
 * }>}
 */
function buildDailyTasks(dayNumber, tasksPerDay) {
  const taskCount = Math.min(
    MAX_TASKS_PER_DAY,
    Math.max(MIN_TASKS_PER_DAY, Math.trunc(tasksPerDay) || MIN_TASKS_PER_DAY)
  );
  const firstTemplate = ((Math.max(1, dayNumber) - 1) * taskCount) % DAILY_TASK_TEMPLATES.length;

  return Array.from({ length: taskCount }, (_unused, offset) => {
    const template = DAILY_TASK_TEMPLATES[(firstTemplate + offset) % DAILY_TASK_TEMPLATES.length];

    return {
      title: template.title,
      skill: template.skill,
      partNumber: template.partNumber,
      points: TASK_POINTS,
      isCompleted: false,
    };
  });
}

/**
 * @param {{
 *   targetCertificate: 'B1'|'B2'|'C1',
 *   deadline: string | Date,
 *   dailyMinutesTarget: number,
 *   now?: Date
 * }} input
 * @returns {{
 *   deadline: Date,
 *   remainingDays: number,
 *   tasksPerDay: number,
 *   days: Array<{ dayNumber: number, dailyTasks: Array<object> }>
 * }}
 */
function buildRoadmap(input) {
  const now = input.now ?? new Date();
  const deadline = parseDeadline(input.deadline, now);
  const remainingDays = calculateRemainingDays(deadline, now);

  if (remainingDays > MAX_ROADMAP_DAYS) {
    throw new RoadmapError(`Deadline must be within ${MAX_ROADMAP_DAYS} days`);
  }

  const tasksPerDay = calculateTasksPerDay(input.dailyMinutesTarget);
  const days = Array.from({ length: remainingDays }, (_unused, index) => {
    const dayNumber = index + 1;

    return {
      dayNumber,
      dailyTasks: buildDailyTasks(dayNumber, tasksPerDay),
    };
  });

  return {
    deadline,
    remainingDays,
    tasksPerDay,
    days,
  };
}

module.exports = {
  DAY_MS,
  MINUTES_PER_TASK,
  MIN_TASKS_PER_DAY,
  MAX_TASKS_PER_DAY,
  MAX_ROADMAP_DAYS,
  TASK_POINTS,
  DAILY_TASK_TEMPLATES,
  RoadmapError,
  parseDeadline,
  calculateRemainingDays,
  calculateTasksPerDay,
  buildDailyTasks,
  buildRoadmap,
};
