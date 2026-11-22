const test = require('node:test');
const assert = require('node:assert/strict');

const Test = require('../server/src/models/Test');
const { getTestById, serializeTest } = require('../server/src/controllers/testController');

const TEST_ID = '507f1f77bcf86cd799439081';
const QUESTION_ID = '507f1f77bcf86cd799439082';
const DROPDOWN_QUESTION_ID = '507f1f77bcf86cd799439083';
const DROPDOWN_SET_ID = '507f1f77bcf86cd799439084';
const SHORT_FIELDS_QUESTION_ID = '507f1f77bcf86cd799439085';
const SENTENCE_ID = '507f1f77bcf86cd799439086';
const FIELD_ID = '507f1f77bcf86cd799439087';

const STORED_TEST = {
  _id: TEST_ID,
  title: 'Mock Exam 1',
  description: 'Full-length mock',
  type: 'mock',
  targetCefr: 'B2',
  skillModules: ['core', 'reading'],
  durationMinutes: 90,
  isPublished: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  __v: 0,
  questions: [
    {
      _id: QUESTION_ID,
      skill: 'core',
      part: 1,
      questionType: 'mcq_single',
      prompt: 'Choose the correct option.',
      options: ['am', 'is', 'are'],
      correctAnswer: 'is',
    },
    {
      _id: DROPDOWN_QUESTION_ID,
      skill: 'reading',
      part: 1,
      questionType: 'dropdown_cloze',
      prompt: 'Complete the notice.',
      contextPassage: 'The library closes at 6 p.m.',
      dropdownSets: [
        {
          _id: DROPDOWN_SET_ID,
          prompt: 'The library ___ at 6 p.m.',
          options: ['close', 'closes'],
          correctAnswer: 'closes',
        },
      ],
      correctAnswer: 'closes',
    },
    {
      _id: SHORT_FIELDS_QUESTION_ID,
      skill: 'writing',
      part: 1,
      questionType: 'short_fields',
      prompt: 'Complete the registration form.',
      sentences: [{ _id: SENTENCE_ID, order: 1, text: 'My name is Amina.', isFixed: false }],
      formFields: [{ _id: FIELD_ID, fieldId: 'name', label: 'Name', minWords: 1, maxWords: 3 }],
    },
  ],
};

function createResponse() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

/**
 * Replace `Test.findOne` with a chainable stub that records the filter and the
 * projection. Restore it in the caller's `finally` block.
 */
function stubFindOne(result) {
  const calls = { filter: null, projection: null, findOne: 0 };

  Test.findOne = (filter) => {
    calls.findOne += 1;
    calls.filter = filter;

    return {
      select(projection) {
        calls.projection = projection;
        return this;
      },
      sort() {
        return this;
      },
      async lean() {
        return result;
      },
    };
  };

  return calls;
}

async function withStub(result, run) {
  const originalFindOne = Test.findOne;
  const calls = stubFindOne(result);

  try {
    return await run(calls);
  } finally {
    Test.findOne = originalFindOne;
  }
}

test('getTestById rejects malformed ids before touching the database', async () => {
  await withStub(null, async (calls) => {
    for (const id of [
      'abc',
      'abcdefghijkl',
      '507f1f77bcf86cd79943901',
      '507f1f77bcf86cd7994390111',
    ]) {
      const response = createResponse();
      await getTestById({ params: { id } }, response);

      assert.equal(response.statusCode, 400, `${id} must be rejected`);
      assert.deepEqual(response.body, { error: 'Invalid identifier' });
    }

    assert.equal(calls.findOne, 0, 'invalid ids must never reach MongoDB');
  });
});

test('getTestById queries published tests only and answers 404 when none match', async () => {
  await withStub(null, async (calls) => {
    const response = createResponse();
    await getTestById({ params: { id: TEST_ID } }, response);

    assert.deepEqual(calls.filter, { _id: TEST_ID, isPublished: true });
    assert.match(String(calls.projection), /-questions\.correctAnswer/);
    assert.match(String(calls.projection), /-questions\.dropdownSets\.correctAnswer/);
    assert.equal(calls.findOne, 1, 'one id lookup must be enough');
    assert.equal(response.statusCode, 404);
    assert.deepEqual(response.body, { error: 'Test not found' });
  });
});

test('getTestById serves the projected test with a 200', async () => {
  await withStub(STORED_TEST, async () => {
    const response = createResponse();
    await getTestById({ params: { id: TEST_ID } }, response);

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.id, TEST_ID);
    assert.equal(response.body.type, 'mock');
    assert.equal(response.body.questionCount, 3);
    assert.equal(JSON.stringify(response.body).includes('correctAnswer'), false);
  });
});

test('serializeTest maps ids and never copies internal or answer fields', () => {
  const payload = serializeTest(STORED_TEST);

  assert.equal(payload.id, TEST_ID);
  assert.equal(payload.title, 'Mock Exam 1');
  assert.equal(payload.description, 'Full-length mock');
  assert.equal(payload.type, 'mock');
  assert.equal(payload.targetCefr, 'B2');
  assert.deepEqual(payload.skillModules, ['core', 'reading']);
  assert.equal(payload.durationMinutes, 90);
  assert.equal(payload.questionCount, 3);
  assert.equal(payload.questions.length, 3);

  assert.equal(payload.isPublished, undefined);
  assert.equal(payload.__v, undefined);
  assert.equal(payload.createdAt, undefined);
  assert.equal(payload.updatedAt, undefined);

  assert.equal(payload.questions[0].id, QUESTION_ID);
  assert.equal(payload.questions[0].correctAnswer, undefined);
  assert.deepEqual(payload.questions[0].options, ['am', 'is', 'are']);

  assert.equal(payload.questions[1].id, DROPDOWN_QUESTION_ID);
  assert.equal(payload.questions[1].contextPassage, 'The library closes at 6 p.m.');
  assert.equal(payload.questions[1].dropdownSets[0].id, DROPDOWN_SET_ID);
  assert.equal(payload.questions[1].dropdownSets[0].correctAnswer, undefined);
  assert.deepEqual(payload.questions[1].dropdownSets[0].options, ['close', 'closes']);

  assert.equal(payload.questions[2].sentences[0].id, SENTENCE_ID);
  assert.equal(payload.questions[2].formFields[0].fieldId, 'name');

  const serialized = JSON.stringify(payload);
  assert.equal(serialized.includes('correctAnswer'), false);
  assert.equal(serialized.includes('"_id"'), false);
  assert.equal(serialized.includes('"__v"'), false);
});

test('serializeTest defaults a missing description to null', () => {
  const payload = serializeTest({ ...STORED_TEST, description: undefined, questions: [] });

  assert.equal(payload.description, null);
  assert.equal(payload.questionCount, 0);
  assert.deepEqual(payload.questions, []);
  assert.equal(JSON.stringify(payload).includes('correctAnswer'), false);
});
