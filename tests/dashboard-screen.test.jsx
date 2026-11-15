import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { saveSession } from '../client/src/auth/authStorage.js';
import {
  getApiRequests,
  getAuthorizationHeader,
  installApiAdapter,
  resetApiAdapter,
} from './auth-test-utils.jsx';
import { STUDENT_SESSION, isoDateDaysFromNow, renderAt } from './screen-fixtures.jsx';

function todayPlanResponse(overrides = {}) {
  return {
    goal: {
      id: 'goal-1',
      targetCertificate: 'B2',
      deadline: isoDateDaysFromNow(30),
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

const TASK_UPDATE_RESPONSE = {
  task: {
    id: 'task-2',
    planId: 'plan-3',
    dayNumber: 3,
    title: 'Listening Part 1: Information matching',
    skill: 'listening',
    partNumber: 1,
    points: 10,
    isCompleted: true,
  },
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
};

/**
 * @param {{ get?: Function, patch?: Function }} handlers
 */
function serveDashboard({ get, patch } = {}) {
  installApiAdapter((config) => {
    if (config.method === 'get' && config.url === '/api/study-plans/today') {
      return get ? get(config) : { status: 200, data: todayPlanResponse() };
    }

    if (config.method === 'patch' && config.url.startsWith('/api/study-plans/tasks/')) {
      return patch ? patch(config) : { status: 200, data: TASK_UPDATE_RESPONSE };
    }

    return { status: 404, data: { error: 'Not found' } };
  });
}

function progressbar(name) {
  return screen.getByRole('progressbar', { name });
}

beforeEach(() => {
  sessionStorage.clear();
  saveSession(STUDENT_SESSION);
});

afterEach(() => {
  resetApiAdapter();
  sessionStorage.clear();
});

describe('Student dashboard', () => {
  it("renders today's checklist, goal summary, and both progress bars", async () => {
    serveDashboard();

    renderAt('/dashboard');

    expect(
      await screen.findByRole('heading', { name: /today's study roadmap/i })
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText(/aptis b2/i)).toBeInTheDocument();
    expect(screen.getByText(/day 3 of 31/i)).toBeInTheDocument();
    expect(screen.getByText(/days to deadline/i)).toBeInTheDocument();

    expect(screen.getByRole('checkbox', { name: /grammar practice/i })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /information matching/i })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: /sentence completion/i })).not.toBeChecked();

    expect(progressbar("Today's plan")).toHaveAttribute('aria-valuenow', '33.3');
    expect(progressbar("Today's plan")).toHaveAttribute('aria-valuemin', '0');
    expect(progressbar("Today's plan")).toHaveAttribute('aria-valuemax', '100');
    expect(progressbar('Roadmap')).toHaveAttribute('aria-valuenow', '4.3');
    expect(screen.getByText(/1 of 3 tasks/i)).toBeInTheDocument();
    expect(screen.getByText(/4 of 93 tasks/i)).toBeInTheDocument();
    expect(screen.getByText(/10 of 30 points/i)).toBeInTheDocument();
  });

  it('confirms a completed task through PATCH and applies the server progress', async () => {
    serveDashboard();
    const user = userEvent.setup();

    renderAt('/dashboard');

    const checkbox = await screen.findByRole('checkbox', {
      name: /information matching/i,
    });

    await user.click(checkbox);

    await waitFor(() => expect(checkbox).toBeChecked());

    const [request] = getApiRequests().filter((entry) => entry.method === 'patch');

    expect(request.url).toBe('/api/study-plans/tasks/task-2');
    expect(JSON.parse(request.data)).toEqual({ isCompleted: true });
    expect(getAuthorizationHeader(request)).toBe('Bearer signed.jwt.token');

    await waitFor(() =>
      expect(progressbar("Today's plan")).toHaveAttribute('aria-valuenow', '66.7')
    );
    expect(progressbar('Roadmap')).toHaveAttribute('aria-valuenow', '5.4');
    expect(screen.getByText(/2 of 3 tasks/i)).toBeInTheDocument();
    expect(screen.getByText(/5 of 93 tasks/i)).toBeInTheDocument();
  });

  it('locks every checkbox while a completion request is in flight', async () => {
    let release;
    const gate = new Promise((resolve) => {
      release = resolve;
    });

    serveDashboard({
      patch: async () => {
        await gate;
        return { status: 200, data: TASK_UPDATE_RESPONSE };
      },
    });

    const user = userEvent.setup();

    renderAt('/dashboard');

    const checkbox = await screen.findByRole('checkbox', {
      name: /information matching/i,
    });

    await user.click(checkbox);

    await waitFor(() => expect(checkbox).toBeDisabled());
    expect(screen.getByRole('checkbox', { name: /grammar practice/i })).toBeDisabled();
    expect(progressbar("Today's plan")).toHaveAttribute('aria-valuenow', '33.3');

    release();

    await waitFor(() =>
      expect(progressbar("Today's plan")).toHaveAttribute('aria-valuenow', '66.7')
    );
    expect(checkbox).toBeEnabled();
  });

  it('keeps the previous state and reports a failed completion', async () => {
    serveDashboard({
      patch: () => ({ status: 404, data: { error: 'Task not found' } }),
    });

    const user = userEvent.setup();

    renderAt('/dashboard');

    const checkbox = await screen.findByRole('checkbox', {
      name: /information matching/i,
    });

    await user.click(checkbox);

    expect(await screen.findByRole('alert')).toHaveTextContent('Task not found');
    expect(checkbox).not.toBeChecked();
    expect(checkbox).toBeEnabled();
    expect(progressbar("Today's plan")).toHaveAttribute('aria-valuenow', '33.3');
  });

  it('shows the empty state and a link to goal setting when no goal exists', async () => {
    serveDashboard({
      get: () => ({ status: 404, data: { error: 'Goal not found' } }),
    });

    renderAt('/dashboard');

    expect(await screen.findByText(/you have not set a study goal yet/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /set your study goal/i })).toHaveAttribute(
      'href',
      '/goals'
    );
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('retries after a failed load', async () => {
    let attempts = 0;

    serveDashboard({
      get: () => {
        attempts += 1;

        return attempts === 1
          ? { status: 500, data: { error: 'Cannot load today' } }
          : { status: 200, data: todayPlanResponse() };
      },
    });

    const user = userEvent.setup();

    renderAt('/dashboard');

    expect(await screen.findByText('Cannot load today')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /try again/i }));

    expect(await screen.findByRole('checkbox', { name: /grammar practice/i })).toBeChecked();
    expect(attempts).toBe(2);
  });

  it('celebrates a fully completed day at 100 percent', async () => {
    const complete = todayPlanResponse();
    complete.day.tasks = complete.day.tasks.map((task) => ({ ...task, isCompleted: true }));
    complete.progress = {
      completedTasks: 3,
      totalTasks: 3,
      percent: 100,
      completedPoints: 30,
      totalPoints: 30,
    };

    serveDashboard({ get: () => ({ status: 200, data: complete }) });

    renderAt('/dashboard');

    expect(await screen.findByText(/today's plan is complete/i)).toBeInTheDocument();
    expect(progressbar("Today's plan")).toHaveAttribute('aria-valuenow', '100');
    expect(screen.getByText(/3 of 3 tasks/i)).toBeInTheDocument();
  });

  it('shows the day tasks inside a labelled section', async () => {
    serveDashboard();

    renderAt('/dashboard');

    const section = await screen.findByRole('region', { name: /today's tasks/i });

    expect(within(section).getByText(/grammar practice/i)).toBeInTheDocument();
    expect(within(section).getByText(/listening · part 1/i)).toBeInTheDocument();
  });
});
