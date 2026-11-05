import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../data');

const inMemory = {
  scans: new Map(),
  crawls: new Map(),
  monitors: new Map(),
};

async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch {
    // Ignore error if already exists
  }
}

async function readJsonFile(filename, defaultValue = []) {
  try {
    await ensureDataDir();
    const filePath = path.join(DATA_DIR, filename);
    const content = await fs.readFile(filePath, 'utf8');
    return JSON.parse(content);
  } catch {
    return defaultValue;
  }
}

async function writeJsonFile(filename, data) {
  try {
    await ensureDataDir();
    const filePath = path.join(DATA_DIR, filename);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error(`Failed to write ${filename}:`, err.message);
  }
}

// Initialise storage from disk on startup
(async () => {
  const savedScans = await readJsonFile('scans.json', []);
  for (const scan of savedScans) {
    if (scan.scanId) inMemory.scans.set(scan.scanId, scan);
  }

  const savedCrawls = await readJsonFile('crawls.json', []);
  for (const crawl of savedCrawls) {
    if (crawl.crawlId) inMemory.crawls.set(crawl.crawlId, crawl);
  }

  const savedMonitors = await readJsonFile('monitors.json', [
    {
      id: 'mon-1',
      url: 'https://example.com',
      frequency: 'weekly',
      active: true,
      createdAt: new Date().toISOString(),
      lastRun: new Date().toISOString(),
      score: 100,
      openIssues: 0,
    },
  ]);
  for (const m of savedMonitors) {
    if (m.id) inMemory.monitors.set(m.id, m);
  }
})();

export async function saveScan(scan) {
  inMemory.scans.set(scan.scanId, scan);
  const allScans = Array.from(inMemory.scans.values()).slice(-50);
  await writeJsonFile('scans.json', allScans);
  return scan;
}

export function getScan(scanId) {
  return inMemory.scans.get(scanId) || null;
}

export function listScans() {
  return Array.from(inMemory.scans.values()).sort(
    (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
  );
}

export async function saveCrawl(crawl) {
  inMemory.crawls.set(crawl.crawlId, crawl);
  const all = Array.from(inMemory.crawls.values()).slice(-50);
  await writeJsonFile('crawls.json', all);
  return crawl;
}

export function getCrawl(crawlId) {
  return inMemory.crawls.get(crawlId) || null;
}

export async function saveMonitor(monitor) {
  inMemory.monitors.set(monitor.id, monitor);
  await writeJsonFile('monitors.json', Array.from(inMemory.monitors.values()));
  return monitor;
}

export function listMonitors() {
  return Array.from(inMemory.monitors.values());
}

export async function updateMonitor(id, changes) {
  const existing = inMemory.monitors.get(id);
  if (!existing) return null;
  const updated = { ...existing, ...changes, updatedAt: new Date().toISOString() };
  inMemory.monitors.set(id, updated);
  await writeJsonFile('monitors.json', Array.from(inMemory.monitors.values()));
  return updated;
}

export async function deleteMonitor(id) {
  const existed = inMemory.monitors.delete(id);
  if (existed) {
    await writeJsonFile('monitors.json', Array.from(inMemory.monitors.values()));
  }
  return existed;
}
