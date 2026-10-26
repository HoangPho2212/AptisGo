const test = require('node:test');
const assert = require('node:assert/strict');

const {
  SALT_ROUNDS,
  hashPassword,
  verifyPassword,
  isBcryptHash,
} = require('../server/src/utils/password');

test('Password: hashes with bcrypt cost 12 and verifies the original value', async () => {
  assert.equal(SALT_ROUNDS, 12);

  const hash = await hashPassword('Placement2026!');

  assert.match(hash, /^\$2[aby]\$12\$/);
  assert.notEqual(hash, 'Placement2026!');
  assert.equal(isBcryptHash(hash), true);
  assert.equal(await verifyPassword('Placement2026!', hash), true);
  assert.equal(await verifyPassword('wrong-password', hash), false);
});

test('Password: rejects empty or non-string input', async () => {
  await assert.rejects(hashPassword(''), TypeError);
  await assert.rejects(hashPassword(undefined), TypeError);
  await assert.rejects(hashPassword(12345678), TypeError);
});

test('Password: verification fails closed for missing or plaintext values', async () => {
  assert.equal(await verifyPassword('Placement2026!', undefined), false);
  assert.equal(await verifyPassword('Placement2026!', null), false);
  assert.equal(await verifyPassword('Placement2026!', 'Placement2026!'), false);
  assert.equal(isBcryptHash('Placement2026!'), false);
  assert.equal(isBcryptHash(null), false);
});
