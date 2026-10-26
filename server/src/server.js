require('dotenv').config({ quiet: true });

const app = require('./app');
const { assertAuthConfig } = require('./config/auth');
const { connectDatabase, disconnectDatabase } = require('./config/database');

const port = Number(process.env.PORT) || 5000;

/** @type {import('node:http').Server | null} */
let server = null;

async function start() {
  assertAuthConfig();
  await connectDatabase();

  server = app.listen(port, () => {
    console.log(`APTIS GO API listening on http://localhost:${port}`);
  });
}

/**
 * @param {string} signal
 * @returns {Promise<void>}
 */
async function shutdown(signal) {
  console.log(`${signal} received, shutting down`);

  if (server) {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }

  await disconnectDatabase();
  process.exit(0);
}

process.on('SIGINT', () => {
  shutdown('SIGINT').catch((error) => {
    console.error('Failed to shut down cleanly', error);
    process.exit(1);
  });
});

process.on('SIGTERM', () => {
  shutdown('SIGTERM').catch((error) => {
    console.error('Failed to shut down cleanly', error);
    process.exit(1);
  });
});

start().catch((error) => {
  console.error('Failed to start APTIS GO API:', error.message);
  process.exit(1);
});
