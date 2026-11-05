import { Router } from 'express';
import { normalizeUrl, assertPublicUrl } from '../services/urlValidator.js';
import { crawlWebsite } from '../services/crawlerService.js';
import { saveCrawl, getCrawl } from '../services/storageService.js';

const router = Router();

router.post('/', async (req, res) => {
  try {
    const { url, maxPages = 20, maxDepth = 2 } = req.body || {};

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'A valid starting URL is required.' });
    }

    const normalized = normalizeUrl(url);
    await assertPublicUrl(normalized);

    const crawlResult = await crawlWebsite(normalized, {
      maxPages: Number(maxPages) || 20,
      maxDepth: Number(maxDepth) || 2,
    });

    const crawlId = `crawl-${Date.now()}`;
    const record = {
      crawlId,
      status: 'completed',
      createdAt: new Date().toISOString(),
      ...crawlResult,
    };

    await saveCrawl(record);

    res.json(record);
  } catch (err) {
    res.status(400).json({
      error: err.message || 'Crawl failed.',
    });
  }
});

router.get('/:crawlId', (req, res) => {
  const crawl = getCrawl(req.params.crawlId);
  if (!crawl) {
    return res.status(404).json({ error: 'Crawl record not found.' });
  }
  res.json(crawl);
});

export default router;
