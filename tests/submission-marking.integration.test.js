const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');

const SECRET = 'submission-marking-integration-secret-at-least-32';
process.env.JWT_SECRET = SECRET;

const { connectDatabase, disconnectDatabase } = require('../server/src/config/database');
const Test = require('../server/src/models/Test');
const Submission = require('../server/src/models/Submission');
const app = require('../server/src/app');
const { signAccessToken } = require('../server/src/utils/jwt');

const testUri = process.env.MONGODB_TEST_URI;
const skipReason = testUri ? false : 'MONGODB_TEST_URI is not set';
const STUDENT_ID = '507f1f77bcf86cd7994390e0';

function mixedQuestions() {
  return [
    {
      skill: 'core',
      part: 1,
      questionType: 'mcq_single',
      prompt: 'Choose the correct verb.',
      options: ['go', 'goes', 'going'],
      correctAnswer: 'goes',
    },
    {
      skill: 'core',
      part: 1,
      questionType: 'mcq_single',
      prompt: 'Choose the correct tense.',
      options: ['have', 'had', 'will have'],
      correctAnswer: 'had',
    },
    {
      skill: 'reading',
      part: 1,
      questionType: 'dropdown_cloze',
      prompt: 'Complete the notice.',
      dropdownSets: [
        {
          prompt: 'The library ___ at 6 p.m.',
          options: ['close', 'closes'],
          correctAnswer: 'closes',
        },
        {
          prompt: 'It is open ___ Saturdays.',
          options: ['at', 'on'],
          correctAnswer: 'on',
        },
      ],
    },
    {
      skill: 'listening',
      part: 1,
      questionType: 'mcq_single',
      prompt: 'Where does the conversation happen?',
      options: ['At a bank', 'At a pharmacy', 'At a train station'],
      correctAnswer: 'At a train station',
    },
    {
      skill: 'writing',
      part: 2,
      questionType: 'essay_text',
      prompt: 'Write a notice for the club.',
    },
    {
      skill: 'speaking',
      part: 1,
      questionType: 'audio_record',
      prompt: 'Introduce yourself.',
    },
  ];
}

function objectiveQuestions() {
  return [
    {
      skill: 'core',
      part: 1,
      questionType: 'mcq_single',
      prompt: 'Choose the correct verb.',
      options: ['am', 'is', 'are'],
      correctAnswer: 'is',
    },
    {
      skill: 'listening',
      part: 1,
      questionType: 'mcq_single',
      prompt: 'Choose the colour.',
      options: ['red', 'blue'],
      correctAnswer: 'blue',
    },
  ];
}

test(
  'POST /api/submissions marks receptive answers deterministically under 500 ms',
  { skip: skipReason },
  async (t) => {
    const stamp = Date.now();
    const mixedTitle = `marking-mixed-${stamp}`;
    const objectiveTitle = `marking-objective-${stamp}`;
    const unpublishedTitle = `marking-unpublished-${stamp}`;

    await connectDatabase({ uri: testUri, options: { maxPoolSize: 2, minPoolSize: 0 } });
    await Test.init();
    await Submission.init();

    const mixed = await Test.create({
      title: mixedTitle,
      type: 'mock',
      targetCefr: 'B2',
      skillModules: ['core', 'reading', 'listening', 'writing', 'speaking'],
      durationMinutes: 120,
      questions: mixedQuestions(),
    });
    const objective = await Test.create({
      title: objectiveTitle,
      type: 'practice',
      targetCefr: 'B2',
      skillModules: ['core', 'listening'],
      durationMinutes: 20,
      questions: objectiveQuestions(),
    });
    const unpublished = await Test.create({
      title: unpublishedTitle,
      type: 'mock',
      targetCefr: 'B2',
      skillModules: ['core'],
      durationMinutes: 20,
      isPublished: false,
      questions: objectiveQuestions(),
    });

    const [coreOne, coreTwo, dropdown, listening, essay, audio] = mixed.questions;
    const [setOne, setTwo] = dropdown.dropdownSets;
    const [objectiveCore, objectiveListening] = objective.questions;

    const mixedAnswers = [
      { questionId: coreOne._id.toString(), submittedAnswer: 1 },
      { questionId: coreTwo._id.toString(), submittedAnswer: 0 },
      {
        questionId: dropdown._id.toString(),
        submittedAnswer: {
          [setOne._id.toString()]: 1,
          [setTwo._id.toString()]: 0,
        },
      },
      { questionId: listening._id.toString(), submittedAnswer: 2 },
      {
        questionId: essay._id.toString(),
        submittedAnswer: 'Dear Sir, I am writing to apply for the summer course.',
      },
      {
        questionId: audio._id.toString(),
        submittedAnswer: null,
        mediaUrl: '/audio/attempt.webm',
      },
    ];

    const objectiveAnswers = [
      { questionId: objectiveCore._id.toString(), submittedAnswer: 0 },
      { questionId: objectiveListening._id.toString(), submittedAnswer: 1 },
    ];

    const server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const { port } = server.address();
    const baseUrl = `http://127.0.0.1:${port}`;
    const token = signAccessToken({ _id: STUDENT_ID, role: 'student' }, { secret: SECRET });

    const originalFindOne = Test.findOne;
    let findOneCalls = 0;
    Test.findOne = function countedFindOne(...args) {
      findOneCalls += 1;
      return originalFindOne.apply(this, args);
    };

    t.after(async () => {
      Test.findOne = originalFindOne;
      await Submission.deleteMany({ student: STUDENT_ID });
      await Test.deleteMany({
        title: { $in: [mixedTitle, objectiveTitle, unpublishedTitle] },
      });
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
      await disconnectDatabase();
    });

    const post = (testId, answers) =>
      fetch(`${baseUrl}/api/submissions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ testId, answers }),
      });

    const warmup = await post(mixed._id.toString(), mixedAnswers);
    assert.equal(warmup.status, 201);
    findOneCalls = 0;

    const started = performance.now();
    const response = await post(mixed._id.toString(), mixedAnswers);
    const elapsedMs = performance.now() - started;
    const body = await response.json();

    t.diagnostic(
      `submission marked in ${elapsedMs.toFixed(1)}ms with ${findOneCalls} Test.findOne call(s)`
    );

    assert.equal(response.status, 201);
    assert.equal(findOneCalls, 1, 'marking must issue exactly one Test.findOne query');
    assert.ok(elapsedMs < 500, `submission took ${elapsedMs.toFixed(1)}ms, expected <500ms`);

    assert.equal(body.test.id, mixed._id.toString());
    assert.equal(body.test.title, mixedTitle);
    assert.equal(body.test.type, 'mock');
    assert.equal(body.status, 'pending_review');
    assert.equal(body.autoScore, 100);
    assert.equal(body.manualScore, null);
    assert.equal(body.totalScore, null);
    assert.deepEqual(body.skillScores, {
      core: 25,
      reading: 25,
      listening: 50,
      writing: null,
      speaking: null,
    });
    assert.equal(body.questionCount, 6);
    assert.equal(body.answeredCount, 6);
    assert.equal(JSON.stringify(body).includes('correctAnswer'), false);

    const stored = await Submission.findById(body.id).lean();

    assert.equal(stored.student.toString(), STUDENT_ID);
    assert.equal(stored.test.toString(), mixed._id.toString());
    assert.equal(stored.status, 'pending_review');
    assert.equal(stored.autoScore, 100);
    assert.equal(stored.manualScore, null);
    assert.equal(stored.totalScore, null);
    assert.deepEqual(stored.skillScores, body.skillScores);
    assert.equal(stored.details.length, 6);

    assert.equal(stored.details[0].isCorrect, true);
    assert.equal(stored.details[0].autoScore, 1);
    assert.equal(stored.details[1].isCorrect, false);
    assert.equal(stored.details[1].autoScore, 0);
    assert.equal(stored.details[2].autoScore, 1);
    assert.equal(stored.details[2].isCorrect, false);
    assert.equal(stored.details[3].isCorrect, true);
    assert.equal(stored.details[4].isCorrect, null);
    assert.equal(stored.details[4].autoScore, 0);
    assert.equal(stored.details[4].wordCount, 11);
    assert.equal(stored.details[4].lecturerScore, null);
    assert.equal(stored.details[5].isCorrect, null);
    assert.equal(stored.details[5].mediaUrl, '/audio/attempt.webm');

    const repeat = await post(mixed._id.toString(), mixedAnswers);
    const repeatBody = await repeat.json();

    assert.equal(repeat.status, 201);
    assert.notEqual(repeatBody.id, body.id, 'a retake is a new attempt');
    assert.deepEqual(repeatBody.skillScores, body.skillScores);
    assert.equal(repeatBody.autoScore, body.autoScore);
    assert.equal(repeatBody.status, body.status);
    assert.equal(repeatBody.totalScore, body.totalScore);

    const objectiveResponse = await post(objective._id.toString(), objectiveAnswers);
    const objectiveBody = await objectiveResponse.json();

    assert.equal(objectiveResponse.status, 201);
    assert.equal(objectiveBody.status, 'completed');
    assert.deepEqual(objectiveBody.skillScores, {
      core: 0,
      reading: 0,
      listening: 50,
      writing: null,
      speaking: null,
    });
    assert.equal(objectiveBody.autoScore, 50);
    assert.equal(objectiveBody.manualScore, null);
    assert.equal(objectiveBody.totalScore, 50);

    const unpublishedResponse = await post(unpublished._id.toString(), objectiveAnswers);
    assert.equal(unpublishedResponse.status, 404);
    assert.deepEqual(await unpublishedResponse.json(), { error: 'Test not found' });

    const unknownResponse = await post(new Test.base.Types.ObjectId().toString(), objectiveAnswers);
    assert.equal(unknownResponse.status, 404);
    assert.deepEqual(await unknownResponse.json(), { error: 'Test not found' });
  }
);
