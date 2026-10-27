const mongoSanitize = require('express-mongo-sanitize');

const sanitize = mongoSanitize({ replaceWith: '_' });

/**
 * Express 5 adapter for express-mongo-sanitize@2.2.0.
 *
 * Express 5 exposes request.query as a getter-only property, while the package
 * assigns it. Defining a writable own property first lets the package sanitize
 * the already-parsed query object without throwing.
 *
 * @param {import('express').Request} request
 * @param {import('express').Response} response
 * @param {import('express').NextFunction} next
 * @returns {void}
 */
function mongoSanitizeMiddleware(request, response, next) {
  Object.defineProperty(request, 'query', {
    configurable: true,
    enumerable: true,
    writable: true,
    value: request.query,
  });

  return sanitize(request, response, next);
}

module.exports = mongoSanitizeMiddleware;
