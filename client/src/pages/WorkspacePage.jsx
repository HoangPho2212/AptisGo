import { Navigate, useNavigate } from 'react-router-dom';

import AuthLayout from '../auth/AuthLayout.jsx';
import { getRoleLabel } from '../auth/authValidation.js';
import { useAuth } from '../auth/useAuth.js';

const WORKSPACES = {
  student: {
    eyebrow: 'Student workspace',
    title: 'Student workspace',
    subtitle: 'Your placement, CEFR goal, and daily study roadmap will live here.',
    next: 'Screen 2 will add the adaptive placement runner and the personalised study plan.',
  },
  lecturer: {
    eyebrow: 'Lecturer workspace',
    title: 'Lecturer workspace',
    subtitle: 'Your review queue, rubric grading, and cohort insights will live here.',
    next: 'The writing and speaking review queue will be added in a later screen.',
  },
  admin: {
    eyebrow: 'Administrator workspace',
    title: 'Administrator workspace',
    subtitle: 'Question banks, account provisioning, and platform analytics will live here.',
    next: 'The administrative controls will be added after the student and lecturer flows.',
  },
};

export default function WorkspacePage() {
  const navigate = useNavigate();
  const { user, role, logout } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const workspace = WORKSPACES[role] ?? WORKSPACES.student;

  function handleSignOut() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <AuthLayout
      eyebrow={workspace.eyebrow}
      title={workspace.title}
      subtitle={workspace.subtitle}
      asideLabel="Authenticated workspace · Role secured"
      footer="Your session is scoped to this browser tab."
    >
      <div className="space-y-5">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold tracking-[0.16em] text-slate-500 uppercase">
                Signed in as
              </p>
              <p className="mt-1 text-lg font-semibold text-white">{user.name}</p>
              <p className="text-sm text-slate-400">{user.email}</p>
            </div>
            <span className="rounded-full border border-teal-400/30 bg-teal-400/10 px-3 py-1 text-xs font-semibold text-teal-200">
              {getRoleLabel(role)}
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-dashed border-white/15 bg-slate-950/30 p-5 text-sm leading-6 text-slate-400">
          <p className="font-medium text-slate-200">This route is role-guarded.</p>
          <p className="mt-1">{workspace.next}</p>
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
