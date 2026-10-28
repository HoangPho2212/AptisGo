import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import AuthAlert from '../auth/AuthAlert.jsx';
import AuthLayout from '../auth/AuthLayout.jsx';
import ConsentField from '../auth/ConsentField.jsx';
import FormField from '../auth/FormField.jsx';
import PasswordField from '../auth/PasswordField.jsx';
import RoleSelector from '../auth/RoleSelector.jsx';
import { ApiError, registerRequest } from '../auth/api.js';
import { saveSession } from '../auth/authStorage.js';
import { normalizeEmail, validateRegisterForm } from '../auth/authValidation.js';

const INITIAL_VIEW_STATE = {
  name: '',
  studentId: '',
  email: '',
  password: '',
  confirmPassword: '',
  gdprConsent: false,
};

export default function RegisterPage() {
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

  function updateConsent(checked) {
    setViewState((current) => ({ ...current, gdprConsent: checked }));
    setFieldErrors((current) => ({ ...current, gdprConsent: undefined }));
    setFormError(null);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = validateRegisterForm(viewState);
    setFieldErrors(nextErrors);
    setFormError(null);
    setDetails([]);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setIsSubmitting(true);

    try {
      const session = await registerRequest({
        name: viewState.name.trim(),
        email: normalizeEmail(viewState.email),
        password: viewState.password,
        studentId: viewState.studentId,
      });

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
      eyebrow="Student enrollment"
      title="Create your student account"
      subtitle="Register with your Greenwich institutional email. Lecturer and administrator accounts are provisioned by the university."
      footer={
        <>
          Already have an account?{' '}
          <Link
            to="/login"
            className="font-semibold text-teal-300 underline-offset-4 hover:text-teal-200 hover:underline"
          >
            Sign in to your workspace
          </Link>
        </>
      }
    >
      <form className="space-y-5" onSubmit={handleSubmit} noValidate>
        <RoleSelector
          value="student"
          onChange={() => {}}
          allowedRoles={['student']}
          disabled={isSubmitting}
          legend="Account type"
          note="Lecturer and administrator accounts are created by invitation only."
          name="register-role"
        />

        <div className="grid gap-5 sm:grid-cols-2">
          <FormField
            id="register-name"
            label="Full name"
            autoComplete="name"
            placeholder="e.g. Nguyen Van Minh"
            value={viewState.name}
            onChange={updateField('name')}
            error={fieldErrors.name}
            required
          />

          <FormField
            id="register-student-id"
            label="Student ID (optional)"
            autoComplete="off"
            placeholder="e.g. GCS210884"
            value={viewState.studentId}
            onChange={updateField('studentId')}
            error={fieldErrors.studentId}
            hint="4–20 letters, digits, or hyphens."
          />
        </div>

        <FormField
          id="register-email"
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

        <div className="grid gap-5 sm:grid-cols-2">
          <PasswordField
            id="register-password"
            label="Password"
            autoComplete="new-password"
            placeholder="8–72 characters"
            value={viewState.password}
            onChange={updateField('password')}
            error={fieldErrors.password}
            required
          />

          <PasswordField
            id="register-confirm-password"
            label="Confirm password"
            autoComplete="new-password"
            placeholder="Repeat your password"
            value={viewState.confirmPassword}
            onChange={updateField('confirmPassword')}
            error={fieldErrors.confirmPassword}
            required
          />
        </div>

        <ConsentField
          checked={viewState.gdprConsent}
          onChange={updateConsent}
          error={fieldErrors.gdprConsent}
        />

        {formError ? <AuthAlert title={formError} details={details} /> : null}

        <button
          type="submit"
          disabled={isSubmitting}
          aria-busy={isSubmitting}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-400 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-teal-300 focus-visible:ring-2 focus-visible:ring-teal-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? 'Creating account…' : 'Create student account'}
          <span aria-hidden="true">→</span>
        </button>

        <p className="text-center text-[11px] leading-5 text-slate-500">
          Your password is hashed before storage. Your session is a short-lived JWT and can be ended
          at any time.
        </p>
      </form>
    </AuthLayout>
  );
}
