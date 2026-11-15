import { apiClient } from '../auth/apiClient.js';

/**
 * @returns {Promise<object>} the published placement diagnostic without answers
 */
export async function fetchPlacementTest() {
  const { data } = await apiClient.get('/api/tests/placement');

  return data;
}
