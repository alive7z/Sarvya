import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import lockfile from 'proper-lockfile';
import { env } from '../../config/env.js';
import { RunError } from '../runErrors.js';

export function createMonitorStore(dataDir = env.dataDir) {
  const directory = path.join(dataDir, 'monitor-records');
  const filename = id => {
    if (!/^mon-[a-zA-Z0-9-]{1,100}$/.test(id || '')) throw new RunError('Monitor not found.', { status: 404 });
    return path.join(directory, `${id}.json`);
  };
  const read = (file, missing = null) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (error) { if (error.code === 'ENOENT') return missing; throw error; } };
  const get = id => read(filename(id));
  const list = () => {
    let files; try { files = fs.readdirSync(directory); } catch (error) { if (error.code === 'ENOENT') return []; throw error; }
    return files.filter(file => file.endsWith('.json')).map(file => read(path.join(directory, file))).filter(Boolean);
  };
  const edit = async (id, action) => {
    const file = filename(id); await fsp.mkdir(directory, { recursive: true });
    const release = await lockfile.lock(file, { realpath: false, stale: 60000, update: 10000, retries: { retries: 30, minTimeout: 25, maxTimeout: 250 } });
    try {
      let record = get(id);
      const save = async value => {
        const next = { ...value, id, revision: (record?.revision || 0) + 1, updatedAt: new Date().toISOString() };
        const temporary = `${file}.${randomUUID()}.tmp`;
        try {
          const handle = await fsp.open(temporary, 'wx', 0o600);
          try { await handle.writeFile(JSON.stringify(next)); await handle.sync(); } finally { await handle.close(); }
          await fsp.rename(temporary, file); record = next; return record;
        } finally { await fsp.rm(temporary, { force: true }); }
      };
      return await action(record, save);
    } finally { await release(); }
  };
  return { get, list, edit, legacy: () => read(path.join(dataDir, 'monitors.json'), []) };
}
export const monitorStore = createMonitorStore();
