import { Queue } from 'bullmq';
import { env } from '../config/env.js';
import { createRedisConnection } from './scanQueue.js';

export const monitorQueueName = `${env.queueName}-monitors`;
let resources;
export async function getMonitorQueue() {
  if (!resources) {
    const pending = (async () => {
      const connection = createRedisConnection(); let queue;
      try { await connection.connect(); queue = new Queue(monitorQueueName, { connection }); await queue.waitUntilReady(); return { queue, connection }; }
      catch (error) { await queue?.close().catch(() => {}); connection.disconnect(); throw error; }
    })().catch(error => { if (resources === pending) resources = null; throw error; });
    resources = pending;
    pending.then(({ queue, connection }) => connection.once('end', () => { if (resources === pending) resources = null; queue.close().catch(() => {}); })).catch(() => {});
  }
  return (await resources).queue;
}
export async function closeMonitorQueue() {
  const current = resources; resources = null; if (!current) return;
  try { const { queue, connection } = await current; await queue.close(); connection.disconnect(); } catch { /* failed initialization */ }
}
