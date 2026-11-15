export const DASHBOARD_STATUS = Object.freeze({
  LOADING: 'loading',
  READY: 'ready',
  EMPTY: 'empty',
  ERROR: 'error',
});

export const GOAL_NOT_FOUND_MESSAGE = 'Goal not found';
export const INCOMPLETE_PAYLOAD_MESSAGE = 'The study plan response was incomplete.';
export const DEFAULT_ERROR_MESSAGE = 'Something went wrong. Please try again.';
export const EMPTY_DASHBOARD_MESSAGE =
  'You have not set a study goal yet. Set your goal to generate today’s roadmap.';

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isTask(value) {
  return (
    isPlainObject(value) &&
    typeof value.id === 'string' &&
    typeof value.title === 'string' &&
    typeof value.skill === 'string' &&
    isFiniteNumber(value.partNumber) &&
    isFiniteNumber(value.points) &&
    typeof value.isCompleted === 'boolean'
  );
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isProgressBlock(value) {
  return (
    isPlainObject(value) &&
    isFiniteNumber(value.completedTasks) &&
    isFiniteNumber(value.totalTasks) &&
    isFiniteNumber(value.percent) &&
    isFiniteNumber(value.completedPoints) &&
    isFiniteNumber(value.totalPoints)
  );
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isTodayPlanPayload(value) {
  return (
    isPlainObject(value) &&
    isPlainObject(value.goal) &&
    typeof value.goal.id === 'string' &&
    typeof value.goal.targetCertificate === 'string' &&
    typeof value.goal.deadline === 'string' &&
    isFiniteNumber(value.goal.dailyMinutesTarget) &&
    isPlainObject(value.day) &&
    typeof value.day.id === 'string' &&
    Number.isInteger(value.day.dayNumber) &&
    Number.isInteger(value.day.totalDays) &&
    Array.isArray(value.day.tasks) &&
    value.day.tasks.every(isTask) &&
    isProgressBlock(value.progress) &&
    isProgressBlock(value.roadmap)
  );
}

/**
 * @param {Date} [now]
 * @returns {string}
 */
function toIsoString(now = new Date()) {
  return now instanceof Date && Number.isFinite(now.getTime())
    ? now.toISOString()
    : new Date().toISOString();
}

/**
 * @param {{ message?: string, details?: string[] }} error
 * @returns {{ message: string, details: string[] }}
 */
function normalizeError(error = {}) {
  return {
    message:
      typeof error.message === 'string' && error.message.length > 0
        ? error.message
        : DEFAULT_ERROR_MESSAGE,
    details: Array.isArray(error.details)
      ? error.details.filter((item) => typeof item === 'string')
      : [],
  };
}

/**
 * @typedef {object} DashboardViewState
 * @property {'loading'|'ready'|'empty'|'error'} status
 * @property {object|null} data
 * @property {string|null} pendingTaskId
 * @property {{ message: string, details: string[] }|null} error
 * @property {string|null} lastUpdatedAt
 */

/**
 * @returns {DashboardViewState}
 */
export function createDashboardViewState() {
  return {
    status: DASHBOARD_STATUS.LOADING,
    data: null,
    pendingTaskId: null,
    error: null,
    lastUpdatedAt: null,
  };
}

/**
 * @param {DashboardViewState} viewState
 * @returns {DashboardViewState}
 */
export function withDashboardLoading(viewState) {
  return {
    ...viewState,
    status: DASHBOARD_STATUS.LOADING,
    pendingTaskId: null,
    error: null,
  };
}

/**
 * @param {DashboardViewState} viewState
 * @param {object} data
 * @param {Date} [now]
 * @returns {DashboardViewState}
 */
export function withTodayPlan(viewState, data, now = new Date()) {
  if (!isTodayPlanPayload(data)) {
    return withDashboardError(viewState, { message: INCOMPLETE_PAYLOAD_MESSAGE });
  }

  return {
    ...viewState,
    status: DASHBOARD_STATUS.READY,
    data,
    pendingTaskId: null,
    error: null,
    lastUpdatedAt: toIsoString(now),
  };
}

/**
 * @param {DashboardViewState} viewState
 * @param {string} [message]
 * @returns {DashboardViewState}
 */
export function withDashboardEmpty(viewState, message = EMPTY_DASHBOARD_MESSAGE) {
  return {
    ...viewState,
    status: DASHBOARD_STATUS.EMPTY,
    data: null,
    pendingTaskId: null,
    error: normalizeError({ message }),
  };
}

/**
 * @param {DashboardViewState} viewState
 * @param {{ message?: string, details?: string[] }} [error]
 * @returns {DashboardViewState}
 */
export function withDashboardError(viewState, error = {}) {
  return {
    ...viewState,
    status: DASHBOARD_STATUS.ERROR,
    pendingTaskId: null,
    error: normalizeError(error),
  };
}

/**
 * @param {object|null} data
 * @param {string} taskId
 * @returns {object|null}
 */
export function findTask(data, taskId) {
  const tasks = data?.day?.tasks;

  if (!Array.isArray(tasks)) {
    return null;
  }

  return tasks.find((task) => task && task.id === taskId) ?? null;
}

/**
 * @param {DashboardViewState} viewState
 * @param {string} taskId
 * @returns {DashboardViewState}
 */
export function withTaskPending(viewState, taskId) {
  if (viewState.status !== DASHBOARD_STATUS.READY || !findTask(viewState.data, taskId)) {
    return viewState;
  }

  return {
    ...viewState,
    pendingTaskId: taskId,
    error: null,
  };
}

/**
 * @param {DashboardViewState} viewState
 * @param {{
 *   taskId: string,
 *   isCompleted: boolean,
 *   plan?: object,
 *   roadmap?: object
 * }} update
 * @param {Date} [now]
 * @returns {DashboardViewState}
 */
export function withTaskUpdated(viewState, update, now = new Date()) {
  if (viewState.status !== DASHBOARD_STATUS.READY) {
    return viewState;
  }

  const { taskId, isCompleted } = update;
  const task = findTask(viewState.data, taskId);

  if (!task) {
    return viewState;
  }

  return {
    ...viewState,
    data: {
      ...viewState.data,
      day: {
        ...viewState.data.day,
        tasks: viewState.data.day.tasks.map((entry) =>
          entry.id === taskId ? { ...entry, isCompleted } : entry
        ),
      },
      progress: isProgressBlock(update.plan) ? update.plan : viewState.data.progress,
      roadmap: isProgressBlock(update.roadmap) ? update.roadmap : viewState.data.roadmap,
    },
    pendingTaskId: null,
    error: null,
    lastUpdatedAt: toIsoString(now),
  };
}

/**
 * @param {DashboardViewState} viewState
 * @param {{ message?: string, details?: string[] }} [error]
 * @returns {DashboardViewState}
 */
export function withTaskError(viewState, error = {}) {
  return {
    ...viewState,
    pendingTaskId: null,
    error: normalizeError(error),
  };
}

/**
 * @param {DashboardViewState} viewState
 * @param {string} taskId
 * @returns {boolean}
 */
export function isTaskToggleDisabled(viewState, taskId) {
  if (viewState.status !== DASHBOARD_STATUS.READY || !findTask(viewState.data, taskId)) {
    return true;
  }

  return viewState.pendingTaskId !== null;
}

/**
 * @param {object|null} data
 * @returns {{ completedTasks: number, totalTasks: number, allComplete: boolean }}
 */
export function summarizeToday(data) {
  const completedTasks = data?.progress?.completedTasks ?? 0;
  const totalTasks = data?.progress?.totalTasks ?? 0;

  return {
    completedTasks,
    totalTasks,
    allComplete: totalTasks > 0 && completedTasks === totalTasks,
  };
}
