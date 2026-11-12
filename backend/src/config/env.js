import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function integer(name, fallback, min, max) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${name} must be an integer from ${min} to ${max}.`);
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: integer('PORT', 3000, 1, 65535),
  frontendOrigin: process.env.FRONTEND_ORIGIN || process.env.RENDER_EXTERNAL_URL || 'http://localhost:5173',
  redisUrl: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
  dataDir: process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : fileURLToPath(new URL('../../data/', import.meta.url)),
  queueName: process.env.SCAN_QUEUE_NAME || 'sarvya-scans',
  workerConcurrency: integer('SCAN_WORKER_CONCURRENCY', 1, 1, 8),
  globalConcurrency: integer('SCAN_GLOBAL_CONCURRENCY', 2, 1, 16),
  attempts: integer('SCAN_ATTEMPTS', 3, 1, 5),
  backoffMs: integer('SCAN_BACKOFF_MS', 1000, 100, 60000),
  jobTimeoutMs: integer('SCAN_JOB_TIMEOUT_MS', 180000, 1000, 900000),
  navigationTimeoutMs: integer('SCAN_NAVIGATION_TIMEOUT_MS', 20000, 1000, 60000),
  cancellationPollMs: 250,
  accessUser: process.env.ACCESS_USER || '',
  accessPassword: process.env.ACCESS_PASSWORD || '',
  staticDir: process.env.STATIC_DIR ? path.resolve(process.env.STATIC_DIR) : null,
  apiRateLimit: integer('API_RATE_LIMIT', 600, 30, 10000),
  maxPendingJobs: integer('SCAN_MAX_PENDING_JOBS', 100, 1, 1000),
};
