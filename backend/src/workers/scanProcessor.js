import { randomUUID } from 'node:crypto';
import { UnrecoverableError } from 'bullmq';
import { env } from '../config/env.js';
import { runStore, terminalStates } from '../services/runStore.js';
import { assertPublicUrl } from '../services/urlValidator.js';
import { scanPages } from '../services/scannerService.js';
import { crawlWebsite } from '../services/crawlerService.js';
import { RunError, RunCancelledError, isTransient, publicError } from '../services/runErrors.js';

export function createScanProcessor({ store = runStore, scan = scanPages, crawl = crawlWebsite, validateUrl = assertPublicUrl, config = env } = {}) {
  const controllers = new Set();
  const process = async (job, _token, workerSignal) => {
    const { id, kind } = job.data;
    if (!['scan', 'crawl'].includes(kind)) throw new UnrecoverableError('Unsupported job type.');
    const runToken = randomUUID();
    const run = await store.update(kind, id, (current) => {
      if (!current) throw new UnrecoverableError('Run record not found.');
      if (terminalStates.has(current.status)) return null;
      if (current.cancelRequested) return { ...current, status: 'cancelled', stage: 'cancelled', finishedAt: new Date().toISOString() };
      return { ...current, runToken, status: 'processing', stage: 'starting', attempt: job.attemptsMade + 1,
        startedAt: current.startedAt || new Date().toISOString(), error: null, nextRetryAt: null,
        progress: { completedPages: 0, totalPages: null, discoveredPages: 0, failedPages: 0 } };
    });
    if (terminalStates.has(run.status)) return { id, status: run.status };
    const controller = new AbortController(); controllers.add(controller);
    const signal = workerSignal ? AbortSignal.any([controller.signal, workerSignal]) : controller.signal;
    const check = () => {
      const latest = store.get(kind, id);
      if (latest?.cancelRequested) controller.abort(new RunCancelledError());
      else if (!latest || latest.runToken !== runToken) controller.abort(new RunError('This job attempt was superseded.'));
    };
    const poll = setInterval(() => { try { check(); } catch { controller.abort(new RunError('Scan storage is unavailable.', { retryable: true })); } }, config.cancellationPollMs);
    const timeout = setTimeout(() => controller.abort(new RunError('The scan exceeded its time limit.', { retryable: true })), config.jobTimeoutMs);
    const progress = async (update) => {
      check(); signal.throwIfAborted();
      const { stage, ...counts } = update;
      const saved = await store.update(kind, id, (current) => {
        if (current.runToken !== runToken || terminalStates.has(current.status)) return null;
        if (current.cancelRequested) throw new RunCancelledError();
        return { ...current, stage, progress: { ...current.progress, ...counts } };
      });
      await job.updateProgress({ stage: saved.stage, ...saved.progress, attempt: saved.attempt });
    };
    try {
      check(); signal.throwIfAborted();
      try { await validateUrl(run.startUrl); } catch { throw new RunError('The target is unavailable or blocked.'); }
      let discovery = null;
      if (kind === 'crawl' || run.configuration.maxPages > 1) {
        await progress({ stage: 'discovery' });
        discovery = await crawl(run.startUrl, { ...run.configuration, signal, onProgress: progress });
        signal.throwIfAborted();
        if (!discovery.pages?.length) throw new RunError('No pages could be discovered.', { retryable: discovery.errors?.some((error) => error.retryable) });
      }
      let result = discovery;
      if (kind === 'scan') {
        const pages = discovery?.pages?.length ? discovery.pages : [{ url: run.startUrl }];
        await progress({ stage: 'navigation', completedPages: 0, totalPages: pages.length, failedPages: 0 });
        result = await scan(pages, { signal, onProgress: progress });
        signal.throwIfAborted();
        if (!result.pagesScanned) throw new RunError('No pages could be audited.', { retryable: result.results?.some((page) => page.retryable) });
        result = { ...result, pagesDiscovered: discovery?.pagesDiscovered || 1,
          truncated: discovery?.truncated || false, crawlErrors: discovery?.errors || [] };
      }
      await progress({ stage: 'saving' });
      const saved = await store.update(kind, id, (current) => {
        if (current.runToken !== runToken || terminalStates.has(current.status)) return null;
        if (current.cancelRequested || signal.reason instanceof RunCancelledError) return { ...current, status: 'cancelled', stage: 'cancelled', finishedAt: new Date().toISOString() };
        signal.throwIfAborted();
        return { ...current, ...result, status: 'completed', stage: 'completed', error: null, finishedAt: new Date().toISOString() };
      });
      return { id, status: saved.status };
    } catch (error) {
      const reason = signal.aborted ? signal.reason : error;
      const retry = isTransient(reason) && job.attemptsMade + 1 < (job.opts.attempts || 1);
      const saved = await store.update(kind, id, (current) => {
        if (current.runToken !== runToken || terminalStates.has(current.status)) return null;
        const cancelled = current.cancelRequested || reason instanceof RunCancelledError;
        return { ...current, status: cancelled ? 'cancelled' : retry ? 'retrying' : 'failed',
          stage: cancelled ? 'cancelled' : retry ? 'retrying' : 'failed', error: cancelled ? null : publicError(reason),
          nextRetryAt: retry && !cancelled ? new Date(Date.now() + config.backoffMs * 2 ** job.attemptsMade).toISOString() : null,
          finishedAt: cancelled || !retry ? new Date().toISOString() : null };
      });
      if (saved.status === 'cancelled' || saved.runToken !== runToken || saved.status === 'completed') return { id, status: saved.status };
      if (!retry) throw new UnrecoverableError(publicError(reason));
      throw new Error(publicError(reason));
    } finally {
      clearInterval(poll); clearTimeout(timeout); controllers.delete(controller);
    }
  };
  process.abortAll = () => { for (const controller of controllers) controller.abort(new RunError('The worker is restarting.', { retryable: true })); };
  return process;
}
