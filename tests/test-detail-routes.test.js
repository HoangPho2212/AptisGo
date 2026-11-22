const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');

const SECRET = 'test-detail-route-secret-at-least-32-characters';
process.env.JWT_SECRET = SECRET;

const app = require('../server/src/app');
const Test = require('../server/src/models/Test');
const { signAccessToken } = require('../server/src/utils/jwt');

const STUDENT_ID = '507f1f77bcf86cd799439091';
const LECTURER_ID = '507f1f77bcf86cd799439092';
const ADMIN_ID = '507f1f77bcf86cd799439093';
const TEST_ID = '507f1f77bcf86cd799439094';

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

/**
 * Replace `Test.findOne` with a chainable stub and return a restore function.
 *
 * @param {object|null} result
 * @returns {() => void}
 */
function stubFindOne(result) {
  const originalFindOne = Test.findOne;

  Test.findOne = () => ({
    select() {
      return this;
    },
    sort() {
      return this;
    },
    async lean() {
      return result;
    },
  });

  return () => {
    Test.findOne = originalFindOne;
  };
}

test('GET /api/tests/:id requires a bearer token', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/tests/${TEST_ID}`);

    assert.equal(response.status, 401);
    assert.equal(response.headers.get('www-authenticate'), 'Bearer');
    assert.deepEqual(await response.json(), { error: 'Authentication required' });
  });
});

test('GET /api/tests/:id rejects lecturer and admin roles', async () => {
  await withServer(async (baseUrl) => {
    for (const [role, id] of [
      ['lecturer', LECTURER_ID],
      ['admin', ADMIN_ID],
    ]) {
      const response = await fetch(`${baseUrl}/api/tests/${TEST_ID}`, {
        headers: { Authorization: `Bearer ${tokenFor(role, id)}` },
      });

      assert.equal(response.status, 403, `${role} must not fetch a student test`);
      assert.deepEqual(await response.json(), { error: 'Forbidden' });
    }
  });
});

test('GET /api/tests/:id rejects a malformed id before any lookup', async () => {
  const restore = stubFindOne(null);

  try {
    await withServer(async (baseUrl) => {
      for (const id of ['abc', 'abcdefghijkl']) {
        const response = await fetch(`${baseUrl}/api/tests/${id}`, {
          headers: { Authorization: `Bearer ${tokenFor('student', STUDENT_ID)}` },
        });

        assert.equal(response.status, 400, `${id} must be rejected`);
        assert.deepEqual(await response.json(), { error: 'Invalid identifier' });
      }
    });
  } finally {
    restore();
  }
});

test('GET /api/tests/:id answers 404 for an unpublished or unknown test', async () => {
  const restore = stubFindOne(null);

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/tests/${TEST_ID}`, {
        headers: { Authorization: `Bearer ${tokenFor('student', STUDENT_ID)}` },
      });

      assert.equal(response.status, 404);
      assert.deepEqual(await response.json(), { error: 'Test not found' });
    });
  } finally {
    restore();
  }
});

test('GET /api/tests/placement still resolves to the placement handler', async () => {
  const restore = stubFindOne(null);

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/tests/placement`, {
        headers: { Authorization: `Bearer ${tokenFor('student', STUDENT_ID)}` },
      });

      assert.equal(response.status, 404);
      assert.deepEqual(await response.json(), { error: 'Placement test not found' });
    });
  } finally {
    restore();
  }
});
