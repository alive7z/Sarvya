import { Router } from 'express';
import { monitorService } from '../services/monitoring/monitorService.js';
import { RunError } from '../services/runErrors.js';
const asyncRoute = handler => (req, res, next) => Promise.resolve(handler(req, res)).catch(next);
const pageNumber = query => { const page = Number(query.page || 1); if (!Number.isSafeInteger(page) || page < 1 || page > 100000) throw new RunError('Invalid page number.', { status: 400 }); return page; };
export function createMonitorRouter(service = monitorService) {
  const router = Router();
  router.get('/', asyncRoute(async (_req, res) => res.json(await service.list())));
  router.get('/status', asyncRoute(async (_req, res) => res.json(await service.runtimeStatus())));
  router.get('/notifications', asyncRoute(async (req, res) => { if (req.query.unread !== undefined && !['true', 'false'].includes(req.query.unread)) throw new RunError('unread must be true or false.', { status: 400 }); res.json(await service.notifications(pageNumber(req.query), req.query.unread === 'true')); }));
  router.post('/', asyncRoute(async (req, res) => res.status(201).json(await service.create(req.body || {}))));
  router.patch('/:id', asyncRoute(async (req, res) => res.json(await service.update(req.params.id, req.body || {}))));
  router.delete('/:id', asyncRoute(async (req, res) => res.json(await service.remove(req.params.id))));
  router.post('/:id/run', asyncRoute(async (req, res) => res.status(202).json(await service.runNow(req.params.id))));
  router.get('/:id/history', asyncRoute(async (req, res) => res.json(await service.history(req.params.id, pageNumber(req.query)))));
  router.get('/:id/history/:scanId/comparison', asyncRoute(async (req, res) => res.json(await service.comparison(req.params.id, req.params.scanId))));
  router.patch('/:id/notifications/:notificationId', asyncRoute(async (req, res) => res.json(await service.markRead(req.params.id, req.params.notificationId, req.body?.read))));
  return router;
}
export default createMonitorRouter();
