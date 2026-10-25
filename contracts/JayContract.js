/**
 * JayContract - Domain & Validation Engine for Official British Council Aptis Specification
 * Follows Jay Framework Architecture for APTIS GO
 */

const SKILLS = ['core', 'listening', 'reading', 'writing', 'speaking'];
const QUESTION_TYPES = [
  'mcq_single', // Core Grammar, Listening Parts 1 & 4
  'dropdown_match', // Core Vocab, Listening Parts 2 & 3, Reading Parts 3 & 4
  'dropdown_cloze', // Reading Part 1 (short gap-fill)
  'sentence_order', // Reading Part 2 (sentence ordering / cohesion)
  'short_fields', // Writing Part 1 (5 registration fields)
  'essay_text', // Writing Parts 2, 3, 4a, 4b
  'audio_record', // Speaking Parts 1-4
];

/**
 * Validates a Question sub-document
 * @param {Object} doc - The question sub-document
 * @returns {{ isValid: boolean, error?: string }}
 */
function validateQuestionSubDoc(doc) {
  if (!doc) return { isValid: false, error: 'Document is undefined' };

  // Normalize legacy skill 'grammar' to 'core'
  const skill = doc.skill === 'grammar' ? 'core' : doc.skill;
  if (!SKILLS.includes(skill)) {
    return {
      isValid: false,
      error: `Invalid skill '${doc.skill}'. Must be one of: ${SKILLS.join(', ')}`,
    };
  }

  if (!QUESTION_TYPES.includes(doc.questionType)) {
    return {
      isValid: false,
      error: `Invalid questionType '${doc.questionType}'. Must be one of: ${QUESTION_TYPES.join(', ')}`,
    };
  }

  if (!doc.part || doc.part < 1 || doc.part > 4) {
    return { isValid: false, error: 'Part must be between 1 and 4' };
  }

  if (!doc.prompt || typeof doc.prompt !== 'string') {
    return { isValid: false, error: 'Prompt is required' };
  }

  // Speaking-specific constraints
  if (skill === 'speaking' && doc.questionType === 'audio_record') {
    if (doc.part === 4 && doc.prepTimeSeconds !== 60) {
      return { isValid: false, error: 'Speaking Part 4 must have prepTimeSeconds = 60' };
    }
  }

  return { isValid: true };
}

/**
 * Validates writing word count against official Aptis limits
 * @param {number|string} part - 1, 2, 3, '4a', '4b'
 * @param {string} text - Candidate response text
 * @returns {{ count: number, min: number, max: number, status: 'under_length'|'in_range'|'over_length' }}
 */
function validateWritingWordCount(part, text = '') {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const count = words.length;

  let min = 1;
  let max = 5;

  if (part === 1 || part === '1') {
    min = 1;
    max = 5;
  } else if (part === 2 || part === '2') {
    min = 20;
    max = 30;
  } else if (part === 3 || part === '3') {
    min = 30;
    max = 40;
  } else if (part === '4a') {
    min = 40;
    max = 60; // target ~50w
  } else if (part === '4b' || part === 4 || part === '4') {
    min = 120;
    max = 150;
  }

  let status = 'in_range';
  if (count < min) {
    status = 'under_length';
  } else if (count > max) {
    status = 'over_length';
  }

  return { count, min, max, status };
}

/**
 * Official Aptis CEFR Scaling & Borderline Modifier Calculation
 * Each skill is 0-50 pts (Total 200 pts).
 * Core (0-50) serves as a borderline CEFR modifier.
 * @param {{ reading: number, listening: number, writing: number, speaking: number, core: number }} scores
 * @returns {Object} CEFR assessment profile
 */
function calculateCefrProfile(scores) {
  const { reading = 0, listening = 0, writing = 0, speaking = 0, core = 0 } = scores;
  const scaledTotal = reading + listening + writing + speaking; // 0 to 200

  // Skill-level standard threshold mappings:
  // 0 - 19: A1
  // 20 - 34: A2
  // 35 - 37: B1/B2 Borderline
  // 38 - 47: B2
  // 48 - 50: C1
  const mapSkillToCefr = (score) => {
    if (score >= 48) return { cefr: 'C1', isBorderline: false };
    if (score >= 38) return { cefr: 'B2', isBorderline: false };
    if (score >= 35 && score <= 37) return { cefr: 'B1', isBorderline: true, targetBump: 'B2' };
    if (score >= 20) return { cefr: 'A2', isBorderline: false };
    return { cefr: 'A1', isBorderline: false };
  };

  const skillCefr = {
    reading: mapSkillToCefr(reading),
    listening: mapSkillToCefr(listening),
    writing: mapSkillToCefr(writing),
    speaking: mapSkillToCefr(speaking),
  };

  let borderlineElevated = false;
  const coreEligibleForBump = core >= 35; // British Council rule: high Core score (>=35/50) elevates borderline skills

  const resolvedSkillCefr = {};
  for (const [skill, meta] of Object.entries(skillCefr)) {
    if (meta.isBorderline && coreEligibleForBump) {
      resolvedSkillCefr[skill] = meta.targetBump;
      borderlineElevated = true;
    } else {
      resolvedSkillCefr[skill] = meta.cefr;
    }
  }

  // Overall CEFR profile:
  // If any skill is below B2, overall certified qualification remains at that lower level (e.g., B1),
  // unless elevated by the Core modifier.
  const cefrLevels = ['A1', 'A2', 'B1', 'B2', 'C1'];
  const minSkillCefr = Object.values(resolvedSkillCefr).reduce((min, curr) => {
    return cefrLevels.indexOf(curr) < cefrLevels.indexOf(min) ? curr : min;
  }, 'C1');

  const finalCefr = minSkillCefr;

  return {
    scaledTotal,
    coreScore: core,
    skillScores: { reading, listening, writing, speaking },
    skillCefr: resolvedSkillCefr,
    borderlineElevated,
    finalCefr,
  };
}

/**
 * Returns speaking timer configuration per official Aptis guidelines
 * Candidates cannot freely navigate back and forth or pause recordings.
 * @param {number} part - 1, 2, 3, or 4
 */
function validateSpeakingTimerConfig(part) {
  switch (part) {
    case 1:
      return { prepTime: 0, recordTime: 30, canPause: false, canGoBack: false };
    case 2:
    case 3:
      return { prepTime: 0, recordTime: 45, canPause: false, canGoBack: false };
    case 4:
      return { prepTime: 60, recordTime: 120, canPause: false, canGoBack: false };
    default:
      throw new Error(`Invalid speaking part: ${part}`);
  }
}

/**
 * Listening plays limiter (maximum 2 audio plays)
 * @param {number} currentPlaysCount
 * @returns {boolean} Whether playback is allowed
 */
function validateListeningPlaysLimit(currentPlaysCount) {
  return currentPlaysCount < 2 || currentPlaysCount === 2;
}

module.exports = {
  SKILLS,
  QUESTION_TYPES,
  validateQuestionSubDoc,
  validateWritingWordCount,
  calculateCefrProfile,
  validateSpeakingTimerConfig,
  validateListeningPlaysLimit,
};
