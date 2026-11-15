const mongoose = require('mongoose');

const StudyPlan = require('../models/StudyPlan');
const { isTaskId, validateTaskCompletionInput } = require('../validators/studyPlanValidator');
const { calculatePercent, calculateTaskProgress } = require('../services/studyPlanProgress');

/**
 * @param {{ _id: unknown, dayNumber: number, dailyTasks: Array<object> }} plan
 * @param {{ _id: unknown, title: string, skill: string, partNumber: number, points: number, isCompleted: boolean }} task
 * @returns {object}
 */
function serializeTask(plan, task) {
  return {
    id: String(task._id),
    planId: String(plan._id),
    dayNumber: plan.dayNumber,
    title: task.title,
    skill: task.skill,
    partNumber: task.partNumber,
    points: task.points,
    isCompleted: task.isCompleted,
  };
}

/**
 * Aggregate every day plan of the student into one progress summary.
 *
 * @param {string} student
 * @returns {Promise<{
 *   completedTasks: number,
 *   totalTasks: number,
 *   percent: number,
 *   completedPoints: number,
 *   totalPoints: number
 * }>}
 */
async function calculateRoadmapProgress(student) {
  const [totals] = await StudyPlan.aggregate([
    { $match: { student: new mongoose.Types.ObjectId(String(student)) } },
    { $unwind: '$dailyTasks' },
    {
      $group: {
        _id: null,
        totalTasks: { $sum: 1 },
        completedTasks: { $sum: { $cond: ['$dailyTasks.isCompleted', 1, 0] } },
        totalPoints: { $sum: '$dailyTasks.points' },
        completedPoints: {
          $sum: { $cond: ['$dailyTasks.isCompleted', '$dailyTasks.points', 0] },
        },
      },
    },
  ]);

  const completedTasks = totals?.completedTasks ?? 0;
  const totalTasks = totals?.totalTasks ?? 0;

  return {
    completedTasks,
    totalTasks,
    percent: calculatePercent(completedTasks, totalTasks),
    completedPoints: totals?.completedPoints ?? 0,
    totalPoints: totals?.totalPoints ?? 0,
  };
}

/**
 * PATCH /api/study-plans/tasks/:id
 *
 * Sets one embedded task's completion flag and returns the recalculated plan
 * and roadmap progress. Progress is derived, never stored.
 *
 * @param {import('express').Request} request
 * @param {import('express').Response} response
 * @returns {Promise<void>}
 */
async function updateTaskCompletion(request, response) {
  const taskId = request.params.id;

  if (!isTaskId(taskId)) {
    return response.status(400).json({ error: 'Invalid identifier' });
  }

  const { value, errors } = validateTaskCompletionInput(request.body);

  if (errors.length > 0) {
    return response.status(400).json({ error: 'Validation failed', details: errors });
  }

  const plan = await StudyPlan.findOneAndUpdate(
    { student: request.user.id, 'dailyTasks._id': taskId },
    { $set: { 'dailyTasks.$.isCompleted': value.isCompleted } },
    { returnDocument: 'after', runValidators: true }
  ).lean();

  if (!plan) {
    return response.status(404).json({ error: 'Task not found' });
  }

  const task = plan.dailyTasks.find((entry) => String(entry._id) === taskId);
  const planProgress = calculateTaskProgress(plan.dailyTasks);
  const roadmapProgress = await calculateRoadmapProgress(request.user.id);

  return response.status(200).json({
    task: serializeTask(plan, task),
    plan: {
      id: String(plan._id),
      dayNumber: plan.dayNumber,
      ...planProgress,
    },
    roadmap: roadmapProgress,
  });
}

module.exports = {
  calculateRoadmapProgress,
  serializeTask,
  updateTaskCompletion,
};
