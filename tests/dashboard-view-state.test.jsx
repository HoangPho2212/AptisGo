import { describe, expect, it } from 'vitest';

import {
  GOAL_NOT_FOUND_MESSAGE,
  INCOMPLETE_PAYLOAD_MESSAGE,
  createDashboardViewState,
  findTask,
  isTaskToggleDisabled,
  summarizeToday,
  withDashboardEmpty,
  withDashboardError,
  withDashboardLoading,
  withTaskError,
  withTaskPending,
  withTaskUpdated,
  withTodayPlan,
} from '../client/src/dashboard/dashboardViewState.js';

function todayPlan(overrides = {}) {
  return {
    goal: {
      id: 'goal-1',
      targetCertificate: 'B2',
      deadline: '2026-12-15',
      dailyMinutesTarget: 45,
    },
    day: {
      id: 'plan-3',
      dayNumber: 3,
      totalDays: 31,
      tasks: [
        {
          id: 'task-1',
          title: 'Core Part 1: Grammar practice',
          skill: 'core',
          partNumber: 1,
          points: 10,
          isCompleted: true,
        },
        {
          id: 'task-2',
          title: 'Listening Part 1: Information matching',
          skill: 'listening',
          partNumber: 1,
          points: 10,
          isCompleted: false,
        },
        {
          id: 'task-3',
          title: 'Reading Part 1: Sentence completion',
          skill: 'reading',
          partNumber: 1,
          points: 10,
          isCompleted: false,
        },
      ],
    },
    progress: {
      completedTasks: 1,
      totalTasks: 3,
      percent: 33.3,
      completedPoints: 10,
      totalPoints: 30,
    },
    roadmap: {
      completedTasks: 4,
      totalTasks: 93,
      percent: 4.3,
      completedPoints: 40,
      totalPoints: 930,
    },
    ...overrides,
  };
}

function readyState() {
  return withTodayPlan(createDashboardViewState(), todayPlan(), new Date('2026-11-15T09:00:00Z'));
}

describe('DashboardViewState', () => {
  it('starts loading without data or errors', () => {
    const viewState = createDashboardViewState();

    expect(viewState).toEqual({
      status: 'loading',
      data: null,
      pendingTaskId: null,
      error: null,
      lastUpdatedAt: null,
    });
  });

  it('stores a valid today payload and the update timestamp', () => {
    const viewState = withTodayPlan(
      createDashboardViewState(),
      todayPlan(),
      new Date('2026-11-15T09:00:00.000Z')
    );

    expect(viewState.status).toBe('ready');
    expect(viewState.data.goal.targetCertificate).toBe('B2');
    expect(viewState.data.day.dayNumber).toBe(3);
    expect(viewState.error).toBeNull();
    expect(viewState.lastUpdatedAt).toBe('2026-11-15T09:00:00.000Z');
  });

  it('rejects an incomplete payload instead of rendering partial data', () => {
    const viewState = withTodayPlan(createDashboardViewState(), {
      goal: todayPlan().goal,
      day: null,
      progress: {},
      roadmap: {},
    });

    expect(viewState.status).toBe('error');
    expect(viewState.data).toBeNull();
    expect(viewState.error).toEqual({ message: INCOMPLETE_PAYLOAD_MESSAGE, details: [] });
  });

  it('maps a missing goal to the empty state', () => {
    const viewState = withDashboardEmpty(
      createDashboardViewState(),
      'Set a goal to build your roadmap.'
    );

    expect(viewState.status).toBe('empty');
    expect(viewState.data).toBeNull();
    expect(viewState.error).toEqual({ message: 'Set a goal to build your roadmap.', details: [] });
  });

  it('exposes the server goal-not-found message', () => {
    expect(GOAL_NOT_FOUND_MESSAGE).toBe('Goal not found');
  });

  it('normalises an unknown error and clears pending work', () => {
    const pending = withTaskPending(readyState(), 'task-2');
    const viewState = withDashboardError(pending, {});

    expect(viewState.status).toBe('error');
    expect(viewState.pendingTaskId).toBeNull();
    expect(viewState.error).toEqual({
      message: 'Something went wrong. Please try again.',
      details: [],
    });
  });

  it('returns to loading for a retry while keeping the error history out of the way', () => {
    const failed = withDashboardError(createDashboardViewState(), { message: 'Server error' });
    const loading = withDashboardLoading(failed);

    expect(loading.status).toBe('loading');
    expect(loading.error).toBeNull();
    expect(loading.pendingTaskId).toBeNull();
  });

  it('locks every task while one completion is pending', () => {
    const viewState = withTaskPending(readyState(), 'task-2');

    expect(viewState.pendingTaskId).toBe('task-2');
    expect(isTaskToggleDisabled(viewState, 'task-1')).toBe(true);
    expect(isTaskToggleDisabled(viewState, 'task-2')).toBe(true);
    expect(isTaskToggleDisabled(viewState, 'task-3')).toBe(true);
  });

  it('ignores a pending or unknown task id', () => {
    const ready = readyState();

    expect(withTaskPending(ready, 'missing')).toBe(ready);
    expect(isTaskToggleDisabled(ready, 'task-2')).toBe(false);
  });

  it('applies the confirmed task state and the server progress blocks', () => {
    const pending = withTaskPending(readyState(), 'task-2');
    const viewState = withTaskUpdated(
      pending,
      {
        taskId: 'task-2',
        isCompleted: true,
        plan: {
          id: 'plan-3',
          dayNumber: 3,
          completedTasks: 2,
          totalTasks: 3,
          percent: 66.7,
          completedPoints: 20,
          totalPoints: 30,
        },
        roadmap: {
          completedTasks: 5,
          totalTasks: 93,
          percent: 5.4,
          completedPoints: 50,
          totalPoints: 930,
        },
      },
      new Date('2026-11-15T09:05:00.000Z')
    );

    expect(findTask(viewState.data, 'task-2')).toMatchObject({ isCompleted: true });
    expect(viewState.data.progress.percent).toBe(66.7);
    expect(viewState.data.roadmap.percent).toBe(5.4);
    expect(viewState.pendingTaskId).toBeNull();
    expect(viewState.error).toBeNull();
    expect(viewState.lastUpdatedAt).toBe('2026-11-15T09:05:00.000Z');
  });

  it('ignores a completion response for a task that is no longer on screen', () => {
    const ready = readyState();

    expect(
      withTaskUpdated(ready, {
        taskId: 'task-99',
        isCompleted: true,
        plan: ready.data.progress,
        roadmap: ready.data.roadmap,
      })
    ).toBe(ready);
  });

  it('keeps the checklist usable after a failed toggle', () => {
    const pending = withTaskPending(readyState(), 'task-2');
    const viewState = withTaskError(pending, { message: 'Task not found' });

    expect(viewState.status).toBe('ready');
    expect(viewState.data).toEqual(readyState().data);
    expect(viewState.pendingTaskId).toBeNull();
    expect(viewState.error).toEqual({ message: 'Task not found', details: [] });
    expect(findTask(viewState.data, 'task-2').isCompleted).toBe(false);
  });

  it('summarises today and flags a finished plan', () => {
    const ready = readyState();

    expect(summarizeToday(ready.data)).toEqual({
      completedTasks: 1,
      totalTasks: 3,
      allComplete: false,
    });

    const finished = todayPlan();
    finished.day.tasks = finished.day.tasks.map((task) => ({ ...task, isCompleted: true }));
    finished.progress = {
      completedTasks: 3,
      totalTasks: 3,
      percent: 100,
      completedPoints: 30,
      totalPoints: 30,
    };

    expect(summarizeToday(finished)).toEqual({
      completedTasks: 3,
      totalTasks: 3,
      allComplete: true,
    });
  });

  it('returns null for an unknown task', () => {
    expect(findTask(readyState().data, 'task-99')).toBeNull();
    expect(findTask(null, 'task-1')).toBeNull();
  });
});
