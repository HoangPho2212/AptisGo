import { describe, expect, it } from 'vitest';

import {
  createGoalViewState,
  isGoalSubmitDisabled,
  validateGoalViewState,
  withDailyMinutes,
  withDeadline,
  withGoalError,
  withGoalSubmitting,
  withGoalSuccess,
  withTarget,
} from '../client/src/goals/goalViewState.js';

const NOW = new Date('2026-11-15T10:00:00.000Z');

describe('GoalViewState', () => {
  it('starts idle with a B2 default and a 45 minute target', () => {
    expect(createGoalViewState()).toEqual({
      status: 'idle',
      targetCertificate: 'B2',
      deadline: '',
      dailyMinutesTarget: 45,
      fieldErrors: {},
      error: null,
      result: null,
    });
  });

  it('accepts B1 and B2 and ignores other certificates', () => {
    expect(withTarget(createGoalViewState(), 'B1').targetCertificate).toBe('B1');
    expect(withTarget(createGoalViewState(), 'B2').targetCertificate).toBe('B2');
    expect(withTarget(createGoalViewState(), 'C1').targetCertificate).toBe('B2');
  });

  it('stores the deadline and clears the previous field error', () => {
    const failed = {
      ...createGoalViewState(),
      fieldErrors: { deadline: 'deadline is required' },
    };

    const viewState = withDeadline(failed, '2026-12-15');

    expect(viewState.deadline).toBe('2026-12-15');
    expect(viewState.fieldErrors.deadline).toBeUndefined();
  });

  it('stores a daily minutes target', () => {
    expect(withDailyMinutes(createGoalViewState(), 60).dailyMinutesTarget).toBe(60);
  });

  it('requires a deadline before submitting', () => {
    const result = validateGoalViewState(createGoalViewState(), NOW);

    expect(result.value).toBeNull();
    expect(result.errors).toEqual({ deadline: 'deadline is required' });
  });

  it('rejects a past deadline with the API message', () => {
    const viewState = withDeadline(createGoalViewState(), '2026-11-14');
    const result = validateGoalViewState(viewState, NOW);

    expect(result.value).toBeNull();
    expect(result.errors.deadline).toBe('Deadline must be a future date');
  });

  it('rejects an out-of-range daily minutes target', () => {
    const low = validateGoalViewState(
      { ...withDeadline(createGoalViewState(), '2026-12-15'), dailyMinutesTarget: 10 },
      NOW
    );
    const fractional = validateGoalViewState(
      { ...withDeadline(createGoalViewState(), '2026-12-15'), dailyMinutesTarget: 45.5 },
      NOW
    );

    expect(low.errors.dailyMinutesTarget).toBe(
      'dailyMinutesTarget must be an integer between 15 and 240'
    );
    expect(fractional.errors.dailyMinutesTarget).toBe(
      'dailyMinutesTarget must be an integer between 15 and 240'
    );
  });

  it('returns a valid request body', () => {
    const viewState = withDeadline(withTarget(createGoalViewState(), 'B1'), '2026-12-15');
    const result = validateGoalViewState(withDailyMinutes(viewState, 60), NOW);

    expect(result.errors).toEqual({});
    expect(result.value).toEqual({
      targetCertificate: 'B1',
      deadline: '2026-12-15',
      dailyMinutesTarget: 60,
    });
  });

  it('tracks submitting, success, and failure', () => {
    const submitting = withGoalSubmitting(createGoalViewState());

    expect(submitting.status).toBe('submitting');
    expect(isGoalSubmitDisabled(submitting)).toBe(true);
    expect(isGoalSubmitDisabled(createGoalViewState())).toBe(false);

    const result = { goal: { id: 'goal-1' }, roadmap: { totalDays: 31 } };
    const success = withGoalSuccess(submitting, result);

    expect(success.status).toBe('success');
    expect(success.result).toBe(result);
    expect(success.error).toBeNull();

    const failed = withGoalError(submitting, {
      message: 'Validation failed',
      details: ['Deadline must be a future date'],
    });

    expect(failed.status).toBe('error');
    expect(failed.error).toEqual({
      message: 'Validation failed',
      details: ['Deadline must be a future date'],
    });
  });

  it('normalises a failure without details', () => {
    const failed = withGoalError(createGoalViewState(), { message: 'Request failed' });

    expect(failed.error).toEqual({ message: 'Request failed', details: [] });
  });
});
