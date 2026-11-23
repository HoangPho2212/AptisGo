import { afterEach, describe, expect, it } from 'vitest';

import {
  EXAM_CRITICAL_SECONDS,
  EXAM_STATUS,
  EXAM_TICK_MS,
  EXAM_VIEW_STATE_VERSION,
  EXAM_WARNING_SECONDS,
  INCOMPLETE_TEST_MESSAGE,
  buildSubmissionPayload,
  countAnsweredQuestions,
  countFlaggedQuestions,
  countWords,
  countdownTone,
  createExamViewState,
  formatCountdown,
  hydrateExamViewState,
  initialSentenceOrder,
  isExpired,
  isQuestionFlagged,
  moveSentence,
  questionStatuses,
  remainingSeconds,
  toggleQuestionFlag,
  withDropdownAnswer,
  withEssayText,
  withExamError,
  withExamSubmitted,
  withExamSubmitting,
  withExamTest,
  withOptionAnswer,
  withSubmissionError,
  withTextField,
} from '../client/src/exam/examViewState.js';
import {
  clearExamProgress,
  examProgressKey,
  readExamProgress,
  saveExamProgress,
} from '../client/src/exam/examProgressStorage.js';
import { EXAM_TEST } from './screen-fixtures.jsx';

const NOW = new Date('2026-11-23T09:00:00.000Z');
const ORDER_QUESTION = EXAM_TEST.questions[2];

function readyState(now = NOW) {
  return withExamTest(createExamViewState(), EXAM_TEST, now);
}

function answeredState() {
  let viewState = readyState();

  viewState = withOptionAnswer(viewState, 'e1', 1);
  viewState = withDropdownAnswer(viewState, 'e2', 'd1', 0);
  viewState = withDropdownAnswer(viewState, 'e2', 'd2', 0);
  viewState = moveSentence(viewState, 'e3', 1, 'down');
  viewState = withTextField(viewState, 'e4', 'name', 'Amina Yusuf');
  viewState = withTextField(viewState, 'e4', 'city', 'Cairo');
  viewState = withEssayText(viewState, 'e5', 'Dear Sir, I would like to request leave.');

  return viewState;
}

afterEach(() => {
  clearExamProgress();
  sessionStorage.clear();
});

describe('ExamViewState', () => {
  it('starts loading with no test, answers, flags, or deadline', () => {
    expect(createExamViewState()).toEqual({
      version: 1,
      status: 'loading',
      test: null,
      answers: {},
      flags: {},
      startedAt: null,
      expiresAt: null,
      autoSubmitted: false,
      result: null,
      submittedAt: null,
      error: null,
    });
    expect(EXAM_VIEW_STATE_VERSION).toBe(1);
    expect(EXAM_TICK_MS).toBe(1000);
    expect(EXAM_STATUS).toEqual({
      LOADING: 'loading',
      READY: 'ready',
      SUBMITTING: 'submitting',
      SUBMITTED: 'submitted',
      ERROR: 'error',
    });
  });

  it('starts a timer from the test duration when the test arrives', () => {
    const viewState = readyState();

    expect(viewState.status).toBe('ready');
    expect(viewState.test).toBe(EXAM_TEST);
    expect(viewState.answers).toEqual({});
    expect(viewState.startedAt).toBe('2026-11-23T09:00:00.000Z');
    expect(viewState.expiresAt).toBe('2026-11-23T10:00:00.000Z');
    expect(viewState.error).toBeNull();
  });

  it('rejects a payload without a usable duration or questions', () => {
    for (const test of [
      null,
      { ...EXAM_TEST, id: '' },
      { ...EXAM_TEST, title: undefined },
      { ...EXAM_TEST, durationMinutes: 0 },
      { ...EXAM_TEST, durationMinutes: '60' },
      { ...EXAM_TEST, questions: 'six' },
      { ...EXAM_TEST, questions: [{ ...EXAM_TEST.questions[0], questionType: 'video_record' }] },
      { ...EXAM_TEST, questions: [{ ...EXAM_TEST.questions[0], id: '' }] },
    ]) {
      const viewState = withExamTest(createExamViewState(), test, NOW);

      expect(viewState.status).toBe('error');
      expect(viewState.test).toBeNull();
      expect(viewState.error.message).toBe(INCOMPLETE_TEST_MESSAGE);
    }
  });

  it('records a load error with the API details', () => {
    const viewState = withExamError(createExamViewState(), {
      message: 'Test not found',
      details: ['unknown id'],
    });

    expect(viewState.status).toBe('error');
    expect(viewState.error).toEqual({ message: 'Test not found', details: ['unknown id'] });
  });

  it('derives a clamped countdown from the deadline', () => {
    expect(remainingSeconds('2026-11-23T10:00:00.000Z', NOW)).toBe(3600);
    expect(remainingSeconds('2026-11-23T00:00:00.000Z', new Date('2026-11-22T23:59:59.500Z'))).toBe(
      1
    );
    expect(remainingSeconds('2026-11-23T08:59:59.000Z', NOW)).toBe(0);
    expect(remainingSeconds(null, NOW)).toBe(0);
    expect(remainingSeconds('not-a-date', NOW)).toBe(0);
    expect(isExpired('2026-11-23T09:00:00.000Z', NOW)).toBe(true);
    expect(isExpired('2026-11-23T10:00:00.000Z', NOW)).toBe(false);
  });

  it('formats the countdown as minutes or hours', () => {
    expect(formatCountdown(3600)).toBe('1:00:00');
    expect(formatCountdown(3900)).toBe('1:05:00');
    expect(formatCountdown(3599)).toBe('59:59');
    expect(formatCountdown(65)).toBe('01:05');
    expect(formatCountdown(59)).toBe('00:59');
    expect(formatCountdown(0)).toBe('00:00');
    expect(formatCountdown(-5)).toBe('00:00');
    expect(formatCountdown(undefined)).toBe('00:00');
  });

  it('warns in the last five minutes and turns critical in the last minute', () => {
    expect(countdownTone(3600)).toBe('normal');
    expect(countdownTone(EXAM_WARNING_SECONDS + 1)).toBe('normal');
    expect(countdownTone(EXAM_WARNING_SECONDS)).toBe('warning');
    expect(countdownTone(EXAM_CRITICAL_SECONDS + 1)).toBe('warning');
    expect(countdownTone(EXAM_CRITICAL_SECONDS)).toBe('critical');
    expect(countdownTone(0)).toBe('critical');
  });

  it('records MCQ, dropdown, text, and essay answers', () => {
    let viewState = readyState();

    viewState = withOptionAnswer(viewState, 'e1', 2);
    expect(viewState.answers.e1).toBe(2);

    viewState = withDropdownAnswer(viewState, 'e2', 'd1', 1);
    viewState = withDropdownAnswer(viewState, 'e2', 'd2', 0);
    expect(viewState.answers.e2).toEqual({ d1: 1, d2: 0 });

    viewState = withTextField(viewState, 'e4', 'name', 'Amina');
    expect(viewState.answers.e4).toEqual({ name: 'Amina' });

    viewState = withEssayText(viewState, 'e5', 'An essay.');
    expect(viewState.answers.e5).toBe('An essay.');
  });

  it('gives sentence order a deterministic shuffle that pins fixed sentences', () => {
    const first = initialSentenceOrder(ORDER_QUESTION);
    const second = initialSentenceOrder(ORDER_QUESTION);

    expect(first).toEqual(second);
    expect(first).toHaveLength(3);
    expect([...first].sort()).toEqual(['s1', 's2', 's3']);
    expect(first[0]).toBe('s1');
  });

  it('does not start every sentence order in the answer-key order', () => {
    const sentences = [
      { id: 'a', order: 1, text: 'A' },
      { id: 'b', order: 2, text: 'B' },
      { id: 'c', order: 3, text: 'C' },
      { id: 'd', order: 4, text: 'D' },
    ];
    const keyOrder = ['a', 'b', 'c', 'd'];
    const orders = Array.from({ length: 20 }, (_unused, index) =>
      initialSentenceOrder({ id: `question-${index}`, sentences })
    );

    expect(orders.some((order) => order.join(',') !== keyOrder.join(','))).toBe(true);
  });

  it('moves a sentence within the order but never a fixed one', () => {
    let viewState = readyState();

    expect(viewState.answers.e3).toBeUndefined();

    viewState = moveSentence(viewState, 'e3', 1, 'down');

    const initial = initialSentenceOrder(ORDER_QUESTION);
    expect(viewState.answers.e3).toEqual([initial[0], initial[2], initial[1]]);

    viewState = moveSentence(viewState, 'e3', 0, 'down');
    expect(viewState.answers.e3).toEqual([initial[0], initial[2], initial[1]]);

    viewState = moveSentence(viewState, 'e3', 2, 'up');
    expect(viewState.answers.e3).toEqual([initial[0], initial[1], initial[2]]);

    viewState = moveSentence(viewState, 'e3', 0, 'up');
    expect(viewState.answers.e3).toEqual([initial[0], initial[1], initial[2]]);
  });

  it('counts answered questions without crediting an untouched sentence order', () => {
    let viewState = readyState();

    expect(countAnsweredQuestions(viewState)).toBe(0);

    viewState = withOptionAnswer(viewState, 'e1', 0);
    expect(countAnsweredQuestions(viewState)).toBe(1);

    viewState = withDropdownAnswer(viewState, 'e2', 'd1', 0);
    expect(countAnsweredQuestions(viewState)).toBe(2);

    viewState = withTextField(viewState, 'e4', 'name', 'Amina');
    viewState = withEssayText(viewState, 'e5', 'An essay.');
    expect(countAnsweredQuestions(viewState)).toBe(4);
    expect(viewState.answers.e3).toBeUndefined();

    viewState = moveSentence(viewState, 'e3', 1, 'down');
    expect(countAnsweredQuestions(viewState)).toBe(5);
  });

  it('toggles a question flag on and off', () => {
    let viewState = readyState();

    expect(viewState.flags).toEqual({});
    expect(isQuestionFlagged(viewState, 'e1')).toBe(false);
    expect(countFlaggedQuestions(viewState)).toBe(0);

    viewState = toggleQuestionFlag(viewState, 'e1');
    expect(viewState.flags).toEqual({ e1: true });
    expect(isQuestionFlagged(viewState, 'e1')).toBe(true);
    expect(isQuestionFlagged(viewState, 'e2')).toBe(false);
    expect(countFlaggedQuestions(viewState)).toBe(1);

    viewState = toggleQuestionFlag(viewState, 'e5');
    expect(countFlaggedQuestions(viewState)).toBe(2);

    viewState = toggleQuestionFlag(viewState, 'e1');
    expect(viewState.flags).toEqual({ e5: true });
    expect(countFlaggedQuestions(viewState)).toBe(1);
  });

  it('ignores flag toggles that cannot apply', () => {
    const ready = readyState();
    const submitting = withExamSubmitting(ready);

    expect(toggleQuestionFlag(ready, 'ghost')).toBe(ready);
    expect(toggleQuestionFlag(ready, '')).toBe(ready);
    expect(toggleQuestionFlag(ready, undefined)).toBe(ready);
    expect(toggleQuestionFlag(submitting, 'e1')).toBe(submitting);
    expect(isQuestionFlagged(createExamViewState(), 'e1')).toBe(false);
    expect(countFlaggedQuestions(createExamViewState())).toBe(0);
  });

  it('lists every question with its number, state, and flag', () => {
    let viewState = withOptionAnswer(readyState(), 'e1', 1);
    viewState = toggleQuestionFlag(viewState, 'e1');
    viewState = toggleQuestionFlag(viewState, 'e5');

    const statuses = questionStatuses(viewState);

    expect(statuses).toHaveLength(6);
    expect(statuses[0]).toEqual({
      questionId: 'e1',
      number: 1,
      skill: 'core',
      part: 1,
      answered: true,
      flagged: true,
    });
    expect(statuses[1]).toMatchObject({
      questionId: 'e2',
      number: 2,
      skill: 'reading',
      answered: false,
      flagged: false,
    });
    expect(statuses[4]).toMatchObject({
      questionId: 'e5',
      number: 5,
      answered: false,
      flagged: true,
    });
    expect(statuses[5]).toMatchObject({ questionId: 'e6', number: 6, answered: false });
    expect(questionStatuses(createExamViewState())).toEqual([]);
  });

  it('reports an untouched sentence order as unanswered in the palette', () => {
    let viewState = readyState();

    expect(questionStatuses(viewState)[2]).toMatchObject({ questionId: 'e3', answered: false });

    viewState = moveSentence(viewState, 'e3', 1, 'down');

    expect(questionStatuses(viewState)[2]).toMatchObject({ questionId: 'e3', answered: true });
  });

  it('counts only flags that belong to the loaded test', () => {
    const viewState = { ...readyState(), flags: { e1: true, 'ghost-question': true } };

    expect(isQuestionFlagged(viewState, 'ghost-question')).toBe(false);
    expect(countFlaggedQuestions(viewState)).toBe(1);
    expect(toggleQuestionFlag(viewState, 'ghost-question')).toBe(viewState);
  });

  it('keeps flags through submission transitions and clears them for a new attempt', () => {
    const flagged = toggleQuestionFlag(readyState(), 'e1');
    const submitting = withExamSubmitting(flagged);
    const submitted = withExamSubmitted(submitting, { status: 'completed' }, { now: NOW });
    const failed = withSubmissionError(withExamSubmitting(flagged), { message: 'Offline' });

    expect(submitted.flags).toEqual({ e1: true });
    expect(failed.flags).toEqual({ e1: true });
    expect(withExamTest(createExamViewState(), EXAM_TEST, NOW).flags).toEqual({});
  });

  it('builds one answer per question, sending null for anything unanswered', () => {
    expect(buildSubmissionPayload(readyState())).toEqual({
      testId: 'test-exam-1',
      answers: [
        { questionId: 'e1', submittedAnswer: null },
        { questionId: 'e2', submittedAnswer: null },
        { questionId: 'e3', submittedAnswer: null },
        { questionId: 'e4', submittedAnswer: null },
        { questionId: 'e5', submittedAnswer: null },
        { questionId: 'e6', submittedAnswer: null },
      ],
    });
  });

  it('sends the stored answers in the AG-303 contract shapes', () => {
    const payload = buildSubmissionPayload(answeredState());

    expect(payload.testId).toBe('test-exam-1');
    expect(payload.answers[0]).toEqual({ questionId: 'e1', submittedAnswer: 1 });
    expect(payload.answers[1]).toEqual({
      questionId: 'e2',
      submittedAnswer: { d1: 0, d2: 0 },
    });
    expect(payload.answers[2]).toEqual({
      questionId: 'e3',
      submittedAnswer: moveSentence(readyState(), 'e3', 1, 'down').answers.e3,
    });
    expect(payload.answers[3]).toEqual({
      questionId: 'e4',
      submittedAnswer: { name: 'Amina Yusuf', city: 'Cairo' },
    });
    expect(payload.answers[4]).toEqual({
      questionId: 'e5',
      submittedAnswer: 'Dear Sir, I would like to request leave.',
    });
    expect(payload.answers[5]).toEqual({ questionId: 'e6', submittedAnswer: null });
  });

  it('drops out-of-range and unknown answer values from the payload', () => {
    let viewState = readyState();

    viewState = withOptionAnswer(viewState, 'e1', 9);
    viewState = withDropdownAnswer(viewState, 'e2', 'd1', 9);
    viewState = withDropdownAnswer(viewState, 'e2', 'unknown', 0);
    viewState = withTextField(viewState, 'e4', 'name', '   ');
    viewState = withTextField(viewState, 'e4', 'unknown', 'value');
    viewState = withEssayText(viewState, 'e5', '   ');

    const payload = buildSubmissionPayload(viewState);

    expect(payload.answers[0].submittedAnswer).toBeNull();
    expect(payload.answers[1].submittedAnswer).toBeNull();
    expect(payload.answers[3].submittedAnswer).toBeNull();
    expect(payload.answers[4].submittedAnswer).toBeNull();
  });

  it('counts words for the essay and form fields', () => {
    expect(countWords('  Dear   Sir,  I am writing. ')).toBe(5);
    expect(countWords('')).toBe(0);
    expect(countWords(null)).toBe(0);
  });

  it('moves ready to submitting to submitted with the server summary', () => {
    const ready = readyState();
    const submitting = withExamSubmitting(ready);
    const submitted = withExamSubmitted(
      submitting,
      { status: 'pending_review', autoScore: 50 },
      { now: NOW }
    );

    expect(ready.status).toBe('ready');
    expect(submitting.status).toBe('submitting');
    expect(submitted.status).toBe('submitted');
    expect(submitted.submittedAt).toBe('2026-11-23T09:00:00.000Z');
    expect(submitted.autoSubmitted).toBe(false);
    expect(submitted.result).toEqual({ status: 'pending_review', autoScore: 50 });

    expect(withExamSubmitting(submitting)).toBe(submitting);
    expect(withExamSubmitting(submitted)).toBe(submitted);
  });

  it('flags an automatic submission', () => {
    const submitted = withExamSubmitted(
      withExamSubmitting(readyState()),
      { status: 'completed' },
      {
        autoSubmitted: true,
        now: NOW,
      }
    );

    expect(submitted.autoSubmitted).toBe(true);
  });

  it('returns to ready with every answer kept when the submission fails', () => {
    const submitting = withExamSubmitting(answeredState());
    const failed = withSubmissionError(submitting, { message: 'Submission failed' });

    expect(failed.status).toBe('ready');
    expect(failed.answers).toEqual(submitting.answers);
    expect(failed.expiresAt).toBe(submitting.expiresAt);
    expect(failed.error).toEqual({ message: 'Submission failed', details: [] });
  });

  it('rehydrates answers and the original deadline for the same test', () => {
    const saved = {
      version: 1,
      testId: EXAM_TEST.id,
      startedAt: '2026-11-23T08:50:00.000Z',
      expiresAt: '2026-11-23T09:50:00.000Z',
      answers: { e1: 2, e2: { d1: 1 } },
      submittedAt: null,
      autoSubmitted: false,
      result: null,
    };

    const viewState = hydrateExamViewState(saved, EXAM_TEST, NOW);

    expect(viewState.status).toBe('ready');
    expect(viewState.startedAt).toBe('2026-11-23T08:50:00.000Z');
    expect(viewState.expiresAt).toBe('2026-11-23T09:50:00.000Z');
    expect(viewState.answers).toEqual({ e1: 2, e2: { d1: 1 } });
  });

  it('starts a fresh exam when the saved attempt belongs to another test', () => {
    const saved = {
      version: 1,
      testId: 'another-test',
      startedAt: '2026-11-23T08:50:00.000Z',
      expiresAt: '2026-11-23T09:50:00.000Z',
      answers: { e1: 2 },
      submittedAt: null,
      autoSubmitted: false,
      result: null,
    };

    const viewState = hydrateExamViewState(saved, EXAM_TEST, NOW);

    expect(viewState.status).toBe('ready');
    expect(viewState.answers).toEqual({});
    expect(viewState.expiresAt).toBe('2026-11-23T10:00:00.000Z');
  });

  it('ignores saved answers for questions the test does not contain', () => {
    const saved = {
      version: 1,
      testId: EXAM_TEST.id,
      startedAt: '2026-11-23T08:50:00.000Z',
      expiresAt: '2026-11-23T09:50:00.000Z',
      answers: { e1: 1, 'ghost-question': 'value', e3: ['s1'] },
      submittedAt: null,
      autoSubmitted: false,
      result: null,
    };

    const viewState = hydrateExamViewState(saved, EXAM_TEST, NOW);

    expect(viewState.answers).toEqual({ e1: 1 });
  });

  it('restores flags for this test and drops unknown ones', () => {
    const saved = {
      version: 1,
      testId: EXAM_TEST.id,
      startedAt: '2026-11-23T08:50:00.000Z',
      expiresAt: '2026-11-23T09:50:00.000Z',
      answers: { e1: 1 },
      flags: { e3: true, 'ghost-question': true, e5: 'yes' },
      submittedAt: null,
      autoSubmitted: false,
      result: null,
    };

    const viewState = hydrateExamViewState(saved, EXAM_TEST, NOW);

    expect(viewState.flags).toEqual({ e3: true });
    expect(isQuestionFlagged(viewState, 'e3')).toBe(true);
  });

  it('hydrates a record written before flags existed', () => {
    const saved = {
      version: 1,
      testId: EXAM_TEST.id,
      startedAt: '2026-11-23T08:50:00.000Z',
      expiresAt: '2026-11-23T09:50:00.000Z',
      answers: { e1: 2 },
      submittedAt: null,
      autoSubmitted: false,
      result: null,
    };

    const viewState = hydrateExamViewState(saved, EXAM_TEST, NOW);

    expect(viewState.status).toBe('ready');
    expect(viewState.answers).toEqual({ e1: 2 });
    expect(viewState.flags).toEqual({});
  });

  it('restores a submitted attempt instead of restarting it', () => {
    const saved = {
      version: 1,
      testId: EXAM_TEST.id,
      startedAt: '2026-11-23T08:50:00.000Z',
      expiresAt: '2026-11-23T09:50:00.000Z',
      answers: { e1: 1 },
      submittedAt: '2026-11-23T09:20:00.000Z',
      autoSubmitted: true,
      result: { status: 'pending_review', autoScore: 50 },
    };

    const viewState = hydrateExamViewState(saved, EXAM_TEST, NOW);

    expect(viewState.status).toBe('submitted');
    expect(viewState.submittedAt).toBe('2026-11-23T09:20:00.000Z');
    expect(viewState.autoSubmitted).toBe(true);
    expect(viewState.result).toEqual({ status: 'pending_review', autoScore: 50 });
  });
});

describe('Exam progress storage', () => {
  it('persists answers, the deadline, and the result for this tab', () => {
    expect(examProgressKey(EXAM_TEST.id)).toBe('aptis-go:exam-progress:test-exam-1');

    saveExamProgress(answeredState(), NOW);

    const saved = readExamProgress(EXAM_TEST.id);

    expect(saved.testId).toBe(EXAM_TEST.id);
    expect(saved.expiresAt).toBe('2026-11-23T10:00:00.000Z');
    expect(saved.answers.e1).toBe(1);
    expect(saved.flags).toEqual({});
    expect(saved.updatedAt).toBe('2026-11-23T09:00:00.000Z');
  });

  it('persists question flags with the attempt', () => {
    saveExamProgress(toggleQuestionFlag(answeredState(), 'e3'), NOW);

    expect(readExamProgress(EXAM_TEST.id).flags).toEqual({ e3: true });
  });

  it('accepts a stored record that predates flags', () => {
    const legacy = {
      version: 1,
      testId: EXAM_TEST.id,
      startedAt: '2026-11-23T08:50:00.000Z',
      expiresAt: '2026-11-23T09:50:00.000Z',
      answers: { e1: 2 },
      submittedAt: null,
      autoSubmitted: false,
      result: null,
      updatedAt: '2026-11-23T08:51:00.000Z',
    };

    sessionStorage.setItem(examProgressKey(EXAM_TEST.id), JSON.stringify(legacy));

    const saved = readExamProgress(EXAM_TEST.id);

    expect(saved).not.toBeNull();
    expect(saved.answers).toEqual({ e1: 2 });
    expect(saved.flags).toBeUndefined();
  });

  it('does not restore another test or a corrupt record', () => {
    saveExamProgress(readyState(), NOW);

    expect(readExamProgress('another-test')).toBeNull();

    sessionStorage.setItem(examProgressKey(EXAM_TEST.id), '{not json');
    expect(readExamProgress(EXAM_TEST.id)).toBeNull();
  });

  it('stores a submitted attempt with its summary', () => {
    const submitted = withExamSubmitted(
      withExamSubmitting(answeredState()),
      { status: 'completed' },
      { now: NOW }
    );

    saveExamProgress(submitted, NOW);

    const saved = readExamProgress(EXAM_TEST.id);

    expect(saved.submittedAt).toBe('2026-11-23T09:00:00.000Z');
    expect(saved.result).toEqual({ status: 'completed' });
  });

  it('clears the stored attempt', () => {
    saveExamProgress(readyState(), NOW);
    clearExamProgress();

    expect(readExamProgress(EXAM_TEST.id)).toBeNull();
  });
});
