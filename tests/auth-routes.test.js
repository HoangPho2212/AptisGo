const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');

const app = require('../server/src/app');

async function withServer(run) {
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

function post(baseUrl, path, body) {
  return fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

test('POST /api/auth/register returns 400 details before touching the database', async () => {
  await withServer(async (baseUrl) => {
    const response = await post(baseUrl, '/api/auth/register', {});
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.error, 'Validation failed');
    assert.ok(Array.isArray(body.details));
    assert.ok(body.details.includes('name is required'));
    assert.ok(body.details.includes('email is required'));
    assert.ok(body.details.includes('password is required'));
  });
});

test('POST /api/auth/register rejects a malformed email without a database', async () => {
  await withServer(async (baseUrl) => {
    const response = await post(baseUrl, '/api/auth/register', {
      name: 'Amina Yusuf',
      email: 'not-an-email',
      password: 'Placement2026!',
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.ok(body.details.includes('email must be a valid address'));
  });
});

test('POST /api/auth/login returns 400 when credentials are missing', async () => {
  await withServer(async (baseUrl) => {
    const response = await post(baseUrl, '/api/auth/login', { email: 'amina@university.edu' });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.error, 'Validation failed');
    assert.ok(body.details.includes('password is required'));
  });
});

test('Auth routes are mounted under /api/auth', async () => {
  await withServer(async (baseUrl) => {
    const response = await post(baseUrl, '/api/auth/unknown', {});

    assert.equal(response.status, 404);
  });
});
