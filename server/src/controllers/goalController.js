const Goal = require('../models/Goal');
const StudyPlan = require('../models/StudyPlan');
const { validateGoalInput } = require('../validators/goalValidator');
const { buildRoadmap, RoadmapError } = require('../services/roadmapGenerator');

/**
 * @param {import('mongoose').Document} goal
 * @param {number} remainingDays
 * @returns {object}
 */
function serializeGoal(goal, remainingDays) {
  return {
    id: String(goal._id),
    targetCertificate: goal.targetCertificate,
    deadline: goal.deadline.toISOString(),
    dailyMinutesTarget: goal.dailyMinutesTarget,
    remainingDays,
  };
}

/**
 * @param {string} student
 * @param {{
 *   targetCertificate: 'B1'|'B2'|'C1',
 *   dailyMinutesTarget: number
 * }} value
 * @param {Date} deadline
 * @returns {Promise<import('mongoose').Document>}
 */
async function upsertGoal(student, value, deadline) {
  const update = {
    $set: {
      targetCertificate: value.targetCertificate,
      deadline,
      dailyMinutesTarget: value.dailyMinutesTarget,
    },
  };
  const options = {
    upsert: true,
    returnDocument: 'after',
    runValidators: true,
    setDefaultsOnInsert: true,
  };

  try {
    return await Goal.findOneAndUpdate({ student }, update, options);
  } catch (error) {
    // A concurrent first request can win the unique student index race.
    if (error.code === 11000) {
      return Goal.findOneAndUpdate({ student }, update, options);
    }

    throw error;
  }
}

/**
 * @param {import('express').Request} request
 * @param {import('express').Response} response
 * @returns {Promise<void>}
 */
async function createGoal(request, response) {
  const { value, errors } = validateGoalInput(request.body);

  if (errors.length > 0) {
    return response.status(400).json({ error: 'Validation failed', details: errors });
  }

  let roadmap;

  try {
    roadmap = buildRoadmap({ ...value, now: new Date() });
  } catch (error) {
    if (error instanceof RoadmapError) {
      return response.status(error.statusCode).json({ error: error.message });
    }

    throw error;
  }

  const student = request.user.id;
  const existed = Boolean(await Goal.exists({ student }));
  const goal = await upsertGoal(student, value, roadmap.deadline);

  const plans = roadmap.days.map(
    (day) =>
      new StudyPlan({
        student,
        dayNumber: day.dayNumber,
        dailyTasks: day.dailyTasks,
      })
  );

  // Validate every generated day before replacing the old roadmap.
  for (const plan of plans) {
    await plan.validate();
  }

  await StudyPlan.deleteMany({ student });
  await StudyPlan.insertMany(plans, { ordered: true });

  return response.status(existed ? 200 : 201).json({
    goal: serializeGoal(goal, roadmap.remainingDays),
    roadmap: {
      totalDays: roadmap.remainingDays,
      tasksPerDay: roadmap.tasksPerDay,
      totalTasks: roadmap.remainingDays * roadmap.tasksPerDay,
      firstDayNumber: 1,
      lastDayNumber: roadmap.remainingDays,
    },
  });
}

module.exports = {
  createGoal,
  serializeGoal,
  upsertGoal,
};
