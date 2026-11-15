import { PLACEMENT_VIEW_STATE_VERSION, countAnswerableQuestions } from './placementViewState.js';

export const PLACEMENT_PROGRESS_KEY = 'aptis-go:placement-progress';

/**
 * @typedef {object} StoredPlacementProgress
 * @property {1} version
 * @property {{ id: string, title: string, answerableCount: number }} test
 * @property {Record<string, object>} answers
 * @property {number} currentIndex
 * @property {string|null} completedAt
 * @property {string} updatedAt
 */

/**
 * @param {unknown} value
 * @returns {value is StoredPlacementProgress}
 */
function isValidProgress(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    value.version === PLACEMENT_VIEW_STATE_VERSION &&
    value.test !== null &&
    typeof value.test === 'object' &&
    typeof value.test.id === 'string' &&
    value.test.id.length > 0 &&
    typeof value.test.title === 'string' &&
    Number.isInteger(value.test.answerableCount) &&
    value.answers !== null &&
    typeof value.answers === 'object' &&
    !Array.isArray(value.answers) &&
    Number.isInteger(value.currentIndex) &&
    (value.completedAt === null || typeof value.completedAt === 'string') &&
    typeof value.updatedAt === 'string'
  );
}

/**
 * Persist the answers of a loaded diagnostic for this browser tab only.
 *
 * @param {import('./placementViewState.js').PlacementViewState} viewState
 * @param {Date} [now]
 * @returns {void}
 */
export function savePlacementProgress(viewState, now = new Date()) {
  if (!viewState.test || (viewState.status !== 'ready' && viewState.status !== 'finished')) {
    return;
  }

  /** @type {StoredPlacementProgress} */
  const progress = {
    version: PLACEMENT_VIEW_STATE_VERSION,
    test: {
      id: String(viewState.test.id),
      title: viewState.test.title,
      answerableCount: countAnswerableQuestions(viewState.test),
    },
    answers: viewState.answers,
    currentIndex: viewState.currentIndex,
    completedAt: viewState.completedAt,
    updatedAt: now.toISOString(),
  };

  try {
    globalThis.sessionStorage?.setItem(PLACEMENT_PROGRESS_KEY, JSON.stringify(progress));
  } catch {
    // Storage can be unavailable (private mode, quota); answers stay in memory.
  }
}

/**
 * @returns {StoredPlacementProgress|null}
 */
export function readPlacementProgress() {
  let raw;

  try {
    raw = globalThis.sessionStorage?.getItem(PLACEMENT_PROGRESS_KEY);
  } catch {
    return null;
  }

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);

    if (!isValidProgress(parsed)) {
      clearPlacementProgress();
      return null;
    }

    return parsed;
  } catch {
    clearPlacementProgress();
    return null;
  }
}

/**
 * @returns {void}
 */
export function clearPlacementProgress() {
  try {
    globalThis.sessionStorage?.removeItem(PLACEMENT_PROGRESS_KEY);
  } catch {
    // Nothing to clear when storage is unavailable.
  }
}
