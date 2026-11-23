import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { saveSession } from '../client/src/auth/authStorage.js';
import { examProgressKey } from '../client/src/exam/examProgressStorage.js';
import { initialSentenceOrder } from '../client/src/exam/examViewState.js';
import {
  getApiRequests,
  getAuthorizationHeader,
  installApiAdapter,
  resetApiAdapter,
} from './auth-test-utils.jsx';
import { EXAM_TEST, STUDENT_SESSION, SUBMISSION_RESULT, renderAt } from './screen-fixtures.jsx';

const FIXED_ID = '3f1d2c4b-0000-4000-8000-000000000001';

function serveExam({ onPost } = {}) {
  installApiAdapter((config) => {
    if (config.method === 'get' && config.url === `/api/tests/${EXAM_TEST.id}`) {
      return { status: 200, data: EXAM_TEST };
    }

    if (config.method === 'post' && config.url === '/api/submissions') {
      return onPost ? onPost(config) : { status: 201, data: SUBMISSION_RESULT };
    }

    return { status: 404, data: { error: 'Not found' } };
  });
}

function postRequests() {
  return getApiRequests().filter((config) => config.method === 'post');
}

async function flushMicrotasks() {
  await act(async () => {
    for (let index = 0; index < 10; index += 1) {
      await Promise.resolve();
    }
  });
}

function storedAttempt(overrides) {
  return {
    version: 1,
    testId: EXAM_TEST.id,
    startedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 9.5 * 60 * 1000).toISOString(),
    answers: {},
    submittedAt: null,
    autoSubmitted: false,
    result: null,
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  sessionStorage.clear();
  saveSession(STUDENT_SESSION);
});

afterEach(() => {
  vi.useRealTimers();
  resetApiAdapter();
  sessionStorage.clear();
});

describe('Timed mock exam screen', () => {
  it('loads the test, every question type, and the countdown', async () => {
    serveExam();

    renderAt(`/tests/${EXAM_TEST.id}`);

    expect(await screen.findByRole('heading', { name: /^mock exam$/i })).toBeInTheDocument();
    expect(await screen.findByText(EXAM_TEST.title)).toBeInTheDocument();
    expect(screen.getByRole('timer')).toHaveTextContent(/^\d+:\d{2}:\d{2}$/);
    expect(screen.getByText(/0 of 6 answered/i)).toBeInTheDocument();

    expect(screen.getByRole('radio', { name: 'goes' })).toBeInTheDocument();
    expect(screen.getByLabelText('Opening time')).toBeInTheDocument();
    expect(screen.getByText('The manager opened the meeting.')).toBeInTheDocument();
    expect(screen.getByLabelText('Full name')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /write a short email/i })).toBeInTheDocument();
    expect(screen.getByText(/recording arrives with fr05/i)).toBeInTheDocument();

    expect(getAuthorizationHeader(getApiRequests()[0])).toBe('Bearer signed.jwt.token');
  });

  it('explains a missing test and retries the lookup', async () => {
    let attempts = 0;

    installApiAdapter(() => {
      attempts += 1;

      if (attempts === 1) {
        return { status: 404, data: { error: 'Test not found' } };
      }

      return { status: 200, data: EXAM_TEST };
    });
    const user = userEvent.setup();

    renderAt(`/tests/${EXAM_TEST.id}`);

    expect(await screen.findByText(/test not found/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /try again/i }));

    expect(await screen.findByText(EXAM_TEST.title)).toBeInTheDocument();
  });

  it('captures answers and posts the AG-303 payload exactly once', async () => {
    serveExam();
    const user = userEvent.setup();

    renderAt(`/tests/${EXAM_TEST.id}`);
    await screen.findByText(EXAM_TEST.title);

    await user.click(screen.getByRole('radio', { name: 'goes' }));
    await user.selectOptions(screen.getByLabelText('Opening time'), 'nine');
    await user.selectOptions(screen.getByLabelText('Place'), 'library');

    const initialOrder = initialSentenceOrder(EXAM_TEST.questions[2]);
    await user.click(screen.getByRole('button', { name: 'Move down 2' }));

    await user.type(screen.getByLabelText('Full name'), 'Amina Yusuf');
    await user.type(screen.getByLabelText('City'), 'Cairo');
    await user.type(
      screen.getByRole('textbox', { name: /write a short email/i }),
      'Dear Sir, I would like to request leave.'
    );

    expect(screen.getByText(/5 of 6 answered/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /submit exam/i }));

    expect(
      await screen.findByRole('heading', { name: /submission received/i })
    ).toBeInTheDocument();

    const posts = postRequests();

    expect(posts).toHaveLength(1);
    expect(getAuthorizationHeader(posts[0])).toBe('Bearer signed.jwt.token');
    expect(JSON.parse(posts[0].data)).toEqual({
      testId: EXAM_TEST.id,
      answers: [
        { questionId: 'e1', submittedAnswer: 1 },
        { questionId: 'e2', submittedAnswer: { d1: 0, d2: 0 } },
        {
          questionId: 'e3',
          submittedAnswer: [initialOrder[0], initialOrder[2], initialOrder[1]],
        },
        { questionId: 'e4', submittedAnswer: { name: 'Amina Yusuf', city: 'Cairo' } },
        {
          questionId: 'e5',
          submittedAnswer: 'Dear Sir, I would like to request leave.',
        },
        { questionId: 'e6', submittedAnswer: null },
      ],
    });

    expect(screen.getByText(/awaiting lecturer review/i)).toBeInTheDocument();
    expect(screen.getByText('50 / 150')).toBeInTheDocument();

    const summary = screen
      .getByRole('heading', { name: /submission received/i })
      .closest('section');

    expect(within(summary).getByText(/6 of 6 answered/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to dashboard/i })).toHaveAttribute(
      'href',
      '/dashboard'
    );
    expect(screen.queryByRole('radio', { name: 'goes' })).not.toBeInTheDocument();
  });

  it('does not post twice while a submission is in flight', async () => {
    let releaseSubmit;

    serveExam({
      onPost: () =>
        new Promise((resolve) => {
          releaseSubmit = () => resolve({ status: 201, data: SUBMISSION_RESULT });
        }),
    });
    const user = userEvent.setup();

    renderAt(`/tests/${EXAM_TEST.id}`);
    await screen.findByText(EXAM_TEST.title);

    const submit = screen.getByRole('button', { name: /submit exam/i });

    await user.click(submit);
    await user.click(submit);

    expect(postRequests()).toHaveLength(1);

    await act(async () => {
      releaseSubmit();
      await Promise.resolve();
    });

    expect(
      await screen.findByRole('heading', { name: /submission received/i })
    ).toBeInTheDocument();
  });

  it('auto-submits when the countdown reaches zero', async () => {
    vi.useFakeTimers({ now: new Date() });

    sessionStorage.setItem(
      examProgressKey(EXAM_TEST.id),
      JSON.stringify(
        storedAttempt({
          expiresAt: new Date(Date.now() + 3000).toISOString(),
          answers: { e1: 1 },
        })
      )
    );
    serveExam();

    renderAt(`/tests/${EXAM_TEST.id}`);
    await flushMicrotasks();

    expect(screen.getByText(EXAM_TEST.title)).toBeInTheDocument();
    expect(screen.getByRole('timer')).toHaveTextContent('00:03');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });
    await flushMicrotasks();

    expect(screen.getByText(/time is up/i)).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/submitted automatically/i);

    const posts = postRequests();

    expect(posts).toHaveLength(1);
    expect(JSON.parse(posts[0].data).answers[0]).toEqual({
      questionId: 'e1',
      submittedAnswer: 1,
    });
    expect(screen.getByRole('timer')).toHaveTextContent('00:00');
  });

  it('does not auto-submit repeatedly when the automatic submission fails', async () => {
    vi.useFakeTimers({ now: new Date() });

    sessionStorage.setItem(
      examProgressKey(EXAM_TEST.id),
      JSON.stringify(
        storedAttempt({
          expiresAt: new Date(Date.now() + 2000).toISOString(),
          answers: { e1: 1 },
        })
      )
    );
    serveExam({
      onPost: () => ({ status: 500, data: { error: 'Marking service unavailable' } }),
    });

    renderAt(`/tests/${EXAM_TEST.id}`);
    await flushMicrotasks();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });
    await flushMicrotasks();

    expect(postRequests()).toHaveLength(1);
    expect(screen.getByRole('alert')).toHaveTextContent(/marking service unavailable/i);
    expect(screen.getByRole('timer')).toHaveTextContent('00:00');
    expect(screen.getByRole('button', { name: /submit exam/i })).toBeEnabled();
  });

  it('restores answers and the original deadline after a refresh', async () => {
    sessionStorage.setItem(
      examProgressKey(EXAM_TEST.id),
      JSON.stringify(storedAttempt({ answers: { e1: 2 } }))
    );
    serveExam();

    renderAt(`/tests/${EXAM_TEST.id}`);

    expect(await screen.findByRole('radio', { name: 'going' })).toBeChecked();
    expect(screen.getByRole('timer').textContent).toMatch(/^09:(2\d|30)$/);
    expect(screen.getByText(/1 of 6 answered/i)).toBeInTheDocument();
  });

  it('keeps the answers and offers a retry when the submission fails', async () => {
    let postAttempts = 0;

    serveExam({
      onPost: () => {
        postAttempts += 1;

        return postAttempts === 1
          ? { status: 500, data: { error: 'Marking service unavailable' } }
          : { status: 201, data: SUBMISSION_RESULT };
      },
    });
    const user = userEvent.setup();

    renderAt(`/tests/${EXAM_TEST.id}`);
    await screen.findByText(EXAM_TEST.title);

    await user.click(screen.getByRole('radio', { name: 'goes' }));
    await user.click(screen.getByRole('button', { name: /submit exam/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/marking service unavailable/i);
    expect(screen.getByRole('radio', { name: 'goes' })).toBeChecked();

    await user.click(screen.getByRole('button', { name: /submit exam/i }));

    expect(
      await screen.findByRole('heading', { name: /submission received/i })
    ).toBeInTheDocument();
    expect(postRequests()).toHaveLength(2);
  });

  it('denies the exam to a lecturer', async () => {
    installApiAdapter(() => ({ status: 200, data: EXAM_TEST }));
    saveSession({
      ...STUDENT_SESSION,
      user: { ...STUDENT_SESSION.user, id: FIXED_ID, role: 'lecturer' },
    });

    renderAt(`/tests/${EXAM_TEST.id}`);

    expect(await screen.findByRole('heading', { name: /access denied/i })).toBeInTheDocument();
    expect(getApiRequests()).toHaveLength(0);
  });
});
