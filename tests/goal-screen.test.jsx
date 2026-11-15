import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { saveSession } from '../client/src/auth/authStorage.js';
import {
  PLACEMENT_PROGRESS_KEY,
  savePlacementProgress,
} from '../client/src/placement/placementProgressStorage.js';
import {
  getApiRequests,
  getAuthorizationHeader,
  installApiAdapter,
  resetApiAdapter,
} from './auth-test-utils.jsx';
import {
  PLACEMENT_TEST,
  STUDENT_SESSION,
  isoDateDaysFromNow,
  renderAt,
} from './screen-fixtures.jsx';

const GOAL_RESPONSE = {
  goal: {
    id: 'goal-1',
    targetCertificate: 'B1',
    deadline: '2026-12-27T23:59:59.999Z',
    dailyMinutesTarget: 75,
    remainingDays: 42,
  },
  roadmap: {
    totalDays: 42,
    tasksPerDay: 5,
    totalTasks: 210,
    firstDayNumber: 1,
    lastDayNumber: 42,
  },
};

function serveGoal(response = { status: 201, data: GOAL_RESPONSE }) {
  installApiAdapter((config) => {
    if (config.method === 'post' && config.url === '/api/goals') {
      return response;
    }

    return { status: 404, data: { error: 'Not found' } };
  });
}

async function fillValidGoal(user, { target = null, minutes = '75', deadline } = {}) {
  if (target) {
    await user.click(screen.getByRole('radio', { name: target }));
  }

  fireEvent.change(screen.getByLabelText(/official test deadline/i), {
    target: { value: deadline ?? isoDateDaysFromNow(30) },
  });

  if (minutes) {
    await user.selectOptions(screen.getByLabelText(/daily study time/i), minutes);
  }
}

function goalRequests() {
  return getApiRequests().filter((request) => request.url === '/api/goals');
}

beforeEach(() => {
  sessionStorage.clear();
  saveSession(STUDENT_SESSION);
});

afterEach(() => {
  resetApiAdapter();
  sessionStorage.clear();
});

describe('Goal screen', () => {
  it('renders the baseline, B1/B2 selector, deadline picker, and cadence controls', async () => {
    renderAt('/goals');

    expect(
      await screen.findByRole('heading', { name: /set your study goal/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/current baseline/i)).toBeInTheDocument();
    expect(screen.getByText('B1')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /aptis b2/i })).toBeChecked();
    expect(screen.getByRole('radio', { name: /aptis b1/i })).not.toBeChecked();
    expect(screen.getByLabelText(/official test deadline/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/daily study time/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /generate my study plan/i })).toBeInTheDocument();
  });

  it('does not offer C1 even though the API accepts it', async () => {
    renderAt('/goals');

    await screen.findByRole('heading', { name: /set your study goal/i });

    expect(screen.queryByRole('radio', { name: /aptis c1/i })).not.toBeInTheDocument();
  });

  it('blocks submission without a deadline', async () => {
    serveGoal();
    const user = userEvent.setup();

    renderAt('/goals');
    await screen.findByRole('heading', { name: /set your study goal/i });
    await user.click(screen.getByRole('button', { name: /generate my study plan/i }));

    expect(await screen.findByText('deadline is required')).toBeInTheDocument();
    expect(goalRequests()).toHaveLength(0);
  });

  it('rejects a past deadline before calling the API', async () => {
    serveGoal();
    const user = userEvent.setup();

    renderAt('/goals');
    await screen.findByRole('heading', { name: /set your study goal/i });
    await fillValidGoal(user, { deadline: isoDateDaysFromNow(-3) });
    await user.click(screen.getByRole('button', { name: /generate my study plan/i }));

    expect(await screen.findByText('Deadline must be a future date')).toBeInTheDocument();
    expect(goalRequests()).toHaveLength(0);
  });

  it('posts the chosen goal and shows the generated roadmap', async () => {
    serveGoal();
    const user = userEvent.setup();

    renderAt('/goals');
    await screen.findByRole('heading', { name: /set your study goal/i });
    const deadline = isoDateDaysFromNow(30);
    await fillValidGoal(user, { target: /aptis b1/i, minutes: '75', deadline });
    await user.click(screen.getByRole('button', { name: /generate my study plan/i }));

    const request = goalRequests()[0];

    expect(request.method).toBe('post');
    expect(getAuthorizationHeader(request)).toBe('Bearer signed.jwt.token');
    expect(JSON.parse(request.data)).toEqual({
      targetCertificate: 'B1',
      deadline,
      dailyMinutesTarget: 75,
    });

    const result = await screen.findByRole('region', { name: /your study plan is ready/i });

    expect(within(result).getByText(/aptis b1/i)).toBeInTheDocument();
    expect(within(result).getByText(/42 days/i)).toBeInTheDocument();
    expect(within(result).getByText(/5 tasks per day/i)).toBeInTheDocument();
    expect(within(result).getByText(/210 tasks/i)).toBeInTheDocument();
    expect(within(result).getByRole('link', { name: /open my workspace/i })).toHaveAttribute(
      'href',
      '/student'
    );
  });

  it('surfaces server validation details', async () => {
    serveGoal({
      status: 400,
      data: { error: 'Validation failed', details: ['Deadline must be a future date'] },
    });
    const user = userEvent.setup();

    renderAt('/goals');
    await screen.findByRole('heading', { name: /set your study goal/i });
    await fillValidGoal(user);
    await user.click(screen.getByRole('button', { name: /generate my study plan/i }));

    expect(await screen.findByText('Validation failed')).toBeInTheDocument();
    expect(screen.getByText('Deadline must be a future date')).toBeInTheDocument();
  });

  it('reports the diagnostic answers captured in this tab', async () => {
    savePlacementProgress(
      {
        status: 'finished',
        test: PLACEMENT_TEST,
        answers: {
          q1: { kind: 'option', optionIndex: 1 },
          q2: { kind: 'dropdowns', selections: { s1: 0, s2: 1 } },
        },
        currentIndex: 2,
        completedAt: '2026-11-15T09:30:00.000Z',
      },
      new Date('2026-11-15T09:30:00.000Z')
    );

    renderAt('/goals');

    expect(await screen.findByText(/2 of 2 answers captured/i)).toBeInTheDocument();
    expect(screen.getByText(/submissions ticket/i)).toBeInTheDocument();
  });

  it('warns that a new goal replaces the existing roadmap', async () => {
    renderAt('/goals');

    await screen.findByRole('heading', { name: /set your study goal/i });

    expect(screen.getByText(/replaces your roadmap/i)).toBeInTheDocument();
  });
});
