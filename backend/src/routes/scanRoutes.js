import { Router } from 'express';
import { normalizeUrl, assertPublicUrl } from '../services/urlValidator.js';
import { crawlWebsite } from '../services/crawlerService.js';
import { scanPages } from '../services/scannerService.js';
import { saveScan, getScan, listScans } from '../services/storageService.js';

const router = Router();

// Run accessibility scan
router.post(['/', '/run'], async (req, res) => {
  try {
    const { url, maxPages = 1, maxDepth = 1 } = req.body || {};

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'A valid URL is required.' });
    }

    const normalized = normalizeUrl(url);
    await assertPublicUrl(normalized);

    let pagesToScan = [{ url: normalized }];
    let crawlDetails = null;

    // If maxPages > 1, discover pages first
    if (Number(maxPages) > 1) {
      crawlDetails = await crawlWebsite(normalized, {
        maxPages: Number(maxPages),
        maxDepth: Number(maxDepth) || 1,
      });

      if (crawlDetails.pages && crawlDetails.pages.length > 0) {
        pagesToScan = crawlDetails.pages;
      }
    }

    const audit = await scanPages(pagesToScan);

    const scanId = `scan-${Date.now()}`;
    const scanRecord = {
      scanId,
      status: 'completed',
      startUrl: normalized,
      pagesDiscovered: crawlDetails ? crawlDetails.pagesDiscovered : 1,
      truncated: crawlDetails ? crawlDetails.truncated : false,
      crawlErrors: crawlDetails ? crawlDetails.errors : [],
      createdAt: new Date().toISOString(),
      ...audit,
    };

    await saveScan(scanRecord);

    res.json(scanRecord);
  } catch (err) {
    console.error('Scan error:', err);
    res.status(400).json({
      error: err.message || 'The accessibility scan failed.',
    });
  }
});

// List all past scans
router.get('/', (_req, res) => {
  res.json(listScans());
});

// Get specific scan by ID
router.get('/:scanId', (req, res) => {
  const scan = getScan(req.params.scanId);
  if (!scan) {
    return res.status(404).json({ error: 'Scan not found.' });
  }
  res.json(scan);
});

// Get issues for specific scan
router.get('/:scanId/issues', (req, res) => {
  const scan = getScan(req.params.scanId);
  if (!scan) {
    return res.status(404).json({ error: 'Scan not found.' });
  }
  res.json(scan.issues || []);
});

// Rescan target
router.post('/:scanId/rescan', async (req, res) => {
  const scan = getScan(req.params.scanId);
  if (!scan) {
    return res.status(404).json({ error: 'Original scan not found.' });
  }

  try {
    const audit = await scanPages([{ url: scan.startUrl }]);
    const newScanId = `scan-${Date.now()}`;
    const newScan = {
      scanId: newScanId,
      status: 'completed',
      startUrl: scan.startUrl,
      pagesDiscovered: 1,
      createdAt: new Date().toISOString(),
      ...audit,
    };
    await saveScan(newScan);
    res.json(newScan);
  } catch (err) {
    res.status(400).json({ error: err.message || 'Rescan failed.' });
  }
});

export default router;
