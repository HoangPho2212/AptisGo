import { USER_ROLES } from './authValidation.js';

export const AUTH_STORAGE_KEY = 'aptis-go.auth';

function isValidSession(session) {
  return (
    typeof session === 'object' &&
    session !== null &&
    typeof session.token === 'string' &&
    session.token.length > 0 &&
    typeof session.user === 'object' &&
    session.user !== null &&
    typeof session.user.name === 'string' &&
    typeof session.user.email === 'string' &&
    USER_ROLES.includes(session.user.role)
  );
}

export function saveSession(session) {
  if (!isValidSession(session)) {
    throw new TypeError('Cannot save an invalid authentication session');
  }

  globalThis.sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
}

export function readSession() {
  const raw = globalThis.sessionStorage?.getItem(AUTH_STORAGE_KEY);

  if (!raw) {
    return null;
  }

  try {
    const session = JSON.parse(raw);

    if (!isValidSession(session)) {
      globalThis.sessionStorage.removeItem(AUTH_STORAGE_KEY);
      return null;
    }

    return session;
  } catch {
    globalThis.sessionStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
}

export function getAccessToken() {
  return readSession()?.token ?? null;
}

export function clearSession() {
  globalThis.sessionStorage?.removeItem(AUTH_STORAGE_KEY);
}
