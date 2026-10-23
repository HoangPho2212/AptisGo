const test = require('node:test');
const assert = require('node:assert/strict');
const { 
  validateQuestionSubDoc, 
  validateWritingWordCount, 
  calculateCefrProfile,
  validateSpeakingTimerConfig,
  validateListeningPlaysLimit
} = require('../contracts/JayContract');

test('Core Test & CEFR Borderline Modifier: should elevate borderline skill when Core >= 35', () => {
  // Candidate on borderline for Listening: 36/50 (threshold B1/B2)
  // Reading: 42/50 (B2)
  // Speaking: 38/50 (B2)
  // Writing: 40/50 (B2)
  // Core: 45/50 (Grammar: 22/25, Vocab: 23/25) -> High Core score triggers borderline elevation to B2
  const result = calculateCefrProfile({
    reading: 42,
    listening: 36,
    writing: 40,
    speaking: 38,
    core: 45
  });

  assert.equal(result.scaledTotal, 156); // 42 + 36 + 40 + 38 = 156 out of 200
  assert.equal(result.coreScore, 45); // Out of 50
  assert.equal(result.borderlineElevated, true);
  assert.equal(result.finalCefr, 'B2');
  assert.equal(result.skillCefr.listening, 'B2'); // Elevates from B1 to B2 due to Core modifier
});

test('Core Test & CEFR Borderline Modifier: should retain lower band if Core < 35', () => {
  const result = calculateCefrProfile({
    reading: 42,
    listening: 36,
    writing: 40,
    speaking: 38,
    core: 24 // Below 35 threshold
  });

  assert.equal(result.borderlineElevated, false);
  assert.equal(result.skillCefr.listening, 'B1'); // Stays B1
  assert.equal(result.finalCefr, 'B1');
});

test('Question Schema Contract: valid question types for all 5 official modules', () => {
  // Core Grammar
  assert.ok(validateQuestionSubDoc({
    skill: 'core',
    part: 1,
    questionType: 'mcq_single',
    prompt: 'Grammar multiple choice sentence completion'
  }).isValid);

  // Core Vocabulary
  assert.ok(validateQuestionSubDoc({
    skill: 'core',
    part: 2,
    questionType: 'dropdown_match',
    prompt: 'Synonym matching set'
  }).isValid);

  // Reading Part 1 & 2
  assert.ok(validateQuestionSubDoc({
    skill: 'reading',
    part: 1,
    questionType: 'dropdown_cloze',
    prompt: 'Informal email cloze'
  }).isValid);

  assert.ok(validateQuestionSubDoc({
    skill: 'reading',
    part: 2,
    questionType: 'sentence_order',
    prompt: 'Scrambled text cohesion'
  }).isValid);

  // Reading Parts 3 & 4
  assert.ok(validateQuestionSubDoc({
    skill: 'reading',
    part: 3,
    questionType: 'dropdown_match',
    prompt: 'Opinion matching 4 persons'
  }).isValid);

  assert.ok(validateQuestionSubDoc({
    skill: 'reading',
    part: 4,
    questionType: 'dropdown_match',
    prompt: 'Paragraph headings matching'
  }).isValid);

  // Writing Parts 1-4
  assert.ok(validateQuestionSubDoc({
    skill: 'writing',
    part: 1,
    questionType: 'short_fields',
    prompt: 'Club registration form fields'
  }).isValid);

  assert.ok(validateQuestionSubDoc({
    skill: 'writing',
    part: 4,
    questionType: 'essay_text',
    minWords: 120,
    maxWords: 150,
    prompt: 'Formal letter'
  }).isValid);

  // Speaking Part 4 with prep time
  assert.ok(validateQuestionSubDoc({
    skill: 'speaking',
    part: 4,
    questionType: 'audio_record',
    prepTimeSeconds: 60,
    recordTimeSeconds: 120,
    prompt: 'Abstract topic long turn'
  }).isValid);
});

test('Question Schema Contract: reject invalid skill or unsupported questionType', () => {
  // Deprecated 'grammar' without alias mapping
  const invalidSkill = validateQuestionSubDoc({
    skill: 'unsupported_skill',
    part: 1,
    questionType: 'mcq_single',
    prompt: 'Test'
  });
  assert.equal(invalidSkill.isValid, false);

  // Unsupported questionType
  const invalidType = validateQuestionSubDoc({
    skill: 'reading',
    part: 1,
    questionType: 'free_drawing',
    prompt: 'Test'
  });
  assert.equal(invalidType.isValid, false);
});

test('Writing Sub-task Validation: strict word count limits per official Aptis guidelines', () => {
  // Part 1: Form fields (1–5 words per field)
  assert.equal(validateWritingWordCount(1, 'Greenwich Environmental Club').status, 'in_range');
  assert.equal(validateWritingWordCount(1, 'This is a way too long answer for a single short form field').status, 'over_length');

  // Part 2: Short text (20–30 words)
  const part2Valid = 'I joined the environmental club because I want to protect local biodiversity and participate in weekly recycling activities with other passionate students.';
  assert.equal(validateWritingWordCount(2, part2Valid).status, 'in_range');
  assert.equal(validateWritingWordCount(2, 'Too short').status, 'under_length');

  // Part 3: Chat response (30–40 words)
  const part3Valid = 'I agree with your suggestion to organize tree planting this Saturday. We should gather at nine in the morning and bring our own reusable gardening gloves and watering cans for everyone to use.';
  assert.equal(validateWritingWordCount(3, part3Valid).status, 'in_range');

  // Part 4a: Informal email (~50 words, 40–60 words allowed)
  const part4aValid = 'Hi Sam, did you see the announcement about our club room moving to the third floor? I think it is very inconvenient because carrying equipment upstairs will be exhausting for everyone. What do you think we should do about this? Let me know soon, Nguyen.';
  assert.equal(validateWritingWordCount('4a', part4aValid).status, 'in_range');

  // Part 4b: Formal letter (120–150 words)
  const part4bValid = 'Dear Committee Members, I am writing on behalf of the Green Campus Initiative to register our vehement objection against the proposed transformation of Oakridge Community Park into a multi-story parking facility. The park serves as an essential ecological buffer and a communal recreational asset for local residents and university students. Replacing this green sanctuary with asphalt will exacerbate urban heat island effects, increase stormwater runoff, and displace valuable local biodiversity. Furthermore, children and senior citizens regularly utilize the tranquil garden for exercise and social gatherings. Alternatively, we strongly suggest implementing shared mobility corridors, expanding cycling infrastructure, and utilizing underground parking structures situated beneath existing commercial developments. This balanced approach preserves vital municipal greenery while sustainably resolving vehicular congestion in the surrounding university district. Thank you very much for your time, deliberation, and consideration of our community proposal. Yours sincerely, Nguyen Van Minh.';
  assert.equal(validateWritingWordCount('4b', part4bValid).status, 'in_range');
});

test('Speaking Timer Rules: Part 1 (30s), Parts 2-3 (45s), Part 4 (60s prep + 120s speak)', () => {
  assert.deepEqual(validateSpeakingTimerConfig(1), { prepTime: 0, recordTime: 30, canPause: false, canGoBack: false });
  assert.deepEqual(validateSpeakingTimerConfig(2), { prepTime: 0, recordTime: 45, canPause: false, canGoBack: false });
  assert.deepEqual(validateSpeakingTimerConfig(3), { prepTime: 0, recordTime: 45, canPause: false, canGoBack: false });
  assert.deepEqual(validateSpeakingTimerConfig(4), { prepTime: 60, recordTime: 120, canPause: false, canGoBack: false });
});

test('Listening Audio Constraint: max 2 plays per track', () => {
  assert.equal(validateListeningPlaysLimit(0), true);
  assert.equal(validateListeningPlaysLimit(1), true);
  assert.equal(validateListeningPlaysLimit(2), true);
  assert.equal(validateListeningPlaysLimit(3), false); // Rejected
});
