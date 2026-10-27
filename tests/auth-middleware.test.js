const test = require('node:test');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');

const serverRequire = createRequire(require.resolve('../server/package.json'));
const jwt = serverRequire('jsonwebtoken');

const { JWT_AUDIENCE, JWT_ISSUER } = require('../server/src/config/auth');
const { signAccessToken } = require('../server/src/utils/jwt');
const { verifyToken, authorizeRoles } = require('../server/src/middleware/authMiddleware');

const SECRET = 'middleware-test-secret-at-least-32-characters';
const OTHER_SECRET = 'other-middleware-secret-at-least-32-chars';
const USER_ID = '507f1f77bcf86cd799439011';

process.env.JWT_SECRET = SECRET;

function createRequest(authorization) {
  const headers = {};
  if (authorization !== undefined) {
    headers.authorization = authorization;
  }
  return { headers };
}

function createResponse() {
  return {
    statusCode: 200,
    body: undefined,
    headers: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
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

function tokenFor(role, overrides = {}) {
  return signAccessToken({ _id: USER_ID, role }, { secret: SECRET, ...overrides });
}

function rawToken(payload) {
  return jwt.sign(payload, SECRET, {
    algorithm: 'HS256',
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
    expiresIn: '1h',
  });
}

for (const role of ['student', 'lecturer', 'admin']) {
  test(`verifyToken accepts a valid ${role} token and attaches the identity`, () => {
    const request = createRequest(`Bearer ${tokenFor(role)}`);
    const response = createResponse();
    const next = createNext();

    verifyToken(request, response, next);

    assert.deepEqual(request.user, { id: USER_ID, role });
    assert.equal(response.statusCode, 200);
    assert.equal(response.body, undefined);
    assert.deepEqual(next.calls, [undefined]);
  });
}

test('verifyToken accepts a lowercase bearer scheme', () => {
  const request = createRequest(`bearer ${tokenFor('student')}`);
  const response = createResponse();
  const next = createNext();

  verifyToken(request, response, next);

  assert.deepEqual(request.user, { id: USER_ID, role: 'student' });
  assert.deepEqual(next.calls, [undefined]);
});

for (const header of [
  undefined,
  '',
  'Token abc',
  'Basic abc',
  'Bearer',
  'Bearer   ',
  'Bearer a b',
]) {
  test(`verifyToken returns 401 for malformed header: ${String(header)}`, () => {
    const request = createRequest(header);
    const response = createResponse();
    const next = createNext();

    verifyToken(request, response, next);

    assert.equal(response.statusCode, 401);
    assert.deepEqual(response.body, { error: 'Authentication required' });
    assert.equal(response.headers['www-authenticate'], 'Bearer');
    assert.equal(next.calls.length, 0);
  });
}

test('verifyToken returns 401 for a tampered token', () => {
  const token = tokenFor('student');
  const request = createRequest(`Bearer ${token.slice(0, -2)}xx`);
  const response = createResponse();
  const next = createNext();

  verifyToken(request, response, next);

  assert.equal(response.statusCode, 401);
  assert.deepEqual(response.body, { error: 'Invalid or expired token' });
  assert.equal(next.calls.length, 0);
});

test('verifyToken returns 401 for a token signed with another secret', () => {
  const token = tokenFor('student', { secret: OTHER_SECRET });
  const request = createRequest(`Bearer ${token}`);
  const response = createResponse();
  const next = createNext();

  verifyToken(request, response, next);

  assert.equal(response.statusCode, 401);
  assert.deepEqual(response.body, { error: 'Invalid or expired token' });
  assert.equal(next.calls.length, 0);
});

test('verifyToken returns 401 for an expired token', () => {
  const token = tokenFor('student', { expiresIn: -1 });
  const request = createRequest(`Bearer ${token}`);
  const response = createResponse();
  const next = createNext();

  verifyToken(request, response, next);

  assert.equal(response.statusCode, 401);
  assert.deepEqual(response.body, { error: 'Invalid or expired token' });
  assert.equal(next.calls.length, 0);
});

test('verifyToken rejects a signed token with an unknown role', () => {
  const request = createRequest(`Bearer ${tokenFor('superadmin')}`);
  const response = createResponse();
  const next = createNext();

  verifyToken(request, response, next);

  assert.equal(response.statusCode, 401);
  assert.deepEqual(response.body, { error: 'Invalid or expired token' });
  assert.equal(next.calls.length, 0);
});

test('verifyToken rejects a signed token without a subject', () => {
  const request = createRequest(`Bearer ${rawToken({ role: 'student' })}`);
  const response = createResponse();
  const next = createNext();

  verifyToken(request, response, next);

  assert.equal(response.statusCode, 401);
  assert.deepEqual(response.body, { error: 'Invalid or expired token' });
  assert.equal(next.calls.length, 0);
});

test('verifyToken forwards configuration errors instead of returning 401', () => {
  const originalSecret = process.env.JWT_SECRET;
  delete process.env.JWT_SECRET;

  try {
    const request = createRequest('Bearer anything');
    const response = createResponse();
    const next = createNext();

    verifyToken(request, response, next);

    assert.equal(response.statusCode, 200);
    assert.equal(response.body, undefined);
    assert.equal(next.calls.length, 1);
    assert.match(next.calls[0].message, /JWT_SECRET/);
  } finally {
    process.env.JWT_SECRET = originalSecret;
  }
});

test('authorizeRoles allows a listed role', () => {
  const guard = authorizeRoles('admin');
  const request = { user: { id: USER_ID, role: 'admin' } };
  const response = createResponse();
  const next = createNext();

  guard(request, response, next);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(next.calls, [undefined]);
});

for (const role of ['student', 'lecturer']) {
  test(`authorizeRoles returns 403 for a valid ${role} token on an admin guard`, () => {
    const guard = authorizeRoles('admin');
    const request = { user: { id: USER_ID, role } };
    const response = createResponse();
    const next = createNext();

    guard(request, response, next);

    assert.equal(response.statusCode, 403);
    assert.deepEqual(response.body, { error: 'Forbidden' });
    assert.equal(next.calls.length, 0);
  });
}

test('authorizeRoles permits either role when several are allowed', () => {
  const guard = authorizeRoles('student', 'lecturer');
  const lecturer = { user: { id: USER_ID, role: 'lecturer' } };
  const response = createResponse();
  const next = createNext();

  guard(lecturer, response, next);

  assert.deepEqual(next.calls, [undefined]);
});

test('authorizeRoles returns 401 when verifyToken has not run', () => {
  const guard = authorizeRoles('admin');
  const request = {};
  const response = createResponse();
  const next = createNext();

  guard(request, response, next);

  assert.equal(response.statusCode, 401);
  assert.deepEqual(response.body, { error: 'Authentication required' });
  assert.equal(response.headers['www-authenticate'], 'Bearer');
  assert.equal(next.calls.length, 0);
});

test('authorizeRoles rejects empty or unknown role configuration', () => {
  assert.throws(() => authorizeRoles(), {
    name: 'TypeError',
    message: /at least one role/,
  });
  assert.throws(() => authorizeRoles('superadmin'), {
    name: 'RangeError',
    message: /Unknown role/,
  });
  assert.throws(() => authorizeRoles('student', 'root'), {
    name: 'RangeError',
    message: /Unknown role/,
  });
});

test('verifyToken and authorizeRoles compose in the documented order', () => {
  const request = createRequest(`Bearer ${tokenFor('admin')}`);
  const response = createResponse();
  const adminOnly = authorizeRoles('admin');
  const next = createNext();

  verifyToken(request, response, () => adminOnly(request, response, next));

  assert.deepEqual(request.user, { id: USER_ID, role: 'admin' });
  assert.deepEqual(next.calls, [undefined]);
});
