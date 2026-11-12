import { randomUUID, createHash } from 'node:crypto';
import { monitorStore } from './monitorStore.js';
import { monitorConfig, repeatOptions, schedulerId } from './config.js';
import { compareScans, assertBaseline, scopeIdentity } from './comparison.js';
import { runService } from '../runService.js';
import { runStore, terminalStates } from '../runStore.js';
import { assertPublicUrl } from '../urlValidator.js';
import { getMonitorQueue } from '../../queues/monitorQueue.js';
import { RunError } from '../runErrors.js';

const hash = input => createHash('sha256').update(input).digest('hex');
const requireMonitor = (monitor, includeDeleted = false) => { if (!monitor || (!includeDeleted && monitor.deleted)) throw new RunError('Monitor not found.', { status: 404 }); return monitor; };
const completeEvidence = run => run.status === 'completed' && run.results?.some(p => p.status === 'success') && !run.pagesFailed && !run.crawlErrors?.length;
const notify = (monitor, run, type, message, summary) => ({ id: hash(`${monitor.id}:${run.scanId}:${type}`), monitorId: monitor.id, scanId: run.scanId, url: run.startUrl, type, message, summary, readAt: null, createdAt: run.finishedAt || new Date().toISOString() });

export function createMonitorService({ store = monitorStore, runs = runService, scans = runStore, queueProvider = getMonitorQueue, validateUrl = assertPublicUrl, scheduleFor = repeatOptions } = {}) {
  let initialized;
  const initialize = async () => {
    if (!initialized) initialized = (async () => {
      // Old files stay untouched. Exclude only the exact seed identity; preserve real configurations.
      for (const old of store.legacy()) {
        if (!old?.id || (old.id === 'mon-1' && /^https:\/\/example\.com\/?$/.test(old.url || ''))) continue;
        const id = /^mon-[a-zA-Z0-9-]{1,100}$/.test(old.id) ? old.id : `mon-legacy-${hash(String(old.id)).slice(0, 24)}`;
        if (store.get(id)) continue;
        let config, migrationError;
        try { config = monitorConfig({ url: old.url, frequency: old.frequency || 'weekly', active: old.active !== false, alerts: typeof old.alerts === 'boolean' ? old.alerts : true }); }
        catch { config = { url: '', frequency: 'weekly', time: '09:00', timeZone: 'UTC', weekday: 1, active: false, alerts: true, maxPages: 1, maxDepth: 1, baselineMode: 'fixed', scope: null }; migrationError = 'Update this legacy monitor with a valid public website and schedule.'; }
        await store.edit(id, async (current, save) => current || save({ ...config, version: 1, createdAt: old.createdAt || new Date().toISOString(), runs: [], notifications: [], baselineScanId: null, lastSuccessfulScanId: null, pendingScanId: null, scheduleStatus: 'pending', migrationError }));
      }
    })().catch(error => { initialized = null; throw error; });
    return initialized;
  };
  const publicMonitor = monitor => {
    const pending = monitor.pendingScanId && scans.get('scan', monitor.pendingScanId);
    const { runs: history, notifications, ...record } = monitor;
    return { ...record, historyCount: history.length, unreadNotifications: notifications.filter(n => !n.readAt).length,
      pendingRun: monitor.pendingScanId ? { scanId: monitor.pendingScanId, status: pending?.status || 'awaiting-enqueue', stage: pending?.stage || 'submission', progress: pending?.progress } : null };
  };
  const reconcileOne = async id => store.edit(id, async (monitor, save) => {
    if (!monitor) return null;
    try {
      const queue = await queueProvider(), key = schedulerId(id);
      let scheduled = await queue.getJobScheduler(key);
      if (monitor.deleted || !monitor.active || monitor.migrationError) {
        if (scheduled) await queue.removeJobScheduler(key);
        const status = monitor.deleted ? 'deleted' : 'paused';
        if (monitor.scheduleStatus !== status || monitor.nextRunAt || monitor.scheduleError) monitor = await save({ ...monitor, scheduleStatus: status, nextRunAt: null, scheduleError: null });
      } else {
        const repeat = scheduleFor(monitor);
        if (!scheduled || scheduled.template?.data?.version !== monitor.version || scheduled.pattern !== repeat.pattern || scheduled.tz !== repeat.tz || (scheduled.every ?? null) !== (repeat.every ?? null)) {
          await queue.upsertJobScheduler(key, repeat, { name: 'monitor-tick', data: { monitorId: id, version: monitor.version }, opts: { attempts: 3, backoff: { type: 'exponential', delay: 1000 }, removeOnComplete: { age: 86400, count: 500 }, removeOnFail: { age: 604800, count: 500 } } });
          scheduled = await queue.getJobScheduler(key);
        }
        const nextRunAt = scheduled?.next ? new Date(scheduled.next).toISOString() : null;
        if (monitor.scheduleStatus !== 'scheduled' || monitor.nextRunAt !== nextRunAt || monitor.scheduleError) monitor = await save({ ...monitor, scheduleStatus: 'scheduled', nextRunAt, scheduleError: null });
      }
    } catch {
      monitor = await save({ ...monitor, scheduleStatus: 'pending', nextRunAt: null, scheduleError: 'Schedule synchronization is pending. Check Redis and the monitoring worker.' });
    }
    return monitor;
  });
  const finalize = async scanId => {
    const run = scans.get('scan', scanId);
    if (!run?.monitor?.id || !terminalStates.has(run.status)) return null;
    return store.edit(run.monitor.id, async (monitor, save) => {
      if (!monitor || monitor.runs.some(entry => entry.scanId === scanId)) return null;
      const baseline = run.monitor.baselineScanId && scans.get('scan', run.monitor.baselineScanId);
      const previous = run.monitor.previousScanId && scans.get('scan', run.monitor.previousScanId);
      const comparison = run.status === 'completed' && baseline?.status === 'completed' ? compareScans(baseline, run) : null;
      const transition = run.status === 'completed' && previous?.status === 'completed' ? compareScans(previous, run) : null;
      const regressions = transition?.entries.filter(entry => entry.change === 'new' || entry.worsened) || [];
      if (comparison && !run.comparison) await scans.update('scan', scanId, current => ({ ...current, comparison }));
      const currentScope = monitor.scope === run.monitor.scope;
      const history = { scanId, status: run.status, trigger: run.trigger, scope: run.monitor.scope, createdAt: run.createdAt, finishedAt: run.finishedAt,
        pagesScanned: run.pagesScanned || 0, pagesFailed: run.pagesFailed || 0, score: run.score ?? null, error: run.error || null, baselineScanId: comparison?.baselineScanId || null, comparison: comparison?.summary || null, newRegressions: regressions.length, baselineEligible: completeEvidence(run) };
      const notifications = [...monitor.notifications];
      if (monitor.alerts && currentScope && !monitor.deleted) {
        if (run.status === 'completed' && regressions.length) notifications.push(notify(monitor, run, 'regression', `${regressions.length} new or worsened accessibility finding(s) since the previous completed run.`, transition.summary));
        if (run.status === 'failed' && !monitor.failureNotified) notifications.push(notify(monitor, run, 'scan_failed', 'A scheduled audit failed. Review its error and coverage before drawing conclusions.', null));
      }
      let updates = {};
      if (currentScope) {
        updates = { lastRunAt: run.finishedAt, lastStatus: run.status, failureNotified: run.status === 'failed' ? true : run.status === 'completed' ? false : monitor.failureNotified };
        if (run.status === 'completed') {
          updates.lastSuccessfulScanId = scanId; updates.score = run.score; updates.openIssues = run.totalAffectedElements ?? run.issues?.reduce((sum, issue) => sum + (issue.count || issue.nodes?.length || 1), 0) ?? 0;
          if (completeEvidence(run) && (!monitor.baselineScanId || monitor.baselineMode === 'previous')) updates.baselineScanId = scanId;
        }
      }
      return save({ ...monitor, ...updates, pendingScanId: monitor.pendingScanId === scanId ? null : monitor.pendingScanId, runs: [...monitor.runs, history], notifications });
    });
  };
  const enqueuePending = async monitor => {
    const run = await runs.submit('scan', { url: monitor.pending.url, maxPages: monitor.pending.maxPages, maxDepth: monitor.pending.maxDepth }, { id: monitor.pendingScanId, trigger: monitor.pending.trigger,
      monitor: { id: monitor.id, scope: monitor.pending.scope, baselineScanId: monitor.pending.baselineScanId, previousScanId: monitor.pending.previousScanId, version: monitor.pending.version } });
    return run;
  };
  const pendingTerminal = async (monitor, status, error = null) => scans.update('scan', monitor.pendingScanId, current => current ? null : ({
    scanId: monitor.pendingScanId, jobId: monitor.pendingScanId, startUrl: monitor.pending.url,
    configuration: { url: monitor.pending.url, maxPages: monitor.pending.maxPages, maxDepth: monitor.pending.maxDepth },
    monitorId: monitor.id, monitor: { id: monitor.id, scope: monitor.pending.scope, version: monitor.pending.version, baselineScanId: monitor.pending.baselineScanId, previousScanId: monitor.pending.previousScanId },
    trigger: monitor.pending.trigger, status, stage: status, error, createdAt: monitor.pending.createdAt,
    finishedAt: new Date().toISOString(), attempt: 0, maxAttempts: 3, progress: { completedPages: 0, totalPages: null }, cancelRequested: status === 'cancelled',
  }));
  const attemptEnqueue = async (monitor, save) => {
    try {
      const run = await enqueuePending(monitor);
      if (monitor.enqueueError) await save({ ...monitor, enqueueError: null });
      return { scanId: run.scanId, status: run.status };
    } catch (error) {
      const attempts = (monitor.pending.enqueueAttempts || 0) + 1;
      const message = error.status === 400 ? 'The audit target could not be validated before queueing.' : 'The audit could not be submitted to the scan queue.';
      monitor = await save({ ...monitor, pending: { ...monitor.pending, enqueueAttempts: attempts }, enqueueError: `${message} Submission attempt ${attempts}; the monitoring worker will retry.` });
      if (attempts >= 3 && !scans.get('scan', monitor.pendingScanId)) {
        await pendingTerminal(monitor, 'failed', `${message} Submission failed after three attempts.`);
        return { scanId: monitor.pendingScanId, status: 'failed' };
      }
      return { scanId: monitor.pendingScanId, status: 'awaiting-enqueue' };
    }
  };
  const trigger = async (id, triggerId, version, manual = false) => {
    await initialize();
    const scanId = `scan-mon-${hash(`${id}:${triggerId}`).slice(0, 48)}`;
    const outcome = await store.edit(id, async (monitor, save) => {
      requireMonitor(monitor);
      if ((!manual && (!monitor.active || monitor.version !== version)) || monitor.migrationError) return { skipped: true, reason: 'Monitor is paused or this schedule was replaced.' };
      if (monitor.runs.some(run => run.scanId === scanId)) return { skipped: true, scanId, reason: 'This scheduled occurrence already finished.' };
      if (monitor.pendingScanId) return { skipped: true, scanId: monitor.pendingScanId, reason: 'An audit is already pending for this monitor.' };
      monitor = await save({ ...monitor, pendingScanId: scanId, pending: { url: monitor.url, maxPages: monitor.maxPages, maxDepth: monitor.maxDepth, scope: monitor.scope, version: monitor.version,
        baselineScanId: monitor.baselineScanId, previousScanId: monitor.lastSuccessfulScanId, createdAt: new Date().toISOString(), enqueueAttempts: 0, trigger: manual ? 'monitor-manual' : 'scheduled' }, enqueueError: null });
      return attemptEnqueue(monitor, save);
    });
    if (outcome.scanId && terminalStates.has(scans.get('scan', outcome.scanId)?.status)) await finalize(outcome.scanId);
    return outcome;
  };
  return {
    initialize, finalize, trigger,
    async list() { await initialize(); return store.list().filter(m => !m.deleted).map(publicMonitor); },
    async create(input) {
      await initialize(); if (store.list().filter(m => !m.deleted).length >= 100) throw new RunError('At most 100 monitors are supported.', { status: 400 });
      const config = monitorConfig(input);
      try { await validateUrl(config.url); } catch { throw new RunError('Use a reachable public HTTP(S) website.', { status: 400 }); }
      const baseline = input.baselineScanId;
      if (baseline !== undefined && baseline !== null && typeof baseline !== 'string') throw new RunError('Invalid baseline scan ID.', { status: 400 });
      if (baseline) assertBaseline(scans.get('scan', baseline), config);
      const id = `mon-${randomUUID()}`;
      await store.edit(id, async (_current, save) => save({ ...config, version: 1, createdAt: new Date().toISOString(), runs: [], notifications: [], baselineScanId: baseline || null, lastSuccessfulScanId: baseline || null, pendingScanId: null, scheduleStatus: 'pending' }));
      return publicMonitor(await reconcileOne(id));
    },
    async update(id, input) {
      await initialize();
      await store.edit(id, async (monitor, save) => {
        requireMonitor(monitor); const config = monitorConfig(input, monitor);
        if (input.url !== undefined) { try { await validateUrl(config.url); } catch { throw new RunError('Use a reachable public HTTP(S) website.', { status: 400 }); } }
        const changedScope = config.scope !== monitor.scope;
        let baselineScanId = changedScope ? null : monitor.baselineScanId;
        if (input.baselineMode === 'previous' && !changedScope) {
          const latest = [...monitor.runs].reverse().map(entry => scans.get('scan', entry.scanId)).find(run => run && completeEvidence(run) && scopeIdentity(run) === config.scope);
          if (latest) baselineScanId = latest.scanId;
        }
        if (input.baselineScanId !== undefined) { if (input.baselineScanId !== null && typeof input.baselineScanId !== 'string') throw new RunError('Invalid baseline scan ID.', { status: 400 }); baselineScanId = input.baselineScanId; if (baselineScanId) assertBaseline(scans.get('scan', baselineScanId), config); }
        return save({ ...monitor, ...config, version: monitor.version + 1, baselineScanId, migrationError: null,
          ...(changedScope ? { lastSuccessfulScanId: null, score: null, openIssues: null, lastRunAt: null, lastStatus: null, failureNotified: false } : {}), scheduleStatus: 'pending', scheduleError: null });
      });
      return publicMonitor(await reconcileOne(id));
    },
    async remove(id) {
      await initialize();
      const monitor = await store.edit(id, async (current, save) => { requireMonitor(current); return save({ ...current, active: false, deleted: true, version: current.version + 1, deletedAt: new Date().toISOString(), scheduleStatus: 'pending' }); });
      if (monitor.pendingScanId) {
        if (scans.get('scan', monitor.pendingScanId)) await runs.cancel('scan', monitor.pendingScanId).catch(() => {});
        else await pendingTerminal(monitor, 'cancelled');
        await finalize(monitor.pendingScanId);
      }
      await reconcileOne(id); return { message: 'Monitor deleted successfully.', deleted: true, historyPreserved: true };
    },
    async runNow(id) { return trigger(id, `manual-${randomUUID()}`, null, true); },
    async history(id, page = 1) {
      await initialize(); const monitor = requireMonitor(store.get(id), true);
      const all = [...monitor.runs].reverse();
      if (monitor.pendingScanId) { const run = scans.get('scan', monitor.pendingScanId); all.unshift({ scanId: monitor.pendingScanId, status: run?.status || 'awaiting-enqueue', createdAt: run?.createdAt || monitor.pending?.createdAt, progress: run?.progress, stage: run?.stage }); }
      return { runs: all.slice((page - 1) * 20, page * 20), page, total: all.length, baselineScanId: monitor.baselineScanId, baselineMode: monitor.baselineMode };
    },
    async comparison(id, scanId) { await initialize(); const monitor = requireMonitor(store.get(id), true); if (!monitor.runs.some(run => run.scanId === scanId)) throw new RunError('Monitor run not found.', { status: 404 }); return scans.get('scan', scanId)?.comparison || null; },
    async notifications(page = 1, unread = false) { await initialize(); const all = store.list().flatMap(m => m.notifications).filter(n => !unread || !n.readAt).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); return { notifications: all.slice((page - 1) * 50, page * 50), unreadCount: store.list().flatMap(m => m.notifications).filter(n => !n.readAt).length, total: all.length, page }; },
    async markRead(id, notificationId, read) { await initialize(); return store.edit(id, async (monitor, save) => { requireMonitor(monitor, true); if (typeof read !== 'boolean') throw new RunError('read must be boolean.', { status: 400 }); if (!monitor.notifications.some(n => n.id === notificationId)) throw new RunError('Notification not found.', { status: 404 }); await save({ ...monitor, notifications: monitor.notifications.map(n => n.id === notificationId ? { ...n, readAt: read ? new Date().toISOString() : null } : n) }); return { id: notificationId, read }; }); },
    async runtimeStatus() { try { const queue = await queueProvider(), value = await (await queue.getBackend().client).get(queue.toKey('heartbeat')); return { queueAvailable: true, workerOnline: Boolean(value && Date.now() - Number(value) < 45000), lastHeartbeatAt: value ? new Date(Number(value)).toISOString() : null }; } catch { return { queueAvailable: false, workerOnline: false, lastHeartbeatAt: null }; } },
    async maintain() {
      await initialize();
      for (const monitor of store.list()) {
        if (monitor.pendingScanId) {
          const run = scans.get('scan', monitor.pendingScanId);
          if (run && terminalStates.has(run.status)) await finalize(run.scanId);
          else if (monitor.deleted && run) await runs.cancel('scan', run.scanId).catch(() => {});
          else if (monitor.deleted && !run) { await pendingTerminal(monitor, 'cancelled'); await finalize(monitor.pendingScanId); }
          else if (!run || run.status === 'queued') await store.edit(monitor.id, async (current, save) => {
            if (!current.pendingScanId || current.deleted) return;
            await attemptEnqueue(current, save);
          });
        }
        if (monitor.pendingScanId && terminalStates.has(scans.get('scan', monitor.pendingScanId)?.status)) await finalize(monitor.pendingScanId);
        await reconcileOne(monitor.id);
      }
      const queue = await queueProvider();
      const desired = new Set(store.list().filter(m => !m.deleted && m.active && !m.migrationError).map(m => schedulerId(m.id)));
      for (const item of await queue.getJobSchedulers(0, -1)) if (item.key.startsWith('audit-') && !desired.has(item.key)) {
        const id = item.key.slice(6);
        if (!/^mon-[a-zA-Z0-9-]{1,100}$/.test(id)) { await queue.removeJobScheduler(item.key); continue; }
        await store.edit(id, async current => { if (!current || current.deleted || !current.active || current.migrationError) await queue.removeJobScheduler(item.key); });
      }
      await (await queue.getBackend().client).set(queue.toKey('heartbeat'), String(Date.now()), { EX: 45 });
    },
  };
}
export const monitorService = createMonitorService();
