const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');

const SECRET = 'study-plan-today-secret-at-least-32-chars';
process.env.JWT_SECRET = SECRET;

const app = require('../server/src/app');
const { connectDatabase, disconnectDatabase } = require('../server/src/config/database');
const Goal = require('../server/src/models/Goal');
const StudyPlan = require('../server/src/models/StudyPlan');
const { DAY_MS } = require('../server/src/services/roadmapGenerator');
const { signAccessToken } = require('../server/src/utils/jwt');

const testUri = process.env.MONGODB_TEST_URI;
const skipReason = testUri ? false : 'MONGODB_TEST_URI is not set';

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

function getToday(baseUrl, token) {
  return fetch(`${baseUrl}/api/study-plans/today`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

test(
  'Study plan today: resolves the current UTC day and derived progress',
  { skip: skipReason },
  async (t) => {
    const student = new StudyPlan.base.Types.ObjectId();
    const otherStudent = new StudyPlan.base.Types.ObjectId();
    const token = signAccessToken({ _id: String(student), role: 'student' }, { secret: SECRET });
    const otherToken = signAccessToken(
      { _id: String(otherStudent), role: 'student' },
      { secret: SECRET }
    );

    await connectDatabase({ uri: testUri, options: { maxPoolSize: 2, minPoolSize: 0 } });
    await Promise.all([Goal.init(), StudyPlan.init()]);

    t.after(async () => {
      await Goal.deleteMany({ student: { $in: [student, otherStudent] } });
      await StudyPlan.deleteMany({ student: { $in: [student, otherStudent] } });
      await disconnectDatabase();
    });

    await withServer(async (baseUrl) => {
      const missingGoal = await getToday(baseUrl, token);

      assert.equal(missingGoal.status, 404);
      assert.deepEqual(await missingGoal.json(), { error: 'Goal not found' });
    });

    const deadline = new Date(Date.now() + 30 * DAY_MS);
    const goal = await Goal.create({
      student,
      targetCertificate: 'B2',
      deadline,
      dailyMinutesTarget: 45,
    });

    // Move the goal two UTC days into the past so "today" is day 3.
    await Goal.collection.updateOne(
      { _id: goal._id },
      { $set: { createdAt: new Date(Date.now() - 2 * DAY_MS) } }
    );

    await withServer(async (baseUrl) => {
      const missingPlan = await getToday(baseUrl, token);

      assert.equal(missingPlan.status, 404);
      assert.deepEqual(await missingPlan.json(), { error: 'Study plan not found' });
    });

    await StudyPlan.create([
      {
        student,
        dayNumber: 1,
        dailyTasks: [{ title: 'Core Part 1: Grammar practice', skill: 'core', partNumber: 1 }],
      },
      {
        student,
        dayNumber: 2,
        dailyTasks: [
          {
            title: 'Listening Part 1: Information matching',
            skill: 'listening',
            partNumber: 1,
          },
          { title: 'Reading Part 1: Sentence completion', skill: 'reading', partNumber: 1 },
        ],
      },
      {
        student,
        dayNumber: 3,
        dailyTasks: [
          {
            title: 'Core Part 2: Vocabulary practice',
            skill: 'core',
            partNumber: 2,
            isCompleted: true,
          },
          { title: 'Listening Part 2: Opinion matching', skill: 'listening', partNumber: 2 },
        ],
      },
      {
        student,
        dayNumber: 4,
        dailyTasks: [
          { title: 'Writing Part 1: Form completion', skill: 'writing', partNumber: 1 },
          { title: 'Speaking Part 1: Personal information', skill: 'speaking', partNumber: 1 },
        ],
      },
    ]);

    await withServer(async (baseUrl) => {
      const response = await getToday(baseUrl, token);

      assert.equal(response.status, 200);

      const body = await response.json();

      assert.deepEqual(body.goal, {
        id: String(goal._id),
        targetCertificate: 'B2',
        deadline: deadline.toISOString().slice(0, 10),
        dailyMinutesTarget: 45,
      });
      assert.equal(body.day.dayNumber, 3);
      assert.equal(body.day.totalDays, 4);
      assert.equal(body.day.tasks.length, 2);
      assert.deepEqual(body.day.tasks[0], {
        id: String(body.day.tasks[0].id),
        title: 'Core Part 2: Vocabulary practice',
        skill: 'core',
        partNumber: 2,
        points: 10,
        isCompleted: true,
      });
      assert.equal(body.day.tasks[1].isCompleted, false);
      assert.equal(body.day.tasks[0].planId, undefined);
      assert.deepEqual(body.progress, {
        completedTasks: 1,
        totalTasks: 2,
        percent: 50,
        completedPoints: 10,
        totalPoints: 20,
      });
      assert.deepEqual(body.roadmap, {
        completedTasks: 1,
        totalTasks: 7,
        percent: 14.3,
        completedPoints: 10,
        totalPoints: 70,
      });

      const foreign = await getToday(baseUrl, otherToken);

      assert.equal(foreign.status, 404);
      assert.deepEqual(await foreign.json(), { error: 'Goal not found' });
    });

    // A stale goal clamps to the last stored day instead of 404.
    await Goal.collection.updateOne(
      { _id: goal._id },
      { $set: { createdAt: new Date(Date.now() - 40 * DAY_MS) } }
    );

    await withServer(async (baseUrl) => {
      const response = await getToday(baseUrl, token);

      assert.equal(response.status, 200);
      assert.equal((await response.json()).day.dayNumber, 4);
    });
  }
);
