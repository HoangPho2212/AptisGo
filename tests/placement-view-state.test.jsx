import { describe, expect, it } from 'vitest';

import {
  canFinishPlacement,
  countAnswerableQuestions,
  countAnsweredQuestions,
  createPlacementViewState,
  finishPlacement,
  getCurrentQuestion,
  goToQuestion,
  hydratePlacementViewState,
  isQuestionAnswerable,
  isQuestionAnswered,
  nextQuestion,
  previousQuestion,
  withDropdownAnswer,
  withOptionAnswer,
  withPlacementError,
  withPlacementTest,
} from '../client/src/placement/placementViewState.js';
import { PLACEMENT_TEST } from './screen-fixtures.jsx';

function readyState(test = PLACEMENT_TEST) {
  return withPlacementTest(createPlacementViewState(), test);
}

function answeredState() {
  let viewState = readyState();
  viewState = withOptionAnswer(viewState, 'q1', 1);
  viewState = withDropdownAnswer(viewState, 'q2', 's1', 0);
  viewState = withDropdownAnswer(viewState, 'q2', 's2', 1);
  return viewState;
}

describe('PlacementViewState', () => {
  it('starts loading with no answers and no result', () => {
    expect(createPlacementViewState()).toEqual({
      version: 1,
      status: 'loading',
      test: null,
      answers: {},
      currentIndex: 0,
      error: null,
      completedAt: null,
    });
  });

  it('moves to ready when the test arrives', () => {
    const viewState = readyState();

    expect(viewState.status).toBe('ready');
    expect(viewState.test).toBe(PLACEMENT_TEST);
    expect(getCurrentQuestion(viewState).id).toBe('q1');
  });

  it('records an error without a test', () => {
    const viewState = withPlacementError(createPlacementViewState(), {
      message: 'Placement test not found',
      details: [],
    });

    expect(viewState.status).toBe('error');
    expect(viewState.error).toEqual({ message: 'Placement test not found', details: [] });
  });

  it('classifies answerable question types', () => {
    const [choice, dropdown, audio] = PLACEMENT_TEST.questions;

    expect(isQuestionAnswerable(choice)).toBe(true);
    expect(isQuestionAnswerable(dropdown)).toBe(true);
    expect(isQuestionAnswerable(audio)).toBe(false);
    expect(countAnswerableQuestions(PLACEMENT_TEST)).toBe(2);
  });

  it('only treats a dropdown question as answered when every set is filled', () => {
    const dropdown = PLACEMENT_TEST.questions[1];

    expect(isQuestionAnswered(dropdown, { kind: 'dropdowns', selections: { s1: 0 } })).toBe(false);
    expect(isQuestionAnswered(dropdown, { kind: 'dropdowns', selections: { s1: 0, s2: 1 } })).toBe(
      true
    );
  });

  it('rejects an option index outside the option list', () => {
    const choice = PLACEMENT_TEST.questions[0];

    expect(isQuestionAnswered(choice, { kind: 'option', optionIndex: 9 })).toBe(false);
  });

  it('counts one answer per answered question', () => {
    let viewState = readyState();

    expect(countAnsweredQuestions(viewState)).toBe(0);

    viewState = withOptionAnswer(viewState, 'q1', 0);
    viewState = withDropdownAnswer(viewState, 'q2', 's1', 0);

    expect(countAnsweredQuestions(viewState)).toBe(1);

    viewState = withDropdownAnswer(viewState, 'q2', 's2', 0);

    expect(countAnsweredQuestions(viewState)).toBe(2);
  });

  it('blocks finishing until every answerable question is answered', () => {
    const viewState = readyState();

    expect(canFinishPlacement(viewState)).toBe(false);

    let partial = withOptionAnswer(viewState, 'q1', 2);

    expect(canFinishPlacement(partial)).toBe(false);

    partial = answeredState();

    expect(canFinishPlacement(partial)).toBe(true);
  });

  it('cannot finish a test with nothing answerable', () => {
    const emptyTest = {
      ...PLACEMENT_TEST,
      questionCount: 1,
      questions: [PLACEMENT_TEST.questions[2]],
    };
    const viewState = readyState(emptyTest);

    expect(canFinishPlacement(viewState)).toBe(false);
  });

  it('clamps navigation inside the question list', () => {
    let viewState = readyState();

    viewState = nextQuestion(viewState);
    expect(viewState.currentIndex).toBe(1);

    viewState = goToQuestion(viewState, 99);
    expect(viewState.currentIndex).toBe(2);

    viewState = nextQuestion(viewState);
    expect(viewState.currentIndex).toBe(2);

    viewState = goToQuestion(viewState, -5);
    expect(viewState.currentIndex).toBe(0);

    viewState = previousQuestion(viewState);
    expect(viewState.currentIndex).toBe(0);
  });

  it('marks the diagnostic finished with an ISO timestamp', () => {
    const now = new Date('2026-11-15T09:30:00.000Z');
    const viewState = finishPlacement(answeredState(), now);

    expect(viewState.status).toBe('finished');
    expect(viewState.completedAt).toBe('2026-11-15T09:30:00.000Z');
  });

  it('does not finish an incomplete diagnostic', () => {
    const viewState = finishPlacement(readyState(), new Date('2026-11-15T09:30:00.000Z'));

    expect(viewState.status).toBe('ready');
    expect(viewState.completedAt).toBeNull();
  });

  it('rehydrates saved answers for the same test', () => {
    const saved = {
      version: 1,
      test: { id: PLACEMENT_TEST.id, title: PLACEMENT_TEST.title, answerableCount: 2 },
      answers: {
        q1: { kind: 'option', optionIndex: 2 },
        q2: { kind: 'dropdowns', selections: { s1: 1, s2: 0 } },
      },
      currentIndex: 1,
      completedAt: '2026-11-15T09:30:00.000Z',
    };

    const viewState = hydratePlacementViewState(saved, PLACEMENT_TEST);

    expect(viewState.status).toBe('finished');
    expect(viewState.answers).toEqual(saved.answers);
    expect(viewState.currentIndex).toBe(1);
    expect(viewState.completedAt).toBe('2026-11-15T09:30:00.000Z');
  });

  it('ignores saved answers for a different test', () => {
    const saved = {
      version: 1,
      test: { id: 'another-test', title: 'Other', answerableCount: 2 },
      answers: { q1: { kind: 'option', optionIndex: 0 } },
      currentIndex: 1,
      completedAt: '2026-11-15T09:30:00.000Z',
    };

    const viewState = hydratePlacementViewState(saved, PLACEMENT_TEST);

    expect(viewState.status).toBe('ready');
    expect(viewState.answers).toEqual({});
    expect(viewState.currentIndex).toBe(0);
  });
});
