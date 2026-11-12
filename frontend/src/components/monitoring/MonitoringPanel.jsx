import { useEffect, useRef, useState } from 'react';
import { CalendarClock, RefreshCw } from 'lucide-react';
import PageHeader, { PageSections } from '../layout/PageHeader.jsx';
import MonitorForm, { monitorButton, monitorPanel } from './MonitorForm.jsx';
import MonitorHistory from './MonitorHistory.jsx';
import { listMonitors, createMonitor, updateMonitor, deleteMonitor, runMonitor, monitorStatus, monitorHistory, monitorComparison, listNotifications, markNotificationRead } from '../../services/monitorService.js';
import { getScan } from '../../services/scanService.js';
const localDate = (value, timeZone) => value ? new Date(value).toLocaleString(undefined, timeZone ? { timeZone } : undefined) : 'Not scheduled';
export default function MonitoringPanel({ onNavigate, onLoadScan }) {
  const [monitors, setMonitors] = useState([]), [runtime, setRuntime] = useState(null), [notices, setNotices] = useState(null);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState(''), [editing, setEditing] = useState(null);
  const [selected, setSelected] = useState(''), [history, setHistory] = useState(null), [comparison, setComparison] = useState(null), [unread, setUnread] = useState(false), [noticePage, setNoticePage] = useState(1);
  const state = useRef({ selected: '', historyPage: 1, noticePage: 1, unread: false }), live = useRef(true), refreshing = useRef(null);
  state.current.selected = selected; state.current.noticePage = noticePage; state.current.unread = unread;
  function refresh() {
    if (refreshing.current) return refreshing.current;
    const request = (async () => {
    try {
      const current = { ...state.current };
      const [items, status, notifications, runs] = await Promise.all([listMonitors(), monitorStatus(), listNotifications(current.noticePage, current.unread), current.selected ? monitorHistory(current.selected, current.historyPage) : null]);
      if (!live.current) return;
      setMonitors(items); setRuntime(status); setNotices(notifications);
      if (state.current.selected === current.selected) setHistory(runs);
      setError('');
    } catch (failure) { if (live.current) setError(failure.userMessage || failure.message || 'Monitoring is unavailable.'); }
    finally { refreshing.current = null; if (live.current) setLoading(false); }
    })();
    refreshing.current = request;
    return request;
  }
  useEffect(() => { live.current = true; refresh(); const timer = setInterval(refresh, 10000); return () => { live.current = false; clearInterval(timer); }; }, []);
  useEffect(() => { if (!loading) refresh(); }, [selected, unread, noticePage]);
  async function action(work) { setBusy(true); setError(''); try { await work(); if (refreshing.current) await refreshing.current; await refresh(); return true; } catch (failure) { setError(failure.userMessage || failure.message); return false; } finally { if (live.current) setBusy(false); } }
  async function openScan(id) { const scan = await getScan(id); onLoadScan?.(scan); }
  const current = monitors.find(m => m.id === selected);
  return <div className="page-stack text-zinc-900 dark:text-zinc-100">
    <PageHeader title="Continuous monitoring" description="Schedule real audits, compare findings against a baseline, and track accessibility regressions." category="Monitoring" icon={CalendarClock} onNavigate={onNavigate} actions={<button type="button" className={monitorButton} disabled={busy || loading} onClick={() => action(async () => {})}><RefreshCw size={16} />Refresh</button>} />
    <PageSections items={[["monitor-create", "Schedule an audit"], ["monitor-sites", "Monitored websites"], ...(current ? [["monitor-history", "Scan history"]] : []), ["monitor-notifications", "Notifications"]]} />
    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">{error}</p>}
    {loading && <p role="status" className="text-sm text-zinc-500">Loading monitoring data…</p>}
    {runtime && !runtime.workerOnline && <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">{runtime.queueAvailable ? 'The monitoring worker is offline or has not reported readiness. Saved schedules will wait for it to resume.' : 'Redis is unavailable. Schedule changes remain pending until the queue recovers.'}</p>}
    <div className="grid gap-4 sm:grid-cols-3">{[['Monitored websites', monitors.length], ['Enabled schedules', monitors.filter(m => m.active).length], ['Unread notifications', notices?.unreadCount ?? '—']].map(([label, value]) => <article key={label} className={monitorPanel}><p className="text-xs text-zinc-500">{label}</p><p className="text-3xl font-bold tabular-nums">{loading ? '—' : value}</p></article>)}</div>
    <MonitorForm editing={editing} busy={busy} serverError={error} onCancel={() => setEditing(null)} onSave={(config, id) => action(async () => { if (id) await updateMonitor(id, config); else await createMonitor(config); setEditing(null); })} />
    <section id="monitor-sites" className={monitorPanel}>
      <h2 className="text-lg font-bold">Monitored websites</h2>
      {!loading && !error && !monitors.length && <p className="text-sm text-zinc-500">No monitors configured. Add a website to schedule its first accessibility audit.</p>}
      {monitors.map(monitor => <article key={monitor.id} aria-label={`Monitor ${monitor.url}`} className="space-y-4 rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
        <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="break-all text-sm font-bold">{monitor.url || 'Legacy monitor needs configuration'}</h3><span className="text-xs font-semibold text-accent-700 dark:text-accent-300">{!monitor.active ? 'Paused' : monitor.scheduleStatus === 'scheduled' ? 'Scheduled' : 'Pending synchronization'}</span></div>
        <p className="text-xs leading-6 text-zinc-500">{monitor.frequency} at {monitor.time} ({monitor.timeZone}){monitor.frequency === 'weekly' ? ` · ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][monitor.weekday]}` : ''} · up to {monitor.maxPages} page(s), depth {monitor.maxDepth}</p>
        <p className="text-xs text-zinc-500">Next: {localDate(monitor.nextRunAt, monitor.timeZone)} · Last run: {monitor.lastRunAt ? localDate(monitor.lastRunAt) : 'Not run yet'}</p>
        {monitor.lastSuccessfulScanId && <p className="text-xs text-zinc-500">Last completed scan: {monitor.score ?? '—'}/100 project estimate · {monitor.openIssues ?? '—'} occurrence(s)</p>}
        {monitor.pendingRun && <p role="status" className="text-sm">{monitor.pendingRun.status} · {monitor.pendingRun.stage}{monitor.pendingRun.progress?.totalPages ? ` · ${monitor.pendingRun.progress.completedPages} of ${monitor.pendingRun.progress.totalPages} pages checked` : ''}</p>}
        {(monitor.scheduleError || monitor.enqueueError || monitor.migrationError) && <p className="text-sm text-amber-700 dark:text-amber-300">{monitor.scheduleError || monitor.enqueueError || monitor.migrationError}</p>}
        <div className="flex flex-wrap gap-2"><button type="button" className={monitorButton} disabled={busy} onClick={() => action(() => updateMonitor(monitor.id, { active: !monitor.active }))}>{monitor.active ? 'Pause' : 'Resume'}</button><button type="button" className={monitorButton} disabled={busy || Boolean(monitor.pendingRun) || Boolean(monitor.migrationError)} onClick={() => action(() => runMonitor(monitor.id))}>Run now</button><button type="button" className={monitorButton} disabled={busy} onClick={() => action(async () => { state.current.historyPage = 1; state.current.selected = monitor.id; setSelected(monitor.id); setComparison(null); setHistory(await monitorHistory(monitor.id, 1)); })}>View history</button><button type="button" className={monitorButton} disabled={busy} onClick={() => { setEditing(monitor); document.getElementById('monitor-create')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>Edit schedule</button><button type="button" className={`${monitorButton} text-red-600`} disabled={busy} onClick={() => action(async () => { await deleteMonitor(monitor.id); if (selected === monitor.id) { setSelected(''); state.current.selected = ''; setHistory(null); setComparison(null); } if (editing?.id === monitor.id) setEditing(null); })}>Delete monitor</button></div>
      </article>)}
      <p className="text-xs leading-6 text-zinc-500">Pausing stops future scheduled triggers; an already requested audit can finish. Deleting a monitor requests cancellation of its pending audit and preserves scan evidence. Automated checks do not establish WCAG conformance.</p>
    </section>
    <MonitorHistory monitor={current} data={history} comparison={comparison} busy={busy} onPage={page => action(async () => { state.current.historyPage = page; setHistory(await monitorHistory(selected, page)); })} onOpen={id => action(() => openScan(id))} onCompare={id => action(async () => setComparison(await monitorComparison(selected, id)))} onBaseline={id => action(() => updateMonitor(selected, { baselineScanId: id, baselineMode: 'fixed' }))} />
    <section id="monitor-notifications" className={monitorPanel}>
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-bold">Notifications</h2><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={unread} onChange={event => { setNoticePage(1); setUnread(event.target.checked); }} />Unread only</label></div>
      <p className="text-xs text-zinc-500">In-app alerts for newly introduced or worsened findings and scan failures. Repeated unchanged regressions do not create duplicate alerts.</p>
      {notices && !notices.notifications.length && <p className="text-sm text-zinc-500">No notifications.</p>}
      {notices?.notifications.map(notice => <article key={notice.id} className="space-y-2 rounded-xl border border-zinc-200 p-4 dark:border-zinc-700"><div className="flex flex-wrap justify-between gap-2"><p className="text-sm font-semibold">{notice.type === 'regression' ? 'Accessibility regression' : 'Audit failed'}{!notice.readAt ? ' · Unread' : ''}</p><span className="text-xs text-zinc-500">{localDate(notice.createdAt)}</span></div><p className="text-sm">{notice.message}</p><p className="break-all text-xs text-zinc-500">{notice.url}</p><div className="flex flex-wrap gap-2"><button type="button" className={monitorButton} disabled={busy} onClick={() => action(() => openScan(notice.scanId))}>View notified scan</button><button type="button" className={monitorButton} disabled={busy} onClick={() => action(() => markNotificationRead(notice, !notice.readAt))}>{notice.readAt ? 'Mark unread' : 'Mark read'}</button></div></article>)}
      {notices?.total > 50 && <div className="flex gap-3"><button type="button" className={monitorButton} disabled={busy || noticePage <= 1} onClick={() => setNoticePage(p => p - 1)}>Newer notifications</button><button type="button" className={monitorButton} disabled={busy || noticePage * 50 >= notices.total} onClick={() => setNoticePage(p => p + 1)}>Older notifications</button></div>}
    </section>
  </div>;
}
