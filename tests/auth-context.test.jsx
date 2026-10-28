import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';

import AuthProvider from '../client/src/auth/AuthProvider.jsx';
import { apiClient } from '../client/src/auth/apiClient.js';
import { readSession, saveSession } from '../client/src/auth/authStorage.js';
import { useAuth } from '../client/src/auth/useAuth.js';
import { installApiAdapter, resetApiAdapter } from './auth-test-utils.jsx';

function sessionFor(role = 'student', overrides = {}) {
  return {
    token: 'signed.jwt.token',
    tokenType: 'Bearer',
    user: {
      id: 'user-1',
      name: 'Amina Rahman',
      email: 'amina@greenwich.edu.vn',
      role,
      ...overrides,
    },
  };
}

function renderAuth() {
  return renderHook(() => useAuth(), { wrapper: AuthProvider });
}

beforeEach(() => {
  sessionStorage.clear();
});

afterEach(() => {
  resetApiAdapter();
});

describe('AuthProvider', () => {
  it('restores an existing tab session on mount', () => {
    saveSession(sessionFor('student'));
    const { result } = renderAuth();

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.role).toBe('student');
    expect(result.current.user?.name).toBe('Amina Rahman');
    expect(result.current.token).toBe('signed.jwt.token');
  });

  it('logs in, verifies the selected role, and persists the session', async () => {
    installApiAdapter(() => ({ status: 200, data: sessionFor('student') }));
    const { result } = renderAuth();

    await act(async () => {
      await result.current.login({
        email: 'amina@greenwich.edu.vn',
        password: 'Placement2026!',
        role: 'student',
      });
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.role).toBe('student');
    expect(readSession()).toMatchObject({ token: 'signed.jwt.token' });
  });

  it('rejects a role mismatch without saving a session', async () => {
    installApiAdapter(() => ({ status: 200, data: sessionFor('student') }));
    const { result } = renderAuth();

    await act(async () => {
      await expect(
        result.current.login({
          email: 'amina@greenwich.edu.vn',
          password: 'Placement2026!',
          role: 'lecturer',
        })
      ).rejects.toMatchObject({ code: 'ROLE_MISMATCH' });
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(readSession()).toBeNull();
  });

  it('registers and persists the returned session', async () => {
    installApiAdapter(() => ({ status: 201, data: sessionFor('student') }));
    const { result } = renderAuth();

    await act(async () => {
      await result.current.register({
        name: 'Amina Rahman',
        email: 'amina@greenwich.edu.vn',
        password: 'Placement2026!',
        studentId: 'GCS210884',
      });
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(readSession()).not.toBeNull();
  });

  it('logs out and clears storage', () => {
    saveSession(sessionFor('student'));
    const { result } = renderAuth();

    act(() => {
      result.current.logout();
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(readSession()).toBeNull();
  });

  it('clears context state after the Axios interceptor handles a 401', async () => {
    saveSession(sessionFor('student'));
    installApiAdapter(() => ({ status: 401, data: { error: 'Unauthorized' } }));
    const { result } = renderAuth();

    await act(async () => {
      await apiClient.get('/api/protected').catch(() => {});
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(readSession()).toBeNull();
  });
});
