import { useEffect, useRef, useState } from 'react';
import { normalizeWebsiteUrl } from '../../utils/websiteUrl.js';
export const fieldStyle = 'w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100';
export const monitorButton = 'inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-300 px-3 py-2 text-xs font-semibold hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800';
export const monitorPanel = 'workspace-panel space-y-5 rounded-2xl border border-zinc-200 bg-white p-5 sm:p-7 dark:border-zinc-800 dark:bg-zinc-900';
const defaults = () => ({ url: '', frequency: 'weekly', time: '09:00', timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', weekday: 1, maxPages: 1, maxDepth: 1, alerts: true, active: true, baselineMode: 'fixed' });
const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export default function MonitorForm({ editing, busy, onSave, onCancel, serverError }) {
  const [saved, setSaved] = useState(false);
  const [urlError, setUrlError] = useState('');
  const urlField = useRef(null);
  const [value, setValue] = useState(defaults);
  useEffect(() => { const base = defaults(); setUrlError(''); setSaved(false); setValue(editing ? Object.fromEntries(Object.keys(base).map(key => [key, editing[key] ?? base[key]])) : base); }, [editing]);
  const change = (key, next) => { setSaved(false); setValue(previous => ({ ...previous, [key]: next })); };
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    let normalized;
    try { normalized = normalizeWebsiteUrl(value.url); }
    catch (error) { setUrlError(error.message); urlField.current?.focus(); return; }
    setUrlError(''); change('url', normalized);
    if (await onSave({ ...value, url: normalized }, editing?.id)) { if (!editing) setValue(defaults()); setSaved(true); }
  }
  return <section id="monitor-create" className={monitorPanel}>
    <h2 className="text-lg font-bold">{editing ? 'Edit audit schedule' : 'Schedule a website audit'}</h2>
    <p className="text-sm leading-6 text-zinc-500">Choose a local time and time zone. The first complete audit establishes a baseline unless you select one from scan history.</p>
    <form onSubmit={submit} className="space-y-4">
      <label className="block space-y-2 text-sm"><span>Website URL</span><input ref={urlField} type="text" inputMode="url" autoComplete="url" autoCapitalize="none" spellCheck={false} maxLength={2048} aria-describedby={urlError ? "monitor-url-help monitor-url-error" : "monitor-url-help"} aria-invalid={Boolean(urlError)} required disabled={busy} aria-label="Monitor website URL" placeholder="www.example.com or https://example.com" className={fieldStyle} value={value.url} onChange={event => { change('url', event.target.value); setUrlError(''); }} /></label>
      <p id="monitor-url-help" className="text-xs text-zinc-500 dark:text-zinc-400">Accepts example.com, www.example.com, or a full URL. HTTPS is added when missing.</p>
      {urlError && <p id="monitor-url-error" role="alert" className="text-sm text-red-700 dark:text-red-300">{urlError}</p>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="space-y-2 text-sm"><span>Frequency</span><select aria-label="Scan frequency" className={fieldStyle} value={value.frequency} disabled={busy} onChange={event => change('frequency', event.target.value)}><option value="daily">Daily</option><option value="weekly">Weekly</option></select></label>
        <label className="space-y-2 text-sm"><span>Local scan time</span><input aria-label="Local scan time" type="time" required disabled={busy} className={fieldStyle} value={value.time} onChange={event => change('time', event.target.value)} /></label>
        <label className="space-y-2 text-sm"><span>Time zone</span><input aria-label="Schedule time zone" required disabled={busy} className={fieldStyle} value={value.timeZone} onChange={event => change('timeZone', event.target.value)} placeholder="Asia/Kolkata" /></label>
        {value.frequency === 'weekly' && <label className="space-y-2 text-sm"><span>Weekday</span><select aria-label="Schedule weekday" disabled={busy} className={fieldStyle} value={value.weekday} onChange={event => change('weekday', Number(event.target.value))}>{days.map((name, index) => <option value={index} key={name}>{name}</option>)}</select></label>}
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="space-y-2 text-sm"><span>Maximum pages</span><input aria-label="Maximum audit pages" type="number" min={1} max={50} required disabled={busy} className={fieldStyle} value={value.maxPages} onChange={event => change('maxPages', Number(event.target.value))} /></label>
        <label className="space-y-2 text-sm"><span>Crawl depth</span><input aria-label="Maximum crawl depth" type="number" min={0} max={3} required disabled={busy} className={fieldStyle} value={value.maxDepth} onChange={event => change('maxDepth', Number(event.target.value))} /></label>
        <label className="space-y-2 text-sm"><span>Baseline policy</span><select aria-label="Baseline policy" disabled={busy} className={fieldStyle} value={value.baselineMode} onChange={event => change('baselineMode', event.target.value)}><option value="fixed">Fixed baseline</option><option value="previous">Previous complete run</option></select></label>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={value.alerts} disabled={busy} onChange={event => change('alerts', event.target.checked)} />Notify me in this app about new regressions and scan failures</label>
      {serverError && <p id="monitor-save-error" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">{serverError}</p>}
      {saved && !serverError && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">Monitor saved. Check Monitored websites below for the next audit time, or choose Run now to start an audit immediately.</p>}
      <div className="flex flex-wrap gap-3"><button aria-describedby={serverError ? "monitor-save-error" : undefined} type="submit" disabled={busy} className="rounded-xl bg-accent-600 px-5 py-3 text-sm font-semibold text-white hover:bg-accent-700 disabled:opacity-50">{busy ? 'Saving…' : editing ? 'Save monitor' : 'Add monitor'}</button>{editing && <button type="button" disabled={busy} onClick={onCancel} className={monitorButton}>Cancel editing</button>}</div>
    </form>
  </section>;
}
