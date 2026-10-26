const test = require('node:test');
const assert = require('node:assert/strict');

const { connectDatabase, disconnectDatabase } = require('../server/src/config/database');
const User = require('../server/src/models/User');

const testUri = process.env.MONGODB_TEST_URI;
const skipReason = testUri ? false : 'MONGODB_TEST_URI is not set';

test(
  'User integration: persists a bcrypt hash and enforces unique email',
  { skip: skipReason },
  async (t) => {
    const email = `integration-${Date.now()}@aptis-go.test`;

    await connectDatabase({ uri: testUri, options: { maxPoolSize: 2, minPoolSize: 0 } });
    await User.init();

    t.after(async () => {
      await User.deleteMany({ email });
      await disconnectDatabase();
    });

    const created = await User.create({
      name: 'Integration Student',
      email,
      password: 'Placement2026!',
      studentId: `T${Date.now().toString().slice(-8)}`,
    });

    const stored = await User.findById(created._id).select('+password');
    assert.match(stored.password, /^\$2[aby]\$12\$/);
    assert.equal(await stored.verifyPassword('Placement2026!'), true);
    assert.equal(stored.currentLevel, 'UNTESTED');

    await assert.rejects(
      User.create({ name: 'Duplicate', email, password: 'Placement2026!' }),
      (error) => error.code === 11000
    );
  }
);
