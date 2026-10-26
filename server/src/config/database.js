const mongoose = require('mongoose');

const DEFAULT_POOL_OPTIONS = Object.freeze({
  maxPoolSize: 10,
  minPoolSize: 2,
  maxIdleTimeMS: 30000,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  retryWrites: true,
});

const NUMERIC_OPTION_KEYS = [
  'maxPoolSize',
  'minPoolSize',
  'maxIdleTimeMS',
  'serverSelectionTimeoutMS',
  'socketTimeoutMS',
];

const POSITIVE_OPTION_KEYS = ['maxIdleTimeMS', 'serverSelectionTimeoutMS', 'socketTimeoutMS'];

/**
 * @param {unknown} value
 * @param {string} name
 * @returns {number}
 */
function toInteger(value, name) {
  const parsed = typeof value === 'number' ? value : Number(value);

  if (!Number.isInteger(parsed)) {
    throw new TypeError(`${name} must be an integer`);
  }

  return parsed;
}

/**
 * @param {object} [overrides]
 * @returns {typeof DEFAULT_POOL_OPTIONS}
 */
function resolvePoolOptions(overrides = {}) {
  const options = { ...DEFAULT_POOL_OPTIONS };

  for (const key of NUMERIC_OPTION_KEYS) {
    if (overrides[key] !== undefined) {
      options[key] = toInteger(overrides[key], key);
    }
  }

  if (overrides.retryWrites !== undefined) {
    options.retryWrites = Boolean(overrides.retryWrites);
  }

  if (options.maxPoolSize < 1 || options.maxPoolSize > 100) {
    throw new RangeError('maxPoolSize must be between 1 and 100');
  }

  if (options.minPoolSize < 0 || options.minPoolSize > options.maxPoolSize) {
    throw new RangeError('minPoolSize must be between 0 and maxPoolSize');
  }

  for (const key of POSITIVE_OPTION_KEYS) {
    if (options[key] <= 0) {
      throw new RangeError(`${key} must be greater than 0`);
    }
  }

  return options;
}

/**
 * @param {unknown} uri
 * @returns {string}
 */
function assertMongoUri(uri) {
  if (typeof uri !== 'string' || uri.trim() === '') {
    throw new Error('MONGODB_URI is not configured');
  }

  const connectionString = uri.trim();

  if (!/^mongodb(\+srv)?:\/\//.test(connectionString)) {
    throw new Error('MONGODB_URI must start with mongodb:// or mongodb+srv://');
  }

  return connectionString;
}

/**
 * @param {{ uri?: string, options?: object }} [config]
 * @returns {Promise<import('mongoose').Mongoose>}
 */
async function connectDatabase({ uri = process.env.MONGODB_URI, options = {} } = {}) {
  const connectionString = assertMongoUri(uri);
  const poolOptions = resolvePoolOptions({
    maxPoolSize: process.env.MONGODB_MAX_POOL_SIZE,
    minPoolSize: process.env.MONGODB_MIN_POOL_SIZE,
    ...options,
  });

  mongoose.set('strictQuery', true);

  const connection = await mongoose.connect(connectionString, poolOptions);

  console.info(
    `MongoDB connected (pool ${poolOptions.minPoolSize}-${poolOptions.maxPoolSize}, ` +
      `selection timeout ${poolOptions.serverSelectionTimeoutMS}ms)`
  );

  return connection;
}

/**
 * @returns {Promise<void>}
 */
async function disconnectDatabase() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

module.exports = {
  DEFAULT_POOL_OPTIONS,
  resolvePoolOptions,
  connectDatabase,
  disconnectDatabase,
};
