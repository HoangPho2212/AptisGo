const test = require('node:test');
const assert = require('node:assert/strict');

const Test = require('../server/src/models/Test');

const VALID_QUESTION = {
  skill: 'core',
  part: 1,
  questionType: 'mcq_single',
  prompt: 'Choose the correct option.',
  options: ['am', 'is', 'are'],
  correctAnswer: 'is',
};

const VALID_TEST = {
  title: 'Diagnostic Test A',
  description: 'Core grammar and vocabulary diagnostic.',
  type: 'diagnostic',
  targetCefr: 'B1',
  skillModules: ['core'],
  durationMinutes: 25,
  questions: [VALID_QUESTION],
};

async function errorsFor(overrides) {
  const testDocument = new Test({ ...VALID_TEST, ...overrides });

  try {
    await testDocument.validate();
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

test('Test schema: embeds question sub-documents for data locality', () => {
  const questionsPath = Test.schema.path('questions');

  assert.ok(questionsPath, 'questions path must exist');
  assert.ok(questionsPath.schema, 'questions must be a document array with an embedded schema');
  assert.ok(questionsPath.schema.path('prompt'), 'the embedded question schema must own prompt');

  const dropdownSetsPath = questionsPath.schema.path('dropdownSets');
  assert.ok(dropdownSetsPath.schema, 'dropdownSets must be embedded sub-documents');
  assert.ok(dropdownSetsPath.schema.path('prompt'));
});

test('Test schema: applies safe defaults and timestamps', async () => {
  const testDocument = new Test({
    title: 'Practice Test A',
    type: 'practice',
    durationMinutes: 12,
  });

  await testDocument.validate();

  assert.equal(testDocument.targetCefr, 'B2');
  assert.equal(testDocument.isPublished, true);
  assert.deepEqual(testDocument.skillModules, []);
  assert.deepEqual(testDocument.questions, []);
  assert.ok(Test.schema.path('createdAt'), 'timestamps must be enabled');
  assert.ok(Test.schema.path('updatedAt'), 'timestamps must be enabled');
});

test('Test schema: title, type, and durationMinutes are required', async () => {
  assert.ok(hasError(await errorsFor({ title: undefined }), 'title'));
  assert.ok(hasError(await errorsFor({ type: undefined }), 'type'));
  assert.ok(hasError(await errorsFor({ durationMinutes: undefined }), 'durationMinutes'));
});

test('Test schema: type, targetCefr, and skillModules are strict enums', async () => {
  assert.ok(hasError(await errorsFor({ type: 'quiz' }), 'type'));
  assert.ok(hasError(await errorsFor({ targetCefr: 'A2' }), 'targetCefr'));
  assert.ok(hasError(await errorsFor({ skillModules: ['grammar'] }), 'skillModules'));
});

test('Question schema: skill, part, questionType, and prompt are required', async () => {
  for (const field of ['skill', 'part', 'questionType', 'prompt']) {
    const question = { ...VALID_QUESTION };
    delete question[field];
    const errors = await errorsFor({ questions: [question] });

    assert.ok(hasError(errors, field), `missing questions[].${field} must fail validation`);
  }
});

test('Question schema: skill, part, and questionType are strict enums', async () => {
  assert.ok(
    hasError(await errorsFor({ questions: [{ ...VALID_QUESTION, skill: 'grammar' }] }), 'skill')
  );
  assert.ok(hasError(await errorsFor({ questions: [{ ...VALID_QUESTION, part: 5 }] }), 'part'));
  assert.ok(
    hasError(
      await errorsFor({ questions: [{ ...VALID_QUESTION, questionType: 'essay' }] }),
      'questionType'
    )
  );
});

test('Question schema: applies defaults for optional UI and timing fields', async () => {
  const testDocument = new Test({
    ...VALID_TEST,
    questions: [
      {
        skill: 'writing',
        part: 2,
        questionType: 'essay_text',
        prompt: 'Write a short notice.',
      },
    ],
  });

  await testDocument.validate();
  const question = testDocument.questions[0];

  assert.equal(question.contextPassage, null);
  assert.equal(question.mediaUrl, null);
  assert.equal(question.prepTimeSeconds, 0);
  assert.equal(question.recordTimeSeconds, 45);
  assert.equal(question.minWords, null);
  assert.equal(question.maxWords, null);
  assert.deepEqual(question.options, []);
  assert.deepEqual(question.dropdownSets, []);
  assert.deepEqual(question.sentences, []);
  assert.deepEqual(question.formFields, []);
  assert.ok(question._id, 'embedded questions keep their own _id');
});

test('Question schema: validates nested dropdown, sentence, and form structures', async () => {
  const dropdownQuestion = {
    ...VALID_QUESTION,
    dropdownSets: [
      {
        prompt: 'The library ___ at 6 p.m.',
        options: ['close', 'closes'],
        correctAnswer: 'closes',
      },
    ],
  };
  assert.deepEqual(await errorsFor({ questions: [dropdownQuestion] }), []);
  assert.ok(
    hasError(
      await errorsFor({
        questions: [
          {
            ...VALID_QUESTION,
            dropdownSets: [{ prompt: 'Missing answer', options: ['a', 'b'] }],
          },
        ],
      }),
      'correctAnswer'
    )
  );

  const sentenceQuestion = {
    ...VALID_QUESTION,
    questionType: 'sentence_order',
    sentences: [{ order: 1, text: 'The first sentence.' }],
  };
  assert.deepEqual(await errorsFor({ questions: [sentenceQuestion] }), []);
  assert.ok(
    hasError(
      await errorsFor({
        questions: [
          {
            ...VALID_QUESTION,
            questionType: 'sentence_order',
            sentences: [{ text: 'Missing order.' }],
          },
        ],
      }),
      'order'
    )
  );

  const formQuestion = {
    ...VALID_QUESTION,
    questionType: 'short_fields',
    formFields: [{ fieldId: 'name', label: 'Name' }],
  };
  assert.deepEqual(await errorsFor({ questions: [formQuestion] }), []);
  assert.ok(
    hasError(
      await errorsFor({
        questions: [
          {
            ...VALID_QUESTION,
            questionType: 'short_fields',
            formFields: [{ fieldId: 'name' }],
          },
        ],
      }),
      'label'
    )
  );
});

test('Question schema: correctAnswer is hidden by default at both answer paths', () => {
  const questionSchema = Test.schema.path('questions').schema;
  const correctAnswerPath = questionSchema.path('correctAnswer');
  const dropdownAnswerPath = questionSchema.path('dropdownSets').schema.path('correctAnswer');

  assert.equal(correctAnswerPath.instance, 'Mixed');
  assert.equal(correctAnswerPath.options.select, false);
  assert.equal(dropdownAnswerPath.options.select, false);
});

test('Test schema: indexes the test type', () => {
  const indexes = Test.schema.indexes();

  assert.ok(
    indexes.some(([fields]) => fields.type === 1),
    'type must be indexed for diagnostic/mock/practice filtering'
  );
});
