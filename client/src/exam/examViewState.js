export const EXAM_VIEW_STATE_VERSION = 1;
export const EXAM_TICK_MS = 1000;
export const EXAM_WARNING_SECONDS = 300;
export const EXAM_CRITICAL_SECONDS = 60;

/**
 * Official Aptis limit: a listening track may be played at most twice.
 * Pinned to `contracts/JayContract.js#validateListeningPlaysLimit` by
 * `tests/exam-audio-player.test.jsx`.
 */
export const LISTENING_PLAY_LIMIT = 2;

export const INCOMPLETE_TEST_MESSAGE = 'The test response was incomplete.';
export const DEFAULT_EXAM_ERROR_MESSAGE = 'Unable to load the exam.';
export const DEFAULT_SUBMISSION_ERROR_MESSAGE =
  'Your answers could not be submitted. Please try again.';

export const EXAM_STATUS = Object.freeze({
  LOADING: 'loading',
  READY: 'ready',
  SUBMITTING: 'submitting',
  SUBMITTED: 'submitted',
  ERROR: 'error',
});

const QUESTION_TYPES = Object.freeze([
  'mcq_single',
  'dropdown_match',
  'dropdown_cloze',
  'sentence_order',
  'short_fields',
  'essay_text',
  'audio_record',
]);

/**
 * @typedef {object} ExamViewState
 * @property {1} version
 * @property {'loading'|'ready'|'submitting'|'submitted'|'error'} status
 * @property {object|null} test
 * @property {Record<string, unknown>} answers
 * @property {Record<string, true>} flags
 * @property {Record<string, number>} playCounts
 * @property {string|null} startedAt
 * @property {string|null} expiresAt
 * @property {boolean} autoSubmitted
 * @property {object|null} result
 * @property {string|null} submittedAt
 * @property {{ message: string, details: string[] }|null} error
 */

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * @param {Date} date
 * @returns {string}
 */
function toIsoString(date) {
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isIsoString(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

/**
 * @param {{ message?: string, details?: string[] }} error
 * @param {string} fallback
 * @returns {{ message: string, details: string[] }}
 */
function normalizeError(error = {}, fallback = DEFAULT_EXAM_ERROR_MESSAGE) {
  return {
    message:
      typeof error.message === 'string' && error.message.length > 0 ? error.message : fallback,
    details: Array.isArray(error.details)
      ? error.details.filter((detail) => typeof detail === 'string')
      : [],
  };
}

/**
 * @param {object} question
 * @returns {boolean}
 */
function isExamQuestion(question) {
  return (
    isPlainObject(question) &&
    typeof question.id === 'string' &&
    question.id.length > 0 &&
    typeof question.skill === 'string' &&
    typeof question.prompt === 'string' &&
    QUESTION_TYPES.includes(question.questionType) &&
    (question.options === undefined || Array.isArray(question.options)) &&
    (question.dropdownSets === undefined || Array.isArray(question.dropdownSets)) &&
    (question.sentences === undefined || Array.isArray(question.sentences)) &&
    (question.formFields === undefined || Array.isArray(question.formFields))
  );
}

/**
 * @param {unknown} test
 * @returns {boolean}
 */
export function isExamTest(test) {
  return (
    isPlainObject(test) &&
    typeof test.id === 'string' &&
    test.id.length > 0 &&
    typeof test.title === 'string' &&
    Number.isFinite(test.durationMinutes) &&
    test.durationMinutes > 0 &&
    Array.isArray(test.questions) &&
    test.questions.every(isExamQuestion)
  );
}

/**
 * @returns {ExamViewState}
 */
export function createExamViewState() {
  return {
    version: EXAM_VIEW_STATE_VERSION,
    status: EXAM_STATUS.LOADING,
    test: null,
    answers: {},
    flags: {},
    playCounts: {},
    startedAt: null,
    expiresAt: null,
    autoSubmitted: false,
    result: null,
    submittedAt: null,
    error: null,
  };
}

/**
 * @param {ExamViewState} viewState
 * @param {unknown} test
 * @param {Date} [now]
 * @returns {ExamViewState}
 */
export function withExamTest(viewState, test, now = new Date()) {
  if (!isExamTest(test)) {
    return {
      ...viewState,
      status: EXAM_STATUS.ERROR,
      test: null,
      answers: {},
      flags: {},
      playCounts: {},
      startedAt: null,
      expiresAt: null,
      autoSubmitted: false,
      result: null,
      submittedAt: null,
      error: normalizeError({ message: INCOMPLETE_TEST_MESSAGE }),
    };
  }

  const startedAt = toIsoString(now);
  const expiresAt = new Date(now.getTime() + test.durationMinutes * 60_000).toISOString();

  return {
    ...viewState,
    status: EXAM_STATUS.READY,
    test,
    answers: {},
    flags: {},
    playCounts: {},
    startedAt,
    expiresAt,
    autoSubmitted: false,
    result: null,
    submittedAt: null,
    error: null,
  };
}

/**
 * @param {ExamViewState} viewState
 * @param {{ message?: string, details?: string[] }} [error]
 * @returns {ExamViewState}
 */
export function withExamError(viewState, error = {}) {
  return {
    ...viewState,
    status: EXAM_STATUS.ERROR,
    test: null,
    answers: {},
    flags: {},
    playCounts: {},
    startedAt: null,
    expiresAt: null,
    autoSubmitted: false,
    result: null,
    submittedAt: null,
    error: normalizeError(error),
  };
}

/**
 * @param {object} question
 * @returns {Array<object>}
 */
function sentencesByStoredOrder(question) {
  return [...(question.sentences ?? [])]
    .filter((sentence) => sentence && typeof sentence.id === 'string')
    .sort((left, right) => (left.order ?? 0) - (right.order ?? 0));
}

/**
 * @param {string} value
 * @returns {number}
 */
function hashString(value) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

/**
 * @param {number} seed
 * @returns {() => number}
 */
function createRandom(seed) {
  let state = seed || 1;

  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);

    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * @param {Array<string>} values
 * @param {() => number} random
 * @returns {Array<string>}
 */
function shuffle(values, random) {
  const result = [...values];

  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapWith = Math.floor(random() * (index + 1));
    const current = result[index];

    result[index] = result[swapWith];
    result[swapWith] = current;
  }

  return result;
}

/**
 * The stored sentence order is the answer key, so the first render must not use
 * it. Fixed sentences stay pinned; the rest are shuffled deterministically from
 * the question id, so a refresh cannot reroll the order.
 *
 * @param {object} question
 * @returns {Array<string>}
 */
export function initialSentenceOrder(question) {
  const ordered = sentencesByStoredOrder(question);
  const ids = ordered.map((sentence) => String(sentence.id));
  const fixedSlots = new Map();

  ordered.forEach((sentence, index) => {
    if (sentence.isFixed === true) {
      fixedSlots.set(index, ids[index]);
    }
  });

  const movable = ids.filter((_id, index) => !fixedSlots.has(index));
  const shuffled = shuffle(movable, createRandom(hashString(String(question.id))));
  let cursor = 0;

  return ids.map((id, index) => fixedSlots.get(index) ?? shuffled[cursor++]);
}

/**
 * @param {object} question
 * @param {unknown} answer
 * @returns {Array<string>}
 */
export function sentenceOrderFor(question, answer) {
  const expected = sentencesByStoredOrder(question).map((sentence) => String(sentence.id));

  if (!Array.isArray(answer) || answer.length !== expected.length) {
    return initialSentenceOrder(question);
  }

  const seen = new Set();

  for (const id of answer) {
    const key = String(id);

    if (!expected.includes(key) || seen.has(key)) {
      return initialSentenceOrder(question);
    }

    seen.add(key);
  }

  return answer.map(String);
}

/**
 * Normalise one stored answer into the AG-303 `submittedAnswer` Contract.
 *
 * @param {object} question
 * @param {unknown} value
 * @returns {unknown}
 */
function answerFor(question, value) {
  switch (question.questionType) {
    case 'mcq_single': {
      const optionCount = question.options?.length ?? 0;

      return Number.isInteger(value) && value >= 0 && value < optionCount ? value : null;
    }

    case 'dropdown_match':
    case 'dropdown_cloze': {
      if (!isPlainObject(value)) {
        return null;
      }

      const sets = new Map((question.dropdownSets ?? []).map((set) => [String(set.id), set]));
      const selections = {};

      for (const [setId, optionIndex] of Object.entries(value)) {
        const set = sets.get(setId);
        const optionCount = set?.options?.length ?? 0;

        if (set && Number.isInteger(optionIndex) && optionIndex >= 0 && optionIndex < optionCount) {
          selections[setId] = optionIndex;
        }
      }

      return Object.keys(selections).length > 0 ? selections : null;
    }

    case 'sentence_order': {
      const expected = sentencesByStoredOrder(question).map((sentence) => String(sentence.id));

      if (!Array.isArray(value) || value.length !== expected.length) {
        return null;
      }

      const seen = new Set();

      for (const id of value) {
        const key = String(id);

        if (!expected.includes(key) || seen.has(key)) {
          return null;
        }

        seen.add(key);
      }

      return value.map(String);
    }

    case 'short_fields': {
      if (!isPlainObject(value)) {
        return null;
      }

      const fieldIds = new Set((question.formFields ?? []).map((field) => field.fieldId));
      const fields = {};

      for (const [fieldId, text] of Object.entries(value)) {
        if (!fieldIds.has(fieldId) || typeof text !== 'string') {
          continue;
        }

        const trimmed = text.trim();

        if (trimmed.length > 0) {
          fields[fieldId] = trimmed;
        }
      }

      return Object.keys(fields).length > 0 ? fields : null;
    }

    case 'essay_text': {
      if (typeof value !== 'string') {
        return null;
      }

      const trimmed = value.trim();

      return trimmed.length > 0 ? trimmed : null;
    }

    default:
      return null;
  }
}

/**
 * @param {ExamViewState} viewState
 * @param {string} questionId
 * @param {unknown} value
 * @returns {ExamViewState}
 */
function withAnswer(viewState, questionId, value) {
  if (typeof questionId !== 'string' || questionId.length === 0) {
    return viewState;
  }

  return {
    ...viewState,
    answers: {
      ...viewState.answers,
      [questionId]: value,
    },
  };
}

/**
 * @param {ExamViewState} viewState
 * @param {string} questionId
 * @param {number} optionIndex
 * @returns {ExamViewState}
 */
export function withOptionAnswer(viewState, questionId, optionIndex) {
  return withAnswer(viewState, questionId, optionIndex);
}

/**
 * @param {ExamViewState} viewState
 * @param {string} questionId
 * @param {string} setId
 * @param {number} optionIndex
 * @returns {ExamViewState}
 */
export function withDropdownAnswer(viewState, questionId, setId, optionIndex) {
  const current = viewState.answers[questionId];
  const selections = isPlainObject(current) ? { ...current } : {};

  selections[setId] = optionIndex;

  return withAnswer(viewState, questionId, selections);
}

/**
 * @param {ExamViewState} viewState
 * @param {string} questionId
 * @param {string} fieldId
 * @param {string} value
 * @returns {ExamViewState}
 */
export function withTextField(viewState, questionId, fieldId, value) {
  const current = viewState.answers[questionId];
  const fields = isPlainObject(current) ? { ...current } : {};

  fields[fieldId] = value;

  return withAnswer(viewState, questionId, fields);
}

/**
 * @param {ExamViewState} viewState
 * @param {string} questionId
 * @param {string} value
 * @returns {ExamViewState}
 */
export function withEssayText(viewState, questionId, value) {
  return withAnswer(viewState, questionId, value);
}

/**
 * @param {ExamViewState} viewState
 * @param {object} question
 * @param {Array<string>} order
 * @returns {ExamViewState}
 */
function sentenceMoveTarget(question, order, index, direction) {
  if (direction !== 'up' && direction !== 'down') {
    return -1;
  }

  const target = direction === 'up' ? index - 1 : index + 1;

  if (index < 0 || index >= order.length || target < 0 || target >= order.length) {
    return -1;
  }

  const fixedIds = new Set(
    sentencesByStoredOrder(question)
      .filter((sentence) => sentence.isFixed === true)
      .map((sentence) => String(sentence.id))
  );

  if (fixedIds.has(order[index]) || fixedIds.has(order[target])) {
    return -1;
  }

  return target;
}

/**
 * @param {ExamViewState} viewState
 * @param {string} questionId
 * @param {number} index
 * @param {'up'|'down'} direction
 * @returns {ExamViewState}
 */
export function moveSentence(viewState, questionId, index, direction) {
  const question = (viewState.test?.questions ?? []).find((entry) => entry.id === questionId);

  if (!question) {
    return viewState;
  }

  const order = [...sentenceOrderFor(question, viewState.answers[questionId])];
  const target = sentenceMoveTarget(question, order, index, direction);

  if (target < 0) {
    return viewState;
  }

  const current = order[index];

  order[index] = order[target];
  order[target] = current;

  return withAnswer(viewState, questionId, order);
}

/**
 * @param {string} text
 * @returns {number}
 */
export function countWords(text) {
  if (typeof text !== 'string') {
    return 0;
  }

  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * @param {ExamViewState} viewState
 * @returns {number}
 */
export function countAnsweredQuestions(viewState) {
  return (viewState.test?.questions ?? []).filter(
    (question) => answerFor(question, viewState.answers[question.id]) !== null
  ).length;
}

/**
 * @param {ExamViewState} viewState
 * @param {unknown} questionId
 * @returns {boolean}
 */
function hasQuestion(viewState, questionId) {
  return (
    typeof questionId === 'string' &&
    questionId.length > 0 &&
    (viewState.test?.questions ?? []).some((question) => question.id === questionId)
  );
}

/**
 * @param {ExamViewState} viewState
 * @param {string} questionId
 * @returns {boolean}
 */
export function isQuestionFlagged(viewState, questionId) {
  return hasQuestion(viewState, questionId) && viewState.flags?.[questionId] === true;
}

/**
 * Flag state is a local study aid: it never leaves the browser and never changes
 * the submission payload.
 *
 * @param {ExamViewState} viewState
 * @param {string} questionId
 * @returns {ExamViewState}
 */
export function toggleQuestionFlag(viewState, questionId) {
  if (viewState.status !== EXAM_STATUS.READY || !hasQuestion(viewState, questionId)) {
    return viewState;
  }

  const flags = { ...(viewState.flags ?? {}) };

  if (flags[questionId] === true) {
    delete flags[questionId];
  } else {
    flags[questionId] = true;
  }

  return { ...viewState, flags };
}

/**
 * @param {ExamViewState} viewState
 * @returns {number}
 */
export function countFlaggedQuestions(viewState) {
  return (viewState.test?.questions ?? []).filter((question) =>
    isQuestionFlagged(viewState, question.id)
  ).length;
}

/**
 * One entry per stored question, in stored order. `answered` uses the same rule
 * as the submission payload, so the palette cannot disagree with the server's
 * `answeredCount`.
 *
 * @typedef {object} ExamQuestionStatus
 * @property {string} questionId
 * @property {number} number
 * @property {string} skill
 * @property {number} part
 * @property {boolean} answered
 * @property {boolean} flagged
 *
 * @param {ExamViewState} viewState
 * @returns {ExamQuestionStatus[]}
 */
export function questionStatuses(viewState) {
  return (viewState.test?.questions ?? []).map((question, index) => ({
    questionId: String(question.id),
    number: index + 1,
    skill: question.skill,
    part: question.part,
    answered: answerFor(question, viewState.answers[question.id]) !== null,
    flagged: isQuestionFlagged(viewState, question.id),
  }));
}

/**
 * @param {object} question
 * @returns {boolean}
 */
export function isListeningTrack(question) {
  return (
    isPlainObject(question) &&
    question.skill === 'listening' &&
    typeof question.mediaUrl === 'string' &&
    question.mediaUrl.length > 0
  );
}

/**
 * @param {ExamViewState} viewState
 * @param {string} questionId
 * @returns {number}
 */
export function playsUsedFor(viewState, questionId) {
  const question = (viewState.test?.questions ?? []).find((entry) => entry.id === questionId);

  if (!isListeningTrack(question)) {
    return 0;
  }

  const stored = viewState.playCounts?.[questionId];

  if (!Number.isInteger(stored) || stored < 0) {
    return 0;
  }

  return Math.min(stored, LISTENING_PLAY_LIMIT);
}

/**
 * @param {ExamViewState} viewState
 * @param {string} questionId
 * @returns {number}
 */
export function playsRemainingFor(viewState, questionId) {
  return Math.max(0, LISTENING_PLAY_LIMIT - playsUsedFor(viewState, questionId));
}

/**
 * @param {ExamViewState} viewState
 * @param {string} questionId
 * @returns {boolean}
 */
export function canPlayTrack(viewState, questionId) {
  return playsUsedFor(viewState, questionId) < LISTENING_PLAY_LIMIT;
}

/**
 * Records one listening play. The player calls this only after
 * `HTMLMediaElement.play()` resolves, so a blocked autoplay never consumes a
 * play. The official limit is authoritative here: a third call is a no-op.
 *
 * @param {ExamViewState} viewState
 * @param {string} questionId
 * @returns {ExamViewState}
 */
export function recordTrackPlay(viewState, questionId) {
  const question = (viewState.test?.questions ?? []).find((entry) => entry.id === questionId);

  if (viewState.status !== EXAM_STATUS.READY || !isListeningTrack(question)) {
    return viewState;
  }

  const used = playsUsedFor(viewState, questionId);

  if (used >= LISTENING_PLAY_LIMIT) {
    return viewState;
  }

  return {
    ...viewState,
    playCounts: { ...(viewState.playCounts ?? {}), [questionId]: used + 1 },
  };
}

/**
 * @param {number} seconds
 * @returns {string} `m:ss`
 */
export function formatPlayClock(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return '0:00';
  }

  const safe = Math.floor(seconds);
  const minutes = Math.floor(safe / 60);
  const remainder = safe % 60;

  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

/**
 * @param {ExamViewState} viewState
 * @returns {{ testId: string, answers: Array<{ questionId: string, submittedAnswer: unknown }> }|null}
 */
export function buildSubmissionPayload(viewState) {
  if (!viewState.test) {
    return null;
  }

  return {
    testId: String(viewState.test.id),
    answers: (viewState.test.questions ?? []).map((question) => ({
      questionId: String(question.id),
      submittedAnswer: answerFor(question, viewState.answers[question.id]),
    })),
  };
}

/**
 * @param {ExamViewState} viewState
 * @returns {ExamViewState}
 */
export function withExamSubmitting(viewState) {
  if (viewState.status !== EXAM_STATUS.READY) {
    return viewState;
  }

  return { ...viewState, status: EXAM_STATUS.SUBMITTING, error: null };
}

/**
 * @param {ExamViewState} viewState
 * @param {object} result
 * @param {{ autoSubmitted?: boolean, now?: Date }} [options]
 * @returns {ExamViewState}
 */
export function withExamSubmitted(
  viewState,
  result,
  { autoSubmitted = false, now = new Date() } = {}
) {
  if (viewState.status !== EXAM_STATUS.SUBMITTING) {
    return viewState;
  }

  return {
    ...viewState,
    status: EXAM_STATUS.SUBMITTED,
    result: isPlainObject(result) ? result : null,
    autoSubmitted: autoSubmitted === true,
    submittedAt: toIsoString(now, now),
    error: null,
  };
}

/**
 * @param {ExamViewState} viewState
 * @param {{ message?: string, details?: string[] }} [error]
 * @returns {ExamViewState}
 */
export function withSubmissionError(viewState, error = {}) {
  if (viewState.status !== EXAM_STATUS.SUBMITTING) {
    return viewState;
  }

  return {
    ...viewState,
    status: EXAM_STATUS.READY,
    error: normalizeError(error, DEFAULT_SUBMISSION_ERROR_MESSAGE),
  };
}

/**
 * @param {string|Date|null} expiresAt
 * @param {Date} [now]
 * @returns {number}
 */
export function remainingSeconds(expiresAt, now = new Date()) {
  const expiresMs =
    expiresAt instanceof Date
      ? expiresAt.getTime()
      : typeof expiresAt === 'string'
        ? Date.parse(expiresAt)
        : Number.NaN;

  if (!Number.isFinite(expiresMs)) {
    return 0;
  }

  const difference = expiresMs - now.getTime();

  return difference <= 0 ? 0 : Math.ceil(difference / 1000);
}

/**
 * @param {string|Date|null} expiresAt
 * @param {Date} [now]
 * @returns {boolean}
 */
export function isExpired(expiresAt, now = new Date()) {
  return remainingSeconds(expiresAt, now) === 0;
}

/**
 * @param {number} seconds
 * @returns {string}
 */
export function formatCountdown(seconds) {
  const safe = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const remainder = safe % 60;

  const paddedMinutes = String(minutes).padStart(2, '0');
  const paddedSeconds = String(remainder).padStart(2, '0');

  return hours > 0
    ? `${hours}:${paddedMinutes}:${paddedSeconds}`
    : `${paddedMinutes}:${paddedSeconds}`;
}

/**
 * @param {number} seconds
 * @returns {'normal'|'warning'|'critical'}
 */
export function countdownTone(seconds) {
  if (!Number.isFinite(seconds) || seconds <= EXAM_CRITICAL_SECONDS) {
    return 'critical';
  }

  return seconds <= EXAM_WARNING_SECONDS ? 'warning' : 'normal';
}

/**
 * @param {object} test
 * @param {unknown} raw
 * @returns {Record<string, unknown>}
 */
function sanitizeAnswers(test, raw) {
  if (!isPlainObject(raw)) {
    return {};
  }

  const questions = new Map((test.questions ?? []).map((question) => [question.id, question]));
  const answers = {};

  for (const [questionId, value] of Object.entries(raw)) {
    const question = questions.get(questionId);

    if (!question) {
      continue;
    }

    const normalized = answerFor(question, value);

    if (normalized !== null) {
      answers[questionId] = normalized;
    }
  }

  return answers;
}

/**
 * Old records predate flags, so a missing value is simply empty. Only ids that
 * exist in the loaded test and are explicitly `true` survive.
 *
 * @param {object} test
 * @param {unknown} raw
 * @returns {Record<string, true>}
 */
function sanitizeFlags(test, raw) {
  if (!isPlainObject(raw)) {
    return {};
  }

  const known = new Set((test.questions ?? []).map((question) => String(question.id)));
  const flags = {};

  for (const [questionId, value] of Object.entries(raw)) {
    if (known.has(questionId) && value === true) {
      flags[questionId] = true;
    }
  }

  return flags;
}

/**
 * Only listening tracks in the loaded test can hold a play count, and the value
 * is clamped to the official limit so an edited storage record cannot exceed it.
 *
 * @param {object} test
 * @param {unknown} raw
 * @returns {Record<string, number>}
 */
function sanitizePlayCounts(test, raw) {
  if (!isPlainObject(raw)) {
    return {};
  }

  const tracks = new Set(
    (test.questions ?? [])
      .filter((question) => isListeningTrack(question))
      .map((question) => String(question.id))
  );
  const counts = {};

  for (const [questionId, value] of Object.entries(raw)) {
    if (tracks.has(questionId) && Number.isInteger(value) && value > 0) {
      counts[questionId] = Math.min(value, LISTENING_PLAY_LIMIT);
    }
  }

  return counts;
}

/**
 * @param {unknown} saved
 * @param {object} test
 * @param {Date} [now]
 * @returns {ExamViewState}
 */
export function hydrateExamViewState(saved, test, now = new Date()) {
  const fresh = withExamTest(createExamViewState(), test, now);

  if (
    fresh.status !== EXAM_STATUS.READY ||
    !isPlainObject(saved) ||
    saved.version !== EXAM_VIEW_STATE_VERSION ||
    saved.testId !== test.id
  ) {
    return fresh;
  }

  const answers = sanitizeAnswers(test, saved.answers);
  const flags = sanitizeFlags(test, saved.flags);
  const playCounts = sanitizePlayCounts(test, saved.playCounts);
  const startedAt = isIsoString(saved.startedAt) ? saved.startedAt : fresh.startedAt;
  const expiresAt = isIsoString(saved.expiresAt) ? saved.expiresAt : fresh.expiresAt;
  const submittedAt = isIsoString(saved.submittedAt) ? saved.submittedAt : null;
  const result = isPlainObject(saved.result) ? saved.result : null;

  if (submittedAt !== null && result !== null) {
    return {
      ...fresh,
      status: EXAM_STATUS.SUBMITTED,
      answers,
      flags,
      playCounts,
      startedAt,
      expiresAt,
      submittedAt,
      result,
      autoSubmitted: saved.autoSubmitted === true,
    };
  }

  return {
    ...fresh,
    answers,
    flags,
    playCounts,
    startedAt,
    expiresAt,
  };
}
