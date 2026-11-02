const test = require('node:test');
const assert = require('node:assert/strict');

const { connectDatabase, disconnectDatabase } = require('../server/src/config/database');
const Goal = require('../server/src/models/Goal');
const StudyPlan = require('../server/src/models/StudyPlan');

const testUri = process.env.MONGODB_TEST_URI;
const skipReason = testUri ? false : 'MONGODB_TEST_URI is not set';

test(
  'Goal and StudyPlan integration: one goal per student and embedded task state',
  { skip: skipReason },
  async (t) => {
    const student = new Goal.base.Types.ObjectId();

    await connectDatabase({ uri: testUri, options: { maxPoolSize: 2, minPoolSize: 0 } });
    await Goal.init();
    await StudyPlan.init();

    t.after(async () => {
      await Goal.deleteMany({ student });
      await StudyPlan.deleteMany({ student });
      await disconnectDatabase();
    });

    const goal = await Goal.create({
      student,
      deadline: new Date('2027-06-30'),
    });

    assert.equal(goal.targetCertificate, 'B2');
    assert.equal(goal.dailyMinutesTarget, 45);

    await assert.rejects(
      Goal.create({
        student,
        targetCertificate: 'C1',
        deadline: new Date('2027-12-31'),
      }),
      (error) => error.code === 11000
    );

    const plan = await StudyPlan.create({
      student,
      dayNumber: 1,
      dailyTasks: [
        {
          title: 'Reading Part 1 practice',
          skill: 'reading',
          partNumber: 1,
        },
      ],
    });

    const storedPlan = await StudyPlan.findById(plan._id);
    assert.equal(storedPlan.dailyTasks[0].isCompleted, false);
    assert.equal(storedPlan.dailyTasks[0].points, 10);
    assert.ok(storedPlan.dailyTasks[0]._id);

    storedPlan.dailyTasks[0].isCompleted = true;
    await storedPlan.save();

    const completedPlan = await StudyPlan.findById(plan._id);
    assert.equal(completedPlan.dailyTasks[0].isCompleted, true);
  }
);
