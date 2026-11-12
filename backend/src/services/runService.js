import { randomUUID } from 'node:crypto';
import { normalizeUrl, assertPublicUrl } from './urlValidator.js';
import { runStore, terminalStates, statusSnapshot } from './runStore.js';
import { getScanQueue } from '../queues/scanQueue.js';
import { env } from '../config/env.js';
import { RunError } from './runErrors.js';

export function validateScanInput(body = {}, kind = 'scan') {
  if (typeof body.url !== 'string' || !body.url.trim() || body.url.length > 2048) throw new RunError('A URL of at most 2048 characters is required.', { status: 400 });
  let url;
  try { url = normalizeUrl(body.url); } catch { throw new RunError('Enter a valid HTTP or HTTPS URL without credentials.', { status: 400 }); }
  if (['maxPages', 'maxDepth'].some((key) => body[key] !== undefined && (typeof body[key] !== 'number' || !Number.isInteger(body[key])))) throw new RunError('Crawl limits must be integers.', { status: 400 });
  const maxPages = Number(body.maxPages ?? (kind === 'crawl' ? 20 : 1));
  const maxDepth = Number(body.maxDepth ?? (kind === 'crawl' ? 2 : 1));
  if (!Number.isInteger(maxPages) || maxPages < 1 || maxPages > 50 || !Number.isInteger(maxDepth) || maxDepth < 0 || maxDepth > 3) {
    throw new RunError('maxPages must be 1–50 and maxDepth must be 0–3.', { status: 400 });
  }
  return { url, maxPages, maxDepth };
}

export function createRunService({ store = runStore, queueProvider = getScanQueue, validateUrl = assertPublicUrl, config = env } = {}) {
  const submit = async (kind, body, internal = {}) => {
    const input = validateScanInput(body, kind);
    try { await validateUrl(input.url); } catch { throw new RunError('The target is unavailable or blocked. Use a public HTTP(S) website.', { status: 400 }); }
    let queue;
    try { queue = await queueProvider(); } catch { throw new RunError('The scan queue is unavailable. Check Redis and try again.', { status: 503 }); }
    if (queue.getJobCounts) {
      const counts = await queue.getJobCounts('waiting', 'active', 'delayed');
      if (Object.values(counts).reduce((n, value) => n + value, 0) >= (config.maxPendingJobs || 100)) throw new RunError('The scan queue is full. Try again later.', { status: 429 });
    }
    const id = internal.id || `${kind}-${randomUUID()}`;
    if (!new RegExp(`^${kind}-[a-zA-Z0-9-]{1,100}$`).test(id)) throw new RunError('Invalid internal run ID.');
    const field = kind === 'scan' ? 'scanId' : 'crawlId';
    const run = await store.update(kind, id, (existing) => existing ? null : ({
      [field]: id, jobId: id, startUrl: input.url, configuration: input,
      ...(internal.monitor ? { monitor: internal.monitor, monitorId: internal.monitor.id, trigger: internal.trigger || 'scheduled' } : {}),
      status: 'queued', stage: 'queued', progress: { completedPages: 0, totalPages: null, discoveredPages: 0, failedPages: 0 },
      attempt: 0, maxAttempts: config.attempts, cancelRequested: false, createdAt: new Date().toISOString(),
    }));
    if (terminalStates.has(run.status) || !['queued'].includes(run.status)) return statusSnapshot(run);
    try {
      await queue.add(kind, { kind, id }, { jobId: id, attempts: config.attempts,
        backoff: { type: 'exponential', delay: config.backoffMs },
        removeOnComplete: { age: 86400, count: 500 }, removeOnFail: { age: 604800, count: 500 } });
    } catch {
      // An interrupted enqueue can have reached Redis: durable cancellation fences any such job.
      await store.update(kind, id, (current) => terminalStates.has(current.status) ? null : ({ ...current, status: 'failed', stage: 'failed', cancelRequested: true, error: 'The scan could not be queued. Submit a new scan.', finishedAt: new Date().toISOString() }));
      throw new RunError('The scan could not be queued. Check Redis and retry.', { status: 503 });
    }
    return statusSnapshot(run);
  };
  const cancel = async (kind, id) => {
    let run = await store.update(kind, id, (current) => {
      if (!current) throw new RunError('Run not found.', { status: 404 });
      if (current.status === 'cancelled') return null;
      if (terminalStates.has(current.status)) throw new RunError('This run has already finished.', { status: 409 });
      return { ...current, cancelRequested: true, status: 'cancelling', stage: 'cancelling' };
    });
    if (run.status === 'cancelled') return statusSnapshot(run);
    try {
      const queue = await queueProvider(); const job = await queue.getJob(id);
      if (!job && run.runToken) return statusSnapshot(run);
      if (job) await job.remove(); // Atomic in Redis; active jobs cannot be removed.
      run = await store.update(kind, id, (current) => terminalStates.has(current.status) ? null : ({ ...current, status: 'cancelled', stage: 'cancelled', finishedAt: new Date().toISOString() }));
    } catch { /* Active jobs observe the durable flag and close Chromium before acknowledging cancellation. */ }
    return statusSnapshot(run);
  };
  return { submit, cancel, get: (kind, id) => store.get(kind, id), list: (kind) => store.list(kind) };
}
export const runService = createRunService();
