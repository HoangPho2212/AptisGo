const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STUDENT_ID_PATTERN = /^[A-Za-z0-9-]{4,20}$/;
const MAX_EMAIL_LENGTH = 254;
const MAX_NAME_LENGTH = 80;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 72;

/**
 * @param {unknown} body
 * @returns {body is Record<string, unknown>}
 */
function isJsonObject(body) {
  return typeof body === 'object' && body !== null && !Array.isArray(body);
}

/**
 * @param {unknown} value
 * @returns {string | null}
 */
function trimmedString(value) {
  return typeof value === 'string' ? value.trim() : null;
}

/**
 * @param {unknown} body
 * @returns {{ value: { name: string, email: string, password: string, studentId: string | null }, errors: string[] }}
 */
function validateRegisterInput(body) {
  if (!isJsonObject(body)) {
    return { value: {}, errors: ['request body must be a JSON object'] };
  }

  const errors = [];
  const name = trimmedString(body.name);
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  let studentId = null;

  if (!name) {
    errors.push('name is required');
  } else if (name.length > MAX_NAME_LENGTH) {
    errors.push(`name must be at most ${MAX_NAME_LENGTH} characters`);
  }

  if (!email) {
    errors.push('email is required');
  } else if (email.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(email)) {
    errors.push('email must be a valid address');
  }

  if (!password) {
    errors.push('password is required');
  } else if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
    errors.push(`password must be ${MIN_PASSWORD_LENGTH}-${MAX_PASSWORD_LENGTH} characters`);
  }

  if (body.studentId !== undefined && body.studentId !== null && body.studentId !== '') {
    const candidate = trimmedString(body.studentId);

    if (!candidate || !STUDENT_ID_PATTERN.test(candidate)) {
      errors.push('studentId must be 4-20 letters, digits, or hyphens');
    } else {
      studentId = candidate;
    }
  }

  return { value: { name: name ?? '', email, password, studentId }, errors };
}

/**
 * @param {unknown} body
 * @returns {{ value: { email: string, password: string }, errors: string[] }}
 */
function validateLoginInput(body) {
  if (!isJsonObject(body)) {
    return { value: {}, errors: ['request body must be a JSON object'] };
  }

  const errors = [];
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!email) {
    errors.push('email is required');
  }

  if (!password) {
    errors.push('password is required');
  }

  return { value: { email, password }, errors };
}

module.exports = {
  validateRegisterInput,
  validateLoginInput,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
};
