import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';

import AuthLayout from '../auth/AuthLayout.jsx';
import { clearSession, readSession } from '../auth/authStorage.js';
import { getRoleLabel } from '../auth/authValidation.js';

export default function SessionPage() {
  const navigate = useNavigate();
  const [session] = useState(() => readSession());

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  const roleLabel = getRoleLabel(session.user.role);

  function handleSignOut() {
    clearSession();
    navigate('/login', { replace: true });
  }

  return (
    <AuthLayout
      eyebrow="Workspace access"
      title="Signed in successfully"
      subtitle="Your account is authenticated. The next screen will continue your Aptis journey."
      footer="Session data is stored for this browser tab only."
    >
      <div className="space-y-5">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold tracking-[0.16em] text-slate-500 uppercase">
                Signed in as
              </p>
              <p className="mt-1 text-lg font-semibold text-white">{session.user.name}</p>
              <p className="text-sm text-slate-400">{session.user.email}</p>
            </div>
            <span className="rounded-full border border-teal-400/30 bg-teal-400/10 px-3 py-1 text-xs font-semibold text-teal-200">
              {roleLabel}
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-dashed border-white/15 bg-slate-950/30 p-5 text-sm leading-6 text-slate-400">
          <p className="font-medium text-slate-200">Screen 2 is next.</p>
          <p className="mt-1">
            The adaptive placement runner, CEFR goal setting, and the student roadmap will be
            mounted here in the following tickets.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSignOut}
          className="w-full rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:border-white/20 hover:bg-white/[0.05] focus-visible:ring-2 focus-visible:ring-teal-400/60 focus-visible:outline-none"
        >
          Sign out
        </button>
      </div>
    </AuthLayout>
  );
}
