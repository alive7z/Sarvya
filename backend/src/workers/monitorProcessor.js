import { UnrecoverableError } from 'bullmq';
export function createMonitorProcessor(service) {
  return async job => {
    if (job.name === 'monitor-maintenance') { await service.maintain(); return { reconciled: true }; }
    if (job.name === 'monitor-tick') {
      try { return await service.trigger(job.data.monitorId, job.id, job.data.version); }
      catch (error) { if (error.status === 404) return { skipped: true, reason: 'Monitor was removed.' }; throw error; }
    }
    throw new UnrecoverableError('Unsupported monitoring job.');
  };
}
