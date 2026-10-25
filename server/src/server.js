require('dotenv').config();

const app = require('./app');

const port = Number(process.env.PORT) || 5000;

const server = app.listen(port, () => {
  console.log(`APTIS GO API listening on http://localhost:${port}`);
});

function shutdown(signal) {
  console.log(`${signal} received, closing HTTP server`);
  server.close((error) => {
    if (error) {
      console.error('Failed to close HTTP server cleanly', error);
      process.exit(1);
    }
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
