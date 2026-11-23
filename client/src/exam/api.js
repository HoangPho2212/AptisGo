import { apiClient } from '../auth/apiClient.js';

/**
 * @param {string} testId
 * @returns {Promise<object>} the published test without answer keys
 */
export async function fetchExamTest(testId) {
  const { data } = await apiClient.get(`/api/tests/${encodeURIComponent(testId)}`);

  return data;
}

/**
 * @param {{ testId: string, answers: Array<{ questionId: string, submittedAnswer: unknown }> }} payload
 * @returns {Promise<object>} the marked submission summary
 */
export async function submitAttempt(payload) {
  const { data } = await apiClient.post('/api/submissions', payload);

  return data;
}
