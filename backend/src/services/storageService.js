import { runStore } from './runStore.js';

export async function saveScan(scan) {
  return runStore.update('scan', scan.scanId, () => scan);
}
export function getScan(scanId) { return runStore.get('scan', scanId); }
export function listScans() { return runStore.list('scan'); }
export async function saveCrawl(crawl) {
  return runStore.update('crawl', crawl.crawlId, () => crawl);
}
export function getCrawl(crawlId) { return runStore.get('crawl', crawlId); }
