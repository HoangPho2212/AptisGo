import { apiClient } from '../auth/apiClient.js';

/**
 * @returns {Promise<{
 *   goal: { id: string, targetCertificate: string, deadline: string, dailyMinutesTarget: number },
 *   day: { id: string, dayNumber: number, totalDays: number, tasks: Array<object> },
 *   progress: object,
 *   roadmap: object
 * }>}
 */
export async function fetchTodayPlan() {
  const { data } = await apiClient.get('/api/study-plans/today');

  return data;
}

/**
 * @param {string} taskId
 * @param {boolean} isCompleted
 * @returns {Promise<{ task: object, plan: object, roadmap: object }>}
 */
export async function updateTaskCompletion(taskId, isCompleted) {
  const { data } = await apiClient.patch(`/api/study-plans/tasks/${taskId}`, { isCompleted });

  return data;
}
