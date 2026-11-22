const { isObjectId } = require('./objectIdValidator');

const MAX_MEDIA_URL_LENGTH = 2048;
const MAX_ESSAY_LENGTH = 20000;
const MAX_FORM_VALUE_LENGTH = 500;

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isJsonObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Structural validation of the request body. Answer shapes need the stored test
 * and are checked by `validateAnswersForTest`.
 *
 * @param {unknown} body
 * @returns {{ value: { testId: string, answers: Array<object> }, errors: string[] }}
 */
function validateSubmissionBody(body) {
  if (!isJsonObject(body)) {
    return {
      value: { testId: '', answers: [] },
      errors: ['request body must be a JSON object'],
    };
  }

  const errors = [];
  const testId = body.testId;

  if (!isObjectId(testId)) {
    errors.push('testId must be a 24-character hexadecimal id');
  }

  const answers = body.answers;

  if (!Array.isArray(answers) || answers.length === 0) {
    errors.push('answers must be a non-empty array');
  } else {
    answers.forEach((entry, index) => {
      if (!isJsonObject(entry)) {
        errors.push(`answers[${index}] must be a JSON object`);
        return;
      }

      if (!isObjectId(entry.questionId)) {
        errors.push(`answers[${index}].questionId must be a 24-character hexadecimal id`);
      }

      if (
        entry.mediaUrl !== undefined &&
        entry.mediaUrl !== null &&
        (typeof entry.mediaUrl !== 'string' || entry.mediaUrl.length > MAX_MEDIA_URL_LENGTH)
      ) {
        errors.push(
          `answers[${index}].mediaUrl must be a string of at most ${MAX_MEDIA_URL_LENGTH} characters`
        );
      }
    });
  }

  if (errors.length > 0) {
    return { value: { testId: '', answers: [] }, errors };
  }

  return { value: { testId, answers }, errors };
}

/**
 * Validate one answer against its question type.
 *
 * @param {object} question
 * @param {unknown} submittedAnswer
 * @returns {{ value: unknown, error?: undefined } | { value?: undefined, error: string }}
 */
function validateAnswerForQuestion(question, submittedAnswer) {
  if (submittedAnswer === undefined || submittedAnswer === null) {
    return { value: null };
  }

  switch (question.questionType) {
    case 'mcq_single': {
      const optionCount = question.options?.length ?? 0;

      if (
        !Number.isInteger(submittedAnswer) ||
        submittedAnswer < 0 ||
        submittedAnswer >= optionCount
      ) {
        return { error: 'submittedAnswer must be a valid option index' };
      }

      return { value: submittedAnswer };
    }

    case 'dropdown_match':
    case 'dropdown_cloze': {
      if (!isJsonObject(submittedAnswer)) {
        return { error: 'submittedAnswer must be an object of dropdown set indexes' };
      }

      const sets = new Map((question.dropdownSets ?? []).map((set) => [String(set._id), set]));

      for (const [setId, optionIndex] of Object.entries(submittedAnswer)) {
        const set = sets.get(setId);

        if (!set) {
          return { error: 'submittedAnswer contains an unknown dropdown set' };
        }

        if (
          !Number.isInteger(optionIndex) ||
          optionIndex < 0 ||
          optionIndex >= (set.options?.length ?? 0)
        ) {
          return { error: 'submittedAnswer dropdown indexes must be valid option indexes' };
        }
      }

      return { value: submittedAnswer };
    }

    case 'sentence_order': {
      const sentences = question.sentences ?? [];

      if (!Array.isArray(submittedAnswer) || submittedAnswer.length !== sentences.length) {
        return { error: 'submittedAnswer must list every sentence exactly once' };
      }

      const knownIds = new Set(sentences.map((sentence) => String(sentence._id)));
      const seen = new Set();

      for (const id of submittedAnswer) {
        const key = String(id);

        if (!knownIds.has(key) || seen.has(key)) {
          return { error: 'submittedAnswer must list every sentence exactly once' };
        }

        seen.add(key);
      }

      return { value: submittedAnswer.map((id) => String(id)) };
    }

    case 'short_fields': {
      if (!isJsonObject(submittedAnswer)) {
        return { error: 'submittedAnswer must be an object of form fields' };
      }

      const fieldIds = new Set((question.formFields ?? []).map((field) => field.fieldId));

      for (const [fieldId, fieldValue] of Object.entries(submittedAnswer)) {
        if (!fieldIds.has(fieldId)) {
          return { error: 'submittedAnswer contains an unknown form field' };
        }

        if (typeof fieldValue !== 'string' || fieldValue.length > MAX_FORM_VALUE_LENGTH) {
          return {
            error: `submittedAnswer form values must be strings of at most ${MAX_FORM_VALUE_LENGTH} characters`,
          };
        }
      }

      return { value: submittedAnswer };
    }

    case 'essay_text': {
      if (typeof submittedAnswer !== 'string' || submittedAnswer.length > MAX_ESSAY_LENGTH) {
        return {
          error: `submittedAnswer must be a string of at most ${MAX_ESSAY_LENGTH} characters`,
        };
      }

      return { value: submittedAnswer };
    }

    case 'audio_record': {
      return { error: 'submittedAnswer must be null for audio_record questions' };
    }

    default:
      return { error: `questionType ${String(question.questionType)} is not supported` };
  }
}

/**
 * Validate answers against the loaded test and key them by question id.
 *
 * @param {object} test
 * @param {Array<object>} answers
 * @returns {{
 *   value: Map<string, { submittedAnswer: unknown, mediaUrl: string | null }>,
 *   errors: string[]
 * }}
 */
function validateAnswersForTest(test, answers) {
  const errors = [];
  const value = new Map();
  const questionsById = new Map(
    (test.questions ?? []).map((question) => [String(question._id), question])
  );
  const seen = new Set();

  answers.forEach((entry, index) => {
    if (!isJsonObject(entry)) {
      errors.push(`answers[${index}] must be a JSON object`);
      return;
    }

    const questionId = String(entry.questionId);
    const question = questionsById.get(questionId);

    if (!question) {
      errors.push(`answers[${index}].questionId is not part of this test`);
      return;
    }

    if (seen.has(questionId)) {
      errors.push(`answers[${index}].questionId is a duplicate`);
      return;
    }

    seen.add(questionId);

    if (
      entry.mediaUrl !== undefined &&
      entry.mediaUrl !== null &&
      (typeof entry.mediaUrl !== 'string' || entry.mediaUrl.length > MAX_MEDIA_URL_LENGTH)
    ) {
      errors.push(
        `answers[${index}].mediaUrl must be a string of at most ${MAX_MEDIA_URL_LENGTH} characters`
      );
      return;
    }

    const mediaUrl = typeof entry.mediaUrl === 'string' ? entry.mediaUrl.trim() || null : null;

    if (mediaUrl !== null && question.questionType !== 'audio_record') {
      errors.push(`answers[${index}].mediaUrl is only valid for audio_record questions`);
      return;
    }

    const result = validateAnswerForQuestion(question, entry.submittedAnswer);

    if (result.error) {
      errors.push(`answers[${index}].${result.error}`);
      return;
    }

    value.set(questionId, { submittedAnswer: result.value, mediaUrl });
  });

  if (errors.length > 0) {
    return { value: new Map(), errors };
  }

  return { value, errors };
}

module.exports = {
  MAX_ESSAY_LENGTH,
  MAX_FORM_VALUE_LENGTH,
  MAX_MEDIA_URL_LENGTH,
  validateAnswerForQuestion,
  validateAnswersForTest,
  validateSubmissionBody,
};
