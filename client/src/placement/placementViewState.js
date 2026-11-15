export const PLACEMENT_VIEW_STATE_VERSION = 1;

const DROPDOWN_TYPES = Object.freeze(['dropdown_match', 'dropdown_cloze']);

/**
 * @typedef {'loading'|'ready'|'error'|'finished'} PlacementStatus
 *
 * @typedef {{ kind: 'option', optionIndex: number }} PlacementOptionAnswer
 * @typedef {{ kind: 'dropdowns', selections: Record<string, number> }} PlacementDropdownAnswer
 *
 * @typedef {object} PlacementViewState
 * @property {1} version
 * @property {PlacementStatus} status
 * @property {object|null} test
 * @property {Record<string, PlacementOptionAnswer|PlacementDropdownAnswer>} answers
 * @property {number} currentIndex
 * @property {{ message: string, details: string[] }|null} error
 * @property {string|null} completedAt
 */

/**
 * @returns {PlacementViewState}
 */
export function createPlacementViewState() {
  return {
    version: PLACEMENT_VIEW_STATE_VERSION,
    status: 'loading',
    test: null,
    answers: {},
    currentIndex: 0,
    error: null,
    completedAt: null,
  };
}

/**
 * @param {PlacementViewState} viewState
 * @returns {Array<object>}
 */
function questionsOf(viewState) {
  return Array.isArray(viewState.test?.questions) ? viewState.test.questions : [];
}

/**
 * @param {PlacementViewState} viewState
 * @param {object} test
 * @returns {PlacementViewState}
 */
export function withPlacementTest(viewState, test) {
  return {
    ...viewState,
    status: 'ready',
    test,
    answers: {},
    currentIndex: 0,
    error: null,
    completedAt: null,
  };
}

/**
 * @param {PlacementViewState} viewState
 * @param {{ message?: string, details?: string[] }} error
 * @returns {PlacementViewState}
 */
export function withPlacementError(viewState, error = {}) {
  return {
    ...viewState,
    status: 'error',
    test: null,
    answers: {},
    currentIndex: 0,
    completedAt: null,
    error: {
      message: typeof error.message === 'string' ? error.message : 'Unable to load the diagnostic.',
      details: Array.isArray(error.details)
        ? error.details.filter((item) => typeof item === 'string')
        : [],
    },
  };
}

/**
 * @param {PlacementViewState} viewState
 * @param {string} questionId
 * @param {number} optionIndex
 * @returns {PlacementViewState}
 */
export function withOptionAnswer(viewState, questionId, optionIndex) {
  return {
    ...viewState,
    answers: {
      ...viewState.answers,
      [questionId]: { kind: 'option', optionIndex },
    },
  };
}

/**
 * @param {PlacementViewState} viewState
 * @param {string} questionId
 * @param {string} setId
 * @param {number} optionIndex
 * @returns {PlacementViewState}
 */
export function withDropdownAnswer(viewState, questionId, setId, optionIndex) {
  const current = viewState.answers[questionId];
  const selections = current?.kind === 'dropdowns' ? { ...current.selections } : {};

  selections[setId] = optionIndex;

  return {
    ...viewState,
    answers: {
      ...viewState.answers,
      [questionId]: { kind: 'dropdowns', selections },
    },
  };
}

/**
 * @param {PlacementViewState} viewState
 * @param {number} index
 * @returns {PlacementViewState}
 */
export function goToQuestion(viewState, index) {
  const questions = questionsOf(viewState);

  if (questions.length === 0) {
    return viewState;
  }

  const clamped = Math.min(questions.length - 1, Math.max(0, Math.trunc(index)));

  return { ...viewState, currentIndex: clamped };
}

/**
 * @param {PlacementViewState} viewState
 * @returns {PlacementViewState}
 */
export function nextQuestion(viewState) {
  return goToQuestion(viewState, viewState.currentIndex + 1);
}

/**
 * @param {PlacementViewState} viewState
 * @returns {PlacementViewState}
 */
export function previousQuestion(viewState) {
  return goToQuestion(viewState, viewState.currentIndex - 1);
}

/**
 * @param {PlacementViewState} viewState
 * @returns {object|null}
 */
export function getCurrentQuestion(viewState) {
  return questionsOf(viewState)[viewState.currentIndex] ?? null;
}

/**
 * @param {object} question
 * @returns {boolean}
 */
export function isQuestionAnswerable(question) {
  if (!question || typeof question !== 'object') {
    return false;
  }

  if (question.questionType === 'mcq_single') {
    return Array.isArray(question.options) && question.options.length > 0;
  }

  if (DROPDOWN_TYPES.includes(question.questionType)) {
    return Array.isArray(question.dropdownSets) && question.dropdownSets.length > 0;
  }

  return false;
}

/**
 * @param {object} question
 * @param {PlacementOptionAnswer|PlacementDropdownAnswer|undefined} answer
 * @returns {boolean}
 */
export function isQuestionAnswered(question, answer) {
  if (!isQuestionAnswerable(question) || !answer) {
    return false;
  }

  if (question.questionType === 'mcq_single') {
    return (
      answer.kind === 'option' &&
      Number.isInteger(answer.optionIndex) &&
      answer.optionIndex >= 0 &&
      answer.optionIndex < question.options.length
    );
  }

  if (answer.kind !== 'dropdowns' || !answer.selections) {
    return false;
  }

  return question.dropdownSets.every((set) => {
    const selected = answer.selections[set.id];

    return Number.isInteger(selected) && selected >= 0 && selected < (set.options?.length ?? 0);
  });
}

/**
 * @param {object|null} test
 * @returns {number}
 */
export function countAnswerableQuestions(test) {
  const questions = Array.isArray(test?.questions) ? test.questions : [];

  return questions.filter(isQuestionAnswerable).length;
}

/**
 * @param {PlacementViewState} viewState
 * @returns {number}
 */
export function countAnsweredQuestions(viewState) {
  return questionsOf(viewState).filter(
    (question) =>
      isQuestionAnswerable(question) && isQuestionAnswered(question, viewState.answers[question.id])
  ).length;
}

/**
 * @param {PlacementViewState} viewState
 * @returns {boolean}
 */
export function canFinishPlacement(viewState) {
  if (viewState.status !== 'ready') {
    return false;
  }

  const answerable = countAnswerableQuestions(viewState.test);

  return answerable > 0 && countAnsweredQuestions(viewState) === answerable;
}

/**
 * @param {PlacementViewState} viewState
 * @param {Date} [now]
 * @returns {PlacementViewState}
 */
export function finishPlacement(viewState, now = new Date()) {
  if (!canFinishPlacement(viewState)) {
    return viewState;
  }

  return {
    ...viewState,
    status: 'finished',
    completedAt: now.toISOString(),
  };
}

/**
 * @param {object|null} saved
 * @param {object} test
 * @returns {PlacementViewState}
 */
export function hydratePlacementViewState(saved, test) {
  const fresh = withPlacementTest(createPlacementViewState(), test);

  if (!saved || saved.version !== PLACEMENT_VIEW_STATE_VERSION) {
    return fresh;
  }

  if (saved.test?.id !== test.id) {
    return fresh;
  }

  const questions = questionsOf(fresh);
  const answers =
    saved.answers && typeof saved.answers === 'object' && !Array.isArray(saved.answers)
      ? saved.answers
      : {};
  const requestedIndex = Number.isInteger(saved.currentIndex) ? saved.currentIndex : 0;
  const currentIndex =
    questions.length === 0 ? 0 : Math.min(questions.length - 1, Math.max(0, requestedIndex));
  const completedAt = typeof saved.completedAt === 'string' ? saved.completedAt : null;

  return {
    ...fresh,
    answers,
    currentIndex,
    status: completedAt ? 'finished' : 'ready',
    completedAt,
  };
}
