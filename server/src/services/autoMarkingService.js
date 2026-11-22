const AUTO_MARKED_SKILLS = Object.freeze(['core', 'reading', 'listening']);
const MANUAL_SKILLS = Object.freeze(['writing', 'speaking']);
const MANUAL_QUESTION_TYPES = Object.freeze(['short_fields', 'essay_text', 'audio_record']);
const SKILL_SCORE_MAX = 50;

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * A question is manual when its skill or its type is one the lecturer grades.
 *
 * @param {object} question
 * @returns {boolean}
 */
function isManualQuestion(question) {
  return (
    MANUAL_SKILLS.includes(question.skill) || MANUAL_QUESTION_TYPES.includes(question.questionType)
  );
}

/**
 * The stored key may be the option text or its index. Both are accepted for
 * reading; a key that is absent from `options` can never be matched.
 *
 * @param {unknown} options
 * @param {unknown} correctAnswer
 * @returns {number}
 */
function resolveCorrectIndex(options, correctAnswer) {
  const list = Array.isArray(options) ? options : [];

  if (Number.isInteger(correctAnswer)) {
    return correctAnswer >= 0 && correctAnswer < list.length ? correctAnswer : -1;
  }

  if (typeof correctAnswer === 'string') {
    return list.indexOf(correctAnswer);
  }

  return -1;
}

/**
 * Count the independently checkable marks in a question.
 *
 * @param {object} question
 * @returns {number}
 */
function countMarkableUnits(question) {
  if (isManualQuestion(question)) {
    return 0;
  }

  switch (question.questionType) {
    case 'mcq_single':
      return 1;
    case 'dropdown_match':
    case 'dropdown_cloze':
      return question.dropdownSets?.length ?? 0;
    case 'sentence_order':
      return (question.sentences?.length ?? 0) > 0 ? 1 : 0;
    default:
      return 0;
  }
}

/**
 * @param {object} question
 * @param {unknown} submittedAnswer
 * @returns {{ isCorrect: boolean | null, earnedUnits: number, totalUnits: number }}
 */
function markQuestion(question, submittedAnswer) {
  const totalUnits = countMarkableUnits(question);

  if (totalUnits === 0) {
    return { isCorrect: null, earnedUnits: 0, totalUnits: 0 };
  }

  let earnedUnits = 0;

  if (question.questionType === 'mcq_single') {
    const correctIndex = resolveCorrectIndex(question.options, question.correctAnswer);

    if (Number.isInteger(submittedAnswer) && submittedAnswer === correctIndex) {
      earnedUnits = 1;
    }
  } else if (
    question.questionType === 'dropdown_match' ||
    question.questionType === 'dropdown_cloze'
  ) {
    const selections = isPlainObject(submittedAnswer) ? submittedAnswer : {};

    for (const set of question.dropdownSets ?? []) {
      const selected = selections[String(set._id)];
      const correctIndex = resolveCorrectIndex(set.options, set.correctAnswer);

      if (Number.isInteger(selected) && selected === correctIndex) {
        earnedUnits += 1;
      }
    }
  } else if (question.questionType === 'sentence_order') {
    const expected = [...(question.sentences ?? [])]
      .sort((left, right) => left.order - right.order)
      .map((sentence) => String(sentence._id));

    const matches =
      Array.isArray(submittedAnswer) &&
      submittedAnswer.length === expected.length &&
      submittedAnswer.every((id, index) => String(id) === expected[index]);

    earnedUnits = matches ? 1 : 0;
  }

  return {
    isCorrect: earnedUnits === totalUnits,
    earnedUnits,
    totalUnits,
  };
}

/**
 * @param {unknown} text
 * @returns {number}
 */
function countWords(text) {
  if (typeof text !== 'string') {
    return 0;
  }

  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Word counts are computed server-side so the lecturer queue cannot be given a
 * claimed length.
 *
 * @param {object} question
 * @param {unknown} submittedAnswer
 * @returns {number}
 */
function wordCountFor(question, submittedAnswer) {
  if (question.questionType === 'essay_text') {
    return countWords(submittedAnswer);
  }

  if (question.questionType === 'short_fields' && isPlainObject(submittedAnswer)) {
    return Object.values(submittedAnswer).reduce((total, value) => total + countWords(value), 0);
  }

  return 0;
}

/**
 * Mark a submission deterministically from the stored test and validated
 * answers. The result never depends on answer order or client-supplied scores.
 *
 * @param {object} test
 * @param {Map<string, { submittedAnswer: unknown, mediaUrl: string | null }>} answersByQuestionId
 * @returns {{
 *   details: Array<object>,
 *   skillScores: { core: number, reading: number, listening: number, writing: null, speaking: null },
 *   autoScore: number,
 *   manualScore: null,
 *   totalScore: number | null,
 *   status: 'completed' | 'pending_review'
 * }}
 */
function markSubmission(test, answersByQuestionId) {
  const marks = {
    core: { earned: 0, total: 0 },
    reading: { earned: 0, total: 0 },
    listening: { earned: 0, total: 0 },
  };
  const details = [];
  let hasManualQuestion = false;

  for (const question of test.questions ?? []) {
    const entry = answersByQuestionId.get(String(question._id));
    const submittedAnswer = entry?.submittedAnswer ?? null;
    const manual = isManualQuestion(question);

    if (manual) {
      hasManualQuestion = true;
    }

    const { isCorrect, earnedUnits, totalUnits } = markQuestion(question, submittedAnswer);

    if (!manual && AUTO_MARKED_SKILLS.includes(question.skill)) {
      marks[question.skill].earned += earnedUnits;
      marks[question.skill].total += totalUnits;
    }

    details.push({
      questionId: String(question._id),
      skill: question.skill,
      part: question.part,
      questionType: question.questionType,
      submittedAnswer,
      mediaUrl: question.questionType === 'audio_record' ? (entry?.mediaUrl ?? null) : null,
      wordCount: wordCountFor(question, submittedAnswer),
      isCorrect,
      autoScore: earnedUnits,
      lecturerScore: null,
      lecturerFeedback: null,
    });
  }

  const skillScores = { core: 0, reading: 0, listening: 0, writing: null, speaking: null };

  for (const skill of AUTO_MARKED_SKILLS) {
    const { earned, total } = marks[skill];

    skillScores[skill] = total === 0 ? 0 : Math.round((earned / total) * SKILL_SCORE_MAX);
  }

  const autoScore = AUTO_MARKED_SKILLS.reduce((total, skill) => total + skillScores[skill], 0);
  const status = hasManualQuestion ? 'pending_review' : 'completed';
  const totalScore = status === 'completed' ? skillScores.reading + skillScores.listening : null;

  return {
    details,
    skillScores,
    autoScore,
    manualScore: null,
    totalScore,
    status,
  };
}

module.exports = {
  AUTO_MARKED_SKILLS,
  MANUAL_SKILLS,
  MANUAL_QUESTION_TYPES,
  SKILL_SCORE_MAX,
  countMarkableUnits,
  isManualQuestion,
  markQuestion,
  markSubmission,
};
