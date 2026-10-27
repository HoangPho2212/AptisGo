const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { createRequire } = require('node:module');

const serverRequire = createRequire(require.resolve('../server/package.json'));
const mongoose = serverRequire('mongoose');

const { notFoundHandler, errorHandler } = require('../server/src/middleware/errorHandler');
const app = require('../server/src/app');
const User = require('../server/src/models/User');

function createResponse() {
  return {
    headersSent: false,
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

function createNext() {
  const calls = [];
  function next(error) {
    calls.push(error);
  }
  next.calls = calls;
  return next;
}

async function withApp(run) {
  const server = app.listen(0, '127.0.0.1');
  try {
    await once(server, 'listening');
    const { port } = server.address();
    return await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

function silenceConsoleError(t) {
  const original = console.error;
  console.error = () => {};
  t.after(() => {
    console.error = original;
  });
}

test('errorHandler maps malformed JSON to a safe 400', () => {
  const error = Object.assign(new SyntaxError('Unexpected token in JSON'), {
    status: 400,
    type: 'entity.parse.failed',
    body: '{"email":',
  });
  const response = createResponse();
  const next = createNext();

  errorHandler(error, {}, response, next);

  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.body, { error: 'Invalid JSON payload' });
  assert.equal(next.calls.length, 0);
});

test('errorHandler maps oversized payloads to 413', () => {
  const error = Object.assign(new Error('request entity too large'), {
    status: 413,
    type: 'entity.too.large',
  });
  const response = createResponse();

  errorHandler(error, {}, response, createNext());

  assert.equal(response.statusCode, 413);
  assert.deepEqual(response.body, { error: 'Payload too large' });
});

test('errorHandler maps Mongoose validation errors to 400 with details', async () => {
  let error;
  try {
    await new User({ email: 'not-an-email' }).validate();
  } catch (caught) {
    error = caught;
  }

  const response = createResponse();
  errorHandler(error, {}, response, createNext());

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.error, 'Validation failed');
  assert.ok(Array.isArray(response.body.details));
  assert.ok(response.body.details.includes('email must be a valid address'));
});

test('errorHandler maps Mongoose cast errors to a safe 400', () => {
  const error = new mongoose.Error.CastError('ObjectId', 'not-an-id', '_id');
  const response = createResponse();

  errorHandler(error, {}, response, createNext());

  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.body, { error: 'Invalid identifier' });
});

test('errorHandler maps duplicate keys to 409', () => {
  const error = Object.assign(new Error('E11000 duplicate key error'), {
    code: 11000,
    keyValue: { email: 'amina@university.edu' },
  });
  const response = createResponse();

  errorHandler(error, {}, response, createNext());

  assert.equal(response.statusCode, 409);
  assert.deepEqual(response.body, { error: 'Resource already exists' });
});

test('errorHandler preserves a known 4xx status message', () => {
  const error = Object.assign(new Error('Request cannot be processed'), { status: 422 });
  const response = createResponse();

  errorHandler(error, {}, response, createNext());

  assert.equal(response.statusCode, 422);
  assert.deepEqual(response.body, { error: 'Request cannot be processed' });
});

test('errorHandler hides unknown server errors behind a generic 500', (t) => {
  silenceConsoleError(t);
  const error = new Error('database exploded: secret connection string');
  const response = createResponse();
  const next = createNext();

  errorHandler(error, {}, response, next);

  assert.equal(response.statusCode, 500);
  assert.deepEqual(response.body, { error: 'Internal Server Error' });
  assert.equal(next.calls.length, 0);
});

test('errorHandler delegates when headers were already sent', () => {
  const error = new Error('late failure');
  const response = createResponse();
  response.headersSent = true;
  const next = createNext();

  errorHandler(error, {}, response, next);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body, undefined);
  assert.equal(next.calls.length, 1);
  assert.equal(next.calls[0], error);
});

test('notFoundHandler keeps the 404 Contract', () => {
  const response = createResponse();

  notFoundHandler({ originalUrl: '/api/missing' }, response);

  assert.equal(response.statusCode, 404);
  assert.deepEqual(response.body, { error: 'Not Found', path: '/api/missing' });
});

test('POST with malformed JSON returns the centralized 400 Contract', async () => {
  await withApp(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"email":',
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.deepEqual(body, { error: 'Invalid JSON payload' });
  });
});
