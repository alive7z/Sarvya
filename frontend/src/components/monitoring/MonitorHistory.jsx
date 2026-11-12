import { monitorButton, monitorPanel } from './MonitorForm.jsx';
const date = value => value ? new Date(value).toLocaleString() : '—';
export default function MonitorHistory({ monitor, data, comparison, busy, onPage, onOpen, onCompare, onBaseline }) {
  if (!monitor) return null;
  return <section id="monitor-history" className={monitorPanel} aria-label="Monitor scan history">
    <div><h2 className="text-lg font-bold">Scan history</h2><p className="mt-1 break-all text-sm text-zinc-500">{monitor.url}</p></div>
    <p className="break-all text-xs leading-6 text-zinc-500">{monitor.baselineScanId ? `Baseline: ${monitor.baselineScanId} · ${monitor.baselineMode === 'previous' ? 'previous complete run' : 'fixed'}` : 'No baseline yet. A complete run will establish one.'}</p>
    {!data && <p role="status" className="text-sm text-zinc-500">Loading scan history…</p>}
    {data && !data.runs.length && <p className="text-sm text-zinc-500">No audits have run yet.</p>}
    <div className="space-y-4">{data?.runs.map(run => <article key={run.scanId} className="space-y-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
      <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold">{run.status} · {date(run.finishedAt || run.createdAt)}</p><span className="text-xs text-zinc-500">{run.trigger || run.stage || 'Audit'}</span></div>
      <p className="break-all font-mono text-[11px] text-zinc-500">{run.scanId}</p>
      {run.status === 'completed' && <p className="text-xs text-zinc-500">{run.pagesScanned} page(s) audited · {run.pagesFailed || 0} failed · {run.score ?? '—'}/100 project estimate</p>}
      {run.error && <p className="text-xs text-red-700 dark:text-red-300">{run.error}</p>}
      {run.comparison && <p className="text-sm">Compared with baseline: {run.comparison.new} new · {run.comparison.worsened} worsened · {run.comparison.resolved} resolved · {run.comparison.persistent} still present · {run.comparison.uncertain} uncertain</p>}
      <div className="flex flex-wrap gap-2"><button type="button" disabled={busy || run.status === 'awaiting-enqueue'} title={run.status === 'awaiting-enqueue' ? 'The scan record will be available after queueing.' : undefined} onClick={() => onOpen(run.scanId)} className={monitorButton}>View scan</button>{run.comparison && <button type="button" disabled={busy} onClick={() => onCompare(run.scanId)} className={monitorButton}>View comparison</button>}{run.baselineEligible && run.scope === monitor.scope && run.scanId !== monitor.baselineScanId && <button type="button" disabled={busy} onClick={() => onBaseline(run.scanId)} className={monitorButton}>Use as fixed baseline</button>}</div>
    </article>)}</div>
    {data?.total > 20 && <div className="flex items-center gap-3"><button type="button" className={monitorButton} disabled={busy || data.page <= 1} onClick={() => onPage(data.page - 1)}>Newer runs</button><span className="text-xs">Page {data.page}</span><button type="button" className={monitorButton} disabled={busy || data.page * 20 >= data.total} onClick={() => onPage(data.page + 1)}>Older runs</button></div>}
    {comparison && <div className="space-y-3 border-t border-zinc-200 pt-4 dark:border-zinc-700"><h3 className="font-semibold">Baseline comparison</h3><p className="break-all text-xs text-zinc-500">{comparison.baselineScanId} → {comparison.scanId}</p><p className="text-xs text-zinc-500">Only changes on pages audited in both snapshots can be confirmed. Unmatched or missing selector evidence remains uncertain.</p><div className="max-h-96 space-y-2 overflow-auto">{comparison.entries.length ? comparison.entries.map(entry => <article key={entry.key} className="rounded-lg bg-zinc-50 p-3 text-xs dark:bg-zinc-950"><p className="font-semibold">{entry.change}{entry.worsened ? ' · worsened' : ''} · {entry.rule} · {entry.impact}</p><p className="mt-1 break-all">{entry.url} · {entry.selector}</p><p className="mt-1 text-zinc-500">{entry.previousCount} → {entry.count} occurrence(s){entry.reason ? ` · ${entry.reason}` : ''}</p></article>) : <p className="text-sm text-zinc-500">No automated findings in either snapshot.</p>}</div></div>}
  </section>;
}
