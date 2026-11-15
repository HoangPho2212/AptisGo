const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');

const SECRET = 'study-plan-integration-secret-at-least-32-chars';
process.env.JWT_SECRET = SECRET;

const app = require('../server/src/app');
const { connectDatabase, disconnectDatabase } = require('../server/src/config/database');
const StudyPlan = require('../server/src/models/StudyPlan');
const { signAccessToken } = require('../server/src/utils/jwt');

const testUri = process.env.MONGODB_TEST_URI;
const skipReason = testUri ? false : 'MONGODB_TEST_URI is not set';

const UNKNOWN_TASK_ID = '507f1f77bcf86cd7994390ff';

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

function patchTask(baseUrl, token, taskId, body) {
  return fetch(`${baseUrl}/api/study-plans/tasks/${taskId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
}

test(
  'Study plan task completion: toggles the embedded flag and recalculates progress',
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
    await StudyPlan.init();

    t.after(async () => {
      await StudyPlan.deleteMany({ student: { $in: [student, otherStudent] } });
      await disconnectDatabase();
    });

    const dayOne = await StudyPlan.create({
      student,
      dayNumber: 1,
      dailyTasks: [
        { title: 'Core Part 1: Grammar practice', skill: 'core', partNumber: 1 },
        { title: 'Listening Part 1: Information matching', skill: 'listening', partNumber: 1 },
      ],
    });
    const dayTwo = await StudyPlan.create({
      student,
      dayNumber: 2,
      dailyTasks: [
        { title: 'Reading Part 1: Sentence completion', skill: 'reading', partNumber: 1 },
        { title: 'Writing Part 1: Form completion', skill: 'writing', partNumber: 1 },
      ],
    });
    const otherPlan = await StudyPlan.create({
      student: otherStudent,
      dayNumber: 1,
      dailyTasks: [{ title: 'Speaking Part 1', skill: 'speaking', partNumber: 1 }],
    });

    const dayOneTask1 = String(dayOne.dailyTasks[0]._id);
    const dayTwoTask1 = String(dayTwo.dailyTasks[0]._id);
    const foreignTask = String(otherPlan.dailyTasks[0]._id);

    await withServer(async (baseUrl) => {
      const first = await patchTask(baseUrl, token, dayOneTask1, { isCompleted: true });
      assert.equal(first.status, 200);

      const firstBody = await first.json();
      assert.deepEqual(firstBody.task, {
        id: dayOneTask1,
        planId: String(dayOne._id),
        dayNumber: 1,
        title: 'Core Part 1: Grammar practice',
        skill: 'core',
        partNumber: 1,
        points: 10,
        isCompleted: true,
      });
      assert.deepEqual(firstBody.plan, {
        id: String(dayOne._id),
        dayNumber: 1,
        completedTasks: 1,
        totalTasks: 2,
        percent: 50,
        completedPoints: 10,
        totalPoints: 20,
      });
      assert.deepEqual(firstBody.roadmap, {
        completedTasks: 1,
        totalTasks: 4,
        percent: 25,
        completedPoints: 10,
        totalPoints: 40,
      });

      const storedTask = await StudyPlan.findById(dayOne._id).lean();
      assert.equal(storedTask.dailyTasks[0].isCompleted, true);
      assert.equal(storedTask.dailyTasks[1].isCompleted, false);

      const repeated = await patchTask(baseUrl, token, dayOneTask1, { isCompleted: true });
      assert.equal(repeated.status, 200);
      assert.equal((await repeated.json()).roadmap.completedTasks, 1);

      const second = await patchTask(baseUrl, token, dayTwoTask1, { isCompleted: true });
      assert.equal(second.status, 200);

      const secondBody = await second.json();
      assert.equal(secondBody.plan.percent, 50);
      assert.equal(secondBody.roadmap.completedTasks, 2);
      assert.equal(secondBody.roadmap.percent, 50);
      assert.equal(secondBody.roadmap.completedPoints, 20);

      const reverted = await patchTask(baseUrl, token, dayOneTask1, { isCompleted: false });
      assert.equal(reverted.status, 200);

      const revertedBody = await reverted.json();
      assert.equal(revertedBody.task.isCompleted, false);
      assert.equal(revertedBody.plan.completedTasks, 0);
      assert.equal(revertedBody.plan.percent, 0);
      assert.equal(revertedBody.roadmap.completedTasks, 1);
      assert.equal(revertedBody.roadmap.percent, 25);

      const revertedStored = await StudyPlan.findById(dayOne._id).lean();
      assert.equal(revertedStored.dailyTasks[0].isCompleted, false);

      const foreign = await patchTask(baseUrl, otherToken, dayOneTask1, { isCompleted: false });
      assert.equal(foreign.status, 404);
      assert.deepEqual(await foreign.json(), { error: 'Task not found' });

      const foreignReverse = await patchTask(baseUrl, token, foreignTask, { isCompleted: true });
      assert.equal(foreignReverse.status, 404);
      assert.deepEqual(await foreignReverse.json(), { error: 'Task not found' });

      const otherStored = await StudyPlan.findById(otherPlan._id).lean();
      assert.equal(otherStored.dailyTasks[0].isCompleted, false);

      const unchanged = await StudyPlan.findById(dayTwo._id).lean();
      assert.equal(unchanged.dailyTasks[0].isCompleted, true);

      const unknown = await patchTask(baseUrl, token, UNKNOWN_TASK_ID, { isCompleted: true });
      assert.equal(unknown.status, 404);
      assert.deepEqual(await unknown.json(), { error: 'Task not found' });
    });
  }
);
