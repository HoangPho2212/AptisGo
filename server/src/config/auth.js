const JWT_ISSUER = 'aptis-go-api';
const JWT_AUDIENCE = 'aptis-go-client';
const MIN_SECRET_LENGTH = 32;
const EXPIRES_IN_PATTERN = /^\d+[smhd]$/;

/**
 * Validate the JWT configuration at startup so the API cannot boot with an
 * unusable signing secret.
 *
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {{ secret: string, expiresIn: string }}
 */
function assertAuthConfig(env = process.env) {
  const secret = env.JWT_SECRET ?? '';

  if (typeof secret !== 'string' || secret.length < MIN_SECRET_LENGTH) {
    throw new Error(`JWT_SECRET must be at least ${MIN_SECRET_LENGTH} characters`);
  }

  const expiresIn = env.JWT_EXPIRES_IN ?? '1h';

  if (typeof expiresIn !== 'string' || !EXPIRES_IN_PATTERN.test(expiresIn)) {
    throw new Error('JWT_EXPIRES_IN must look like 15m, 1h, or 7d');
  }

  return { secret, expiresIn };
}

module.exports = { JWT_ISSUER, JWT_AUDIENCE, MIN_SECRET_LENGTH, assertAuthConfig };
