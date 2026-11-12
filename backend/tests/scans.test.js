import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { Queue, Worker } from 'bullmq';
import express from 'express';
import { createRunStore } from '../src/services/runStore.js';
import { createRunService, validateScanInput } from '../src/services/runService.js';
import { createScanProcessor } from '../src/workers/scanProcessor.js';
import { createRunRouter } from '../src/routes/runRoutes.js';
import { createRedisConnection } from '../src/queues/scanQueue.js';
import { assertPublicUrl, normalizeUrl } from '../src/services/urlValidator.js';
import { RunError } from '../src/services/runErrors.js';

const config = { attempts: 3, backoffMs: 100, cancellationPollMs: 20, jobTimeoutMs: 3000 };
const result = { pagesScanned: 1, pagesFailed: 0, issues: [{ rule: 'image-alt' }], results: [{ status: 'success' }], score: 94 };
async function until(fn, timeout = 6000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { const value = await fn(); if (value) return value; await delay(20); }
  throw new Error('Condition did not become true before timeout.');
}
async function fixture(t) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'sarvya-test-'));
  const store = createRunStore(dir);
  t.after(() => rm(dir, { recursive: true, force: true }));
  return { dir, store };
}

test('input validation and URL safety reject unsupported and internal destinations', async () => {
  for (const url of ['http://localhost', 'http://127.0.0.1', 'http://169.254.169.254', 'http://10.0.0.1', 'http://[::1]', 'http://[::ffff:127.0.0.1]']) await assert.rejects(assertPublicUrl(url));
  for (const url of ['ftp://example.com', 'file:///etc/passwd', 'https://name:secret@example.com']) assert.throws(() => normalizeUrl(url));
  for (const body of [{}, { url: 'example.com', maxPages: 51 }, { url: 'example.com', maxPages: true }, { url: 'example.com', maxDepth: '2' }, { url: 'example.com', maxDepth: -1 }]) assert.throws(() => validateScanInput(body));
  assert.equal(validateScanInput({ url: 'example.com/#a' }).url, 'https://example.com/');
});

test('atomic run storage shares updates without losing legacy history', async t => {
  const { dir, store } = await fixture(t);
  await writeFile(path.join(dir, 'scans.json'), JSON.stringify([{ scanId: 'scan-old', status: 'completed', issues: [1] }]));
  const other = createRunStore(dir);
  await store.update('scan', 'scan-new', () => ({ scanId: 'scan-new', count: 0 }));
  await Promise.all(Array.from({ length: 12 }, (_, i) => (i % 2 ? store : other).update('scan', 'scan-new', run => ({ ...run, count: run.count + 1 }))));
  assert.equal(other.get('scan', 'scan-new').count, 12);
  assert.equal(store.list('scan').length, 2);
  assert.deepEqual(other.get('scan', 'scan-old').issues, [1]);
  assert.equal(store.get('scan', '../secrets'), null);
});

test('enqueue failure persists a fenced failure and queue outage returns 503', async t => {
  const { store } = await fixture(t);
  const service = createRunService({ store, validateUrl: async () => {}, config, queueProvider: async () => ({ add: async () => { throw Error('secret'); } }) });
  await assert.rejects(service.submit('scan', { url: 'example.com' }), error => error.status === 503 && !error.message.includes('secret'));
  assert.equal(store.list('scan')[0].status, 'failed');
  assert.equal(store.list('scan')[0].cancelRequested, true);
  const unavailable = createRunService({ store, validateUrl: async () => {}, queueProvider: async () => { throw Error('Redis unavailable'); } });
  await assert.rejects(unavailable.submit('scan', { url: 'example.com' }), error => error.status === 503);
  assert.equal(store.list('scan').length, 1);
});

async function queueFixture(t, scan, overrides = {}) {
  const { store } = await fixture(t);
  const name = `test-${randomUUID()}`;
  const connections = [];
  const connection = () => { const c = createRedisConnection({ worker: true, url: process.env.REDIS_TEST_URL }); connections.push(c); return c; };
  const queueConnection = createRedisConnection({ url: process.env.REDIS_TEST_URL });
  connections.push(queueConnection);
  const queue = new Queue(name, { connection: queueConnection });
  queue.on('error', () => {});
  const settings = { ...config, ...overrides };
  const service = createRunService({ store, config: settings, validateUrl: async () => {}, queueProvider: async () => queue });
  const processors = [];
  const workers = [];
  const start = () => {
    const processor = createScanProcessor({ store, scan, config: settings, validateUrl: async () => {}, crawl: async (_url, { onProgress }) => { await onProgress({ stage: 'discovery', discoveredPages: 2, crawledPages: 2 }); return { pages: [{ url: 'https://example.com/' }, { url: 'https://example.com/about' }], pagesDiscovered: 2 }; } });
    const worker = new Worker(name, processor, { connection: connection(), concurrency: 2 });
    worker.on('error', () => {}); processors.push(processor); workers.push(worker); return worker;
  };
  t.after(async () => { processors.forEach(p => p.abortAll()); await Promise.all(workers.map(w => w.close())); if (queueConnection.status === 'ready') await queue.obliterate({ force: true }); await queue.close(); connections.forEach(c => c.disconnect()); });
  await queue.waitUntilReady(); await queue.setGlobalConcurrency(1);
  return { store, queue, service, start };
}
const integration = { skip: !process.env.REDIS_TEST_URL };

test('real queue retries transient failures and preserves final findings; deterministic failures stop', integration, async t => {
  let calls = 0;
  const f = await queueFixture(t, async (_pages, { onProgress }) => { calls++; if (calls === 1) throw new RunError('Temporary target failure', { retryable: true }); await onProgress({ stage: 'page-completed', completedPages: 1, totalPages: 1 }); return result; });
  f.start();
  const submitted = await f.service.submit('scan', { url: 'example.com' });
  assert.equal(submitted.status, 'queued'); assert.equal(submitted.results, undefined);
  const run = await until(() => { const r = f.store.get('scan', submitted.scanId); return r.status === 'completed' && r; });
  assert.equal(calls, 2); assert.equal(run.attempt, 2); assert.deepEqual(run.issues, result.issues); assert.equal(run.progress.completedPages, 1);
  // Redelivery of an already completed run is idempotent.
  const processor = createScanProcessor({ store: f.store, scan: () => { throw Error('must not execute'); }, config });
  await processor({ data: { kind: 'scan', id: run.scanId }, attemptsMade: 0 });
  assert.equal(f.store.get('scan', run.scanId).revision, run.revision);
  const bad = await queueFixture(t, async () => { throw new RunError('Permanent failure'); }); bad.start();
  const b = await bad.service.submit('scan', { url: 'example.com' });
  await until(async () => await (await bad.queue.getJob(b.scanId)).getState() === 'failed');
  assert.equal(bad.store.get('scan', b.scanId).attempt, 1);
});

test('queued cancellation removes work; active cancellation waits for cleanup and never publishes results', integration, async t => {
  let cleaned = false;
  const f = await queueFixture(t, async (_pages, { signal }) => { try { await delay(10000, null, { signal }); } finally { await delay(80); cleaned = true; } return result; });
  const queued = await f.service.submit('scan', { url: 'example.com' });
  assert.equal((await f.service.cancel('scan', queued.scanId)).status, 'cancelled');
  assert.equal(await f.queue.getJob(queued.scanId), undefined);
  f.start();
  const active = await f.service.submit('scan', { url: 'example.com' });
  await until(() => f.store.get('scan', active.scanId).stage === 'navigation');
  assert.equal((await f.service.cancel('scan', active.scanId)).status, 'cancelling');
  await until(() => f.store.get('scan', active.scanId).status === 'cancelled');
  assert.equal(cleaned, true); assert.equal(f.store.get('scan', active.scanId).results, undefined);
});

test('global concurrency bounds multiple workers; crawl remains supported; time limit releases work', integration, async t => {
  let active = 0, maxActive = 0;
  const f = await queueFixture(t, async (pages, { signal }) => { active++; maxActive = Math.max(maxActive, active); try { await delay(120, null, { signal }); return { ...result, pagesScanned: pages.length }; } finally { active--; } });
  f.start(); f.start();
  const runs = await Promise.all(Array.from({ length: 4 }, () => f.service.submit('scan', { url: 'example.com', maxPages: 2 })));
  await until(() => runs.every(r => f.store.get('scan', r.scanId).status === 'completed'));
  assert.equal(maxActive, 1); assert.equal(f.store.get('scan', runs[0].scanId).pagesScanned, 2);
  const crawl = await f.service.submit('crawl', { url: 'example.com' });
  await until(() => f.store.get('crawl', crawl.crawlId).status === 'completed');
  assert.equal(f.store.get('crawl', crawl.crawlId).pages.length, 2);
  const timed = await queueFixture(t, async (_pages, { signal }) => delay(10000, null, { signal }), { jobTimeoutMs: 80, attempts: 1 }); timed.start();
  const run = await timed.service.submit('scan', { url: 'example.com' });
  await until(() => timed.store.get('scan', run.scanId).status === 'failed');
  assert.match(timed.store.get('scan', run.scanId).error, /time limit/);
});

test('HTTP submission returns 202 and SSE streams persisted progress and terminal status', integration, async t => {
  const f = await queueFixture(t, async (_pages, { onProgress }) => { await onProgress({ stage: 'accessibility-analysis', completedPages: 0, totalPages: 1 }); await delay(700); return result; });
  const app = express(); app.use(express.json()); app.use('/api/scans', createRunRouter('scan', f.service));
  app.use((error, _req, res, _next) => res.status(error.status || 500).json({ error: error.message }));
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
  const base = `http://127.0.0.1:${server.address().port}/api/scans`;
  const response = await fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: 'example.com' }) });
  assert.equal(response.status, 202); const run = await response.json();
  const stream = await fetch(`${base}/${run.scanId}/events`); f.start();
  const text = await stream.text();
  assert.match(text, /event: status/); assert.match(text, /"status":"queued"/); assert.match(text, /"status":"processing"/); assert.match(text, /"status":"completed"/);
  assert.doesNotMatch(text, /"results"|runToken/);
  assert.deepEqual((await (await fetch(`${base}/${run.scanId}`)).json()).issues, result.issues);
  assert.equal((await fetch(`${base}/${run.scanId}/rescan`, { method: 'POST' })).status, 202);
});
