const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');

const SECRET = 'placement-route-secret-at-least-32-characters';
process.env.JWT_SECRET = SECRET;

const app = require('../server/src/app');
const Test = require('../server/src/models/Test');
const { signAccessToken } = require('../server/src/utils/jwt');

const LECTURER_ID = '507f1f77bcf86cd799439022';
const ADMIN_ID = '507f1f77bcf86cd799439023';

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

test('GET /api/tests/placement requires a bearer token', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/tests/placement`);

    assert.equal(response.status, 401);
    assert.equal(response.headers.get('www-authenticate'), 'Bearer');
    assert.deepEqual(await response.json(), { error: 'Authentication required' });
  });
});

test('GET /api/tests/placement rejects lecturer and admin roles', async () => {
  await withServer(async (baseUrl) => {
    for (const [role, id] of [
      ['lecturer', LECTURER_ID],
      ['admin', ADMIN_ID],
    ]) {
      const response = await fetch(`${baseUrl}/api/tests/placement`, {
        headers: { Authorization: `Bearer ${tokenFor(role, id)}` },
      });

      assert.equal(response.status, 403, `${role} must not receive placement items`);
      assert.deepEqual(await response.json(), { error: 'Forbidden' });
    }
  });
});

test('Test schema: defines the placement filter and sort index', () => {
  const indexes = Test.schema.indexes();

  assert.ok(
    indexes.some(
      ([fields]) => fields.type === 1 && fields.isPublished === 1 && fields.createdAt === -1
    ),
    'placement must have a type + isPublished + createdAt index'
  );
});
