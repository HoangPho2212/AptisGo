const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');

const SECRET = 'submission-route-secret-at-least-32-characters';
process.env.JWT_SECRET = SECRET;

const app = require('../server/src/app');
const Test = require('../server/src/models/Test');
const { signAccessToken } = require('../server/src/utils/jwt');

const STUDENT_ID = '507f1f77bcf86cd7994390d0';
const LECTURER_ID = '507f1f77bcf86cd7994390d1';
const ADMIN_ID = '507f1f77bcf86cd7994390d2';
const TEST_ID = '507f1f77bcf86cd7994390d3';
const QUESTION_ID = '507f1f77bcf86cd7994390d4';

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

function post(baseUrl, token, body) {
  const headers = { 'Content-Type': 'application/json' };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return fetch(`${baseUrl}/api/submissions`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

test('POST /api/submissions requires a bearer token', async () => {
  await withServer(async (baseUrl) => {
    const response = await post(baseUrl, null, {});

    assert.equal(response.status, 401);
    assert.equal(response.headers.get('www-authenticate'), 'Bearer');
    assert.deepEqual(await response.json(), { error: 'Authentication required' });
  });
});

test('POST /api/submissions rejects lecturer and admin roles', async () => {
  await withServer(async (baseUrl) => {
    for (const [role, id] of [
      ['lecturer', LECTURER_ID],
      ['admin', ADMIN_ID],
    ]) {
      const response = await post(baseUrl, tokenFor(role, id), {});

      assert.equal(response.status, 403, `${role} must not submit a student attempt`);
      assert.deepEqual(await response.json(), { error: 'Forbidden' });
    }
  });
});

test('POST /api/submissions validates the body before any lookup', async () => {
  await withServer(async (baseUrl) => {
    const response = await post(baseUrl, tokenFor('student', STUDENT_ID), {});

    assert.equal(response.status, 400);
    const body = await response.json();

    assert.equal(body.error, 'Validation failed');
    assert.ok(body.details.some((detail) => detail.includes('testId')));
    assert.ok(body.details.some((detail) => detail.includes('answers')));
  });
});

test('POST /api/submissions answers 404 for an unknown or unpublished test', async () => {
  const originalFindOne = Test.findOne;

  Test.findOne = () => ({
    select() {
      return this;
    },
    sort() {
      return this;
    },
    async lean() {
      return null;
    },
  });

  try {
    await withServer(async (baseUrl) => {
      const response = await post(baseUrl, tokenFor('student', STUDENT_ID), {
        testId: TEST_ID,
        answers: [{ questionId: QUESTION_ID, submittedAnswer: 1 }],
      });

      assert.equal(response.status, 404);
      assert.deepEqual(await response.json(), { error: 'Test not found' });
    });
  } finally {
    Test.findOne = originalFindOne;
  }
});
