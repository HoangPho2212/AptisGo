import { Link, Navigate, useNavigate } from 'react-router-dom';

import AuthLayout from '../auth/AuthLayout.jsx';
import { getRoleLabel } from '../auth/authValidation.js';
import { useAuth } from '../auth/useAuth.js';

export default function AccessDeniedPage() {
  const navigate = useNavigate();
  const { user, role, logout } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  function handleSignOut() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <AuthLayout
      eyebrow="Access control"
      title="Access denied"
      subtitle="Your account is authenticated, but this area is reserved for a different role."
      asideLabel="Protected route · Role mismatch"
      footer="Client guards are a navigation aid; the API enforces authorization."
    >
      <div className="space-y-5">
        <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-5 text-sm leading-6 text-amber-100">
          <p className="font-semibold">This route is not available to your role.</p>
          <p className="mt-1">
            You are signed in as {getRoleLabel(role)}. If you followed a link from another
            workspace, return to your own area.
          </p>
        </div>

        <Link
          to={`/${role}`}
          className="block w-full rounded-xl bg-teal-400 px-4 py-3 text-center text-sm font-bold text-slate-950 transition hover:bg-teal-300 focus-visible:ring-2 focus-visible:ring-teal-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 focus-visible:outline-none"
        >
          Go to my workspace
        </Link>

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
