const test = require('node:test');
const assert = require('node:assert/strict');

const Submission = require('../server/src/models/Submission');
const { connectDatabase, disconnectDatabase } = require('../server/src/config/database');

const testUri = process.env.MONGODB_TEST_URI;
const skipReason = testUri ? false : 'MONGODB_TEST_URI is not set';

test(
  'Submission integration: persists details and grading scores',
  { skip: skipReason },
  async (t) => {
    const student = new Submission.base.Types.ObjectId();
    const testId = new Submission.base.Types.ObjectId();

    await connectDatabase({ uri: testUri, options: { maxPoolSize: 2, minPoolSize: 0 } });
    await Submission.init();

    t.after(async () => {
      await Submission.deleteMany({ student });
      await disconnectDatabase();
    });

    const created = await Submission.create({
      student,
      test: testId,
      status: 'pending_review',
      autoScore: 38,
      details: [
        {
          questionId: new Submission.base.Types.ObjectId(),
          skill: 'core',
          part: 1,
          questionType: 'mcq_single',
          submittedAnswer: 'is',
          isCorrect: true,
          autoScore: 1,
        },
        {
          questionId: new Submission.base.Types.ObjectId(),
          skill: 'writing',
          part: 4,
          questionType: 'essay_text',
          submittedAnswer: 'Dear Sir, I am writing to apply for the course.',
          wordCount: 120,
        },
      ],
    });

    const stored = await Submission.findById(created._id).lean();

    assert.equal(stored.status, 'pending_review');
    assert.equal(stored.autoScore, 38);
    assert.equal(stored.manualScore, null);
    assert.equal(stored.totalScore, null);
    assert.equal(stored.details.length, 2);
    assert.equal(stored.details[1].isCorrect, null);
    assert.equal(stored.details[1].autoScore, 0);
    assert.equal(stored.details[1].wordCount, 120);
    assert.equal(stored.details[0]._id, undefined, 'stored details must not gain ids');

    const graded = await Submission.findByIdAndUpdate(
      created._id,
      {
        status: 'completed',
        manualScore: 41,
        totalScore: 79,
        'details.1.lecturerScore': 41,
        'details.1.lecturerFeedback': 'Clear structure; expand the closing.',
      },
      { returnDocument: 'after', runValidators: true }
    ).lean();

    assert.equal(graded.status, 'completed');
    assert.equal(graded.manualScore, 41);
    assert.equal(graded.totalScore, 79);
    assert.equal(graded.details[1].lecturerScore, 41);
    assert.equal(graded.details[1].lecturerFeedback, 'Clear structure; expand the closing.');
  }
);
