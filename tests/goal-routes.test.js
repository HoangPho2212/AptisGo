const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');

const SECRET = 'goal-route-secret-at-least-32-characters';
process.env.JWT_SECRET = SECRET;

const app = require('../server/src/app');
const { signAccessToken } = require('../server/src/utils/jwt');

const STUDENT_ID = '507f1f77bcf86cd799439031';
const LECTURER_ID = '507f1f77bcf86cd799439032';
const ADMIN_ID = '507f1f77bcf86cd799439033';

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

function tokenFor(role, id) {
  return signAccessToken({ _id: id, role }, { secret: SECRET });
}

function postGoal(baseUrl, token, body) {
  return fetch(`${baseUrl}/api/goals`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

test('POST /api/goals requires a bearer token', async () => {
  await withServer(async (baseUrl) => {
    const response = await postGoal(baseUrl, null, { deadline: '2030-06-30' });

    assert.equal(response.status, 401);
    assert.equal(response.headers.get('www-authenticate'), 'Bearer');
    assert.deepEqual(await response.json(), { error: 'Authentication required' });
  });
});

test('POST /api/goals rejects lecturer and admin roles', async () => {
  await withServer(async (baseUrl) => {
    for (const [role, id] of [
      ['lecturer', LECTURER_ID],
      ['admin', ADMIN_ID],
    ]) {
      const response = await postGoal(baseUrl, tokenFor(role, id), {
        deadline: '2030-06-30',
      });

      assert.equal(response.status, 403, `${role} must not create a student goal`);
      assert.deepEqual(await response.json(), { error: 'Forbidden' });
    }
  });
});

test('POST /api/goals validates the request body', async () => {
  await withServer(async (baseUrl) => {
    const token = tokenFor('student', STUDENT_ID);

    const missing = await postGoal(baseUrl, token, {});
    assert.equal(missing.status, 400);
    assert.deepEqual(await missing.json(), {
      error: 'Validation failed',
      details: ['deadline is required'],
    });

    const badCertificate = await postGoal(baseUrl, token, {
      deadline: '2030-06-30',
      targetCertificate: 'A2',
    });
    assert.equal(badCertificate.status, 400);
    assert.deepEqual(await badCertificate.json(), {
      error: 'Validation failed',
      details: ['targetCertificate must be one of: B1, B2, C1'],
    });
  });
});

test('POST /api/goals rejects an invalid calendar date before touching MongoDB', async () => {
  await withServer(async (baseUrl) => {
    const response = await postGoal(baseUrl, tokenFor('student', STUDENT_ID), {
      deadline: '2026-02-31',
    });

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      error: 'Deadline must be a valid ISO date',
    });
  });
});

test('POST /api/goals rejects a past deadline with the STP TC04 message', async () => {
  await withServer(async (baseUrl) => {
    const response = await postGoal(baseUrl, tokenFor('student', STUDENT_ID), {
      deadline: '2020-01-01',
    });

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      error: 'Deadline must be a future date',
    });
  });
});

test('POST /api/goals rejects a deadline beyond the five-year roadmap cap', async () => {
  await withServer(async (baseUrl) => {
    const response = await postGoal(baseUrl, tokenFor('student', STUDENT_ID), {
      deadline: '2099-01-01',
    });

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      error: 'Deadline must be within 1825 days',
    });
  });
});
