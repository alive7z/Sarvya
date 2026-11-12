import { Worker } from 'bullmq';
import { createRedisConnection, closeScanQueue } from '../queues/scanQueue.js';
import { getMonitorQueue, closeMonitorQueue, monitorQueueName } from '../queues/monitorQueue.js';
import { monitorService } from '../services/monitoring/monitorService.js';
import { createMonitorProcessor } from './monitorProcessor.js';

const queue = await getMonitorQueue();
await monitorService.initialize();
await queue.upsertJobScheduler('housekeeping', { every: 15000 }, { name: 'monitor-maintenance', data: {}, opts: { attempts: 3, backoff: { type: 'exponential', delay: 1000 }, removeOnComplete: { count: 30 }, removeOnFail: { count: 100 } } });
const connection = createRedisConnection({ worker: true });
const worker = new Worker(monitorQueueName, createMonitorProcessor(monitorService), { connection, concurrency: 1, autorun: false, maxStalledCount: 1 });
worker.on('error', () => console.error('Monitoring queue connection failed; reconnecting.'));
worker.on('failed', () => console.error('A monitoring dispatch or reconciliation failed; persisted intent will be reconciled.'));
await worker.waitUntilReady();
worker.run().catch(() => { console.error('Monitoring worker stopped unexpectedly.'); process.exitCode = 1; });
console.log('Monitoring worker ready: schedules, comparisons, and in-app notifications.');
let closing = false;
async function shutdown() {
  if (closing) return; closing = true;
  await worker.close(); connection.disconnect(); await closeMonitorQueue(); await closeScanQueue();
}
process.once('SIGINT', () => shutdown().catch(() => { process.exitCode = 1; }));
process.once('SIGTERM', () => shutdown().catch(() => { process.exitCode = 1; }));
