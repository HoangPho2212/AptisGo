const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { createRequire } = require('node:module');

const serverRequire = createRequire(require.resolve('../server/package.json'));
const express = serverRequire('express');

const mongoSanitize = require('../server/src/middleware/mongoSanitize');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(mongoSanitize);
  app.all('/echo', (request, response) => {
    response.json({ query: request.query, body: request.body });
  });
  return app;
}

async function withServer(run) {
  const server = createApp().listen(0, '127.0.0.1');
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

test('mongoSanitize sanitizes query keys under Express 5 without throwing', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(
      `${baseUrl}/echo?%24where=1&profile.name=Amina&filter.%24gt=0&safe=ok`
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(body.query, {
      _where: '1',
      profile_name: 'Amina',
      filter_$gt: '0',
      safe: 'ok',
    });
  });
});

test('mongoSanitize recursively sanitizes body operators and dotted keys', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/echo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'amina@university.edu',
        $where: 'this.password.length > 0',
        'profile.name': 'Amina',
        filter: { $gt: 0, ok: true },
        items: [{ $ne: null, safe: 1 }],
      }),
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(body.body, {
      email: 'amina@university.edu',
      _where: 'this.password.length > 0',
      profile_name: 'Amina',
      filter: { _gt: 0, ok: true },
      items: [{ _ne: null, safe: 1 }],
    });
  });
});

test('mongoSanitize preserves ordinary requests', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/echo?limit=10&sort=name`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(body.query, { limit: '10', sort: 'name' });
  });
});
