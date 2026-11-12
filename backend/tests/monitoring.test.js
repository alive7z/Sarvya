import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { Queue, Worker } from 'bullmq';
import express from 'express';
import { createMonitorStore } from '../src/services/monitoring/monitorStore.js';
import { createMonitorService } from '../src/services/monitoring/monitorService.js';
import { monitorConfig, repeatOptions, schedulerId } from '../src/services/monitoring/config.js';
import { compareScans, scopeIdentity } from '../src/services/monitoring/comparison.js';
import { createRunStore } from '../src/services/runStore.js';
import { createRunService } from '../src/services/runService.js';
import { createScanProcessor } from '../src/workers/scanProcessor.js';
import { createMonitorProcessor } from '../src/workers/monitorProcessor.js';
import { createMonitorRouter } from '../src/routes/monitorRoutes.js';
import { createRunRouter } from '../src/routes/runRoutes.js';
import { createRedisConnection } from '../src/queues/scanQueue.js';
import { assertPublicUrl } from '../src/services/urlValidator.js';
const target = 'https://example.com/';
const settings = { attempts: 2, backoffMs: 100, cancellationPollMs: 20, jobTimeoutMs: 3000 };
const violation = (selector, impact = 'serious', rule = 'image-alt') => ({ id: rule, impact, affectedElements: [{ selector, html: `<img id="${selector}">` }] });
const result = (violations = [violation('#logo')]) => ({ status: 'completed', pagesScanned: 1, pagesFailed: 0, score: 94, totalAffectedElements: violations.length,
  results: [{ url: target, status: 'success', violations }], issues: [], crawlErrors: [] });
function fakeQueue() {
  const schedulers = new Map(), values = new Map(), jobs = new Map();
  return { schedulers, jobs, client: Promise.resolve({ get: async key => values.get(key) || null, set: async (key, value) => values.set(key, value) }), toKey: key => `test:${key}`, getBackend() { return { client: this.client }; },
    async getJobScheduler(key) { return schedulers.get(key); },
    async upsertJobScheduler(key, repeat, template) { const value = { key, ...repeat, template: { data: template.data }, next: Date.now() + 3600000 }; schedulers.set(key, value); return value; },
    async removeJobScheduler(key) { return schedulers.delete(key); }, async getJobSchedulers() { return [...schedulers.values()]; },
    async add(name, data, options) { if (!jobs.has(options.jobId)) jobs.set(options.jobId, { name, data, options }); return jobs.get(options.jobId); },
    async getJob(id) { return jobs.has(id) ? { remove: async () => jobs.delete(id) } : undefined; },
  };
}
async function fixture(t, overrides = {}) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'sarvya-monitor-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = createMonitorStore(dir), scans = createRunStore(dir), queue = fakeQueue();
  const runs = createRunService({ store: scans, config: settings, validateUrl: async () => {}, queueProvider: async () => queue });
  const service = createMonitorService({ store, scans, runs, queueProvider: async () => queue, validateUrl: async () => {}, ...overrides });
  return { dir, store, scans, queue, runs, service };
}
async function complete(f, id, data = result()) {
  const requested = await f.service.runNow(id); assert.ok(requested.scanId);
  await f.scans.update('scan', requested.scanId, current => ({ ...current, ...data, finishedAt: new Date().toISOString() }));
  await f.service.finalize(requested.scanId);
  return f.scans.get('scan', requested.scanId);
}
async function until(fn, timeout = 7000) { const end = Date.now() + timeout; while (Date.now() < end) { const value = await fn(); if (value) return value; await delay(25); } throw Error('Timed out waiting for monitoring state.'); }

test('monitor configuration validates schedules, zones, booleans, fields, and bounded crawl scope', () => {
  const config = monitorConfig({ url: target, frequency: 'weekly', time: '14:35', timeZone: 'Asia/Kolkata', weekday: 2 });
  assert.deepEqual(repeatOptions(config), { pattern: '0 35 14 * * 2', tz: 'Asia/Kolkata' });
  assert.equal(repeatOptions({ ...config, frequency: 'daily' }).pattern, '0 35 14 * * *');
  for (const input of [{ frequency: 'hourly' }, { time: '25:00' }, { timeZone: 'Invalid/zone' }, { timeZone: '+05:30' }, { weekday: 7 }, { maxPages: 51 }, { active: 'false' }, { alerts: 1 }, { baselineMode: 'random' }, { score: 100 }]) assert.throws(() => monitorConfig({ url: target, ...input }));
});

test('legacy migration removes only the known mock and strips fake results while preserving real configuration', async t => {
  const f = await fixture(t);
  const old = [{ id: 'mon-1', url: 'https://example.com', frequency: 'weekly', score: 100 }, { id: 'mon-123', url: target, frequency: 'daily', alerts: true, active: false, lastRun: new Date().toISOString(), score: 100, openIssues: 0 }];
  const serialized = JSON.stringify(old); await writeFile(path.join(f.dir, 'monitors.json'), serialized);
  const monitors = await f.service.list(); assert.equal(monitors.length, 1); assert.equal(monitors[0].id, 'mon-123');
  assert.equal(monitors[0].score, undefined); assert.equal(monitors[0].lastRunAt, undefined); assert.equal(monitors[0].historyCount, 0);
  assert.equal(await readFile(path.join(f.dir, 'monitors.json'), 'utf8'), serialized);
  assert.deepEqual(await createMonitorService({ store: createMonitorStore(path.join(f.dir, 'empty')) }).list(), []);
});

test('schedulers reconcile create, update, pause, resume, deletion, orphan cleanup and Redis recovery', async t => {
  let offline = false; const queue = fakeQueue();
  const f = await fixture(t, { queueProvider: async () => { if (offline) throw Error('offline'); return queue; } });
  let monitor = await f.service.create({ url: target, timeZone: 'UTC', frequency: 'daily' });
  assert.equal(monitor.scheduleStatus, 'scheduled'); assert.ok(monitor.nextRunAt); assert.equal(queue.schedulers.size, 1);
  assert.equal(monitor.score, undefined); assert.equal(monitor.lastRunAt, undefined);
  monitor = await f.service.update(monitor.id, { time: '12:15', timeZone: 'America/New_York' });
  assert.equal(queue.schedulers.size, 1); assert.equal(queue.schedulers.get(schedulerId(monitor.id)).pattern, '0 15 12 * * *');
  offline = true; monitor = await f.service.update(monitor.id, { active: false }); assert.equal(monitor.active, false); assert.equal(monitor.scheduleStatus, 'pending');
  assert.equal((await f.service.trigger(monitor.id, 'old-tick', monitor.version - 1)).skipped, true);
  offline = false; await f.service.maintain(); assert.equal(queue.schedulers.size, 0);
  monitor = await f.service.update(monitor.id, { active: true }); assert.equal(queue.schedulers.size, 1);
  queue.schedulers.set('audit-mon-orphan', { key: 'audit-mon-orphan' }); await f.service.maintain(); assert.equal(queue.schedulers.size, 1);
  assert.equal((await f.service.runtimeStatus()).workerOnline, true);
  await f.service.remove(monitor.id); assert.equal(queue.schedulers.size, 0); assert.deepEqual(await f.service.list(), []);
  assert.equal(f.store.get(monitor.id).deleted, true);
});

test('regression evidence matches rules, normalized pages and selectors; failures and weak evidence stay uncertain', () => {
  const baseline = { ...result([violation('#kept'), violation('#gone'), violation('#worse', 'minor')]), scanId: 'scan-base', startUrl: target };
  const current = { ...result([violation('#kept'), violation('#new'), violation('#worse', 'critical')]), scanId: 'scan-next', startUrl: target };
  const compared = compareScans(baseline, current);
  assert.deepEqual(compared.summary, { new: 1, resolved: 1, persistent: 2, uncertain: 0, worsened: 1 });
  assert.equal(compared.entries.find(e => e.selector === '#gone').count, 0);
  const failed = { ...current, results: [{ url: target, status: 'error' }], pagesScanned: 0, pagesFailed: 1 };
  assert.equal(compareScans(baseline, failed).summary.resolved, 0); assert.equal(compareScans(baseline, failed).summary.uncertain, 3);
  const weak = { ...result([violation('')]), scanId: 'scan-weak', startUrl: target };
  assert.equal(compareScans(weak, { ...result([]), scanId: 'scan-clear' }).summary.uncertain, 1);
  const generated = { ...result([violation('#radix-123456')]), scanId: 'scan-dynamic', startUrl: target };
  assert.equal(compareScans(generated, { ...result([]), scanId: 'scan-clear' }).summary.uncertain, 1);
  const newPage = { ...current, results: [{ url: `${target}new`, status: 'success', violations: [violation('#other')] }] };
  assert.equal(compareScans(baseline, newPage).summary.new, 0);
});

test('baseline history and notifications are real, idempotent, durable, and deduplicated across unchanged runs', async t => {
  const f = await fixture(t); const monitor = await f.service.create({ url: target });
  const first = await complete(f, monitor.id);
  assert.equal((await f.service.list())[0].baselineScanId, first.scanId); assert.equal((await f.service.notifications()).total, 0);
  const second = await complete(f, monitor.id, result([violation('#logo'), violation('#new')]));
  let notices = await f.service.notifications(); assert.equal(notices.total, 1); assert.equal(notices.unreadCount, 1);
  assert.equal((await f.service.comparison(monitor.id, second.scanId)).summary.new, 1);
  await Promise.all([f.service.finalize(second.scanId), f.service.finalize(second.scanId)]); assert.equal((await f.service.history(monitor.id)).total, 2);
  await complete(f, monitor.id, result([violation('#logo'), violation('#new')])); assert.equal((await f.service.notifications()).total, 1);
  await complete(f, monitor.id, result([violation('#logo'), violation('#new', 'critical')])); assert.equal((await f.service.notifications()).total, 2);
  await f.service.markRead(monitor.id, notices.notifications[0].id, true); assert.equal((await f.service.notifications()).unreadCount, 1);
  const restored = createMonitorService({ store: createMonitorStore(f.dir), scans: createRunStore(f.dir), runs: f.runs, queueProvider: async () => f.queue });
  assert.equal((await restored.history(monitor.id)).total, 4); assert.equal((await restored.notifications()).total, 2);
  await f.service.update(monitor.id, { baselineMode: 'previous' });
  assert.notEqual((await f.service.list())[0].baselineScanId, first.scanId);
  await f.service.update(monitor.id, { baselineScanId: first.scanId, baselineMode: 'fixed' });
  assert.equal((await f.service.list())[0].baselineScanId, first.scanId);
});

test('duplicate triggers and overlapping runs cannot duplicate history; scope changes do not inherit a stale baseline', async t => {
  const f = await fixture(t); let monitor = await f.service.create({ url: target });
  const tick = await f.service.trigger(monitor.id, 'tick-1', monitor.version);
  assert.equal((await f.service.trigger(monitor.id, 'tick-1', monitor.version)).scanId, tick.scanId);
  assert.equal((await f.service.runNow(monitor.id)).skipped, true); assert.equal(f.queue.jobs.size, 1);
  await f.scans.update('scan', tick.scanId, current => ({ ...current, ...result(), finishedAt: new Date().toISOString() }));
  await f.service.finalize(tick.scanId);
  assert.equal((await f.service.trigger(monitor.id, 'tick-1', monitor.version)).skipped, true); assert.equal((await f.service.history(monitor.id)).total, 1);
  const pending = await f.service.runNow(monitor.id);
  monitor = await f.service.update(monitor.id, { maxPages: 2 }); assert.equal(monitor.baselineScanId, null);
  await f.scans.update('scan', pending.scanId, current => ({ ...current, ...result(), finishedAt: new Date().toISOString() }));
  await f.service.finalize(pending.scanId); monitor = (await f.service.list())[0]; assert.equal(monitor.baselineScanId, null); assert.equal(monitor.lastSuccessfulScanId, null);
});

test('failed and partial runs do not establish baselines or resolve findings; failure alerts wait for recovery', async t => {
  const f = await fixture(t); const monitor = await f.service.create({ url: target });
  await complete(f, monitor.id, { status: 'failed', error: 'Timed out', pagesFailed: 1 });
  await complete(f, monitor.id, { status: 'failed', error: 'Timed out', pagesFailed: 1 });
  assert.equal((await f.service.notifications()).total, 1); assert.equal((await f.service.list())[0].baselineScanId, null);
  const partial = await complete(f, monitor.id, { ...result(), pagesFailed: 1 });
  assert.equal((await f.service.list())[0].baselineScanId, null);
  await assert.rejects(f.service.update(monitor.id, { baselineScanId: partial.scanId }), error => error.status === 400);
  await complete(f, monitor.id); await complete(f, monitor.id, { status: 'failed', error: 'Timed out' });
  assert.equal((await f.service.notifications()).total, 2);
  await f.service.update(monitor.id, { alerts: false });
  await complete(f, monitor.id, result([violation('#logo'), violation('#brand-new')]));
  assert.equal((await f.service.notifications()).total, 2);
});

test('deleting a monitor cancels queued work without deleting scan evidence or history', async t => {
  const f = await fixture(t); const monitor = await f.service.create({ url: target });
  await complete(f, monitor.id); const pending = await f.service.runNow(monitor.id);
  await f.service.remove(monitor.id); assert.equal(f.scans.get('scan', pending.scanId).status, 'cancelled');
  await f.service.maintain(); assert.equal((await f.service.history(monitor.id)).total, 2); assert.equal((await f.service.list()).length, 0);
  assert.equal((await f.service.trigger(monitor.id, 'late-job', monitor.version).catch(error => error)).status, 404);
});

test('monitor API validates targets, serves paginated history/alerts, and exposes actual comparisons', async t => {
  const f = await fixture(t, { validateUrl: assertPublicUrl });
  await assert.rejects(f.service.create({ url: 'http://localhost:3000' }), error => error.status === 400);
  const normal = createMonitorService({ store: f.store, scans: f.scans, runs: f.runs, queueProvider: async () => f.queue, validateUrl: async () => {} });
  const app = express(); app.use(express.json()); app.use('/api/monitors', createMonitorRouter(normal)); app.use('/api/scans', createRunRouter('scan', f.runs));
  app.use((error, _req, res, _next) => res.status(error.status || 500).json({ error: error.message }));
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
  const base = `http://127.0.0.1:${server.address().port}/api/monitors`;
  const response = await fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: target }) }); assert.equal(response.status, 201);
  const monitor = await response.json();
  assert.equal((await fetch(`${base}/${monitor.id}/run`, { method: 'POST' })).status, 202);
  assert.equal((await (await fetch(`${base}/${monitor.id}/history`)).json()).total, 1);
  assert.equal((await fetch(`${base}/${monitor.id}/history?page=-1`)).status, 400);
  assert.equal((await (await fetch(`${base}/notifications`)).json()).total, 0);
});

test('submission retries are bounded, recorded as failures, and deletion can cancel an outbox before queueing', async t => {
  const f = await fixture(t);
  const offline = createMonitorService({ store: f.store, scans: f.scans, queueProvider: async () => f.queue, validateUrl: async () => {}, runs: { submit: async () => { const error = Error('queue offline'); error.status = 503; throw error; } } });
  const monitor = await offline.create({ url: target });
  assert.equal((await offline.runNow(monitor.id)).status, 'awaiting-enqueue');
  await offline.maintain(); await offline.maintain();
  assert.equal((await offline.history(monitor.id)).runs[0].status, 'failed');
  assert.equal((await offline.list())[0].pendingRun, null);
  assert.equal((await offline.notifications()).total, 1);
  await offline.runNow(monitor.id); await offline.remove(monitor.id);
  assert.equal((await offline.history(monitor.id)).runs[0].status, 'cancelled');
});

test('real BullMQ schedulers dispatch recurring audits, compare results, notify once, and reconcile pause/resume/delete', { skip: !process.env.REDIS_TEST_URL }, async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'sarvya-scheduled-'));
  const name = `monitor-test-${randomUUID()}`, connections = [], workers = [];
  const conn = worker => { const c = createRedisConnection({ worker, url: process.env.REDIS_TEST_URL }); connections.push(c); return c; };
  const monitorQueue = new Queue(name, { connection: conn(false) }), scanQueue = new Queue(`${name}-scans`, { connection: conn(false) });
  for (const q of [monitorQueue, scanQueue]) q.on('error', () => {});
  t.after(async () => {
    try {
      await Promise.all(workers.map(w => w.close()));
      for (const q of [monitorQueue, scanQueue]) { if ((await q.getBackend().client).status === 'ready') await q.obliterate({ force: true }); await q.close(); }
    } finally { connections.forEach(c => c.disconnect()); await rm(root, { recursive: true, force: true }); }
  });
  await Promise.all([monitorQueue.waitUntilReady(), scanQueue.waitUntilReady()]); await scanQueue.setGlobalConcurrency(1);
  const scans = createRunStore(root), store = createMonitorStore(root);
  const runs = createRunService({ store: scans, config: settings, validateUrl: async () => {}, queueProvider: async () => scanQueue });
  const service = createMonitorService({ store, scans, runs, queueProvider: async () => monitorQueue, validateUrl: async () => {}, scheduleFor: monitor => ({ pattern: '*/1 * * * * *', tz: monitor.timeZone }) });
  let count = 0;
  const scanWorker = new Worker(`${name}-scans`, createScanProcessor({ store: scans, config: settings, validateUrl: async () => {}, scan: async () => { count++; return count === 1 ? result() : result([violation('#logo'), violation('#regression')]); } }), { connection: conn(true), concurrency: 2 });
  scanWorker.on('error', () => {}); scanWorker.on('completed', job => service.finalize(job.data.id).catch(() => {})); workers.push(scanWorker);
  const monitoring = new Worker(name, createMonitorProcessor(service), { connection: conn(true), concurrency: 1 }); monitoring.on('error', () => {}); workers.push(monitoring);
  const monitor = await service.create({ url: target, frequency: 'daily', timeZone: 'Asia/Kolkata' });
  await service.maintain(); assert.equal((await service.runtimeStatus()).workerOnline, true);
  const scheduler = await monitorQueue.getJobScheduler(schedulerId(monitor.id)); assert.equal(scheduler.tz, 'Asia/Kolkata'); assert.equal(scheduler.template.data.version, 1);
  await until(async () => (await service.history(monitor.id)).total >= 3);
  assert.equal((await service.notifications()).total, 1); assert.ok((await service.list())[0].baselineScanId);
  await service.update(monitor.id, { active: false });
  await until(async () => !(await service.list())[0].pendingRun); const stopped = count;
  await delay(1200); assert.equal(count, stopped); assert.equal(await monitorQueue.getJobScheduler(schedulerId(monitor.id)), undefined);
  await service.update(monitor.id, { active: true, time: '13:00' }); assert.ok(await monitorQueue.getJobScheduler(schedulerId(monitor.id)));
  assert.equal((await monitorQueue.getJobSchedulers(0, -1)).length, 1);
  await service.remove(monitor.id); assert.equal(await monitorQueue.getJobScheduler(schedulerId(monitor.id)), undefined);
  assert.ok((await service.history(monitor.id)).total >= 3);
});
