const DEFAULT_DAILY_MINUTES = 45;
const MIN_DAILY_MINUTES = 15;
const MAX_DAILY_MINUTES = 240;
const TARGET_CERTIFICATES = Object.freeze(['B1', 'B2', 'C1']);

/**
 * @param {unknown} body
 * @returns {body is Record<string, unknown>}
 */
function isJsonObject(body) {
  return typeof body === 'object' && body !== null && !Array.isArray(body);
}

/**
 * Validate the goal request body. Future-date checks belong to the roadmap
 * service because they need the current clock.
 *
 * @param {unknown} body
 * @returns {{
 *   value: { targetCertificate: 'B1'|'B2'|'C1', deadline: string, dailyMinutesTarget: number },
 *   errors: string[]
 * }}
 */
function validateGoalInput(body) {
  if (!isJsonObject(body)) {
    return { value: {}, errors: ['request body must be a JSON object'] };
  }

  const errors = [];
  const targetCertificate = body.targetCertificate === undefined ? 'B2' : body.targetCertificate;
  const dailyMinutesTarget =
    body.dailyMinutesTarget === undefined ? DEFAULT_DAILY_MINUTES : body.dailyMinutesTarget;

  let deadline = '';

  if (body.deadline === undefined || body.deadline === null) {
    errors.push('deadline is required');
  } else if (typeof body.deadline !== 'string') {
    errors.push('deadline must be a valid ISO date');
  } else {
    deadline = body.deadline.trim();

    if (!deadline) {
      errors.push('deadline is required');
    }
  }

  if (!TARGET_CERTIFICATES.includes(targetCertificate)) {
    errors.push(`targetCertificate must be one of: ${TARGET_CERTIFICATES.join(', ')}`);
  }

  if (
    typeof dailyMinutesTarget !== 'number' ||
    !Number.isInteger(dailyMinutesTarget) ||
    dailyMinutesTarget < MIN_DAILY_MINUTES ||
    dailyMinutesTarget > MAX_DAILY_MINUTES
  ) {
    errors.push(
      `dailyMinutesTarget must be an integer between ${MIN_DAILY_MINUTES} and ${MAX_DAILY_MINUTES}`
    );
  }

  return {
    value: {
      targetCertificate,
      deadline,
      dailyMinutesTarget,
    },
    errors,
  };
}

module.exports = {
  DEFAULT_DAILY_MINUTES,
  MIN_DAILY_MINUTES,
  MAX_DAILY_MINUTES,
  TARGET_CERTIFICATES,
  validateGoalInput,
};
