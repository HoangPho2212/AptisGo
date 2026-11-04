const test = require('node:test');
const assert = require('node:assert/strict');

const {
  DIAGNOSTIC_SKILLS,
  MIN_SCORE,
  MAX_SCORE,
  DiagnosticEvaluationError,
  validateDiagnosticScores,
  evaluateDiagnosticScores,
} = require('../server/src/services/diagnosticEvaluationService');

function makeScores(overrides = {}) {
  return {
    core: 40,
    reading: 40,
    listening: 40,
    writing: 40,
    speaking: 40,
    ...overrides,
  };
}

function finalLevelFor(skill, score, core = 0) {
  return evaluateDiagnosticScores(
    makeScores({
      core,
      reading: 50,
      listening: 50,
      writing: 50,
      speaking: 50,
      [skill]: score,
    })
  ).finalCefr;
}

test('diagnostic evaluator: exports the documented score bounds and skills', () => {
  assert.deepEqual(DIAGNOSTIC_SKILLS, ['core', 'reading', 'listening', 'writing', 'speaking']);
  assert.equal(MIN_SCORE, 0);
  assert.equal(MAX_SCORE, 50);
});

test('diagnostic evaluator: maps each skill boundary to the expected CEFR', () => {
  assert.equal(finalLevelFor('reading', 0), 'A1');
  assert.equal(finalLevelFor('reading', 19), 'A1');
  assert.equal(finalLevelFor('reading', 20), 'A2');
  assert.equal(finalLevelFor('reading', 34), 'A2');
  assert.equal(finalLevelFor('reading', 35), 'B1');
  assert.equal(finalLevelFor('reading', 37), 'B1');
  assert.equal(finalLevelFor('reading', 38), 'B2');
  assert.equal(finalLevelFor('reading', 47), 'B2');
  assert.equal(finalLevelFor('reading', 48), 'C1');
  assert.equal(finalLevelFor('reading', 50), 'C1');
});

test('diagnostic evaluator: uses the lowest resolved skill as the overall level', () => {
  const result = evaluateDiagnosticScores(
    makeScores({
      core: 50,
      reading: 50,
      listening: 50,
      writing: 50,
      speaking: 30,
    })
  );

  assert.equal(result.skillCefr.reading, 'C1');
  assert.equal(result.skillCefr.speaking, 'A2');
  assert.equal(result.finalCefr, 'A2');
});

test('diagnostic evaluator: Core >= 35 elevates a borderline skill to B2', () => {
  const result = evaluateDiagnosticScores(
    makeScores({
      core: 35,
      reading: 40,
      listening: 36,
      writing: 40,
      speaking: 40,
    })
  );

  assert.equal(result.skillCefr.listening, 'B2');
  assert.equal(result.borderlineElevated, true);
  assert.equal(result.finalCefr, 'B2');
});

test('diagnostic evaluator: Core < 35 leaves a borderline skill at B1', () => {
  const result = evaluateDiagnosticScores(
    makeScores({
      core: 34,
      reading: 40,
      listening: 36,
      writing: 40,
      speaking: 40,
    })
  );

  assert.equal(result.skillCefr.listening, 'B1');
  assert.equal(result.borderlineElevated, false);
  assert.equal(result.finalCefr, 'B1');
});

test('diagnostic evaluator: scaledTotal excludes Core', () => {
  const result = evaluateDiagnosticScores(
    makeScores({
      core: 50,
      reading: 10,
      listening: 20,
      writing: 30,
      speaking: 40,
    })
  );

  assert.equal(result.scaledTotal, 100);
  assert.equal(result.coreScore, 50);
});

test('diagnostic evaluator: validates the scores object shape', () => {
  for (const invalid of [null, undefined, [], 'scores', 42]) {
    assert.throws(
      () => validateDiagnosticScores(invalid),
      (error) =>
        error instanceof DiagnosticEvaluationError &&
        error.statusCode === 400 &&
        error.message === 'scores must be an object'
    );
  }
});

test('diagnostic evaluator: requires every skill as a finite number', () => {
  const missing = makeScores();
  delete missing.speaking;

  assert.throws(
    () => validateDiagnosticScores(missing),
    (error) =>
      error instanceof DiagnosticEvaluationError &&
      error.statusCode === 400 &&
      error.message === 'scores.speaking must be a finite number'
  );

  for (const value of ['40', NaN, Infinity, -Infinity]) {
    assert.throws(
      () => validateDiagnosticScores(makeScores({ core: value })),
      (error) =>
        error instanceof DiagnosticEvaluationError &&
        error.statusCode === 400 &&
        error.message === 'scores.core must be a finite number'
    );
  }
});

test('diagnostic evaluator: rejects scores outside 0-50 without clamping', () => {
  for (const value of [-1, 51, 100]) {
    assert.throws(
      () => validateDiagnosticScores(makeScores({ listening: value })),
      (error) =>
        error instanceof DiagnosticEvaluationError &&
        error.statusCode === 400 &&
        error.message === 'scores.listening must be between 0 and 50'
    );
  }
});

test('diagnostic evaluator: returns the validated score object', () => {
  const input = makeScores({ core: 0, reading: 50, listening: 35, writing: 20, speaking: 48 });

  assert.deepEqual(validateDiagnosticScores(input), input);
});
