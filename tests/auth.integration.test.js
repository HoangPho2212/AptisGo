const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');

const { connectDatabase, disconnectDatabase } = require('../server/src/config/database');
const User = require('../server/src/models/User');
const app = require('../server/src/app');
const { verifyAccessToken } = require('../server/src/utils/jwt');

const testUri = process.env.MONGODB_TEST_URI;
const skipReason = testUri ? false : 'MONGODB_TEST_URI is not set';
const SECRET = 'integration-secret-with-at-least-32-characters';
const EMAIL_PREFIX = 'auth-integration-';

process.env.JWT_SECRET = SECRET;

function post(baseUrl, path, body) {
  return fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

test(
  'Auth integration: register, role forcing, duplicate, login, and token',
  { skip: skipReason },
  async (t) => {
    const email = `${EMAIL_PREFIX}${Date.now()}@aptis-go.test`;
    const password = 'Placement2026!';

    await connectDatabase({ uri: testUri, options: { maxPoolSize: 2, minPoolSize: 0 } });
    await User.init();
    await User.deleteMany({ email: { $regex: `^${EMAIL_PREFIX}` } });

    const server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const { port } = server.address();
    const baseUrl = `http://127.0.0.1:${port}`;

    t.after(async () => {
      await User.deleteMany({ email: { $regex: `^${EMAIL_PREFIX}` } });
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
      await disconnectDatabase();
    });

    const registration = await post(baseUrl, '/api/auth/register', {
      name: 'Amina Yusuf',
      email: `  ${email.toUpperCase()}  `,
      password,
      role: 'admin',
      currentLevel: 'C1',
    });
    const registered = await registration.json();

    assert.equal(registration.status, 201);
    assert.equal(registered.tokenType, 'Bearer');
    assert.equal(typeof registered.token, 'string');
    assert.equal(registered.user.email, email);
    assert.equal(registered.user.role, 'student');
    assert.equal(registered.user.currentLevel, 'UNTESTED');
    assert.equal(registered.user.password, undefined);

    const claims = verifyAccessToken(registered.token, { secret: SECRET });
    assert.equal(claims.sub, registered.user._id);
    assert.equal(claims.role, 'student');

    const stored = await User.findById(registered.user._id).select('+password');
    assert.match(stored.password, /^\$2[aby]\$12\$/);
    assert.equal(await stored.verifyPassword(password), true);

    const duplicate = await post(baseUrl, '/api/auth/register', {
      name: 'Someone Else',
      email,
      password,
    });
    assert.equal(duplicate.status, 409);
    assert.equal((await duplicate.json()).error, 'Email is already registered');

    const wrongPassword = await post(baseUrl, '/api/auth/login', {
      email,
      password: 'wrong-password',
    });
    const unknownEmail = await post(baseUrl, '/api/auth/login', {
      email: `${EMAIL_PREFIX}missing@aptis-go.test`,
      password,
    });
    const wrongBody = await wrongPassword.json();
    const unknownBody = await unknownEmail.json();

    assert.equal(wrongPassword.status, 401);
    assert.equal(unknownEmail.status, 401);
    assert.deepEqual(wrongBody, unknownBody);

    const login = await post(baseUrl, '/api/auth/login', { email, password });
    const loggedIn = await login.json();

    assert.equal(login.status, 200);
    assert.equal(loggedIn.user.email, email);
    assert.equal(loggedIn.user.password, undefined);
    assert.equal(verifyAccessToken(loggedIn.token, { secret: SECRET }).role, 'student');
  }
);
