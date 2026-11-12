import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import lockfile from 'proper-lockfile';
import { env } from '../../config/env.js';
import { RunError } from '../runErrors.js';

export function createReviewStore(root = path.join(env.dataDir, 'github-reviews')) {
  const filename = (owner, id) => {
    if (!/^\d+$/.test(String(owner)) || !/^[a-f0-9-]{36}$/.test(id || '')) throw new RunError('Review not found.', { status: 404 });
    return path.join(root, String(owner), `${id}.json`);
  };
  const read = async file => { try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch (error) { if (error.code === 'ENOENT') throw new RunError('Review not found.', { status: 404 }); throw error; } };
  const write = async (file, record) => {
    const tmp = `${file}.${randomUUID()}.tmp`;
    try { await fs.writeFile(tmp, JSON.stringify(record), { mode: 0o600, flag: 'wx' }); await fs.rename(tmp, file); }
    finally { await fs.rm(tmp, { force: true }); }
  };
  return {
    async create(owner, value) {
      const id = randomUUID(), file = filename(owner, id);
      await fs.mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
      const record = { ...value, id, owner: String(owner), revision: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      await write(file, record); return record;
    },
    async get(owner, id) { return read(filename(owner, id)); },
    async edit(owner, id, action) {
      const file = filename(owner, id);
      await read(file);
      const release = await lockfile.lock(file, { realpath: false, stale: 60000, update: 10000, retries: { retries: 3, minTimeout: 100, maxTimeout: 250 } });
      try {
        let record = await read(file);
        const save = async updates => { record = { ...record, ...updates, revision: record.revision + 1, updatedAt: new Date().toISOString() }; await write(file, record); return record; };
        return await action(record, save);
      } finally { await release(); }
    },
  };
}
