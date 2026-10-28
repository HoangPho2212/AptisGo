import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import App from '../client/src/App.jsx';
import { readSession, saveSession } from '../client/src/auth/authStorage.js';
import { installApiAdapter, resetApiAdapter } from './auth-test-utils.jsx';

function sessionFor(role) {
  const names = {
    student: 'Amina Rahman',
    lecturer: 'Dr. Lewis',
    admin: 'System Administrator',
  };

  return {
    token: 'signed.jwt.token',
    tokenType: 'Bearer',
    user: {
      id: `user-${role}`,
      name: names[role],
      email: `${role}@greenwich.edu.vn`,
      role,
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
  resetApiAdapter();
});

describe('ProtectedRoute', () => {
  it('redirects an unauthenticated visitor to /login', async () => {
    renderAt('/student');

    expect(
      await screen.findByRole('heading', { name: /sign in to your workspace/i })
    ).toBeInTheDocument();
  });

  it('returns to the attempted protected route after login', async () => {
    installApiAdapter(() => ({ status: 200, data: sessionFor('student') }));
    const user = userEvent.setup();
    renderAt('/student');

    await screen.findByRole('heading', { name: /sign in to your workspace/i });
    await user.type(screen.getByLabelText(/email address/i), 'student@greenwich.edu.vn');
    await user.type(screen.getByLabelText(/^password$/i), 'Placement2026!');
    await user.click(screen.getByRole('button', { name: /sign in securely/i }));

    expect(await screen.findByRole('heading', { name: /student workspace/i })).toBeInTheDocument();
  });

  it('denies a student access to the lecturer workspace without clearing the session', async () => {
    saveSession(sessionFor('student'));
    const user = userEvent.setup();
    renderAt('/lecturer');

    expect(await screen.findByRole('heading', { name: /access denied/i })).toBeInTheDocument();
    expect(readSession()).not.toBeNull();

    await user.click(screen.getByRole('link', { name: /go to my workspace/i }));

    expect(await screen.findByRole('heading', { name: /student workspace/i })).toBeInTheDocument();
  });

  it('allows a lecturer into the lecturer workspace', async () => {
    saveSession(sessionFor('lecturer'));
    renderAt('/lecturer');

    expect(await screen.findByRole('heading', { name: /lecturer workspace/i })).toBeInTheDocument();
  });

  it('allows an administrator into the admin workspace', async () => {
    saveSession(sessionFor('admin'));
    renderAt('/admin');

    expect(
      await screen.findByRole('heading', { name: /administrator workspace/i })
    ).toBeInTheDocument();
  });

  it('sends an authenticated student from / to the student workspace', async () => {
    saveSession(sessionFor('student'));
    renderAt('/');

    expect(await screen.findByRole('heading', { name: /student workspace/i })).toBeInTheDocument();
  });

  it('redirects an authenticated user away from /login', async () => {
    saveSession(sessionFor('student'));
    renderAt('/login');

    expect(await screen.findByRole('heading', { name: /student workspace/i })).toBeInTheDocument();
  });
});
