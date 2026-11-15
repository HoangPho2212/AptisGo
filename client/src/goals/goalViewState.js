import {
  MAX_DAILY_MINUTES,
  MAX_ROADMAP_DAYS,
  MIN_DAILY_MINUTES,
  calculateRemainingDays,
  validateDeadline,
} from './goalCadence.js';

export const GOAL_TARGETS = Object.freeze(['B1', 'B2']);
export const DEFAULT_DAILY_MINUTES = 45;

/**
 * @typedef {object} GoalViewState
 * @property {'idle'|'submitting'|'success'|'error'} status
 * @property {'B1'|'B2'} targetCertificate
 * @property {string} deadline
 * @property {number} dailyMinutesTarget
 * @property {{ targetCertificate?: string, deadline?: string, dailyMinutesTarget?: string }} fieldErrors
 * @property {{ message: string, details: string[] }|null} error
 * @property {{ goal: object, roadmap: object }|null} result
 */

/**
 * @returns {GoalViewState}
 */
export function createGoalViewState() {
  return {
    status: 'idle',
    targetCertificate: 'B2',
    deadline: '',
    dailyMinutesTarget: DEFAULT_DAILY_MINUTES,
    fieldErrors: {},
    error: null,
    result: null,
  };
}

/**
 * @param {GoalViewState} viewState
 * @param {string} field
 * @returns {Record<string, string>}
 */
function withoutFieldError(viewState, field) {
  const fieldErrors = { ...viewState.fieldErrors };

  delete fieldErrors[field];

  return fieldErrors;
}

/**
 * @param {GoalViewState} viewState
 * @param {string} targetCertificate
 * @returns {GoalViewState}
 */
export function withTarget(viewState, targetCertificate) {
  if (!GOAL_TARGETS.includes(targetCertificate)) {
    return viewState;
  }

  return {
    ...viewState,
    targetCertificate,
    fieldErrors: withoutFieldError(viewState, 'targetCertificate'),
  };
}

/**
 * @param {GoalViewState} viewState
 * @param {string} deadline
 * @returns {GoalViewState}
 */
export function withDeadline(viewState, deadline) {
  return {
    ...viewState,
    deadline: typeof deadline === 'string' ? deadline : '',
    fieldErrors: withoutFieldError(viewState, 'deadline'),
  };
}

/**
 * @param {GoalViewState} viewState
 * @param {number} dailyMinutesTarget
 * @returns {GoalViewState}
 */
export function withDailyMinutes(viewState, dailyMinutesTarget) {
  return {
    ...viewState,
    dailyMinutesTarget,
    fieldErrors: withoutFieldError(viewState, 'dailyMinutesTarget'),
  };
}

/**
 * @param {GoalViewState} viewState
 * @returns {GoalViewState}
 */
export function withGoalSubmitting(viewState) {
  return { ...viewState, status: 'submitting', error: null };
}

/**
 * @param {GoalViewState} viewState
 * @param {{ goal: object, roadmap: object }} result
 * @returns {GoalViewState}
 */
export function withGoalSuccess(viewState, result) {
  return {
    ...viewState,
    status: 'success',
    result,
    fieldErrors: {},
    error: null,
  };
}

/**
 * @param {GoalViewState} viewState
 * @param {{ message?: string, details?: string[] }} error
 * @returns {GoalViewState}
 */
export function withGoalError(viewState, error = {}) {
  return {
    ...viewState,
    status: 'error',
    error: {
      message:
        typeof error.message === 'string'
          ? error.message
          : 'Something went wrong. Please try again.',
      details: Array.isArray(error.details)
        ? error.details.filter((item) => typeof item === 'string')
        : [],
    },
  };
}

/**
 * @param {GoalViewState} viewState
 * @param {Date} [now]
 * @returns {{
 *   errors: Record<string, string>,
 *   value: { targetCertificate: 'B1'|'B2', deadline: string, dailyMinutesTarget: number }|null
 * }}
 */
export function validateGoalViewState(viewState, now = new Date()) {
  const errors = {};

  if (!GOAL_TARGETS.includes(viewState.targetCertificate)) {
    errors.targetCertificate = `targetCertificate must be one of: ${GOAL_TARGETS.join(', ')}`;
  }

  const deadlineError = validateDeadline(viewState.deadline, now);

  if (deadlineError) {
    errors.deadline = deadlineError;
  } else if (calculateRemainingDays(viewState.deadline, now) > MAX_ROADMAP_DAYS) {
    errors.deadline = `Deadline must be within ${MAX_ROADMAP_DAYS} days`;
  }

  const minutes = viewState.dailyMinutesTarget;

  if (
    typeof minutes !== 'number' ||
    !Number.isInteger(minutes) ||
    minutes < MIN_DAILY_MINUTES ||
    minutes > MAX_DAILY_MINUTES
  ) {
    errors.dailyMinutesTarget = `dailyMinutesTarget must be an integer between ${MIN_DAILY_MINUTES} and ${MAX_DAILY_MINUTES}`;
  }

  if (Object.keys(errors).length > 0) {
    return { errors, value: null };
  }

  return {
    errors,
    value: {
      targetCertificate: viewState.targetCertificate,
      deadline: viewState.deadline.trim(),
      dailyMinutesTarget: minutes,
    },
  };
}

/**
 * @param {GoalViewState} viewState
 * @returns {boolean}
 */
export function isGoalSubmitDisabled(viewState) {
  return viewState.status === 'submitting';
}
