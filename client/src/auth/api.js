import { apiClient } from './apiClient.js';

export { ApiError } from './apiError.js';

export async function loginRequest({ email, password }) {
  const { data } = await apiClient.post('/api/auth/login', { email, password });
  return data;
}

export async function registerRequest({ name, email, password, studentId }) {
  const body = { name, email, password };
  const normalizedStudentId = typeof studentId === 'string' ? studentId.trim() : '';

  if (normalizedStudentId) {
    body.studentId = normalizedStudentId;
  }

  const { data } = await apiClient.post('/api/auth/register', body);
  return data;
}
