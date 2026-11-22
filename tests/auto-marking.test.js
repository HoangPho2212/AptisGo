const test = require('node:test');
const assert = require('node:assert/strict');

const {
  countMarkableUnits,
  markQuestion,
  markSubmission,
} = require('../server/src/services/autoMarkingService');

const CORE_MCQ = {
  _id: 'q-core-1',
  skill: 'core',
  part: 1,
  questionType: 'mcq_single',
  prompt: 'Choose the correct option.',
  options: ['go', 'goes', 'going'],
  correctAnswer: 'goes',
};

const LISTENING_MCQ = {
  _id: 'q-listening-1',
  skill: 'listening',
  part: 1,
  questionType: 'mcq_single',
  prompt: 'Where does the conversation happen?',
  options: ['At a bank', 'At a pharmacy', 'At a train station'],
  correctAnswer: 'At a train station',
};

const DROPDOWN = {
  _id: 'q-drop-1',
  skill: 'reading',
  part: 1,
  questionType: 'dropdown_cloze',
  prompt: 'Complete the notice.',
  dropdownSets: [
    {
      _id: 'set-1',
      prompt: 'The library ___ at 6 p.m.',
      options: ['close', 'closes'],
      correctAnswer: 'closes',
    },
    {
      _id: 'set-2',
      prompt: 'It is open ___ Saturdays.',
      options: ['at', 'on'],
      correctAnswer: 'on',
    },
  ],
};

const ORDER = {
  _id: 'q-order-1',
  skill: 'reading',
  part: 2,
  questionType: 'sentence_order',
  prompt: 'Put the sentences in order.',
  sentences: [
    { _id: 's-1', order: 1, text: 'First.' },
    { _id: 's-2', order: 2, text: 'Second.' },
    { _id: 's-3', order: 3, text: 'Third.' },
  ],
};

const ESSAY = {
  _id: 'q-essay-1',
  skill: 'writing',
  part: 2,
  questionType: 'essay_text',
  prompt: 'Write a short notice.',
};

const FORM = {
  _id: 'q-form-1',
  skill: 'writing',
  part: 1,
  questionType: 'short_fields',
  prompt: 'Complete the form.',
  formFields: [
    { fieldId: 'name', label: 'Name' },
    { fieldId: 'city', label: 'City' },
  ],
};

const AUDIO = {
  _id: 'q-audio-1',
  skill: 'speaking',
  part: 1,
  questionType: 'audio_record',
  prompt: 'Introduce yourself.',
};

/**
 * @param {string} questionId
 * @param {unknown} submittedAnswer
 * @param {string|null} [mediaUrl]
 */
function answer(questionId, submittedAnswer, mediaUrl = null) {
  return { questionId, submittedAnswer, mediaUrl };
}

/**
 * @param {Array<{ questionId: string, submittedAnswer: unknown, mediaUrl: string|null }>} entries
 * @returns {Map<string, { submittedAnswer: unknown, mediaUrl: string|null }>}
 */
function answerMap(entries) {
  return new Map(entries.map((entry) => [String(entry.questionId), entry]));
}

function readingMcq(id) {
  return {
    _id: id,
    skill: 'reading',
    part: 1,
    questionType: 'mcq_single',
    prompt: 'Choose.',
    options: ['a', 'b'],
    correctAnswer: 'a',
  };
}

test('markQuestion counts one mark per MCQ and none for a manual answer', () => {
  assert.deepEqual(markQuestion(CORE_MCQ, 1), {
    isCorrect: true,
    earnedUnits: 1,
    totalUnits: 1,
  });
  assert.deepEqual(markQuestion(CORE_MCQ, 0), {
    isCorrect: false,
    earnedUnits: 0,
    totalUnits: 1,
  });
  assert.deepEqual(markQuestion(CORE_MCQ, null), {
    isCorrect: false,
    earnedUnits: 0,
    totalUnits: 1,
  });
  assert.deepEqual(markQuestion(ESSAY, 'An essay.'), {
    isCorrect: null,
    earnedUnits: 0,
    totalUnits: 0,
  });
  assert.deepEqual(markQuestion(AUDIO, null), {
    isCorrect: null,
    earnedUnits: 0,
    totalUnits: 0,
  });
});

test('markQuestion accepts text and numeric answer keys but only index answers', () => {
  assert.deepEqual(markQuestion({ ...CORE_MCQ, correctAnswer: 2 }, 2), {
    isCorrect: true,
    earnedUnits: 1,
    totalUnits: 1,
  });
  assert.deepEqual(markQuestion(CORE_MCQ, 'goes'), {
    isCorrect: false,
    earnedUnits: 0,
    totalUnits: 1,
  });
});

test('markQuestion counts one mark per dropdown set and gives partial credit', () => {
  const both = { 'set-1': 1, 'set-2': 1 };

  assert.deepEqual(markQuestion(DROPDOWN, both), {
    isCorrect: true,
    earnedUnits: 2,
    totalUnits: 2,
  });
  assert.deepEqual(markQuestion(DROPDOWN, { 'set-1': 1, 'set-2': 0 }), {
    isCorrect: false,
    earnedUnits: 1,
    totalUnits: 2,
  });
  assert.deepEqual(markQuestion(DROPDOWN, null), {
    isCorrect: false,
    earnedUnits: 0,
    totalUnits: 2,
  });
});

test('markQuestion grades sentence order as one all-or-nothing mark', () => {
  assert.deepEqual(markQuestion(ORDER, ['s-1', 's-2', 's-3']), {
    isCorrect: true,
    earnedUnits: 1,
    totalUnits: 1,
  });
  assert.deepEqual(markQuestion(ORDER, ['s-2', 's-1', 's-3']), {
    isCorrect: false,
    earnedUnits: 0,
    totalUnits: 1,
  });
  assert.deepEqual(markQuestion(ORDER, ['s-1', 's-2']), {
    isCorrect: false,
    earnedUnits: 0,
    totalUnits: 1,
  });
});

test('countMarkableUnits matches the mark table', () => {
  assert.equal(countMarkableUnits(CORE_MCQ), 1);
  assert.equal(countMarkableUnits(DROPDOWN), 2);
  assert.equal(countMarkableUnits(ORDER), 1);
  assert.equal(countMarkableUnits(ESSAY), 0);
  assert.equal(countMarkableUnits(AUDIO), 0);
  assert.equal(
    countMarkableUnits({ ...DROPDOWN, dropdownSets: [] }),
    0,
    'an empty dropdown has nothing to mark'
  );
});

test('markSubmission builds one detail per stored question, in order', () => {
  const result = markSubmission(
    { questions: [CORE_MCQ, ESSAY, AUDIO] },
    answerMap([answer('q-core-1', 1), answer('q-audio-1', null, '/audio/attempt.webm')])
  );

  assert.deepEqual(
    result.details.map((detail) => detail.questionId),
    ['q-core-1', 'q-essay-1', 'q-audio-1']
  );

  assert.equal(result.details[0].skill, 'core');
  assert.equal(result.details[0].part, 1);
  assert.equal(result.details[0].questionType, 'mcq_single');
  assert.equal(result.details[0].submittedAnswer, 1);
  assert.equal(result.details[0].mediaUrl, null);
  assert.equal(result.details[0].isCorrect, true);
  assert.equal(result.details[0].autoScore, 1);
  assert.equal(result.details[0].lecturerScore, null);
  assert.equal(result.details[0].lecturerFeedback, null);

  assert.equal(result.details[1].isCorrect, null);
  assert.equal(result.details[1].autoScore, 0);
  assert.equal(result.details[2].mediaUrl, '/audio/attempt.webm');
});

test('markSubmission computes word counts from the submitted text', () => {
  const essayText = 'Dear Sir, I am writing to apply for the summer course.';
  const result = markSubmission(
    { questions: [ESSAY, FORM] },
    answerMap([
      answer('q-essay-1', essayText),
      answer('q-form-1', { name: 'Amina Yusuf', city: 'Cairo' }),
    ])
  );

  assert.equal(result.details[0].wordCount, 11);
  assert.equal(result.details[1].wordCount, 3);
});

test('markSubmission scales each skill and includes unanswered questions', () => {
  const questions = [readingMcq('q-r-1'), readingMcq('q-r-2'), readingMcq('q-r-3')];

  const one = markSubmission({ questions }, answerMap([answer('q-r-1', 0)]));
  assert.equal(one.skillScores.reading, 17);

  const two = markSubmission({ questions }, answerMap([answer('q-r-1', 0), answer('q-r-2', 0)]));
  assert.equal(two.skillScores.reading, 33);

  const none = markSubmission({ questions }, answerMap([]));
  assert.equal(none.skillScores.reading, 0);
});

test('markSubmission sums auto-marked skills and excludes Core from totalScore', () => {
  const result = markSubmission(
    { questions: [CORE_MCQ, LISTENING_MCQ, DROPDOWN] },
    answerMap([
      answer('q-core-1', 1),
      answer('q-listening-1', 2),
      answer('q-drop-1', { 'set-1': 1, 'set-2': 0 }),
    ])
  );

  assert.deepEqual(result.skillScores, {
    core: 50,
    reading: 25,
    listening: 50,
    writing: null,
    speaking: null,
  });
  assert.equal(result.autoScore, 125);
  assert.equal(result.manualScore, null);
  assert.equal(result.totalScore, 75);
  assert.equal(result.status, 'completed');
});

test('markSubmission leaves manual tests pending with no total score', () => {
  const result = markSubmission(
    { questions: [CORE_MCQ, ESSAY] },
    answerMap([answer('q-core-1', 1)])
  );

  assert.equal(result.status, 'pending_review');
  assert.equal(result.autoScore, 50);
  assert.equal(result.manualScore, null);
  assert.equal(result.totalScore, null);
});

test('markSubmission gives a zero score to an auto skill absent from the test', () => {
  const result = markSubmission({ questions: [CORE_MCQ] }, answerMap([answer('q-core-1', 1)]));

  assert.deepEqual(result.skillScores, {
    core: 50,
    reading: 0,
    listening: 0,
    writing: null,
    speaking: null,
  });
  assert.equal(result.autoScore, 50);
  assert.equal(result.totalScore, 0, 'core is not part of the four-skill total');
});

test('markSubmission is deterministic regardless of answer order and claimed fields', () => {
  const questions = [CORE_MCQ, DROPDOWN, ORDER, ESSAY];
  const answers = [
    answer('q-core-1', 1),
    answer('q-drop-1', { 'set-1': 1, 'set-2': 0 }),
    answer('q-order-1', ['s-1', 's-2', 's-3']),
  ];

  const forward = markSubmission({ questions }, answerMap(answers));
  const reversed = markSubmission({ questions }, answerMap([...answers].reverse()));
  const claimed = markSubmission(
    { questions },
    answerMap(answers.map((entry) => ({ ...entry, isCorrect: true, autoScore: 50 })))
  );

  assert.deepEqual(reversed, forward);
  assert.deepEqual(claimed, forward);
  assert.deepEqual(markSubmission({ questions }, answerMap(answers)), forward);
});
