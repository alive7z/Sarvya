import { pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import cors from 'cors';
import { createSecurity, frontendOrigins } from './middleware/security.js';
import express from 'express';
import { env } from './config/env.js';
import routes from './routes/index.js';
import { closeMonitorQueue } from './queues/monitorQueue.js';
import { closeScanQueue } from './queues/scanQueue.js';
import { RunError } from './services/runErrors.js';

const app = express();
app.disable('x-powered-by');
// Render connects through a managed reverse proxy; never trust arbitrary hop counts.
if (process.env.RENDER === 'true') app.set('trust proxy', 1);
app.use(createSecurity({ production: env.nodeEnv === 'production', username: env.accessUser, password: env.accessPassword, origin: env.frontendOrigin, limit: env.apiRateLimit }));
const allowedOrigins = frontendOrigins(env.frontendOrigin, env.nodeEnv === 'production');
app.use(cors({ origin: (origin, done) => done(null, !origin || allowedOrigins.has(origin)), methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'], credentials: true, allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-CSRF-Token'] }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/api', routes);
if (env.staticDir) {
  const index = path.join(env.staticDir, 'index.html');
  if (!fs.existsSync(index)) throw new Error('STATIC_DIR must contain a built frontend.');
  app.use(express.static(env.staticDir, { dotfiles: 'deny', index: false, setHeaders: (res, file) => {
    if (file.includes(`${path.sep}assets${path.sep}`)) res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
  } }));
  app.get('*', (req, res, next) => req.path.startsWith('/api/') || path.extname(req.path) ? next() : res.sendFile(index));
}
app.use((_req, res) => res.status(404).json({ error: 'Endpoint not found.' }));
app.use((error, _req, res, _next) => {
  if (res.headersSent) return res.end();
  if (error instanceof RunError) return res.status(error.status).json({ error: error.message });
  if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON request.' });
  if (error.type === 'entity.too.large') return res.status(413).json({ error: 'Request body is too large.' });
  console.error('API request failed:', error.name || 'Error');
  res.status(500).json({ error: 'The request could not be completed.' });
});

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const server = app.listen(env.port, () => console.log(`Sarvya API listening on http://localhost:${env.port}`));
  server.on('error', () => { console.error('Could not start the API. Check the port and permissions.'); process.exitCode = 1; });
  const shutdown = async () => { server.close(); server.closeAllConnections(); await closeScanQueue(); await closeMonitorQueue(); };
  process.once('SIGINT', () => shutdown().catch(() => { process.exitCode = 1; }));
  process.once('SIGTERM', () => shutdown().catch(() => { process.exitCode = 1; }));
}
export default app;
