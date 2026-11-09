const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');

const SECRET = 'goal-integration-secret-at-least-32-characters';
process.env.JWT_SECRET = SECRET;

const app = require('../server/src/app');
const { connectDatabase, disconnectDatabase } = require('../server/src/config/database');
const Goal = require('../server/src/models/Goal');
const StudyPlan = require('../server/src/models/StudyPlan');
const User = require('../server/src/models/User');
const { signAccessToken } = require('../server/src/utils/jwt');

const testUri = process.env.MONGODB_TEST_URI;
const skipReason = testUri ? false : 'MONGODB_TEST_URI is not set';
const DAY_MS = 86_400_000;

async function withServer(run) {
  const server = app.listen(0, '127.0.0.1');

  try {
    await once(server, 'listening');
    const { port } = server.address();
    return await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

function postGoal(baseUrl, token, body) {
  return fetch(`${baseUrl}/api/goals`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

test(
  'Goal roadmap generator: persists goal and daily plans, then regenerates on update',
  { skip: skipReason },
  async (t) => {
    const email = `goal-roadmap-${Date.now()}@aptis-go.test`;
    let user;

    await connectDatabase({ uri: testUri, options: { maxPoolSize: 2, minPoolSize: 0 } });
    await Goal.init();
    await StudyPlan.init();

    t.after(async () => {
      if (user) {
        await Goal.deleteMany({ student: user._id });
        await StudyPlan.deleteMany({ student: user._id });
        await User.deleteOne({ _id: user._id });
      }
      await disconnectDatabase();
    });

    user = await User.create({
      name: 'Roadmap Student',
      email,
      password: 'Placement2026!',
    });

    const token = signAccessToken(user, { secret: SECRET });

    await withServer(async (baseUrl) => {
      const firstDeadline = new Date(Date.now() + 10 * DAY_MS + 60_000).toISOString();
      const first = await postGoal(baseUrl, token, { deadline: firstDeadline });

      assert.equal(first.status, 201);
      const firstBody = await first.json();

      assert.equal(firstBody.goal.targetCertificate, 'B2');
      assert.equal(firstBody.goal.dailyMinutesTarget, 45);
      assert.equal(new Date(firstBody.goal.deadline).toISOString(), firstDeadline);
      assert.ok(firstBody.goal.remainingDays >= 10);
      assert.equal(firstBody.goal.remainingDays, firstBody.roadmap.totalDays);
      assert.equal(firstBody.roadmap.tasksPerDay, 3);
      assert.equal(
        firstBody.roadmap.totalTasks,
        firstBody.roadmap.totalDays * firstBody.roadmap.tasksPerDay
      );
      assert.equal(firstBody.roadmap.firstDayNumber, 1);
      assert.equal(firstBody.roadmap.lastDayNumber, firstBody.roadmap.totalDays);

      const firstPlans = await StudyPlan.find({ student: user._id }).sort({ dayNumber: 1 });

      assert.equal(firstPlans.length, firstBody.roadmap.totalDays);
      assert.equal(firstPlans[0].dayNumber, 1);
      assert.equal(firstPlans.at(-1).dayNumber, firstBody.roadmap.totalDays);
      assert.deepEqual(
        firstPlans[0].dailyTasks.map((task) => task.title),
        [
          'Core Part 1: Grammar practice',
          'Listening Part 1: Information matching',
          'Reading Part 1: Sentence completion',
        ]
      );
      assert.deepEqual(
        firstPlans[1].dailyTasks.map((task) => task.title),
        [
          'Writing Part 1: Form completion',
          'Speaking Part 1: Personal information',
          'Core Part 2: Vocabulary practice',
        ]
      );

      for (const plan of firstPlans) {
        assert.equal(plan.dailyTasks.length, 3);
        for (const task of plan.dailyTasks) {
          assert.ok(task._id, 'each embedded task must have an _id');
          assert.equal(task.points, 10);
          assert.equal(task.isCompleted, false);
        }
      }

      assert.equal(await Goal.countDocuments({ student: user._id }), 1);

      const secondDeadline = new Date(Date.now() + 5 * DAY_MS + 60_000).toISOString();
      const second = await postGoal(baseUrl, token, {
        deadline: secondDeadline,
        targetCertificate: 'C1',
        dailyMinutesTarget: 30,
      });

      assert.equal(second.status, 200);
      const secondBody = await second.json();

      assert.equal(secondBody.goal.targetCertificate, 'C1');
      assert.equal(secondBody.goal.dailyMinutesTarget, 30);
      assert.equal(secondBody.roadmap.tasksPerDay, 2);
      assert.equal(secondBody.roadmap.totalDays, secondBody.goal.remainingDays);
      assert.ok(secondBody.roadmap.totalDays < firstBody.roadmap.totalDays);

      const secondPlans = await StudyPlan.find({ student: user._id }).sort({ dayNumber: 1 });

      assert.equal(secondPlans.length, secondBody.roadmap.totalDays);
      assert.equal(secondPlans.at(-1).dayNumber, secondBody.roadmap.totalDays);
      assert.equal(new Set(secondPlans.map((plan) => plan.dayNumber)).size, secondPlans.length);
      assert.deepEqual(
        secondPlans[0].dailyTasks.map((task) => task.title),
        ['Core Part 1: Grammar practice', 'Listening Part 1: Information matching']
      );
      assert.deepEqual(
        secondPlans[1].dailyTasks.map((task) => task.title),
        ['Reading Part 1: Sentence completion', 'Writing Part 1: Form completion']
      );

      const goal = await Goal.findOne({ student: user._id });
      assert.equal(goal.targetCertificate, 'C1');
      assert.equal(goal.dailyMinutesTarget, 30);
      assert.equal(await Goal.countDocuments({ student: user._id }), 1);

      const planCountBeforePast = await StudyPlan.countDocuments({ student: user._id });
      const past = await postGoal(baseUrl, token, {
        deadline: new Date(Date.now() - DAY_MS).toISOString(),
      });

      assert.equal(past.status, 400);
      assert.deepEqual(await past.json(), { error: 'Deadline must be a future date' });
      assert.equal(await Goal.countDocuments({ student: user._id }), 1);
      assert.equal(await StudyPlan.countDocuments({ student: user._id }), planCountBeforePast);
    });
  }
);
