const test = require('node:test');
const assert = require('node:assert/strict');

const Submission = require('../server/src/models/Submission');
const QuestionSubDocSchema = require('../server/src/models/Question');

const { QUESTION_SKILLS, QUESTION_TYPES, QUESTION_PARTS } = QuestionSubDocSchema;

const STUDENT_ID = '507f1f77bcf86cd799439071';
const TEST_ID = '507f1f77bcf86cd799439072';
const QUESTION_ID = '507f1f77bcf86cd799439073';

const VALID_DETAIL = {
  questionId: QUESTION_ID,
  skill: 'core',
  part: 1,
  questionType: 'mcq_single',
  submittedAnswer: 'is',
  isCorrect: true,
  autoScore: 1,
};

const VALID_SUBMISSION = {
  student: STUDENT_ID,
  test: TEST_ID,
  details: [VALID_DETAIL],
};

async function errorsFor(overrides) {
  const submission = new Submission({ ...VALID_SUBMISSION, ...overrides });

  try {
    await submission.validate();
    return [];
  } catch (error) {
    return Object.keys(error.errors);
  }
}

function hasError(errors, field) {
  return errors.some(
    (key) => key === field || key.startsWith(`${field}.`) || key.endsWith(`.${field}`)
  );
}

test('Submission schema: references User and Test and enables timestamps', () => {
  assert.equal(Submission.schema.path('student').options.ref, 'User');
  assert.equal(Submission.schema.path('test').options.ref, 'Test');
  assert.ok(Submission.schema.path('createdAt'), 'timestamps must be enabled');
  assert.ok(Submission.schema.path('updatedAt'), 'timestamps must be enabled');
});

test('Submission schema: applies safe defaults without inventing grades', async () => {
  const submission = new Submission(VALID_SUBMISSION);

  await submission.validate();

  assert.equal(submission.status, 'completed');
  assert.equal(submission.autoScore, 0);
  assert.equal(submission.manualScore, null);
  assert.equal(submission.totalScore, null);
  assert.equal(submission.details.length, 1);
  assert.equal(submission.details[0]._id, undefined, 'details must not generate their own id');
});

test('Submission schema: stores per-skill scores with null manual skills', async () => {
  const submission = new Submission(VALID_SUBMISSION);

  await submission.validate();

  assert.equal(submission.skillScores.core, 0);
  assert.equal(submission.skillScores.reading, 0);
  assert.equal(submission.skillScores.listening, 0);
  assert.equal(submission.skillScores.writing, null);
  assert.equal(submission.skillScores.speaking, null);

  const scored = new Submission({
    ...VALID_SUBMISSION,
    skillScores: { core: 50, reading: 35, listening: 40 },
  });
  await scored.validate();

  assert.equal(scored.skillScores.core, 50);
  assert.equal(scored.skillScores.reading, 35);
  assert.equal(scored.skillScores.listening, 40);
  assert.equal(scored.skillScores.writing, null);
  assert.equal(scored.skillScores.speaking, null);

  assert.ok(
    (await errorsFor({ skillScores: { reading: 51 } })).includes('skillScores.reading'),
    'reading above 50 must fail'
  );
  assert.ok(
    (await errorsFor({ skillScores: { core: -1 } })).includes('skillScores.core'),
    'core below 0 must fail'
  );
  assert.ok(
    (await errorsFor({ skillScores: { writing: 51 } })).includes('skillScores.writing'),
    'writing is still bounded when graded'
  );
});

test('Submission schema: accepts every documented status and rejects unknown ones', async () => {
  for (const status of ['in_progress', 'pending_review', 'completed']) {
    assert.deepEqual(await errorsFor({ status }), []);
  }

  assert.ok(hasError(await errorsFor({ status: 'graded' }), 'status'));
});

test('Submission schema: requires the student and the test', async () => {
  assert.ok(hasError(await errorsFor({ student: undefined }), 'student'));
  assert.ok(hasError(await errorsFor({ test: undefined }), 'test'));
  assert.ok(hasError(await errorsFor({ student: 'not-an-id' }), 'student'));
  assert.ok(hasError(await errorsFor({ test: 'not-an-id' }), 'test'));
});

test('Submission schema: bounds every score and accepts null manual/total scores', async () => {
  assert.ok(hasError(await errorsFor({ autoScore: -1 }), 'autoScore'));
  assert.ok(hasError(await errorsFor({ autoScore: 201 }), 'autoScore'));
  assert.ok(hasError(await errorsFor({ manualScore: -1 }), 'manualScore'));
  assert.ok(hasError(await errorsFor({ manualScore: 101 }), 'manualScore'));
  assert.ok(hasError(await errorsFor({ totalScore: -1 }), 'totalScore'));
  assert.ok(hasError(await errorsFor({ totalScore: 201 }), 'totalScore'));

  assert.deepEqual(
    await errorsFor({ autoScore: 0, manualScore: 0, totalScore: 0 }),
    [],
    'a graded zero is a valid score'
  );
  assert.deepEqual(
    await errorsFor({ autoScore: 200, manualScore: 100, totalScore: 200 }),
    [],
    'upper bounds must be inclusive'
  );
  assert.deepEqual(
    await errorsFor({ autoScore: 38, manualScore: null, totalScore: null }),
    [],
    'ungraded subjective work keeps null scores'
  );
  assert.ok(hasError(await errorsFor({ autoScore: 'ten' }), 'autoScore'));
});

test('Submission schema: embeds details without extra ids', () => {
  const detailsPath = Submission.schema.path('details');

  assert.ok(detailsPath.schema, 'details must be an embedded document array');
  assert.equal(detailsPath.schema.options._id, false);
  assert.equal(detailsPath.schema.path('questionId').instance, 'ObjectId');
  assert.equal(detailsPath.schema.path('submittedAnswer').instance, 'Mixed');
});

test('Submission schema: applies detail defaults for ungraded subjective answers', async () => {
  const submission = new Submission({
    student: STUDENT_ID,
    test: TEST_ID,
    details: [
      {
        questionId: QUESTION_ID,
        skill: 'writing',
        part: 2,
        questionType: 'essay_text',
      },
    ],
  });

  await submission.validate();
  const detail = submission.details[0];

  assert.equal(detail.submittedAnswer, null);
  assert.equal(detail.mediaUrl, null);
  assert.equal(detail.wordCount, 0);
  assert.equal(detail.isCorrect, null);
  assert.equal(detail.autoScore, 0);
  assert.equal(detail.lecturerScore, null);
  assert.equal(detail.lecturerFeedback, null);
});

test('Submission schema: keeps structured answers intact', async () => {
  const dropdownAnswer = { s1: 0, s2: 1 };
  const orderedAnswer = ['The library opens at nine.', 'Students borrow books.'];
  const submission = new Submission({
    ...VALID_SUBMISSION,
    details: [
      { ...VALID_DETAIL, questionType: 'dropdown_cloze', submittedAnswer: dropdownAnswer },
      { ...VALID_DETAIL, questionType: 'sentence_order', submittedAnswer: orderedAnswer },
      {
        ...VALID_DETAIL,
        questionType: 'audio_record',
        submittedAnswer: null,
        mediaUrl: '/audio/a.webm',
      },
    ],
  });

  await submission.validate();

  assert.deepEqual(submission.details[0].submittedAnswer, dropdownAnswer);
  assert.deepEqual(submission.details[1].submittedAnswer, orderedAnswer);
  assert.equal(submission.details[2].submittedAnswer, null);
  assert.equal(submission.details[2].mediaUrl, '/audio/a.webm');
});

test('Submission schema: requires questionId and strict detail enums', async () => {
  const missingQuestion = { ...VALID_DETAIL };
  delete missingQuestion.questionId;

  assert.ok(hasError(await errorsFor({ details: [missingQuestion] }), 'questionId'));

  for (const skill of QUESTION_SKILLS) {
    assert.deepEqual(await errorsFor({ details: [{ ...VALID_DETAIL, skill }] }), []);
  }
  assert.ok(
    hasError(await errorsFor({ details: [{ ...VALID_DETAIL, skill: 'grammar' }] }), 'skill')
  );

  for (const part of QUESTION_PARTS) {
    assert.deepEqual(await errorsFor({ details: [{ ...VALID_DETAIL, part }] }), []);
  }
  assert.ok(hasError(await errorsFor({ details: [{ ...VALID_DETAIL, part: 5 }] }), 'part'));

  for (const questionType of QUESTION_TYPES) {
    assert.deepEqual(await errorsFor({ details: [{ ...VALID_DETAIL, questionType }] }), []);
  }
  assert.ok(
    hasError(
      await errorsFor({ details: [{ ...VALID_DETAIL, questionType: 'essay' }] }),
      'questionType'
    )
  );
});

test('Submission schema: validates per-item grading fields', async () => {
  assert.ok(
    hasError(await errorsFor({ details: [{ ...VALID_DETAIL, isCorrect: 'maybe' }] }), 'isCorrect')
  );

  assert.deepEqual(
    await errorsFor({
      details: [{ ...VALID_DETAIL, questionType: 'essay_text', isCorrect: null }],
    }),
    []
  );

  assert.ok(
    hasError(await errorsFor({ details: [{ ...VALID_DETAIL, wordCount: -1 }] }), 'wordCount')
  );
  assert.ok(
    hasError(await errorsFor({ details: [{ ...VALID_DETAIL, wordCount: 1.5 }] }), 'wordCount')
  );
  assert.ok(
    hasError(await errorsFor({ details: [{ ...VALID_DETAIL, autoScore: 51 }] }), 'autoScore')
  );
  assert.ok(
    hasError(
      await errorsFor({ details: [{ ...VALID_DETAIL, lecturerScore: 51 }] }),
      'lecturerScore'
    )
  );
  assert.ok(
    hasError(
      await errorsFor({ details: [{ ...VALID_DETAIL, lecturerFeedback: 'x'.repeat(2001) }] }),
      'lecturerFeedback'
    )
  );
  assert.deepEqual(
    await errorsFor({
      details: [
        { ...VALID_DETAIL, lecturerScore: 0, lecturerFeedback: 'Needs clearer structure.' },
      ],
    }),
    []
  );
});

test('Submission schema: indexes student history, the review queue, and the test', () => {
  const indexes = Submission.schema.indexes();

  const hasIndex = (fields) =>
    indexes.some(([entry]) =>
      Object.entries(fields).every(([key, direction]) => entry[key] === direction)
    );

  assert.ok(hasIndex({ student: 1, createdAt: -1 }), 'student history must be indexed');
  assert.ok(hasIndex({ status: 1, createdAt: 1 }), 'pending queue must be indexed FIFO');
  assert.ok(hasIndex({ test: 1 }), 'per-test reporting must be indexed');
});

test('Submission schema: exports its status and score Contracts', () => {
  assert.deepEqual(Submission.SUBMISSION_STATUSES, ['in_progress', 'pending_review', 'completed']);
  assert.deepEqual(Submission.SUBMISSION_SCORE_LIMITS.autoScore, { min: 0, max: 200 });
  assert.deepEqual(Submission.SUBMISSION_SCORE_LIMITS.manualScore, { min: 0, max: 100 });
  assert.deepEqual(Submission.SUBMISSION_SCORE_LIMITS.totalScore, { min: 0, max: 200 });
  assert.deepEqual(Submission.SUBMISSION_SCORE_LIMITS.itemAutoScore, { min: 0, max: 50 });
  assert.ok(Submission.SubmissionDetailSchema, 'the detail schema must be exported');
});
