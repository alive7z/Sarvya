
import {
  ChevronDown,
  Box,
  Link2,
  Play,
  X,
  ArrowUpRight,
  Layers3,
  LoaderCircle,
  ShieldCheck,
} from 'lucide-react';
import ScanProgress from './ScanProgress.jsx';

export default function ScanForm({
  url,
  onUrlChange,
  onSubmit,
  onCrawl,
  busy,
  demo,
  state,
  error,
}) {
  return (
    <section className="workspace-panel overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_4px_14px_rgba(0,0,0,0.035),0_14px_35px_rgba(0,0,0,0.035)] transition-shadow duration-300 hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-[0_5px_25px_rgba(0,0,0,0.18)]">
      <div className="px-5 pb-6 pt-6 sm:px-7 sm:pt-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3.5">
            <div className="scan-icon flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-accent-100 bg-accent-50 text-accent-600 dark:border-accent-900/40 dark:bg-accent-500/10 dark:text-accent-400">
              <Box size={22} strokeWidth={1.9} />
            </div>

            <div className="min-w-0">
              <h2 className="text-[20px] font-extrabold tracking-[-0.5px] text-zinc-900 dark:text-zinc-100">
                Start a website audit
              </h2>

              <p className="mt-1.5 text-[12px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                Enter a public website URL to inspect its accessibility.
              </p>
            </div>
          </div>

          <span
            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-[10px] font-bold tracking-[0.025em] ${
              demo
                ? 'border-accent-200 bg-accent-50 text-accent-700 dark:border-accent-900/50 dark:bg-accent-500/10 dark:text-accent-400'
                : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-500/10 dark:text-emerald-400'
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                demo ? 'bg-accent-500' : 'bg-emerald-500'
              }`}
            />

            {demo ? 'SAMPLE DATA' : 'API CONNECTED'}
          </span>
        </div>

        <form
          onSubmit={onSubmit}
          className="mt-7 flex flex-col gap-3 lg:flex-row lg:items-center"
        >
          <div className="group flex h-[52px] w-full min-w-0 shrink-0 items-center lg:flex-1 gap-3 rounded-xl border border-zinc-200 bg-zinc-50/60 px-4 transition-all duration-200 hover:border-zinc-300 focus-within:border-accent-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-accent-500/10 dark:border-zinc-700 dark:bg-zinc-800/60 dark:hover:border-zinc-600 dark:focus-within:border-accent-500 dark:focus-within:bg-zinc-800">
            <Link2
              size={19}
              strokeWidth={1.9}
              className="shrink-0 text-zinc-400 transition-colors duration-200 group-focus-within:text-accent-500 dark:text-zinc-500"
            />

            <input
              type="url"
              aria-label="Website URL"
              value={url}
              onChange={(e) => onUrlChange(e.target.value)}
              placeholder="https://example.com"
              autoComplete="url"
              className="h-full min-w-0 flex-1 border-0 bg-transparent text-[13px] font-medium text-zinc-800 outline-none placeholder:font-normal placeholder:text-zinc-400 focus:outline-none focus:ring-0 dark:text-zinc-100 dark:placeholder:text-zinc-500"
            />

            {url && (
              <button
                type="button"
                aria-label="Clear URL"
                title="Clear URL"
                onClick={() => onUrlChange('')}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition-all duration-200 hover:bg-zinc-200/70 hover:text-zinc-700 active:scale-95 dark:text-zinc-500 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
              >
                <X size={16} />
              </button>
            )}
          </div>

          <button
            type="submit"
            disabled={busy}
            className="group inline-flex h-[52px] shrink-0 items-center justify-center gap-2.5 rounded-xl bg-zinc-900 px-6 text-[14px] font-semibold text-white shadow-[0_4px_14px_rgba(0,0,0,0.12)] transition-all duration-200 hover:bg-zinc-800 hover:shadow-[0_8px_22px_rgba(0,0,0,0.18)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 dark:bg-accent-600 dark:hover:bg-accent-500"
          >
            {busy ? (
              <LoaderCircle size={17} className="animate-spin" />
            ) : (
              <Play size={16} fill="currentColor" />
            )}

            {busy ? 'Scanning...' : 'Scan website'}

            {!busy && (
              <ArrowUpRight
                size={15}
                className="transition-transform duration-200 group-hover:translate-x-0.5"
              />
            )}
          </button>

          <button
            type="button"
            onClick={onCrawl}
            className="group inline-flex h-[52px] shrink-0 items-center justify-center gap-2.5 rounded-xl border border-zinc-200 bg-white px-5 text-[14px] font-semibold text-zinc-700 shadow-sm transition-all duration-200 hover:border-accent-300 hover:bg-accent-50 hover:text-accent-600 hover:shadow-md active:scale-[0.99] dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:border-accent-800 dark:hover:bg-accent-500/10 dark:hover:text-accent-400"
          >
            <Layers3 size={17} />
            Scan all pages
            <ChevronDown
              size={15}
              className="text-zinc-400 transition-transform duration-200 group-hover:translate-y-0.5 group-hover:text-accent-500"
            />
          </button>
        </form>
      </div>

      <div className="border-t border-zinc-100 bg-zinc-50/60 dark:border-zinc-800 dark:bg-zinc-800/20">
        <ScanProgress
          state={state}
          error={error}
          demo={demo}
        />
      </div>
    </section>
  );
}
