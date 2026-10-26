const test = require('node:test');
const assert = require('node:assert/strict');

const { assertAuthConfig, JWT_AUDIENCE, JWT_ISSUER } = require('../server/src/config/auth');
const { signAccessToken, verifyAccessToken } = require('../server/src/utils/jwt');

const SECRET = 'test-secret-with-at-least-32-characters!!';
const USER = { _id: '507f1f77bcf86cd799439011', role: 'student' };

test('Auth config: accepts a strong secret and defaults to one hour', () => {
  const config = assertAuthConfig({ JWT_SECRET: SECRET });

  assert.equal(config.secret, SECRET);
  assert.equal(config.expiresIn, '1h');
});

test('Auth config: rejects missing, short, or malformed settings', () => {
  assert.throws(() => assertAuthConfig({}), /JWT_SECRET must be at least 32 characters/);
  assert.throws(
    () => assertAuthConfig({ JWT_SECRET: 'too-short' }),
    /JWT_SECRET must be at least 32 characters/
  );
  assert.throws(
    () => assertAuthConfig({ JWT_SECRET: SECRET, JWT_EXPIRES_IN: 'forever' }),
    /JWT_EXPIRES_IN must look like 15m, 1h, or 7d/
  );
});

test('JWT: signs and verifies the documented claims', () => {
  const token = signAccessToken(USER, { secret: SECRET });
  const payload = verifyAccessToken(token, { secret: SECRET });

  assert.equal(payload.sub, USER._id);
  assert.equal(payload.role, 'student');
  assert.equal(payload.iss, JWT_ISSUER);
  assert.equal(payload.aud, JWT_AUDIENCE);
  assert.equal(payload.exp - payload.iat, 3600);
});

test('JWT: rejects tampered tokens and the wrong secret', () => {
  const token = signAccessToken(USER, { secret: SECRET });

  assert.throws(() => verifyAccessToken(`${token.slice(0, -2)}xx`, { secret: SECRET }));
  assert.throws(() =>
    verifyAccessToken(token, { secret: 'another-secret-with-32-characters-min!!' })
  );
});

test('JWT: rejects expired tokens', () => {
  const token = signAccessToken(USER, { secret: SECRET, expiresIn: -1 });

  assert.throws(
    () => verifyAccessToken(token, { secret: SECRET }),
    (error) => error.name === 'TokenExpiredError'
  );
});

test('JWT: refuses to sign without a strong secret', () => {
  assert.throws(() => signAccessToken(USER, { secret: '' }), /JWT_SECRET/);
  assert.throws(() => signAccessToken(USER, { secret: 'short' }), /JWT_SECRET/);
});
