import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import AuthAlert from '../auth/AuthAlert.jsx';
import AuthLayout from '../auth/AuthLayout.jsx';
import FormField from '../auth/FormField.jsx';
import PasswordField from '../auth/PasswordField.jsx';
import RoleSelector from '../auth/RoleSelector.jsx';
import { ApiError, loginRequest } from '../auth/api.js';
import { saveSession } from '../auth/authStorage.js';
import { getRoleLabel, normalizeEmail, validateLoginForm } from '../auth/authValidation.js';

const INITIAL_VIEW_STATE = {
  email: '',
  password: '',
  role: 'student',
};

export default function LoginPage() {
  const navigate = useNavigate();
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [details, setDetails] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateField(field) {
    return (event) => {
      setViewState((current) => ({ ...current, [field]: event.target.value }));
      setFieldErrors((current) => ({ ...current, [field]: undefined }));
      setFormError(null);
      setDetails([]);
    };
  }

  function updateRole(role) {
    setViewState((current) => ({ ...current, role }));
    setFieldErrors((current) => ({ ...current, role: undefined }));
    setFormError(null);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = validateLoginForm(viewState);
    setFieldErrors(nextErrors);
    setFormError(null);
    setDetails([]);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setIsSubmitting(true);

    try {
      const session = await loginRequest({
        email: normalizeEmail(viewState.email),
        password: viewState.password,
      });
      const actualRole = session?.user?.role;

      if (actualRole !== viewState.role) {
        const actualLabel = getRoleLabel(actualRole);
        setFormError(
          `This account is registered as a ${actualLabel}. Select ${actualLabel} to continue.`
        );
        return;
      }

      saveSession(session);
      navigate('/', { replace: true });
    } catch (error) {
      setFormError(
        error instanceof ApiError ? error.message : 'Something went wrong. Please try again.'
      );
      setDetails(error instanceof ApiError ? error.details : []);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout
      eyebrow="Welcome back"
      title="Sign in to your workspace"
      subtitle="Use your Greenwich institutional account. Your selected role is checked against the account record."
      footer={
        <>
          New to APTIS GO?{' '}
          <Link
            to="/register"
            className="font-semibold text-teal-300 underline-offset-4 hover:text-teal-200 hover:underline"
          >
            Create a student account
          </Link>
        </>
      }
    >
      <form className="space-y-5" onSubmit={handleSubmit} noValidate>
        <RoleSelector
          value={viewState.role}
          onChange={updateRole}
          disabled={isSubmitting}
          legend="Sign in as"
          note="Your account role is verified after sign-in."
        />

        <FormField
          id="login-email"
          label="Institutional email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="name@greenwich.edu.vn"
          value={viewState.email}
          onChange={updateField('email')}
          error={fieldErrors.email}
          hint="Use your @greenwich.edu.vn address."
          required
        />

        <PasswordField
          id="login-password"
          label="Password"
          autoComplete="current-password"
          placeholder="Enter your password"
          value={viewState.password}
          onChange={updateField('password')}
          error={fieldErrors.password}
          required
        />

        {formError ? <AuthAlert title={formError} details={details} /> : null}

        <button
          type="submit"
          disabled={isSubmitting}
          aria-busy={isSubmitting}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-400 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-teal-300 focus-visible:ring-2 focus-visible:ring-teal-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? 'Signing in…' : 'Sign in securely'}
          <span aria-hidden="true">→</span>
        </button>

        <p className="text-center text-[11px] leading-5 text-slate-500">
          Protected by bcrypt password hashing and a short-lived JWT session. Never share your
          password with anyone.
        </p>
      </form>
    </AuthLayout>
  );
}
