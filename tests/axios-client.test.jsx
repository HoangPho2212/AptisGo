import axios from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../client/src/auth/apiError.js';
import { apiClient } from '../client/src/auth/apiClient.js';
import { AUTH_UNAUTHORIZED_EVENT } from '../client/src/auth/authEvents.js';
import { readSession, saveSession } from '../client/src/auth/authStorage.js';
import {
  getApiRequests,
  getAuthorizationHeader,
  installApiAdapter,
  resetApiAdapter,
} from './auth-test-utils.jsx';

function sessionFor(role = 'student') {
  return {
    token: 'signed.jwt.token',
    tokenType: 'Bearer',
    user: {
      id: 'user-1',
      name: 'Amina Rahman',
      email: 'amina@greenwich.edu.vn',
      role,
    },
  };
}

beforeEach(() => {
  sessionStorage.clear();
});

afterEach(() => {
  resetApiAdapter();
  vi.restoreAllMocks();
});

describe('Axios request interceptor', () => {
  it('attaches the current JWT as a Bearer header', async () => {
    saveSession(sessionFor());
    installApiAdapter(() => ({ status: 200, data: { ok: true } }));

    await apiClient.get('/api/protected');

    expect(getAuthorizationHeader(getApiRequests()[0])).toBe('Bearer signed.jwt.token');
  });

  it('does not attach an Authorization header without a session', async () => {
    installApiAdapter(() => ({ status: 200, data: { ok: true } }));

    await apiClient.get('/api/protected');

    expect(getAuthorizationHeader(getApiRequests()[0])).toBeNull();
  });
});

describe('Axios response interceptor', () => {
  it('clears the session and emits an unauthorized event on 401', async () => {
    saveSession(sessionFor());
    installApiAdapter(() => ({ status: 401, data: { error: 'Unauthorized' } }));
    const listener = vi.fn();
    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, listener);

    await expect(apiClient.get('/api/protected')).rejects.toBeInstanceOf(ApiError);

    expect(readSession()).toBeNull();
    expect(listener).toHaveBeenCalledTimes(1);

    window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, listener);
  });

  it('normalizes server error details into ApiError', async () => {
    installApiAdapter(() => ({
      status: 400,
      data: { error: 'Validation failed', details: ['email is required'] },
    }));

    await expect(apiClient.post('/api/auth/register', {})).rejects.toMatchObject({
      name: 'ApiError',
      message: 'Validation failed',
      status: 400,
      details: ['email is required'],
    });
  });

  it('normalizes network failures with status 0', async () => {
    installApiAdapter((config) => {
      throw new axios.AxiosError('Network Error', 'ERR_NETWORK', config);
    });

    await expect(apiClient.get('/api/health')).rejects.toMatchObject({
      name: 'ApiError',
      status: 0,
      message: expect.stringMatching(/Unable to reach the API/i),
    });
  });
});
