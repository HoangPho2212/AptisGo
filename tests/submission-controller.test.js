const test = require('node:test');
const assert = require('node:assert/strict');

const Test = require('../server/src/models/Test');
const Submission = require('../server/src/models/Submission');
const { createSubmission } = require('../server/src/controllers/submissionController');

const STUDENT_ID = '507f1f77bcf86cd7994390c0';
const TEST_ID = '507f1f77bcf86cd7994390c1';
const MCQ_ID = '507f1f77bcf86cd7994390c2';
const ESSAY_ID = '507f1f77bcf86cd7994390c3';
const UNKNOWN_ID = '507f1f77bcf86cd7994390c4';
const SUBMISSION_ID = '507f1f77bcf86cd7994390c5';

const STORED_TEST = {
  _id: TEST_ID,
  title: 'Mock Exam 1',
  type: 'mock',
  questions: [
    {
      _id: MCQ_ID,
      skill: 'core',
      part: 1,
      questionType: 'mcq_single',
      prompt: 'Choose.',
      options: ['a', 'b', 'c'],
      correctAnswer: 'b',
    },
    {
      _id: ESSAY_ID,
      skill: 'writing',
      part: 2,
      questionType: 'essay_text',
      prompt: 'Write a notice.',
    },
  ],
};

const VALID_BODY = {
  testId: TEST_ID,
  answers: [
    { questionId: MCQ_ID, submittedAnswer: 1 },
    { questionId: ESSAY_ID, submittedAnswer: 'An essay about the library.' },
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

function stubFindOne(result) {
  const calls = { filter: null, projection: null, count: 0 };

  Test.findOne = (filter) => {
    calls.count += 1;
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

function stubCreate() {
  const calls = { payload: null, count: 0 };

  Submission.create = async (payload) => {
    calls.count += 1;
    calls.payload = payload;

    return {
      _id: SUBMISSION_ID,
      ...payload,
      createdAt: new Date('2026-11-22T13:45:00.000Z'),
    };
  };

  return calls;
}

function requestFor(body) {
  return { user: { id: STUDENT_ID, role: 'student' }, body };
}

async function withStubs(run) {
  const originalFindOne = Test.findOne;
  const originalCreate = Submission.create;

  try {
    return await run();
  } finally {
    Test.findOne = originalFindOne;
    Submission.create = originalCreate;
  }
}

test('createSubmission rejects an invalid body before reading the test', async () => {
  await withStubs(async () => {
    const findOneCalls = stubFindOne(STORED_TEST);

    const response = createResponse();
    await createSubmission(requestFor({ testId: 'abc', answers: [] }), response);

    assert.equal(response.statusCode, 400);
    assert.equal(response.body.error, 'Validation failed');
    assert.ok(Array.isArray(response.body.details));
    assert.equal(findOneCalls.count, 0, 'an invalid body must not reach MongoDB');
  });
});

test('createSubmission loads only published tests with grading projections', async () => {
  await withStubs(async () => {
    const findOneCalls = stubFindOne(null);

    const response = createResponse();
    await createSubmission(requestFor(VALID_BODY), response);

    assert.deepEqual(findOneCalls.filter, { _id: TEST_ID, isPublished: true });
    assert.equal(findOneCalls.count, 1, 'one test read must be enough');
    assert.match(String(findOneCalls.projection), /\+questions\.correctAnswer/);
    assert.match(String(findOneCalls.projection), /\+questions\.dropdownSets\.correctAnswer/);
    assert.equal(response.statusCode, 404);
    assert.deepEqual(response.body, { error: 'Test not found' });
  });
});

test('createSubmission rejects answers for questions outside the test', async () => {
  await withStubs(async () => {
    stubFindOne(STORED_TEST);
    const created = stubCreate();

    const response = createResponse();
    await createSubmission(
      requestFor({
        testId: TEST_ID,
        answers: [{ questionId: UNKNOWN_ID, submittedAnswer: 1 }],
      }),
      response
    );

    assert.equal(response.statusCode, 400);
    assert.equal(response.body.error, 'Validation failed');
    assert.equal(created.count, 0, 'a rejected answer must not create a submission');
  });
});

test('createSubmission persists the deterministic result and returns a summary', async () => {
  await withStubs(async () => {
    stubFindOne(STORED_TEST);
    const created = stubCreate();

    const response = createResponse();
    await createSubmission(requestFor(VALID_BODY), response);

    assert.equal(response.statusCode, 201);
    assert.equal(created.count, 1);

    const payload = created.payload;
    assert.equal(payload.student, STUDENT_ID);
    assert.equal(String(payload.test), TEST_ID);
    assert.equal(payload.status, 'pending_review');
    assert.equal(payload.autoScore, 50);
    assert.equal(payload.manualScore, null);
    assert.equal(payload.totalScore, null);
    assert.deepEqual(payload.skillScores, {
      core: 50,
      reading: 0,
      listening: 0,
      writing: null,
      speaking: null,
    });
    assert.equal(payload.details.length, 2);
    assert.equal(payload.details[0].isCorrect, true);
    assert.equal(payload.details[0].autoScore, 1);
    assert.equal(payload.details[1].isCorrect, null);

    assert.equal(response.body.id, SUBMISSION_ID);
    assert.deepEqual(response.body.test, { id: TEST_ID, title: 'Mock Exam 1', type: 'mock' });
    assert.equal(response.body.status, 'pending_review');
    assert.equal(response.body.autoScore, 50);
    assert.equal(response.body.manualScore, null);
    assert.equal(response.body.totalScore, null);
    assert.deepEqual(response.body.skillScores, payload.skillScores);
    assert.equal(response.body.questionCount, 2);
    assert.equal(response.body.answeredCount, 2);
    assert.equal(response.body.createdAt, '2026-11-22T13:45:00.000Z');
    assert.equal(JSON.stringify(response.body).includes('correctAnswer'), false);
  });
});
