import { Link, useNavigate } from 'react-router-dom';

import { getRoleLabel } from '../auth/authValidation.js';
import { useAuth } from '../auth/useAuth.js';
import Brand from './Brand.jsx';

const NAV_ITEMS = [
  { id: 'workspace', to: '/student', label: 'Workspace' },
  { id: 'placement', to: '/placement', label: 'Diagnostic' },
  { id: 'goals', to: '/goals', label: 'Goal' },
];

export default function StudentShell({ active, children }) {
  const navigate = useNavigate();
  const { user, role, logout } = useAuth();

  function handleSignOut() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="relative min-h-screen bg-[#06111f] text-slate-100">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(20,184,166,0.18),transparent_35%),radial-gradient(circle_at_85%_80%,rgba(37,99,235,0.14),transparent_40%)]"
      />

      <div className="relative mx-auto flex min-h-screen max-w-5xl flex-col px-4 py-8 sm:px-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <Link to="/student" aria-label="APTIS GO workspace">
            <Brand />
          </Link>

          <nav aria-label="Student" className="flex flex-wrap items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.id}
                to={item.to}
                aria-current={active === item.id ? 'page' : undefined}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  active === item.id
                    ? 'bg-teal-400/15 text-teal-200'
                    : 'text-slate-400 hover:bg-white/[0.05] hover:text-slate-200'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-white">{user?.name}</p>
              <p className="text-xs text-slate-500">{getRoleLabel(role)}</p>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              className="rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-white/20 hover:bg-white/[0.05] focus-visible:ring-2 focus-visible:ring-teal-400/60 focus-visible:outline-none"
            >
              Sign out
            </button>
          </div>
        </header>

        <main className="mt-8 flex-1">{children}</main>

        <footer className="mt-10 text-xs text-slate-600">
          Your session is scoped to this browser tab. Never share your password.
        </footer>
      </div>
    </div>
  );
}
