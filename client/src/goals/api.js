import { apiClient } from '../auth/apiClient.js';

/**
 * @param {{ targetCertificate: 'B1'|'B2', deadline: string, dailyMinutesTarget: number }} goal
 * @returns {Promise<{ goal: object, roadmap: object }>}
 */
export async function createGoalRequest(goal) {
  const { data } = await apiClient.post('/api/goals', {
    targetCertificate: goal.targetCertificate,
    deadline: goal.deadline,
    dailyMinutesTarget: goal.dailyMinutesTarget,
  });

  return data;
}
