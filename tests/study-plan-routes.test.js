const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');

const SECRET = 'study-plan-route-secret-at-least-32-chars';
process.env.JWT_SECRET = SECRET;

const app = require('../server/src/app');
const { signAccessToken } = require('../server/src/utils/jwt');

const STUDENT_ID = '507f1f77bcf86cd799439051';
const LECTURER_ID = '507f1f77bcf86cd799439052';
const ADMIN_ID = '507f1f77bcf86cd799439053';
const TASK_ID = '507f1f77bcf86cd799439054';

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

function patchTask(baseUrl, token, taskId, body) {
  return fetch(`${baseUrl}/api/study-plans/tasks/${taskId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

test('PATCH /api/study-plans/tasks/:id requires a bearer token', async () => {
  await withServer(async (baseUrl) => {
    const response = await patchTask(baseUrl, null, TASK_ID, { isCompleted: true });

    assert.equal(response.status, 401);
    assert.equal(response.headers.get('www-authenticate'), 'Bearer');
    assert.deepEqual(await response.json(), { error: 'Authentication required' });
  });
});

test('PATCH /api/study-plans/tasks/:id authenticates before validating the id', async () => {
  await withServer(async (baseUrl) => {
    const response = await patchTask(baseUrl, null, 'not-an-id', { isCompleted: true });

    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: 'Authentication required' });
  });
});

test('PATCH /api/study-plans/tasks/:id rejects lecturer and admin roles', async () => {
  await withServer(async (baseUrl) => {
    for (const [role, id] of [
      ['lecturer', LECTURER_ID],
      ['admin', ADMIN_ID],
    ]) {
      const response = await patchTask(baseUrl, tokenFor(role, id), TASK_ID, {
        isCompleted: true,
      });

      assert.equal(response.status, 403, `${role} must not complete a student task`);
      assert.deepEqual(await response.json(), { error: 'Forbidden' });
    }
  });
});

test('PATCH /api/study-plans/tasks/:id rejects a malformed task id before MongoDB', async () => {
  await withServer(async (baseUrl) => {
    const token = tokenFor('student', STUDENT_ID);

    for (const taskId of ['1', '507f1f77bcf8', '507f1f77bcf86cd79943905g']) {
      const response = await patchTask(baseUrl, token, taskId, { isCompleted: true });

      assert.equal(response.status, 400, `${taskId} must be rejected`);
      assert.deepEqual(await response.json(), { error: 'Invalid identifier' });
    }
  });
});

test('PATCH /api/study-plans/tasks/:id validates the completion flag before MongoDB', async () => {
  await withServer(async (baseUrl) => {
    const token = tokenFor('student', STUDENT_ID);

    const missing = await patchTask(baseUrl, token, TASK_ID, {});
    assert.equal(missing.status, 400);
    assert.deepEqual(await missing.json(), {
      error: 'Validation failed',
      details: ['isCompleted must be a boolean'],
    });

    const stringBoolean = await patchTask(baseUrl, token, TASK_ID, { isCompleted: 'true' });
    assert.equal(stringBoolean.status, 400);
    assert.deepEqual(await stringBoolean.json(), {
      error: 'Validation failed',
      details: ['isCompleted must be a boolean'],
    });
  });
});

function getToday(baseUrl, token) {
  return fetch(`${baseUrl}/api/study-plans/today`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

test('GET /api/study-plans/today requires a bearer token', async () => {
  await withServer(async (baseUrl) => {
    const response = await getToday(baseUrl, null);

    assert.equal(response.status, 401);
    assert.equal(response.headers.get('www-authenticate'), 'Bearer');
    assert.deepEqual(await response.json(), { error: 'Authentication required' });
  });
});

test('GET /api/study-plans/today rejects lecturer and admin roles', async () => {
  await withServer(async (baseUrl) => {
    for (const [role, id] of [
      ['lecturer', LECTURER_ID],
      ['admin', ADMIN_ID],
    ]) {
      const response = await getToday(baseUrl, tokenFor(role, id));

      assert.equal(response.status, 403, `${role} must not read a student roadmap`);
      assert.deepEqual(await response.json(), { error: 'Forbidden' });
    }
  });
});
