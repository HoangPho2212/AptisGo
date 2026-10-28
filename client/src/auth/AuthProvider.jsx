import { useCallback, useEffect, useMemo, useState } from 'react';

import { AuthContext } from './authContext.js';
import { AuthError } from './authError.js';
import { loginRequest, registerRequest } from './api.js';
import { AUTH_UNAUTHORIZED_EVENT } from './authEvents.js';
import { clearSession, readSession, saveSession } from './authStorage.js';
import { getRoleLabel, normalizeEmail } from './authValidation.js';

export default function AuthProvider({ children }) {
  const [session, setSession] = useState(() => readSession());

  useEffect(() => {
    function handleUnauthorized() {
      clearSession();
      setSession(null);
    }

    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);

    return () => {
      window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
    };
  }, []);

  const login = useCallback(async ({ email, password, role }) => {
    const nextSession = await loginRequest({
      email: normalizeEmail(email),
      password,
    });
    const actualRole = nextSession?.user?.role;

    if (actualRole !== role) {
      const actualLabel = getRoleLabel(actualRole);
      throw new AuthError(
        `This account is registered as a ${actualLabel}. Select ${actualLabel} to continue.`,
        'ROLE_MISMATCH'
      );
    }

    saveSession(nextSession);
    setSession(nextSession);
    return nextSession;
  }, []);

  const register = useCallback(async ({ name, email, password, studentId }) => {
    const nextSession = await registerRequest({
      name: typeof name === 'string' ? name.trim() : '',
      email: normalizeEmail(email),
      password,
      studentId,
    });

    saveSession(nextSession);
    setSession(nextSession);
    return nextSession;
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setSession(null);
  }, []);

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      token: session?.token ?? null,
      role: session?.user?.role ?? null,
      isAuthenticated: Boolean(session),
      login,
      register,
      logout,
    }),
    [session, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
