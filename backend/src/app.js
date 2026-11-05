import cors from 'cors';
import express from 'express';
import routes from './routes/index.js';

try {
  process.loadEnvFile?.();
} catch {
  // Ignore missing .env file
}

const app = express();
const port = Number(process.env.PORT) || 3000;

app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Mount all API routes under /api
app.use('/api', routes);

// Fallback 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Endpoint not found.' });
});

// Error handling middleware
app.use((err, _req, res, _next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({
    error: err.message || 'Internal server error.',
  });
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

const server = app.listen(port, () => {
  console.log(`AccessLens API server listening on http://localhost:${port}`);
});

server.on('error', (err) => {
  console.error('Server listen error:', err);
});

server.on('close', () => {
  console.log('Server listen closed');
});

export default app;
