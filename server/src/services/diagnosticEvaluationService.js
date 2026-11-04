const { calculateCefrProfile } = require('../../../contracts/JayContract');
const User = require('../models/User');

const DIAGNOSTIC_SKILLS = Object.freeze(['core', 'reading', 'listening', 'writing', 'speaking']);
const MIN_SCORE = 0;
const MAX_SCORE = 50;

class DiagnosticEvaluationError extends Error {
  /**
   * @param {string} message
   * @param {number} [statusCode]
   */
  constructor(message, statusCode = 400) {
    super(message);
    this.name = 'DiagnosticEvaluationError';
    this.statusCode = statusCode;
  }
}

/**
 * Validate a complete diagnostic score set. All five skills are required so a
 * missing skill cannot silently become zero and force an A1 result.
 *
 * @param {unknown} scores
 * @returns {{ core: number, reading: number, listening: number, writing: number, speaking: number }}
 * @throws {DiagnosticEvaluationError}
 */
function validateDiagnosticScores(scores) {
  if (scores === null || typeof scores !== 'object' || Array.isArray(scores)) {
    throw new DiagnosticEvaluationError('scores must be an object');
  }

  const validated = {};

  for (const skill of DIAGNOSTIC_SKILLS) {
    const value = scores[skill];

    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new DiagnosticEvaluationError(`scores.${skill} must be a finite number`);
    }

    if (value < MIN_SCORE || value > MAX_SCORE) {
      throw new DiagnosticEvaluationError(
        `scores.${skill} must be between ${MIN_SCORE} and ${MAX_SCORE}`
      );
    }

    validated[skill] = value;
  }

  return validated;
}

/**
 * Map validated raw scores to the official CEFR profile.
 *
 * @param {unknown} scores
 * @returns {{
 *   scaledTotal: number,
 *   coreScore: number,
 *   skillScores: { reading: number, listening: number, writing: number, speaking: number },
 *   skillCefr: { reading: string, listening: string, writing: string, speaking: string },
 *   borderlineElevated: boolean,
 *   finalCefr: 'A1' | 'A2' | 'B1' | 'B2' | 'C1'
 * }}
 */
function evaluateDiagnosticScores(scores) {
  return calculateCefrProfile(validateDiagnosticScores(scores));
}

/**
 * Evaluate a diagnostic and persist the resulting CEFR baseline.
 *
 * @param {string | import('mongoose').Types.ObjectId} userId
 * @param {unknown} scores
 * @returns {Promise<{ user: object, evaluation: object }>}
 */
async function evaluateDiagnosticForUser(userId, scores) {
  const evaluation = evaluateDiagnosticScores(scores);

  const user = await User.findByIdAndUpdate(
    userId,
    { $set: { currentLevel: evaluation.finalCefr } },
    { returnDocument: 'after', runValidators: true }
  );

  if (!user) {
    throw new DiagnosticEvaluationError('User not found', 404);
  }

  return {
    user: user.toJSON(),
    evaluation,
  };
}

module.exports = {
  DIAGNOSTIC_SKILLS,
  MIN_SCORE,
  MAX_SCORE,
  DiagnosticEvaluationError,
  validateDiagnosticScores,
  evaluateDiagnosticScores,
  evaluateDiagnosticForUser,
};
