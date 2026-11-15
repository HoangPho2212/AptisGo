const PERCENT_SCALE = 10;

/**
 * Treat missing, negative, or non-finite counts as zero.
 *
 * @param {unknown} value
 * @returns {number}
 */
function toCount(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
}

/**
 * Percentage with one decimal place, clamped to 0-100. One decimal keeps the
 * first completion of a long roadmap visible (1 of 699 is 0.1, not 0).
 *
 * @param {number} completedTasks
 * @param {number} totalTasks
 * @returns {number}
 */
function calculatePercent(completedTasks, totalTasks) {
  const completed = toCount(completedTasks);
  const total = toCount(totalTasks);

  if (total === 0) {
    return 0;
  }

  const raw = (completed / total) * 100;
  const clamped = Math.min(100, Math.max(0, raw));

  return Math.round(clamped * PERCENT_SCALE) / PERCENT_SCALE;
}

/**
 * Derive completion and points for one day plan, or for a roadmap when the
 * caller passes aggregated task data.
 *
 * @param {Array<{ isCompleted?: boolean, points?: number }>} dailyTasks
 * @returns {{
 *   completedTasks: number,
 *   totalTasks: number,
 *   percent: number,
 *   completedPoints: number,
 *   totalPoints: number
 * }}
 */
function calculateTaskProgress(dailyTasks = []) {
  const tasks = Array.isArray(dailyTasks) ? dailyTasks : [];

  let completedTasks = 0;
  let completedPoints = 0;
  let totalPoints = 0;

  for (const task of tasks) {
    const points = Number.isFinite(task?.points) ? task.points : 0;

    totalPoints += points;

    if (task?.isCompleted === true) {
      completedTasks += 1;
      completedPoints += points;
    }
  }

  return {
    completedTasks,
    totalTasks: tasks.length,
    percent: calculatePercent(completedTasks, tasks.length),
    completedPoints,
    totalPoints,
  };
}

module.exports = {
  PERCENT_SCALE,
  calculatePercent,
  calculateTaskProgress,
};
