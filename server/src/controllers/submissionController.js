const Submission = require('../models/Submission');
const Test = require('../models/Test');
const {
  validateAnswersForTest,
  validateSubmissionBody,
} = require('../validators/submissionValidator');
const { markSubmission } = require('../services/autoMarkingService');

const TEST_NOT_FOUND = 'Test not found';
const VALIDATION_FAILED = 'Validation failed';
const ANSWER_KEY_PROJECTION = '+questions.correctAnswer +questions.dropdownSets.correctAnswer';

/**
 * @param {object} detail
 * @returns {boolean}
 */
function isAnswered(detail) {
  const value = detail.submittedAnswer;

  if (value === null || value === undefined) {
    return detail.mediaUrl !== null && detail.mediaUrl !== undefined;
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (typeof value === 'object') {
    return Object.keys(value).length > 0;
  }

  return true;
}

/**
 * @param {import('mongoose').Document} submission
 * @param {object} test
 * @returns {object}
 */
function serializeSubmission(submission, test) {
  const details = submission.details ?? [];

  return {
    id: String(submission._id),
    test: {
      id: String(test._id),
      title: test.title,
      type: test.type,
    },
    status: submission.status,
    autoScore: submission.autoScore,
    manualScore: submission.manualScore,
    totalScore: submission.totalScore,
    skillScores: {
      core: submission.skillScores.core,
      reading: submission.skillScores.reading,
      listening: submission.skillScores.listening,
      writing: submission.skillScores.writing,
      speaking: submission.skillScores.speaking,
    },
    questionCount: test.questions?.length ?? 0,
    answeredCount: details.filter(isAnswered).length,
    createdAt: new Date(submission.createdAt).toISOString(),
  };
}

/**
 * POST /api/submissions
 *
 * Marks Core, Reading, and Listening in one test read, persists the attempt,
 * and leaves Writing/Speaking for the lecturer queue.
 *
 * @param {import('express').Request} request
 * @param {import('express').Response} response
 * @returns {Promise<void>}
 */
async function createSubmission(request, response) {
  const body = validateSubmissionBody(request.body);

  if (body.errors.length > 0) {
    return response.status(400).json({ error: VALIDATION_FAILED, details: body.errors });
  }

  const test = await Test.findOne({ _id: body.value.testId, isPublished: true })
    .select(ANSWER_KEY_PROJECTION)
    .lean();

  if (!test) {
    return response.status(404).json({ error: TEST_NOT_FOUND });
  }

  const answers = validateAnswersForTest(test, body.value.answers);

  if (answers.errors.length > 0) {
    return response.status(400).json({ error: VALIDATION_FAILED, details: answers.errors });
  }

  const result = markSubmission(test, answers.value);

  const submission = await Submission.create({
    student: request.user.id,
    test: test._id,
    status: result.status,
    skillScores: result.skillScores,
    autoScore: result.autoScore,
    manualScore: result.manualScore,
    totalScore: result.totalScore,
    details: result.details,
  });

  return response.status(201).json(serializeSubmission(submission, test));
}

module.exports = {
  ANSWER_KEY_PROJECTION,
  createSubmission,
  serializeSubmission,
};
