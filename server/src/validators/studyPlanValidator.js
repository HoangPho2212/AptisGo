const OBJECT_ID_PATTERN = /^[0-9a-fA-F]{24}$/;

/**
 * @param {unknown} body
 * @returns {body is Record<string, unknown>}
 */
function isJsonObject(body) {
  return typeof body === 'object' && body !== null && !Array.isArray(body);
}

/**
 * Validate the task completion request body. Progress recalculation belongs to
 * the controller because it needs the stored plan.
 *
 * @param {unknown} body
 * @returns {{ value: { isCompleted: boolean | null }, errors: string[] }}
 */
function validateTaskCompletionInput(body) {
  if (!isJsonObject(body)) {
    return {
      value: { isCompleted: null },
      errors: ['request body must be a JSON object'],
    };
  }

  const isCompleted = body.isCompleted === undefined ? null : body.isCompleted;
  const errors = [];

  if (typeof isCompleted !== 'boolean') {
    errors.push('isCompleted must be a boolean');

    return { value: { isCompleted: null }, errors };
  }

  return { value: { isCompleted }, errors };
}

/**
 * Accept only the 24-character hexadecimal text form of an ObjectId. Mongoose
 * `isValidObjectId` is intentionally not used because it also accepts
 * arbitrary 12-character strings.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
function isTaskId(value) {
  return typeof value === 'string' && OBJECT_ID_PATTERN.test(value);
}

module.exports = {
  OBJECT_ID_PATTERN,
  isTaskId,
  validateTaskCompletionInput,
};
