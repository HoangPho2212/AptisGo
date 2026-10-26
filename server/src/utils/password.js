const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 12;
const BCRYPT_HASH_PATTERN = /^\$2[aby]\$\d{2}\$/;

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isBcryptHash(value) {
  return typeof value === 'string' && BCRYPT_HASH_PATTERN.test(value);
}

/**
 * @param {string} plainPassword
 * @param {number} [saltRounds=12]
 * @returns {Promise<string>}
 */
async function hashPassword(plainPassword, saltRounds = SALT_ROUNDS) {
  if (typeof plainPassword !== 'string' || plainPassword.length === 0) {
    throw new TypeError('plainPassword must be a non-empty string');
  }

  return bcrypt.hash(plainPassword, saltRounds);
}

/**
 * @param {string} plainPassword
 * @param {string} passwordHash
 * @returns {Promise<boolean>} false when the stored value is not a bcrypt hash
 */
async function verifyPassword(plainPassword, passwordHash) {
  if (typeof plainPassword !== 'string' || !isBcryptHash(passwordHash)) {
    return false;
  }

  return bcrypt.compare(plainPassword, passwordHash);
}

module.exports = { SALT_ROUNDS, hashPassword, verifyPassword, isBcryptHash };
