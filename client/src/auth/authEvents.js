export const AUTH_UNAUTHORIZED_EVENT = 'aptis-go:auth-unauthorized';

export function emitUnauthorized() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(AUTH_UNAUTHORIZED_EVENT));
  }
}
