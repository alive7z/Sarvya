import { Router } from 'express';
import { normalizeUrl, assertPublicUrl } from '../services/urlValidator.js';
import {
  listMonitors,
  saveMonitor,
  updateMonitor,
  deleteMonitor,
} from '../services/storageService.js';

const router = Router();

router.get('/', (_req, res) => {
  res.json(listMonitors());
});

router.post('/', async (req, res) => {
  try {
    const { url, frequency = 'weekly', alerts = true } = req.body || {};

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'A valid website URL is required.' });
    }

    const normalized = normalizeUrl(url);
    await assertPublicUrl(normalized);

    const monitorId = `mon-${Date.now()}`;
    const newMonitor = {
      id: monitorId,
      url: normalized,
      frequency,
      alerts: Boolean(alerts),
      active: true,
      createdAt: new Date().toISOString(),
      lastRun: new Date().toISOString(),
      score: 100,
      openIssues: 0,
    };

    await saveMonitor(newMonitor);
    res.status(201).json(newMonitor);
  } catch (err) {
    res.status(400).json({ error: err.message || 'Could not create monitor.' });
  }
});

router.patch('/:id', async (req, res) => {
  const updated = await updateMonitor(req.params.id, req.body || {});
  if (!updated) {
    return res.status(404).json({ error: 'Monitor not found.' });
  }
  res.json(updated);
});

router.delete('/:id', async (req, res) => {
  const deleted = await deleteMonitor(req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: 'Monitor not found.' });
  }
  res.json({ message: 'Monitor deleted successfully.' });
});

export default router;
