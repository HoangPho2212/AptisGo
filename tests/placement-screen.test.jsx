import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { saveSession } from '../client/src/auth/authStorage.js';
import { PLACEMENT_PROGRESS_KEY } from '../client/src/placement/placementProgressStorage.js';
import {
  getApiRequests,
  getAuthorizationHeader,
  installApiAdapter,
  resetApiAdapter,
} from './auth-test-utils.jsx';
import { PLACEMENT_TEST, STUDENT_SESSION, renderAt } from './screen-fixtures.jsx';

function servePlacement(test = PLACEMENT_TEST) {
  installApiAdapter((config) => {
    if (config.url === '/api/tests/placement') {
      return { status: 200, data: test };
    }

    return { status: 404, data: { error: 'Not found' } };
  });
}

async function answerFirstQuestion(user) {
  await screen.findByText(/question 1 of 3/i);
  await user.click(screen.getByRole('radio', { name: 'goes' }));
  await user.click(screen.getByRole('button', { name: /next question/i }));
}

beforeEach(() => {
  sessionStorage.clear();
  saveSession(STUDENT_SESSION);
});

afterEach(() => {
  resetApiAdapter();
  sessionStorage.clear();
});

describe('Placement screen', () => {
  it('loads the diagnostic and shows the first question', async () => {
    servePlacement();

    renderAt('/placement');

    expect(
      await screen.findByRole('heading', { name: /diagnostic placement/i })
    ).toBeInTheDocument();
    expect(await screen.findByText(PLACEMENT_TEST.title)).toBeInTheDocument();
    expect(screen.getByText(/question 1 of 3/i)).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'goes' })).toBeInTheDocument();
    expect(getAuthorizationHeader(getApiRequests()[0])).toBe('Bearer signed.jwt.token');
  });

  it('shows the passage and dropdowns of the active question', async () => {
    servePlacement();
    const user = userEvent.setup();

    renderAt('/placement');
    await answerFirstQuestion(user);

    expect(screen.getByText(/question 2 of 3/i)).toBeInTheDocument();
    expect(screen.getByText('The library opens at nine.')).toBeInTheDocument();
    expect(screen.getByLabelText('Opening time')).toBeInTheDocument();
    expect(screen.getByLabelText('Place')).toBeInTheDocument();
  });

  it('keeps answers when navigating between questions', async () => {
    servePlacement();
    const user = userEvent.setup();

    renderAt('/placement');
    await answerFirstQuestion(user);
    await user.click(screen.getByRole('button', { name: /previous question/i }));

    expect(screen.getByText(/question 1 of 3/i)).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'goes' })).toBeChecked();
  });

  it('acknowledges question types the runner cannot answer yet', async () => {
    servePlacement();
    const user = userEvent.setup();

    renderAt('/placement');
    await answerFirstQuestion(user);
    await user.selectOptions(screen.getByLabelText('Opening time'), 'nine');
    await user.selectOptions(screen.getByLabelText('Place'), 'library');
    await user.click(screen.getByRole('button', { name: /next question/i }));

    expect(screen.getByText(/question 3 of 3/i)).toBeInTheDocument();
    expect(screen.getByText(/not part of this runner yet/i)).toBeInTheDocument();
  });

  it('only enables finishing once every answerable question is answered', async () => {
    servePlacement();
    const user = userEvent.setup();

    renderAt('/placement');
    const finish = await screen.findByRole('button', { name: /finish diagnostic/i });

    expect(finish).toBeDisabled();

    await answerFirstQuestion(user);
    expect(finish).toBeDisabled();

    await user.selectOptions(screen.getByLabelText('Opening time'), 'nine');
    await user.selectOptions(screen.getByLabelText('Place'), 'library');

    expect(finish).toBeEnabled();
  });

  it('summarises the captured answers and links to goal setting', async () => {
    servePlacement();
    const user = userEvent.setup();

    renderAt('/placement');
    await answerFirstQuestion(user);
    await user.selectOptions(screen.getByLabelText('Opening time'), 'nine');
    await user.selectOptions(screen.getByLabelText('Place'), 'library');
    await user.click(screen.getByRole('button', { name: /finish diagnostic/i }));

    expect(await screen.findByText(/2 of 2 answers captured/i)).toBeInTheDocument();
    expect(screen.getByText(/submissions ticket/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /set your goal/i })).toHaveAttribute('href', '/goals');
  });

  it('restores saved progress for the same diagnostic', async () => {
    sessionStorage.setItem(
      PLACEMENT_PROGRESS_KEY,
      JSON.stringify({
        version: 1,
        test: { id: PLACEMENT_TEST.id, title: PLACEMENT_TEST.title, answerableCount: 2 },
        answers: { q1: { kind: 'option', optionIndex: 1 } },
        currentIndex: 1,
        completedAt: null,
        updatedAt: '2026-11-15T09:30:00.000Z',
      })
    );
    servePlacement();

    renderAt('/placement');

    expect(await screen.findByText(/question 2 of 3/i)).toBeInTheDocument();
    expect(screen.getByText(/1 of 2 answers captured/i)).toBeInTheDocument();
  });

  it('explains when no diagnostic is published', async () => {
    installApiAdapter(() => ({ status: 404, data: { error: 'Placement test not found' } }));

    renderAt('/placement');

    expect(await screen.findByText(/placement test not found/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /set your goal instead/i })).toHaveAttribute(
      'href',
      '/goals'
    );
  });

  it('offers a retry after a transport failure', async () => {
    let attempts = 0;

    installApiAdapter(() => {
      attempts += 1;

      if (attempts === 1) {
        return { status: 500, data: { error: 'Diagnostic service unavailable' } };
      }

      return { status: 200, data: PLACEMENT_TEST };
    });
    const user = userEvent.setup();

    renderAt('/placement');

    expect(await screen.findByText(/diagnostic service unavailable/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /try again/i }));

    expect(await screen.findByText(/question 1 of 3/i)).toBeInTheDocument();
  });
});
