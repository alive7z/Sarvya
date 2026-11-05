import { Router } from 'express';
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
    service: 'AccessLens API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
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
