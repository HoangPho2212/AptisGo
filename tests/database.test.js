const test = require('node:test');
const assert = require('node:assert/strict');

const {
  DEFAULT_POOL_OPTIONS,
  resolvePoolOptions,
  connectDatabase,
  disconnectDatabase,
} = require('../server/src/config/database');

const EXPECTED_DEFAULTS = {
  maxPoolSize: 10,
  minPoolSize: 2,
  maxIdleTimeMS: 30000,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  retryWrites: true,
};

test('Database: default pool options match the Connection Contract', () => {
  assert.deepEqual({ ...DEFAULT_POOL_OPTIONS }, EXPECTED_DEFAULTS);
  assert.deepEqual(resolvePoolOptions(), EXPECTED_DEFAULTS);
  assert.ok(Object.isFrozen(DEFAULT_POOL_OPTIONS), 'defaults must be immutable');
});

test('Database: overrides coerce numeric strings and preserve other defaults', () => {
  const options = resolvePoolOptions({
    maxPoolSize: '25',
    minPoolSize: '5',
    serverSelectionTimeoutMS: '8000',
  });

  assert.equal(options.maxPoolSize, 25);
  assert.equal(options.minPoolSize, 5);
  assert.equal(options.serverSelectionTimeoutMS, 8000);
  assert.equal(options.socketTimeoutMS, EXPECTED_DEFAULTS.socketTimeoutMS);
  assert.equal(options.retryWrites, true);
});

test('Database: invalid pool bounds are rejected before dialing', () => {
  assert.throws(() => resolvePoolOptions({ maxPoolSize: 0 }), RangeError);
  assert.throws(() => resolvePoolOptions({ maxPoolSize: 101 }), RangeError);
  assert.throws(() => resolvePoolOptions({ minPoolSize: -1 }), RangeError);
  assert.throws(() => resolvePoolOptions({ maxPoolSize: 4, minPoolSize: 5 }), RangeError);
  assert.throws(() => resolvePoolOptions({ maxPoolSize: 2.5 }), TypeError);
  assert.throws(() => resolvePoolOptions({ socketTimeoutMS: 'soon' }), TypeError);
});

test('Database: invalid or missing URI fails without opening a socket', async () => {
  await assert.rejects(connectDatabase({ uri: '' }), /MONGODB_URI is not configured/);
  await assert.rejects(
    connectDatabase({ uri: 'https://cluster.example.com' }),
    /must start with mongodb:\/\/ or mongodb\+srv:\/\//
  );
});

test('Database: disconnectDatabase is safe when never connected', async () => {
  await disconnectDatabase();
  await disconnectDatabase();
});
