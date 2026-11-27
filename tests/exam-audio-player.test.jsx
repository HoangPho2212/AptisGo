import { createRequire } from 'node:module';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { saveSession } from '../client/src/auth/authStorage.js';
import { examProgressKey } from '../client/src/exam/examProgressStorage.js';
import { LISTENING_PLAY_LIMIT } from '../client/src/exam/examViewState.js';
import { installApiAdapter, resetApiAdapter } from './auth-test-utils.jsx';
import { LISTENING_TEST, STUDENT_SESSION, renderAt } from './screen-fixtures.jsx';

const require = createRequire(import.meta.url);
const { validateListeningPlaysLimit } = require('../contracts/JayContract.js');

function serveListening() {
  installApiAdapter((config) => {
    if (config.method === 'get' && config.url === `/api/tests/${LISTENING_TEST.id}`) {
      return { status: 200, data: LISTENING_TEST };
    }

    return { status: 404, data: { error: 'Not found' } };
  });
}

function stubPlayback({ reject = false } = {}) {
  const play = vi.spyOn(window.HTMLMediaElement.prototype, 'play');
  const pause = vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});

  if (reject) {
    play.mockRejectedValue(new Error('blocked by the browser'));
  } else {
    play.mockResolvedValue(undefined);
  }

  return { play, pause };
}

function audioElement() {
  return document.querySelector('audio');
}

function storedAttempt(overrides) {
  return {
    version: 1,
    testId: LISTENING_TEST.id,
    startedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 9 * 60 * 1000).toISOString(),
    answers: {},
    flags: {},
    playCounts: {},
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
  vi.restoreAllMocks();
  resetApiAdapter();
  sessionStorage.clear();
});

describe('Listening audio player', () => {
  it('matches the JayContract two-play boundary', () => {
    expect(LISTENING_PLAY_LIMIT).toBe(2);
    expect(validateListeningPlaysLimit(LISTENING_PLAY_LIMIT)).toBe(true);
    expect(validateListeningPlaysLimit(1)).toBe(true);
    expect(validateListeningPlaysLimit(0)).toBe(true);
    expect(validateListeningPlaysLimit(LISTENING_PLAY_LIMIT + 1)).toBe(false);
  });

  it('renders a custom player for a listening track and a notice when audio is missing', async () => {
    serveListening();
    stubPlayback();

    renderAt(`/tests/${LISTENING_TEST.id}`);
    await screen.findByText(LISTENING_TEST.title);

    expect(screen.getByText('0 of 2 plays used')).toBeInTheDocument();
    expect(screen.getByText('2 plays remaining')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Play audio' })).toBeEnabled();
    expect(screen.getByRole('progressbar', { name: /audio progress/i })).toBeInTheDocument();
    expect(screen.getByText('0:00 / 0:00')).toBeInTheDocument();
    expect(screen.getByText('Audio is not available for this question.')).toBeInTheDocument();
    expect(document.querySelectorAll('audio')).toHaveLength(1);
    expect(audioElement()).toHaveAttribute('src', LISTENING_TEST.questions[0].mediaUrl);
    expect(document.querySelectorAll('audio[controls]')).toHaveLength(0);
  });

  it('records the first play and offers pause', async () => {
    serveListening();
    const { play } = stubPlayback();
    const user = userEvent.setup();

    renderAt(`/tests/${LISTENING_TEST.id}`);
    await screen.findByText(LISTENING_TEST.title);

    await user.click(screen.getByRole('button', { name: 'Play audio' }));

    expect(play).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('1 of 2 plays used')).toBeInTheDocument();
    expect(screen.getByText('1 play remaining')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
  });

  it('does not consume a play when a paused track is resumed', async () => {
    serveListening();
    const { play, pause } = stubPlayback();
    const user = userEvent.setup();

    renderAt(`/tests/${LISTENING_TEST.id}`);
    await screen.findByText(LISTENING_TEST.title);

    await user.click(screen.getByRole('button', { name: 'Play audio' }));
    await user.click(screen.getByRole('button', { name: 'Pause' }));

    expect(pause).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Play again' }));

    expect(play).toHaveBeenCalledTimes(2);
    expect(screen.getByText('1 of 2 plays used')).toBeInTheDocument();
    expect(screen.getByText('1 play remaining')).toBeInTheDocument();
  });

  it('consumes the second play after the track ends and then blocks the control', async () => {
    serveListening();
    const { play } = stubPlayback();
    const user = userEvent.setup();

    renderAt(`/tests/${LISTENING_TEST.id}`);
    await screen.findByText(LISTENING_TEST.title);

    await user.click(screen.getByRole('button', { name: 'Play audio' }));
    fireEvent.ended(audioElement());

    await user.click(screen.getByRole('button', { name: 'Play again' }));

    expect(screen.getByText('2 of 2 plays used')).toBeInTheDocument();
    expect(play).toHaveBeenCalledTimes(2);

    fireEvent.ended(audioElement());

    const blocked = screen.getByRole('button', { name: 'No plays remaining' });

    expect(blocked).toBeDisabled();
    expect(screen.getAllByText('No plays remaining')).toHaveLength(2);

    await user.click(blocked);

    expect(play).toHaveBeenCalledTimes(2);
  });

  it('does not consume a play when the browser refuses to start audio', async () => {
    serveListening();
    stubPlayback({ reject: true });
    const user = userEvent.setup();

    renderAt(`/tests/${LISTENING_TEST.id}`);
    await screen.findByText(LISTENING_TEST.title);

    await user.click(screen.getByRole('button', { name: 'Play audio' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/audio could not start/i);
    expect(screen.getByText('0 of 2 plays used')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Play audio' })).toBeEnabled();
  });

  it('restores an exhausted limit after a refresh', async () => {
    sessionStorage.setItem(
      examProgressKey(LISTENING_TEST.id),
      JSON.stringify(storedAttempt({ playCounts: { l1: 2 } }))
    );
    serveListening();
    stubPlayback();

    renderAt(`/tests/${LISTENING_TEST.id}`);

    expect(await screen.findByText('2 of 2 plays used')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'No plays remaining' })).toBeDisabled();
    expect(screen.getAllByText('No plays remaining')).toHaveLength(2);
  });
});
