const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const app = express();

app.disable('x-powered-by');
app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_request, response) => {
  response.status(200).json({
    status: 'ok',
    service: 'aptis-go-api',
    timestamp: new Date().toISOString(),
  });
});

app.use((request, response) => {
  response.status(404).json({
    error: 'Not Found',
    path: request.originalUrl,
  });
});

app.use((error, _request, response, _next) => {
  const status = Number.isInteger(error.status) ? error.status : 500;
  response.status(status).json({
    error: status >= 500 ? 'Internal Server Error' : error.message,
  });
});

module.exports = app;
