const test = require('node:test');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');

const { connectDatabase, disconnectDatabase } = require('../server/src/config/database');
const User = require('../server/src/models/User');
const {
  DiagnosticEvaluationError,
  evaluateDiagnosticForUser,
} = require('../server/src/services/diagnosticEvaluationService');

const serverRequire = createRequire(require.resolve('../server/package.json'));
const mongoose = serverRequire('mongoose');

const testUri = process.env.MONGODB_TEST_URI;
const skipReason = testUri ? false : 'MONGODB_TEST_URI is not set';
const EMAIL_PREFIX = 'diagnostic-evaluation-';

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

test(
  'Diagnostic evaluation persists the CEFR baseline on User.currentLevel',
  { skip: skipReason },
  async (t) => {
    const email = `${EMAIL_PREFIX}${Date.now()}@aptis-go.test`;
    let user;

    await connectDatabase({ uri: testUri, options: { maxPoolSize: 2, minPoolSize: 0 } });

    t.after(async () => {
      if (user) {
        await User.deleteOne({ _id: user._id });
      }
      await disconnectDatabase();
    });

    user = await User.create({
      name: 'Diagnostic Student',
      email,
      password: 'Placement2026!',
    });

    assert.equal(user.currentLevel, 'UNTESTED');

    const b2 = await evaluateDiagnosticForUser(
      user._id,
      makeScores({ core: 45, reading: 42, listening: 36, writing: 40, speaking: 38 })
    );

    assert.equal(b2.evaluation.finalCefr, 'B2');
    assert.equal(b2.evaluation.borderlineElevated, true);
    assert.equal(b2.evaluation.skillCefr.listening, 'B2');
    assert.equal(b2.user.currentLevel, 'B2');
    assert.equal(b2.user.password, undefined);

    const persistedB2 = await User.findById(user._id);
    assert.equal(persistedB2.currentLevel, 'B2');

    const b1 = await evaluateDiagnosticForUser(
      user._id,
      makeScores({ core: 24, reading: 40, listening: 36, writing: 40, speaking: 40 })
    );

    assert.equal(b1.evaluation.finalCefr, 'B1');
    assert.equal(b1.evaluation.borderlineElevated, false);
    assert.equal(b1.evaluation.skillCefr.listening, 'B1');
    assert.equal(b1.user.currentLevel, 'B1');

    const persistedB1 = await User.findById(user._id);
    assert.equal(persistedB1.currentLevel, 'B1');

    await assert.rejects(
      () => evaluateDiagnosticForUser(user._id, makeScores({ core: 51 })),
      (error) =>
        error instanceof DiagnosticEvaluationError &&
        error.statusCode === 400 &&
        error.message === 'scores.core must be between 0 and 50'
    );

    const persistedAfterInvalid = await User.findById(user._id);
    assert.equal(persistedAfterInvalid.currentLevel, 'B1');

    await assert.rejects(
      () => evaluateDiagnosticForUser(new mongoose.Types.ObjectId(), makeScores()),
      (error) =>
        error instanceof DiagnosticEvaluationError &&
        error.statusCode === 404 &&
        error.message === 'User not found'
    );
  }
);
