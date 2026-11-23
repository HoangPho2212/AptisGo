import { EXAM_VIEW_STATE_VERSION } from './examViewState.js';

export const EXAM_PROGRESS_PREFIX = 'aptis-go:exam-progress';

const SAVABLE_STATUSES = Object.freeze(['ready', 'submitting', 'submitted']);

/**
 * @typedef {object} StoredExamProgress
 * @property {1} version
 * @property {string} testId
 * @property {string} startedAt
 * @property {string} expiresAt
 * @property {Record<string, unknown>} answers
 * @property {Record<string, true>} [flags]
 * @property {string|null} submittedAt
 * @property {boolean} autoSubmitted
 * @property {object|null} result
 * @property {string} updatedAt
 */

/**
 * @param {string} testId
 * @returns {string}
 */
export function examProgressKey(testId) {
  return `${EXAM_PROGRESS_PREFIX}:${String(testId)}`;
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isValidProgress(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    value.version === EXAM_VIEW_STATE_VERSION &&
    typeof value.testId === 'string' &&
    value.testId.length > 0 &&
    typeof value.startedAt === 'string' &&
    typeof value.expiresAt === 'string' &&
    value.answers !== null &&
    typeof value.answers === 'object' &&
    !Array.isArray(value.answers) &&
    (value.flags === undefined ||
      (value.flags !== null && typeof value.flags === 'object' && !Array.isArray(value.flags))) &&
    (value.submittedAt === null || typeof value.submittedAt === 'string') &&
    typeof value.autoSubmitted === 'boolean' &&
    (value.result === null || (typeof value.result === 'object' && !Array.isArray(value.result))) &&
    typeof value.updatedAt === 'string'
  );
}

/**
 * Persist the attempt for this browser tab only, including the original
 * deadline, so a refresh cannot extend the exam.
 *
 * @param {import('./examViewState.js').ExamViewState} viewState
 * @param {Date} [now]
 * @returns {void}
 */
export function saveExamProgress(viewState, now = new Date()) {
  const testId = viewState?.test?.id;

  if (!testId || !SAVABLE_STATUSES.includes(viewState.status)) {
    return;
  }

  /** @type {StoredExamProgress} */
  const progress = {
    version: EXAM_VIEW_STATE_VERSION,
    testId: String(testId),
    startedAt: viewState.startedAt,
    expiresAt: viewState.expiresAt,
    answers: viewState.answers,
    flags: viewState.flags ?? {},
    submittedAt: viewState.submittedAt,
    autoSubmitted: viewState.autoSubmitted === true,
    result: viewState.result,
    updatedAt: now.toISOString(),
  };

  try {
    globalThis.sessionStorage?.setItem(examProgressKey(testId), JSON.stringify(progress));
  } catch {
    // Storage can be unavailable (private mode, quota); the attempt stays in memory.
  }
}

/**
 * @param {string} testId
 * @returns {StoredExamProgress|null}
 */
export function readExamProgress(testId) {
  let raw;

  try {
    raw = globalThis.sessionStorage?.getItem(examProgressKey(testId));
  } catch {
    return null;
  }

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);

    if (!isValidProgress(parsed) || parsed.testId !== String(testId)) {
      clearExamProgress(testId);
      return null;
    }

    return parsed;
  } catch {
    clearExamProgress(testId);
    return null;
  }
}

/**
 * @param {string} [testId] omit to clear every stored attempt in this tab
 * @returns {void}
 */
export function clearExamProgress(testId) {
  try {
    if (testId) {
      globalThis.sessionStorage?.removeItem(examProgressKey(testId));
      return;
    }

    const storage = globalThis.sessionStorage;

    if (!storage) {
      return;
    }

    const keys = [];

    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);

      if (typeof key === 'string' && key.startsWith(`${EXAM_PROGRESS_PREFIX}:`)) {
        keys.push(key);
      }
    }

    keys.forEach((key) => storage.removeItem(key));
  } catch {
    // Nothing to clear when storage is unavailable.
  }
}
