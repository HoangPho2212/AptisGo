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

test('GET /api/health returns 200 with the Health Contract', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/health`);

    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type') ?? '', /application\/json/);

    const body = await response.json();
    assert.equal(body.status, 'ok');
    assert.equal(body.service, 'aptis-go-api');
    assert.ok(
      typeof body.timestamp === 'string' && !Number.isNaN(Date.parse(body.timestamp)),
      'timestamp must be an ISO-8601 string'
    );
  });
});

test('Unknown routes return the 404 Contract and Express fingerprint is hidden', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/does-not-exist`);

    assert.equal(response.status, 404);
    assert.equal(response.headers.get('x-powered-by'), null);

    const body = await response.json();
    assert.equal(body.error, 'Not Found');
    assert.equal(body.path, '/api/does-not-exist');
  });
});
