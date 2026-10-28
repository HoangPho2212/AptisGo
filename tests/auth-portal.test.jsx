import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import App from '../client/src/App.jsx';
import { clearSession, readSession, saveSession } from '../client/src/auth/authStorage.js';

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

function studentSession(overrides = {}) {
  return {
    token: 'signed.jwt.token',
    tokenType: 'Bearer',
    user: {
      id: 'user-1',
      name: 'Amina Rahman',
      email: 'amina@greenwich.edu.vn',
      role: 'student',
      ...overrides,
    },
  };
}

function renderAt(path) {
  window.history.replaceState({}, '', path);
  return render(<App />);
}

beforeEach(() => {
  sessionStorage.clear();
  window.history.replaceState({}, '', '/login');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('login portal', () => {
  it('renders the role selector and institutional email guidance', () => {
    renderAt('/login');

    expect(screen.getByRole('heading', { name: /sign in to your workspace/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /student/i })).toBeChecked();
    expect(screen.getByRole('radio', { name: /lecturer/i })).toBeEnabled();
    expect(screen.getByRole('radio', { name: /administrator/i })).toBeEnabled();
    expect(screen.getByLabelText(/institutional email/i)).toBeInTheDocument();
    expect(screen.getByText(/@greenwich\.edu\.vn/i)).toBeInTheDocument();
  });

  it('blocks invalid email and empty password before calling the API', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    renderAt('/login');

    await user.type(screen.getByLabelText(/institutional email/i), 'amina@gmail.com');
    await user.click(screen.getByRole('button', { name: /sign in securely/i }));

    expect(await screen.findByText(/Use your Greenwich email/i)).toBeInTheDocument();
    expect(screen.getByText(/Password is required/i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('logs in, checks the selected role, and saves the session', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, studentSession()));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    renderAt('/login');

    await user.type(screen.getByLabelText(/institutional email/i), 'amina@greenwich.edu.vn');
    await user.type(screen.getByLabelText(/^password$/i), 'Placement2026!');
    await user.click(screen.getByRole('button', { name: /sign in securely/i }));

    await screen.findByRole('heading', { name: /signed in successfully/i });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/login',
      expect.objectContaining({ method: 'POST' })
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      email: 'amina@greenwich.edu.vn',
      password: 'Placement2026!',
    });
    expect(readSession()).toMatchObject({
      token: 'signed.jwt.token',
      user: { name: 'Amina Rahman', role: 'student' },
    });
    expect(screen.getByText('Amina Rahman')).toBeInTheDocument();
  });

  it('rejects a login role that does not match the account and saves nothing', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, studentSession()));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    renderAt('/login');

    await user.click(screen.getByRole('radio', { name: /lecturer/i }));
    await user.type(screen.getByLabelText(/institutional email/i), 'amina@greenwich.edu.vn');
    await user.type(screen.getByLabelText(/^password$/i), 'Placement2026!');
    await user.click(screen.getByRole('button', { name: /sign in securely/i }));

    expect(await screen.findByText(/registered as a Student/i)).toBeInTheDocument();
    expect(readSession()).toBeNull();
    expect(screen.getByRole('heading', { name: /sign in to your workspace/i })).toBeInTheDocument();
  });

  it('shows the API login error without saving a session', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(401, { error: 'Invalid email or password' }));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    renderAt('/login');

    await user.type(screen.getByLabelText(/institutional email/i), 'amina@greenwich.edu.vn');
    await user.type(screen.getByLabelText(/^password$/i), 'WrongPassword1!');
    await user.click(screen.getByRole('button', { name: /sign in securely/i }));

    expect(await screen.findByText('Invalid email or password')).toBeInTheDocument();
    expect(readSession()).toBeNull();
  });

  it('toggles password visibility', async () => {
    const user = userEvent.setup();
    renderAt('/login');
    const password = screen.getByLabelText(/^password$/i);

    await user.type(password, 'Placement2026!');
    await user.click(screen.getByRole('button', { name: /show password/i }));
    expect(password).toHaveAttribute('type', 'text');

    await user.click(screen.getByRole('button', { name: /hide password/i }));
    expect(password).toHaveAttribute('type', 'password');
  });
});

describe('registration portal', () => {
  it('shows the role selector with student-only self-service', () => {
    renderAt('/register');

    expect(
      screen.getByRole('heading', { name: /create your student account/i })
    ).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /student/i })).toBeChecked();
    expect(screen.getByRole('radio', { name: /lecturer/i })).toBeDisabled();
    expect(screen.getByRole('radio', { name: /administrator/i })).toBeDisabled();
  });

  it('requires the institutional domain and GDPR consent before calling the API', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    renderAt('/register');

    await user.type(screen.getByLabelText(/full name/i), 'Amina Rahman');
    await user.type(screen.getByLabelText(/institutional email/i), 'amina@gmail.com');
    await user.type(screen.getByLabelText(/^password$/i), 'Placement2026!');
    await user.type(screen.getByLabelText(/confirm password/i), 'Placement2026!');
    await user.click(screen.getByRole('button', { name: /create student account/i }));

    expect(await screen.findByText(/Use your Greenwich email/i)).toBeInTheDocument();
    expect(screen.getByText(/You must consent to the privacy notice/i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('registers a student, sends only the API fields, and saves the session', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(201, studentSession()));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    renderAt('/register');

    await user.type(screen.getByLabelText(/full name/i), 'Amina Rahman');
    await user.type(screen.getByLabelText(/student id/i), 'GCS210884');
    await user.type(screen.getByLabelText(/institutional email/i), 'amina@greenwich.edu.vn');
    await user.type(screen.getByLabelText(/^password$/i), 'Placement2026!');
    await user.type(screen.getByLabelText(/confirm password/i), 'Placement2026!');
    await user.click(screen.getByRole('checkbox', { name: /I consent to the processing/i }));
    await user.click(screen.getByRole('button', { name: /create student account/i }));

    await screen.findByRole('heading', { name: /signed in successfully/i });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/register',
      expect.objectContaining({ method: 'POST' })
    );
    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(requestBody).toEqual({
      name: 'Amina Rahman',
      email: 'amina@greenwich.edu.vn',
      password: 'Placement2026!',
      studentId: 'GCS210884',
    });
    expect(requestBody.role).toBeUndefined();
    expect(requestBody.gdprConsent).toBeUndefined();
    expect(readSession()).not.toBeNull();
  });
});

describe('session gate', () => {
  it('redirects an unauthenticated visitor from / to /login', async () => {
    renderAt('/');

    expect(
      await screen.findByRole('heading', { name: /sign in to your workspace/i })
    ).toBeInTheDocument();
  });

  it('renders the signed-in session and signs out cleanly', async () => {
    saveSession(studentSession());
    const user = userEvent.setup();
    renderAt('/');

    expect(screen.getByRole('heading', { name: /signed in successfully/i })).toBeInTheDocument();
    expect(screen.getByText('Amina Rahman')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /sign out/i }));

    expect(
      await screen.findByRole('heading', { name: /sign in to your workspace/i })
    ).toBeInTheDocument();
    expect(readSession()).toBeNull();
  });

  it('redirects unknown paths to the login page', async () => {
    renderAt('/not-a-real-screen');

    expect(
      await screen.findByRole('heading', { name: /sign in to your workspace/i })
    ).toBeInTheDocument();
  });
});

describe('auth storage', () => {
  it('ignores malformed stored sessions', () => {
    sessionStorage.setItem('aptis-go.auth', '{broken');
    expect(readSession()).toBeNull();

    sessionStorage.setItem('aptis-go.auth', JSON.stringify({ token: 'x', user: {} }));
    expect(readSession()).toBeNull();
  });

  it('clears a saved session', () => {
    saveSession(studentSession());
    expect(readSession()).not.toBeNull();

    clearSession();
    expect(readSession()).toBeNull();
  });
});
