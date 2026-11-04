const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');

const SECRET = 'placement-integration-secret-at-least-32-chars';
process.env.JWT_SECRET = SECRET;

const { connectDatabase, disconnectDatabase } = require('../server/src/config/database');
const Test = require('../server/src/models/Test');
const app = require('../server/src/app');
const { signAccessToken } = require('../server/src/utils/jwt');

const testUri = process.env.MONGODB_TEST_URI;
const skipReason = testUri ? false : 'MONGODB_TEST_URI is not set';
const STUDENT_ID = '507f1f77bcf86cd799439031';

function makeQuestions(count) {
  return Array.from({ length: count }, (_, index) => {
    if (index === count - 1) {
      return {
        skill: 'reading',
        part: 1,
        questionType: 'dropdown_cloze',
        prompt: `Complete the notice ${index + 1}.`,
        contextPassage: 'The library closes at 6 p.m.',
        dropdownSets: [
          {
            prompt: 'The library ___ at 6 p.m.',
            options: ['close', 'closes'],
            correctAnswer: 'closes',
          },
        ],
        correctAnswer: 'closes',
      };
    }

    return {
      skill: 'core',
      part: 1,
      questionType: 'mcq_single',
      prompt: `Choose the correct option ${index + 1}.`,
      options: ['am', 'is', 'are'],
      correctAnswer: 'is',
    };
  });
}

test(
  'GET /api/tests/placement serves one diagnostic in a single fast query',
  { skip: skipReason },
  async (t) => {
    const title = `placement-${Date.now()}`;

    await connectDatabase({ uri: testUri, options: { maxPoolSize: 2, minPoolSize: 0 } });
    await Test.init();

    const created = await Test.create({
      title,
      description: 'Baseline CEFR placement',
      type: 'diagnostic',
      targetCefr: 'B2',
      skillModules: ['core', 'reading'],
      durationMinutes: 25,
      questions: makeQuestions(50),
    });

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
      await Test.deleteMany({ title });
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
      await disconnectDatabase();
    });

    const request = () =>
      fetch(`${baseUrl}/api/tests/placement`, {
        headers: { Authorization: `Bearer ${token}` },
      });

    // Warm the route and controller before measuring the NFR01 path.
    const warmup = await request();
    assert.equal(warmup.status, 200);
    findOneCalls = 0;

    const started = performance.now();
    const response = await request();
    const elapsedMs = performance.now() - started;
    const body = await response.json();

    t.diagnostic(
      `placement response ${elapsedMs.toFixed(1)}ms with ${findOneCalls} Test.findOne call(s)`
    );

    assert.equal(response.status, 200);
    assert.equal(findOneCalls, 1, 'placement must issue exactly one Test.findOne query');
    assert.ok(elapsedMs < 500, `placement took ${elapsedMs.toFixed(1)}ms, expected <500ms`);

    assert.equal(body.id, created._id.toString());
    assert.equal(body.title, title);
    assert.equal(body.description, 'Baseline CEFR placement');
    assert.equal(body.targetCefr, 'B2');
    assert.deepEqual(body.skillModules, ['core', 'reading']);
    assert.equal(body.durationMinutes, 25);
    assert.equal(body.questionCount, 50);
    assert.equal(body.questions.length, 50);

    assert.equal(body.questions[0]._id, undefined);
    assert.equal(body.questions[0].correctAnswer, undefined);
    assert.equal(body.questions[0].prompt, 'Choose the correct option 1.');
    assert.deepEqual(body.questions[0].options, ['am', 'is', 'are']);

    assert.equal(body.questions[49].skill, 'reading');
    assert.equal(body.questions[49].correctAnswer, undefined);
    assert.equal(body.questions[49].dropdownSets[0].correctAnswer, undefined);
    assert.deepEqual(body.questions[49].dropdownSets[0].options, ['close', 'closes']);
  }
);
