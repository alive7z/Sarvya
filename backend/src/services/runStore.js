import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import lockfile from 'proper-lockfile';
import { env } from '../config/env.js';

export const terminalStates = new Set(['completed', 'failed', 'cancelled']);
const idField = (kind) => kind === 'crawl' ? 'crawlId' : 'scanId';

// One atomic file per run; API and workers always read disk, never process-local caches.
// The existing scans.json/crawls.json remain readable and are never rewritten or deleted.
export function createRunStore(dataDir = env.dataDir) {
  const directory = (kind) => path.join(dataDir, kind === 'crawl' ? 'crawl-runs' : 'scan-runs');
  const filename = (kind, id) => {
    if (!/^(scan|crawl)-[a-zA-Z0-9-]{1,100}$/.test(id || '')) return null;
    return path.join(directory(kind), `${id}.json`);
  };
  const readJson = (file, missing = null) => {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return missing; throw error; }
  };
  const legacy = (kind) => readJson(path.join(dataDir, kind === 'crawl' ? 'crawls.json' : 'scans.json'), []);
  const get = (kind, id) => {
    const file = filename(kind, id);
    if (!file) return null;
    return readJson(file) || legacy(kind).find((run) => run[idField(kind)] === id) || null;
  };
  const list = (kind) => {
    const byId = new Map(legacy(kind).map((run) => [run[idField(kind)], run]));
    let files = [];
    try { files = fs.readdirSync(directory(kind)); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    for (const file of files.filter((name) => name.endsWith('.json'))) {
      const run = readJson(path.join(directory(kind), file));
      if (run) byId.set(run[idField(kind)], run);
    }
    return [...byId.values()].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  };
  const update = async (kind, id, change) => {
    const file = filename(kind, id);
    if (!file) throw new Error('Invalid run ID.');
    await fsp.mkdir(directory(kind), { recursive: true });
    const release = await lockfile.lock(file, { realpath: false, stale: 30000, update: 5000, retries: { retries: 30, minTimeout: 25, maxTimeout: 250 } });
    let temporary;
    try {
      const previous = get(kind, id);
      const next = await change(previous);
      if (!next) return previous;
      const record = { ...next, revision: (previous?.revision || 0) + 1, updatedAt: new Date().toISOString() };
      temporary = `${file}.${randomUUID()}.tmp`;
      const handle = await fsp.open(temporary, 'wx', 0o600);
      try { await handle.writeFile(JSON.stringify(record)); await handle.sync(); } finally { await handle.close(); }
      await fsp.rename(temporary, file);
      return record;
    } finally {
      if (temporary) await fsp.rm(temporary, { force: true });
      await release();
    }
  };
  return { get, list, update };
}

export const runStore = createRunStore();
export function statusSnapshot(run) {
  const { scanId, crawlId, jobId, status, stage, progress, attempt, maxAttempts, error, cancelRequested,
    createdAt, updatedAt, startedAt, finishedAt, nextRetryAt, revision, startUrl, configuration } = run;
  return { scanId, crawlId, jobId, status, stage, progress, attempt, maxAttempts, error, cancelRequested,
    createdAt, updatedAt, startedAt, finishedAt, nextRetryAt, revision, startUrl, configuration };
}
