import { monitorService } from '../services/monitoring/monitorService.js';
import { Worker } from 'bullmq';
import { env } from '../config/env.js';
import { createRedisConnection, getScanQueue, closeScanQueue } from '../queues/scanQueue.js';
import { createScanProcessor } from './scanProcessor.js';
import { runStore, terminalStates } from '../services/runStore.js';

await getScanQueue();
const connection = createRedisConnection({ worker: true });
const processor = createScanProcessor();
const worker = new Worker(env.queueName, processor, { connection, concurrency: env.workerConcurrency,
  autorun: false, maxStalledCount: 1, lockDuration: 30000, stalledInterval: 15000 });
worker.on('error', () => console.error('Scan worker queue connection failed; reconnecting.'));
worker.on('completed', (job) => {
  if (job?.data?.kind === 'scan') monitorService.finalize(job.data.id).catch(() => console.error('Monitoring completion is pending reconciliation.'));
});
worker.on('failed', (job) => {
  if (!job) return;
  // Covers jobs failed by BullMQ itself (for example repeated worker stalls).
  getScanQueue().then(queue => queue.getJob(job.id)).then(async (saved) => {
    if (saved && await saved.getState() === 'failed') await runStore.update(job.data.kind, job.data.id, (run) => !run || terminalStates.has(run.status) ? null : ({ ...run, status: run.cancelRequested ? 'cancelled' : 'failed', stage: run.cancelRequested ? 'cancelled' : 'failed', error: run.cancelRequested ? null : 'The worker could not finish this run.', finishedAt: new Date().toISOString() }));
  }).catch(() => console.error('Could not persist a worker failure.'));
});
await worker.waitUntilReady();
worker.run().catch(() => { console.error('Scan worker stopped unexpectedly.'); process.exitCode = 1; });
console.log(`Scan worker ready: local concurrency ${env.workerConcurrency}, global concurrency ${env.globalConcurrency}.`);
let closing = false;
async function shutdown() {
  if (closing) return; closing = true;
  await worker.pause(true); processor.abortAll();
  await worker.close(); connection.disconnect(); await closeScanQueue();
}
process.once('SIGTERM', () => shutdown().catch(() => { process.exitCode = 1; }));
process.once('SIGINT', () => shutdown().catch(() => { process.exitCode = 1; }));
