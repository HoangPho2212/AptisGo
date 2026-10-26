const jwt = require('jsonwebtoken');
const { JWT_ISSUER, JWT_AUDIENCE, MIN_SECRET_LENGTH } = require('../config/auth');

const EXPIRES_IN_PATTERN = /^\d+[smhd]$/;

/**
 * @param {{ secret?: string, expiresIn?: string | number }} overrides
 * @returns {{ secret: string, expiresIn: string | number }}
 */
function resolveOptions(overrides = {}) {
  const secret = overrides.secret ?? process.env.JWT_SECRET;

  if (typeof secret !== 'string' || secret.length < MIN_SECRET_LENGTH) {
    throw new Error(`JWT_SECRET must be at least ${MIN_SECRET_LENGTH} characters`);
  }

  const expiresIn = overrides.expiresIn ?? process.env.JWT_EXPIRES_IN ?? '1h';

  if (typeof expiresIn === 'string' && !EXPIRES_IN_PATTERN.test(expiresIn)) {
    throw new Error('JWT_EXPIRES_IN must look like 15m, 1h, or 7d');
  }

  if (typeof expiresIn !== 'string' && typeof expiresIn !== 'number') {
    throw new Error('expiresIn must be a string duration or a number of seconds');
  }

  return { secret, expiresIn };
}

/**
 * @param {{ _id?: unknown, id?: string, role?: string }} user
 * @param {{ secret?: string, expiresIn?: string | number }} [overrides]
 * @returns {string}
 */
function signAccessToken(user, overrides = {}) {
  const { secret, expiresIn } = resolveOptions(overrides);
  const subject = user.id ?? user._id;

  if (!subject) {
    throw new TypeError('user id is required to sign a token');
  }

  if (!user.role) {
    throw new TypeError('user role is required to sign a token');
  }

  return jwt.sign({ role: user.role }, secret, {
    algorithm: 'HS256',
    subject: String(subject),
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
    expiresIn,
  });
}

/**
 * @param {string} token
 * @param {{ secret?: string }} [overrides]
 * @returns {{ sub: string, role: string, iss: string, aud: string, iat: number, exp: number }}
 */
function verifyAccessToken(token, overrides = {}) {
  const { secret } = resolveOptions(overrides);

  return jwt.verify(token, secret, {
    algorithms: ['HS256'],
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  });
}

module.exports = { signAccessToken, verifyAccessToken };
