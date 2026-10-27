const DUPLICATE_KEY_CODES = new Set([11000, 11001]);
const MIN_STATUS = 400;
const MAX_STATUS = 599;

/**
 * @param {import('express').Response} response
 * @param {number} status
 * @param {string} message
 * @param {string[]} [details]
 * @returns {import('express').Response}
 */
function sendError(response, status, message, details) {
  const body = { error: message };

  if (details && details.length > 0) {
    body.details = details;
  }

  return response.status(status).json(body);
}

/**
 * @param {unknown} error
 * @returns {number}
 */
function getStatus(error) {
  const candidate = error.statusCode ?? error.status;

  if (Number.isInteger(candidate) && candidate >= MIN_STATUS && candidate <= MAX_STATUS) {
    return candidate;
  }

  return 500;
}

/**
 * Keep the unknown-route response Contract in one place.
 *
 * @param {import('express').Request} request
 * @param {import('express').Response} response
 * @returns {void}
 */
function notFoundHandler(request, response) {
  response.status(404).json({
    error: 'Not Found',
    path: request.originalUrl,
  });
}

/**
 * Centralized Express error handler.
 *
 * @param {unknown} error
 * @param {import('express').Request} request
 * @param {import('express').Response} response
 * @param {import('express').NextFunction} next
 * @returns {void}
 */
function errorHandler(error, request, response, next) {
  if (response.headersSent) {
    return next(error);
  }

  const normalized = error instanceof Error ? error : new Error(String(error));

  if (normalized.type === 'entity.too.large') {
    return sendError(response, 413, 'Payload too large');
  }

  if (
    normalized.type === 'entity.parse.failed' ||
    (normalized instanceof SyntaxError && normalized.status === 400 && 'body' in normalized)
  ) {
    return sendError(response, 400, 'Invalid JSON payload');
  }

  if (normalized.name === 'ValidationError') {
    const details = Object.values(normalized.errors ?? {})
      .map((entry) => entry?.message)
      .filter(Boolean);

    return sendError(response, 400, 'Validation failed', details);
  }

  if (normalized.name === 'CastError') {
    return sendError(response, 400, 'Invalid identifier');
  }

  if (DUPLICATE_KEY_CODES.has(Number(normalized.code))) {
    return sendError(response, 409, 'Resource already exists');
  }

  const status = getStatus(normalized);

  if (status >= 500) {
    console.error('[api-error]', request.method, request.originalUrl, normalized);
    return sendError(response, 500, 'Internal Server Error');
  }

  return sendError(response, status, normalized.message || 'Request failed');
}

module.exports = { notFoundHandler, errorHandler };
