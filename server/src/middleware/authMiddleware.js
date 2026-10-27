const { USER_ROLES } = require('../models/User');
const { verifyAccessToken } = require('../utils/jwt');

const AUTHENTICATION_REQUIRED = 'Authentication required';
const INVALID_TOKEN = 'Invalid or expired token';
const FORBIDDEN = 'Forbidden';
const JWT_ERROR_NAMES = new Set(['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError']);

/**
 * @param {import('express').Response} response
 * @param {string} message
 */
function unauthorized(response, message) {
  response.setHeader('WWW-Authenticate', 'Bearer');
  return response.status(401).json({ error: message });
}

/**
 * Extract the token from a `Bearer <token>` Authorization header.
 *
 * @param {unknown} header
 * @returns {string | null}
 */
function extractBearerToken(header) {
  if (typeof header !== 'string') {
    return null;
  }

  const parts = header.trim().split(/\s+/);

  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer' || !parts[1]) {
    return null;
  }

  return parts[1];
}

/**
 * Validate a Bearer access token and attach the caller identity.
 *
 * @param {import('express').Request} request
 * @param {import('express').Response} response
 * @param {import('express').NextFunction} next
 * @returns {void}
 */
function verifyToken(request, response, next) {
  const token = extractBearerToken(request.headers?.authorization);

  if (!token) {
    return unauthorized(response, AUTHENTICATION_REQUIRED);
  }

  let payload;

  try {
    payload = verifyAccessToken(token);
  } catch (error) {
    if (JWT_ERROR_NAMES.has(error.name)) {
      return unauthorized(response, INVALID_TOKEN);
    }

    return next(error);
  }

  if (typeof payload.sub !== 'string' || !payload.sub || !USER_ROLES.includes(payload.role)) {
    return unauthorized(response, INVALID_TOKEN);
  }

  request.user = { id: payload.sub, role: payload.role };
  return next();
}

/**
 * Build a guard that permits only the supplied roles.
 * Must be mounted after verifyToken.
 *
 * @param {...('student'|'lecturer'|'admin')} allowedRoles
 * @returns {(request: import('express').Request, response: import('express').Response, next: import('express').NextFunction) => void}
 */
function authorizeRoles(...allowedRoles) {
  if (allowedRoles.length === 0) {
    throw new TypeError('authorizeRoles requires at least one role');
  }

  for (const role of allowedRoles) {
    if (!USER_ROLES.includes(role)) {
      throw new RangeError(`Unknown role: ${String(role)}`);
    }
  }

  const allowed = new Set(allowedRoles);

  return function authorizeRole(request, response, next) {
    if (!request.user || !request.user.role) {
      return unauthorized(response, AUTHENTICATION_REQUIRED);
    }

    if (!allowed.has(request.user.role)) {
      return response.status(403).json({ error: FORBIDDEN });
    }

    return next();
  };
}

module.exports = { verifyToken, authorizeRoles };
