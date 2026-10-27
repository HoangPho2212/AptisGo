const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const authRoutes = require('./routes/authRoutes');
const mongoSanitize = require('./middleware/mongoSanitize');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

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
app.use(mongoSanitize);

app.get('/api/health', (_request, response) => {
  response.status(200).json({
    status: 'ok',
    service: 'aptis-go-api',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/auth', authRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
