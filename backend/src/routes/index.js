import { Router } from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { env } from '../config/env.js';
import { getScanRedisConnection } from '../queues/scanQueue.js';
import scanRoutes from './scanRoutes.js';
import crawlRoutes from './crawlRoutes.js';
import fixRoutes from './fixRoutes.js';
import monitorRoutes from './monitorRoutes.js';
import githubRoutes from './githubRoutes.js';
import previewRoutes from './previewRoutes.js';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'Sarvya API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Readiness checks dependencies without exposing connection strings or local paths.
router.get('/ready', async (_req, res) => {
  let probe;
  try {
    await fs.mkdir(env.dataDir, { recursive: true });
    probe = path.join(env.dataDir, `.ready-${randomUUID()}`);
    await fs.writeFile(probe, 'ready', { flag: 'wx', mode: 0o600 });
    const redis = await getScanRedisConnection(); await redis.ping();
    res.json({ status: 'ready' });
  } catch { res.status(503).json({ status: 'unavailable' }); }
  finally { if (probe) await fs.rm(probe, { force: true }).catch(() => {}); }
});

// Scan endpoints (support both /api/scan and /api/scans)
router.use('/scans', scanRoutes);
router.use('/scan', scanRoutes);

// Crawl endpoints (support both /api/crawl and /api/crawls)
router.use('/crawls', crawlRoutes);
router.use('/crawl', crawlRoutes);

// Fix generation and verification endpoints
router.use('/fixes', fixRoutes);

// Continuous monitoring endpoints
router.use('/monitors', monitorRoutes);

// GitHub pull request and repository endpoints
router.use('/github', githubRoutes);

// Controlled preview endpoint
router.use('/preview', previewRoutes);

export default router;
