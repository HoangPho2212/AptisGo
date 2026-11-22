const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');

const SECRET = 'test-detail-integration-secret-at-least-32';
process.env.JWT_SECRET = SECRET;

const { connectDatabase, disconnectDatabase } = require('../server/src/config/database');
const Test = require('../server/src/models/Test');
const app = require('../server/src/app');
const { signAccessToken } = require('../server/src/utils/jwt');

const testUri = process.env.MONGODB_TEST_URI;
const skipReason = testUri ? false : 'MONGODB_TEST_URI is not set';
const STUDENT_ID = '507f1f77bcf86cd7994390a1';

function createTest({ title, isPublished }) {
  return {
    title,
    description: 'Full-length mock',
    type: 'mock',
    targetCefr: 'B2',
    skillModules: ['core', 'reading'],
    durationMinutes: 90,
    isPublished,
    questions: [
      {
        skill: 'core',
        part: 1,
        questionType: 'mcq_single',
        prompt: 'Choose the correct option.',
        options: ['am', 'is', 'are'],
        correctAnswer: 'is',
      },
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
  };
}

test(
  'GET /api/tests/:id serves one published test with hidden answers',
  { skip: skipReason },
  async (t) => {
    const stamp = Date.now();
    const publishedTitle = `detail-published-${stamp}`;
    const unpublishedTitle = `detail-unpublished-${stamp}`;

    await connectDatabase({ uri: testUri, options: { maxPoolSize: 2, minPoolSize: 0 } });
    await Test.init();

    const published = await Test.create(createTest({ title: publishedTitle, isPublished: true }));
    const unpublished = await Test.create(
      createTest({ title: unpublishedTitle, isPublished: false })
    );

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
      await Test.deleteMany({ title: { $in: [publishedTitle, unpublishedTitle] } });
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
      await disconnectDatabase();
    });

    const request = (id) =>
      fetch(`${baseUrl}/api/tests/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

    const warmup = await request(published._id.toString());
    assert.equal(warmup.status, 200);
    findOneCalls = 0;

    const started = performance.now();
    const response = await request(published._id.toString());
    const elapsedMs = performance.now() - started;
    const body = await response.json();

    t.diagnostic(
      `test detail response ${elapsedMs.toFixed(1)}ms with ${findOneCalls} Test.findOne call(s)`
    );

    assert.equal(response.status, 200);
    assert.equal(findOneCalls, 1, 'the detail route must issue exactly one Test.findOne query');
    assert.ok(elapsedMs < 500, `test detail took ${elapsedMs.toFixed(1)}ms, expected <500ms`);

    assert.equal(body.id, published._id.toString());
    assert.equal(body.title, publishedTitle);
    assert.equal(body.description, 'Full-length mock');
    assert.equal(body.type, 'mock');
    assert.equal(body.targetCefr, 'B2');
    assert.deepEqual(body.skillModules, ['core', 'reading']);
    assert.equal(body.durationMinutes, 90);
    assert.equal(body.questionCount, 2);
    assert.equal(body.questions.length, 2);

    assert.equal(body.questions[0]._id, undefined);
    assert.equal(body.questions[0].correctAnswer, undefined);
    assert.equal(body.questions[0].prompt, 'Choose the correct option.');
    assert.deepEqual(body.questions[0].options, ['am', 'is', 'are']);

    assert.equal(body.questions[1].correctAnswer, undefined);
    assert.equal(body.questions[1].dropdownSets[0].correctAnswer, undefined);
    assert.deepEqual(body.questions[1].dropdownSets[0].options, ['close', 'closes']);
    assert.equal(JSON.stringify(body).includes('correctAnswer'), false);

    const unpublishedResponse = await request(unpublished._id.toString());
    assert.equal(unpublishedResponse.status, 404);
    assert.deepEqual(await unpublishedResponse.json(), { error: 'Test not found' });

    const unknownResponse = await request(new Test.base.Types.ObjectId().toString());
    assert.equal(unknownResponse.status, 404);
    assert.deepEqual(await unknownResponse.json(), { error: 'Test not found' });
  }
);
