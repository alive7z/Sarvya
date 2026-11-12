import { compareScans, scopeIdentity } from '../services/monitoring/comparison.js';
import { Router } from 'express';
import { runService } from '../services/runService.js';
import { statusSnapshot, terminalStates } from '../services/runStore.js';
import { RunError } from '../services/runErrors.js';

const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res)).catch(next);
const getOr404 = (service, kind, id) => {
  const run = service.get(kind, id);
  if (!run) throw new RunError('Run not found.', { status: 404 });
  return run;
};

const publicRun = ({ runToken, ...run }) => run;

export function createRunRouter(kind, service = runService) {
  const router = Router();
  router.post(kind === 'scan' ? ['/', '/run'] : '/', asyncRoute(async (req, res) => {
    res.status(202).json(await service.submit(kind, req.body));
  }));
  if (kind === 'scan') router.get('/', asyncRoute(async (_req, res) => res.json(service.list(kind).map(publicRun))));
  router.get('/:id/events', asyncRoute(async (req, res) => {
    getOr404(service, kind, req.params.id);
    res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.flushHeaders();
    let revision = null; let stopped = false; let poll; let heartbeat;
    const close = () => { stopped = true; clearInterval(poll); clearInterval(heartbeat); };
    const send = () => {
      if (stopped || res.writableEnded || res.writableNeedDrain) return;
      try {
        const run = getOr404(service, kind, req.params.id);
        const snapshot = statusSnapshot(run);
        const version = run.revision || run.updatedAt || run.createdAt;
        if (revision !== version) {
          revision = version;
          res.write(`id: ${version}\nevent: status\ndata: ${JSON.stringify(snapshot)}\n\n`);
        }
        if (terminalStates.has(run.status)) { close(); res.end(); }
      } catch { close(); res.end(); }
    };
    // These are persisted worker counts, not timed or simulated percentages.
    poll = setInterval(send, 500);
    heartbeat = setInterval(() => { if (!res.writableNeedDrain) res.write(': heartbeat\n\n'); }, 15000);
    res.on('close', close);
    send();
  }));
  router.get('/:id', asyncRoute(async (req, res) => res.json(publicRun(getOr404(service, kind, req.params.id)))));
  router.post('/:id/cancel', asyncRoute(async (req, res) => {
    getOr404(service, kind, req.params.id);
    const snapshot = await service.cancel(kind, req.params.id);
    res.status(snapshot.status === 'cancelled' ? 200 : 202).json(snapshot);
  }));
  if (kind === 'scan') {
    router.get('/:id/compare', asyncRoute(async (req, res) => {
      if (typeof req.query.baselineId !== 'string') throw new RunError('baselineId is required.', { status: 400 });
      const current = getOr404(service, kind, req.params.id), baseline = getOr404(service, kind, req.query.baselineId);
      if (scopeIdentity(current) !== scopeIdentity(baseline)) throw new RunError('Compare scans with matching URL and crawl limits.', { status: 400 });
      res.json(compareScans(baseline, current));
    }));
    router.get('/:id/issues', asyncRoute(async (req, res) => res.json(getOr404(service, kind, req.params.id).issues || [])));
    router.post('/:id/rescan', asyncRoute(async (req, res) => {
      const original = getOr404(service, kind, req.params.id);
      res.status(202).json(await service.submit(kind, { ...(original.configuration || {}), url: original.startUrl }));
    }));
  }
  return router;
}
