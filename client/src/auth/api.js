const API_BASE_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(message, { status = 0, details = [] } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = Array.isArray(details)
      ? details.filter((detail) => typeof detail === 'string')
      : [];
  }
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function postJson(path, body) {
  let response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw error;
    }

    throw new ApiError('Unable to reach the API. Check that the server is running.', {
      status: 0,
    });
  }

  const payload = await readJson(response);

  if (!response.ok) {
    throw new ApiError(payload?.error ?? `Request failed with status ${response.status}`, {
      status: response.status,
      details: payload?.details,
    });
  }

  return payload;
}

export function loginRequest({ email, password }) {
  return postJson('/api/auth/login', { email, password });
}

export function registerRequest({ name, email, password, studentId }) {
  const body = { name, email, password };
  const normalizedStudentId = typeof studentId === 'string' ? studentId.trim() : '';

  if (normalizedStudentId) {
    body.studentId = normalizedStudentId;
  }

  return postJson('/api/auth/register', body);
}
