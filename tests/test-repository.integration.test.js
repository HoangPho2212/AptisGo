const test = require('node:test');
const assert = require('node:assert/strict');

const { connectDatabase, disconnectDatabase } = require('../server/src/config/database');
const Test = require('../server/src/models/Test');

const testUri = process.env.MONGODB_TEST_URI;
const skipReason = testUri ? false : 'MONGODB_TEST_URI is not set';

test(
  'Test integration: default reads omit embedded correct answers',
  { skip: skipReason },
  async (t) => {
    const title = `test-integration-${Date.now()}`;

    await connectDatabase({ uri: testUri, options: { maxPoolSize: 2, minPoolSize: 0 } });
    await Test.init();

    t.after(async () => {
      await Test.deleteMany({ title });
      await disconnectDatabase();
    });

    const created = await Test.create({
      title,
      type: 'practice',
      targetCefr: 'B2',
      skillModules: ['reading'],
      durationMinutes: 35,
      questions: [
        {
          skill: 'reading',
          part: 1,
          questionType: 'dropdown_cloze',
          prompt: 'Complete the notice.',
          contextPassage: 'The library closes at 6 p.m.',
          dropdownSets: [
            {
              prompt: 'The library ___ at 6 p.m.',
              options: ['close', 'closes'],
              correctAnswer: 'closes',
            },
          ],
          correctAnswer: 'closes',
        },
      ],
    });

    const studentView = await Test.findById(created._id);
    assert.equal(studentView.questions[0].correctAnswer, undefined);
    assert.equal(studentView.questions[0].dropdownSets[0].correctAnswer, undefined);

    const gradingView = await Test.findById(created._id).select(
      '+questions.correctAnswer +questions.dropdownSets.correctAnswer'
    );
    assert.equal(gradingView.questions[0].correctAnswer, 'closes');
    assert.equal(gradingView.questions[0].dropdownSets[0].correctAnswer, 'closes');
  }
);
