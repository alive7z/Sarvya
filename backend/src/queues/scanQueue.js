import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { env } from '../config/env.js';

export function createRedisConnection({ worker = false, url = env.redisUrl } = {}) {
  const connection = new IORedis(url, {
    lazyConnect: true,
    maxRetriesPerRequest: worker ? null : 1,
    enableOfflineQueue: worker,
    connectTimeout: 1500,
    retryStrategy: worker ? (times) => Math.min(times * 250, 3000) : () => null,
  });
  connection.on('error', () => {}); // Callers return safe errors or log a fixed message; never Redis credentials.
  return connection;
}

let resources;
export async function getScanQueue() {
  if (!resources) {
    const pending = (async () => {
      const connection = createRedisConnection();
      let queue;
      try {
        await connection.connect();
        queue = new Queue(env.queueName, { connection });
        await queue.waitUntilReady();
        await queue.setGlobalConcurrency(env.globalConcurrency);
        return { queue, connection };
      } catch (error) {
        await queue?.close().catch(() => {}); connection.disconnect(); throw error;
      }
    })().catch((error) => { if (resources === pending) resources = null; throw error; });
    resources = pending;
    pending.then(({ connection, queue }) => {
      connection.once('end', () => {
        if (resources === pending) resources = null;
        queue.close().catch(() => {});
      });
    }).catch(() => {});
  }
  return (await resources).queue;
}
export async function closeScanQueue() {
  const current = resources;
  resources = null;
  if (!current) return;
  try { const { queue, connection } = await current; await queue.close(); connection.disconnect(); } catch { /* failed initial connection */ }
}

// Application session commands use ioredis directly; BullMQ 6 exposes a different
// command adapter through getBackend().client and no longer exposes Queue.client.
export async function getScanRedisConnection() {
  await getScanQueue();
  return (await resources).connection;
}
