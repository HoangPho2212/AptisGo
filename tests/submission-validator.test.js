const test = require('node:test');
const assert = require('node:assert/strict');

const {
  validateSubmissionBody,
  validateAnswersForTest,
} = require('../server/src/validators/submissionValidator');

const TEST_ID = '507f1f77bcf86cd7994390b1';
const MCQ_ID = '507f1f77bcf86cd7994390b2';
const DROPDOWN_ID = '507f1f77bcf86cd7994390b3';
const SET_1 = '507f1f77bcf86cd7994390b4';
const SET_2 = '507f1f77bcf86cd7994390b5';
const ORDER_ID = '507f1f77bcf86cd7994390b6';
const SENTENCE_1 = '507f1f77bcf86cd7994390b7';
const SENTENCE_2 = '507f1f77bcf86cd7994390b8';
const FORM_ID = '507f1f77bcf86cd7994390b9';
const ESSAY_ID = '507f1f77bcf86cd7994390ba';
const AUDIO_ID = '507f1f77bcf86cd7994390bb';
const UNKNOWN_ID = '507f1f77bcf86cd7994390bc';

const TEST = {
  questions: [
    {
      _id: MCQ_ID,
      skill: 'core',
      part: 1,
      questionType: 'mcq_single',
      options: ['a', 'b', 'c'],
    },
    {
      _id: DROPDOWN_ID,
      skill: 'reading',
      part: 1,
      questionType: 'dropdown_cloze',
      dropdownSets: [
        { _id: SET_1, options: ['x', 'y'] },
        { _id: SET_2, options: ['m', 'n'] },
      ],
    },
    {
      _id: ORDER_ID,
      skill: 'reading',
      part: 2,
      questionType: 'sentence_order',
      sentences: [
        { _id: SENTENCE_1, order: 1 },
        { _id: SENTENCE_2, order: 2 },
      ],
    },
    {
      _id: FORM_ID,
      skill: 'writing',
      part: 1,
      questionType: 'short_fields',
      formFields: [
        { fieldId: 'name', label: 'Name' },
        { fieldId: 'city', label: 'City' },
      ],
    },
    { _id: ESSAY_ID, skill: 'writing', part: 2, questionType: 'essay_text' },
    { _id: AUDIO_ID, skill: 'speaking', part: 1, questionType: 'audio_record' },
  ],
};

const VALID_ANSWERS = [
  { questionId: MCQ_ID, submittedAnswer: 1 },
  { questionId: DROPDOWN_ID, submittedAnswer: { [SET_1]: 1, [SET_2]: 0 } },
  { questionId: ORDER_ID, submittedAnswer: [SENTENCE_2, SENTENCE_1] },
  { questionId: FORM_ID, submittedAnswer: { name: 'Amina', city: 'Cairo' } },
  { questionId: ESSAY_ID, submittedAnswer: 'A short essay.' },
  { questionId: AUDIO_ID, submittedAnswer: null, mediaUrl: '/audio/attempt.webm' },
];

function hasError(errors, needle) {
  return errors.some((error) => error.includes(needle));
}

function bodyErrors(body) {
  return validateSubmissionBody(body).errors;
}

function answerErrors(answers) {
  return validateAnswersForTest(TEST, answers).errors;
}

test('validateSubmissionBody accepts a valid test id and answer list', () => {
  const result = validateSubmissionBody({
    testId: TEST_ID,
    answers: [{ questionId: MCQ_ID, submittedAnswer: 1 }],
  });

  assert.deepEqual(result.errors, []);
  assert.equal(result.value.testId, TEST_ID);
  assert.equal(result.value.answers.length, 1);
});

test('validateSubmissionBody ignores client-owned fields', () => {
  const result = validateSubmissionBody({
    testId: TEST_ID,
    answers: [{ questionId: MCQ_ID, submittedAnswer: 1, isCorrect: true, autoScore: 50 }],
    student: UNKNOWN_ID,
    status: 'completed',
    autoScore: 200,
  });

  assert.deepEqual(result.errors, []);
  assert.equal(result.value.student, undefined);
  assert.equal(result.value.status, undefined);
  assert.equal(result.value.autoScore, undefined);
});

test('validateSubmissionBody rejects a missing or malformed testId', () => {
  for (const testId of [
    undefined,
    null,
    '',
    'abc',
    'abcdefghijkl',
    '507f1f77bcf86cd7994390b',
    '507f1f77bcf86cd7994390bbb',
    '507f1f77bcf86cd7994390bz',
  ]) {
    assert.ok(hasError(bodyErrors({ testId, answers: [] }), 'testId'), `${testId} must fail`);
  }
});

test('validateSubmissionBody rejects a missing, non-array, or empty answers list', () => {
  assert.ok(hasError(bodyErrors({ testId: TEST_ID }), 'answers'));
  assert.ok(hasError(bodyErrors({ testId: TEST_ID, answers: {} }), 'answers'));
  assert.ok(hasError(bodyErrors({ testId: TEST_ID, answers: '[]' }), 'answers'));
  assert.ok(hasError(bodyErrors({ testId: TEST_ID, answers: [] }), 'answers'));
  assert.ok(hasError(bodyErrors(undefined), 'request body'));
});

test('validateSubmissionBody rejects malformed answer items', () => {
  assert.ok(hasError(bodyErrors({ testId: TEST_ID, answers: [null] }), 'answers[0]'));
  assert.ok(hasError(bodyErrors({ testId: TEST_ID, answers: ['answer'] }), 'answers[0]'));
  assert.ok(hasError(bodyErrors({ testId: TEST_ID, answers: [{}] }), 'questionId'));
  assert.ok(
    hasError(bodyErrors({ testId: TEST_ID, answers: [{ questionId: 'abc' }] }), 'questionId')
  );
});

test('validateAnswersForTest accepts every supported shape and returns a Map', () => {
  const result = validateAnswersForTest(TEST, VALID_ANSWERS);

  assert.deepEqual(result.errors, []);
  assert.equal(result.value.size, 6);
  assert.deepEqual(result.value.get(MCQ_ID), { submittedAnswer: 1, mediaUrl: null });
  assert.deepEqual(result.value.get(AUDIO_ID), {
    submittedAnswer: null,
    mediaUrl: '/audio/attempt.webm',
  });
});

test('validateAnswersForTest rejects unknown and duplicate question ids', () => {
  assert.ok(
    hasError(answerErrors([{ questionId: UNKNOWN_ID, submittedAnswer: 1 }]), 'questionId'),
    'a question outside the test must be rejected'
  );
  assert.ok(
    hasError(
      answerErrors([
        { questionId: MCQ_ID, submittedAnswer: 1 },
        { questionId: MCQ_ID, submittedAnswer: 2 },
      ]),
      'duplicate'
    )
  );
});

test('validateAnswersForTest bounds MCQ answers to option indexes', () => {
  for (const submittedAnswer of [3, -1, 1.5, '1', true]) {
    assert.ok(
      hasError(answerErrors([{ questionId: MCQ_ID, submittedAnswer }]), 'submittedAnswer'),
      `${String(submittedAnswer)} must fail`
    );
  }

  assert.deepEqual(answerErrors([{ questionId: MCQ_ID, submittedAnswer: null }]), []);
});

test('validateAnswersForTest validates dropdown set ids and indexes', () => {
  assert.deepEqual(answerErrors([{ questionId: DROPDOWN_ID, submittedAnswer: {} }]), []);
  assert.deepEqual(answerErrors([{ questionId: DROPDOWN_ID, submittedAnswer: null }]), []);

  assert.ok(
    hasError(
      answerErrors([{ questionId: DROPDOWN_ID, submittedAnswer: { [SET_1]: 2 } }]),
      'submittedAnswer'
    )
  );
  assert.ok(
    hasError(
      answerErrors([{ questionId: DROPDOWN_ID, submittedAnswer: { unknown: 0 } }]),
      'submittedAnswer'
    )
  );
  assert.ok(
    hasError(
      answerErrors([{ questionId: DROPDOWN_ID, submittedAnswer: [0, 1] }]),
      'submittedAnswer'
    )
  );
});

test('validateAnswersForTest requires a complete, unique sentence order', () => {
  assert.deepEqual(answerErrors([{ questionId: ORDER_ID, submittedAnswer: null }]), []);

  for (const submittedAnswer of [
    [SENTENCE_1],
    [SENTENCE_1, UNKNOWN_ID],
    [SENTENCE_1, SENTENCE_1],
    'not-an-array',
  ]) {
    assert.ok(
      hasError(answerErrors([{ questionId: ORDER_ID, submittedAnswer }]), 'submittedAnswer'),
      `${JSON.stringify(submittedAnswer)} must fail`
    );
  }
});

test('validateAnswersForTest validates form field ids and string values', () => {
  assert.deepEqual(answerErrors([{ questionId: FORM_ID, submittedAnswer: { name: 'Amina' } }]), []);
  assert.deepEqual(answerErrors([{ questionId: FORM_ID, submittedAnswer: null }]), []);

  assert.ok(
    hasError(
      answerErrors([{ questionId: FORM_ID, submittedAnswer: { unknown: 'value' } }]),
      'submittedAnswer'
    )
  );
  assert.ok(
    hasError(
      answerErrors([{ questionId: FORM_ID, submittedAnswer: { name: 5 } }]),
      'submittedAnswer'
    )
  );
});

test('validateAnswersForTest caps essay text and rejects non-strings', () => {
  assert.deepEqual(answerErrors([{ questionId: ESSAY_ID, submittedAnswer: null }]), []);

  for (const submittedAnswer of ['x'.repeat(20001), 5, ['text']]) {
    assert.ok(
      hasError(answerErrors([{ questionId: ESSAY_ID, submittedAnswer }]), 'submittedAnswer'),
      'invalid essay answer must fail'
    );
  }
});

test('validateAnswersForTest keeps mediaUrl exclusive to audio questions', () => {
  assert.deepEqual(
    answerErrors([{ questionId: AUDIO_ID, submittedAnswer: null, mediaUrl: '/audio/a.webm' }]),
    []
  );
  assert.deepEqual(answerErrors([{ questionId: AUDIO_ID, submittedAnswer: null }]), []);

  assert.ok(
    hasError(
      answerErrors([{ questionId: AUDIO_ID, submittedAnswer: 'transcript' }]),
      'submittedAnswer'
    )
  );
  assert.ok(
    hasError(
      answerErrors([{ questionId: MCQ_ID, submittedAnswer: 1, mediaUrl: '/audio/a.webm' }]),
      'mediaUrl'
    )
  );
  assert.ok(
    hasError(
      answerErrors([{ questionId: AUDIO_ID, submittedAnswer: null, mediaUrl: 42 }]),
      'mediaUrl'
    )
  );
  assert.ok(
    hasError(
      answerErrors([
        { questionId: AUDIO_ID, submittedAnswer: null, mediaUrl: `/${'x'.repeat(2048)}` },
      ]),
      'mediaUrl'
    )
  );
});
