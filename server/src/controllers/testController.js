const Test = require('../models/Test');
const { isObjectId } = require('../validators/objectIdValidator');

const PLACEMENT_NOT_FOUND = 'Placement test not found';
const TEST_NOT_FOUND = 'Test not found';
const INVALID_IDENTIFIER = 'Invalid identifier';

/**
 * Explicit answer-key exclusion. `correctAnswer` is already `select: false` in
 * the Question schema; this projection keeps the intent visible in the query
 * even if the schema ever changes.
 */
const TEST_DETAIL_PROJECTION = '-questions.correctAnswer -questions.dropdownSets.correctAnswer';

/**
 * @param {object} question
 * @returns {object}
 */
function serializeQuestion(question) {
  return {
    id: String(question._id),
    skill: question.skill,
    part: question.part,
    questionType: question.questionType,
    prompt: question.prompt,
    contextPassage: question.contextPassage ?? null,
    mediaUrl: question.mediaUrl ?? null,
    prepTimeSeconds: question.prepTimeSeconds ?? 0,
    recordTimeSeconds: question.recordTimeSeconds ?? 45,
    minWords: question.minWords ?? null,
    maxWords: question.maxWords ?? null,
    options: question.options ?? [],
    dropdownSets: (question.dropdownSets ?? []).map((dropdownSet) => ({
      id: String(dropdownSet._id),
      prompt: dropdownSet.prompt,
      options: dropdownSet.options ?? [],
    })),
    sentences: (question.sentences ?? []).map((sentence) => ({
      id: String(sentence._id),
      order: sentence.order,
      text: sentence.text,
      isFixed: sentence.isFixed,
    })),
    formFields: (question.formFields ?? []).map((field) => ({
      id: String(field._id),
      fieldId: field.fieldId,
      label: field.label,
      minWords: field.minWords,
      maxWords: field.maxWords,
    })),
  };
}

/**
 * @param {object} test
 * @returns {object}
 */
function serializePlacementTest(test) {
  const questions = (test.questions ?? []).map(serializeQuestion);

  return {
    id: String(test._id),
    title: test.title,
    description: test.description ?? null,
    targetCefr: test.targetCefr,
    skillModules: test.skillModules ?? [],
    durationMinutes: test.durationMinutes,
    questionCount: questions.length,
    questions,
  };
}

/**
 * Client contract for one test. Only allowlisted fields leave the server, so
 * answer keys, `__v`, timestamps, and `isPublished` cannot ride along.
 *
 * @param {object} test
 * @returns {object}
 */
function serializeTest(test) {
  const questions = (test.questions ?? []).map(serializeQuestion);

  return {
    id: String(test._id),
    title: test.title,
    description: test.description ?? null,
    type: test.type,
    targetCefr: test.targetCefr,
    skillModules: test.skillModules ?? [],
    durationMinutes: test.durationMinutes,
    questionCount: questions.length,
    questions,
  };
}

/**
 * @param {import('express').Request} _request
 * @param {import('express').Response} response
 * @returns {Promise<void>}
 */
async function getPlacementTest(_request, response) {
  const test = await Test.findOne({
    type: 'diagnostic',
    isPublished: true,
  })
    .sort({ createdAt: -1, _id: -1 })
    .lean();

  if (!test) {
    return response.status(404).json({ error: PLACEMENT_NOT_FOUND });
  }

  return response.status(200).json(serializePlacementTest(test));
}

/**
 * GET /api/tests/:id
 *
 * Serves one published test with its embedded questions. Answer keys are
 * excluded twice: by the query projection and by the allowlist serializer.
 *
 * @param {import('express').Request} request
 * @param {import('express').Response} response
 * @returns {Promise<void>}
 */
async function getTestById(request, response) {
  const testId = request.params.id;

  if (!isObjectId(testId)) {
    return response.status(400).json({ error: INVALID_IDENTIFIER });
  }

  const test = await Test.findOne({ _id: testId, isPublished: true })
    .select(TEST_DETAIL_PROJECTION)
    .lean();

  if (!test) {
    return response.status(404).json({ error: TEST_NOT_FOUND });
  }

  return response.status(200).json(serializeTest(test));
}

module.exports = {
  getPlacementTest,
  getTestById,
  serializePlacementTest,
  serializeQuestion,
  serializeTest,
};
