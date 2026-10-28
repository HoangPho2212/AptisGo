const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STUDENT_ID_PATTERN = /^[A-Za-z0-9-]{4,20}$/;
const MAX_EMAIL_LENGTH = 254;
const MAX_NAME_LENGTH = 80;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 72;

export const USER_ROLES = Object.freeze(['student', 'lecturer', 'admin']);

export const ROLE_OPTIONS = Object.freeze([
  {
    value: 'student',
    label: 'Student',
    description: 'Placement, roadmap, mocks',
  },
  {
    value: 'lecturer',
    label: 'Lecturer',
    description: 'Review queue, rubric grading',
  },
  {
    value: 'admin',
    label: 'Administrator',
    description: 'Test banks, accounts, SLA',
  },
]);

export function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function validateEmail(value) {
  const email = normalizeEmail(value);

  if (!email) {
    return 'Email is required';
  }

  if (email.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(email)) {
    return 'Enter a valid email address';
  }

  return null;
}

export function validateName(value) {
  const name = typeof value === 'string' ? value.trim() : '';

  if (!name) {
    return 'Full name is required';
  }

  if (name.length > MAX_NAME_LENGTH) {
    return `Full name must be ${MAX_NAME_LENGTH} characters or fewer`;
  }

  return null;
}

export function validatePassword(value) {
  const password = typeof value === 'string' ? value : '';

  if (!password) {
    return 'Password is required';
  }

  if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
    return `Password must be ${MIN_PASSWORD_LENGTH}–${MAX_PASSWORD_LENGTH} characters`;
  }

  return null;
}

export function validateStudentId(value) {
  const studentId = typeof value === 'string' ? value.trim() : '';

  if (!studentId) {
    return null;
  }

  if (!STUDENT_ID_PATTERN.test(studentId)) {
    return 'Student ID must be 4–20 letters, digits, or hyphens';
  }

  return null;
}

export function validateLoginForm(viewState = {}) {
  const errors = {};
  const emailError = validateEmail(viewState.email);
  const password = typeof viewState.password === 'string' ? viewState.password : '';

  if (emailError) {
    errors.email = emailError;
  }

  if (!password) {
    errors.password = 'Password is required';
  }

  if (!USER_ROLES.includes(viewState.role)) {
    errors.role = 'Select a valid role';
  }

  return errors;
}

export function validateRegisterForm(viewState = {}) {
  const errors = {};
  const nameError = validateName(viewState.name);
  const emailError = validateEmail(viewState.email);
  const studentIdError = validateStudentId(viewState.studentId);
  const passwordError = validatePassword(viewState.password);

  if (nameError) {
    errors.name = nameError;
  }

  if (emailError) {
    errors.email = emailError;
  }

  if (studentIdError) {
    errors.studentId = studentIdError;
  }

  if (passwordError) {
    errors.password = passwordError;
  } else if (viewState.confirmPassword !== viewState.password) {
    errors.confirmPassword = 'Passwords do not match';
  }

  if (viewState.gdprConsent !== true) {
    errors.gdprConsent = 'You must consent to the privacy notice to create an account';
  }

  return errors;
}

export function getRoleLabel(role) {
  return ROLE_OPTIONS.find((option) => option.value === role)?.label ?? 'Student';
}
