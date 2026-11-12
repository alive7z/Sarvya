import { AlertTriangle, LoaderCircle, CheckCircle2, Clock3, Square, XCircle } from 'lucide-react';
const active = ['submitting', 'queued', 'processing', 'retrying', 'cancelling'];
const labels = { submitting: 'Submitting scan', queued: 'Scan queued', processing: 'Scanning website', retrying: 'Retry scheduled', cancelling: 'Stopping scan', completed: 'Scan completed', failed: 'Scan failed', cancelled: 'Scan cancelled' };
const stages = { queued: 'Waiting for a worker.', starting: 'Starting a browser worker.', discovery: 'Discovering pages on this origin.', navigation: 'Loading a page.', 'accessibility-analysis': 'Running axe-core accessibility checks.', 'preview-capture': 'Capturing preview and element metadata.', 'page-completed': 'Page checks completed.', saving: 'Saving scan results.', retrying: 'A temporary error occurred. Waiting for exponential backoff.', cancelling: 'Cancellation requested. Waiting for browser resources to close.', cancelled: 'The run was cancelled.', completed: 'Results are ready for review.' };
export default function ScanProgress({ state, error, progress, stage, attempt, maxAttempts, onCancel, cancelPending, demo }) {
  if (state === 'idle' && !error) return null;
  const busy = active.includes(state);
  const completedPages = progress?.completedPages || 0;
  const totalPages = progress?.totalPages;
  const percent = totalPages ? Math.min(100, Math.round(completedPages / totalPages * 100)) : null;
  const Icon = state === 'failed' ? AlertTriangle : state === 'completed' ? CheckCircle2 : state === 'cancelled' ? XCircle : state === 'queued' || state === 'retrying' ? Clock3 : LoaderCircle;
  return (
    <div className="space-y-3 px-5 py-4 sm:px-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <Icon size={17} className={`mt-0.5 shrink-0 text-accent-600 dark:text-accent-400 ${busy && !['queued', 'retrying'].includes(state) ? 'animate-spin' : ''}`} />
          <div role="status" aria-live="polite">
            <p className="text-[12px] font-semibold text-zinc-800 dark:text-zinc-100">{labels[state] || 'Scan status'}{attempt > 0 ? ` · attempt ${attempt} of ${maxAttempts || 1}` : ''}</p>
            <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">{stages[stage || state] || (state === 'submitting' ? 'Validating the target and requesting a queue slot.' : '')}</p>
          </div>
        </div>
        {busy && onCancel && <button type="button" onClick={onCancel} disabled={cancelPending} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-[12px] text-zinc-700 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"><Square size={13} />{cancelPending ? 'Cancelling…' : 'Cancel scan'}</button>}
      </div>
      {progress && <div className="space-y-2">
        <p className="text-[11px] tabular-nums text-zinc-600 dark:text-zinc-300">{totalPages ? `${completedPages} of ${totalPages} pages checked` : `${progress.discoveredPages || 0} pages discovered${progress.crawledPages ? ` · ${progress.crawledPages} visited` : ''}`}{progress.failedPages ? ` · ${progress.failedPages} failed` : ''}</p>
        {percent !== null && <div role="progressbar" aria-label="Pages checked" aria-valuemin={0} aria-valuemax={totalPages} aria-valuenow={completedPages} className="h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700"><div className="h-full bg-accent-600 transition-[width] duration-200" style={{ width: `${percent}%` }} /></div>}
      </div>}
      {error && <p role="alert" className="break-words text-[12px] text-red-700 dark:text-red-300">{error}</p>}
      {demo && <p className="text-[10px] text-zinc-500 dark:text-zinc-400">Sample data is separate from live scans.</p>}
    </div>
  );
}
