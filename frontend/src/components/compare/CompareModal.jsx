import { useEffect, useState } from 'react';
import {
  X,
  ArrowDownUp,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  AlertTriangle,
  Minus,
  Globe2,
  Calendar,
  Layers,
} from 'lucide-react';
import { listScans } from '../../services/scanService.js';

export default function CompareModal({
  open,
  currentScan,
  currentIssues = [],
  onClose,
  onLoadScan,
}) {
  const [scans, setScans] = useState([]);
  const [selectedScanId, setSelectedScanId] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    async function load() {
      setLoading(true);
      try {
        const data = await listScans();
        const past = Array.isArray(data) ? data : [];
        setScans(past);
        // Default to the most recent different scan
        const other = past.find((s) => s.scanId !== currentScan?.scanId);
        if (other) {
          setSelectedScanId(other.scanId);
        }
      } catch {
        setScans([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [open, currentScan]);

  if (!open) return null;

  const baselineScan = scans.find((s) => s.scanId === selectedScanId);
  const baselineIssues = baselineScan?.issues || [];

  // Fingerprint calculation (rule + selector)
  const currentFingerprints = new Set(
    currentIssues.map((i) => `${i.rule}:::${i.selector}`)
  );
  const baselineFingerprints = new Set(
    baselineIssues.map((i) => `${i.rule}:::${i.selector}`)
  );

  // Classify issues
  const fixedIssues = baselineIssues.filter(
    (i) => !currentFingerprints.has(`${i.rule}:::${i.selector}`)
  );

  const newRegressions = currentIssues.filter(
    (i) => !baselineFingerprints.has(`${i.rule}:::${i.selector}`)
  );

  const persistentIssues = currentIssues.filter((i) =>
    baselineFingerprints.has(`${i.rule}:::${i.selector}`)
  );

  const currentScore = currentScan?.score ?? 100;
  const baselineScore = baselineScan?.score ?? 100;
  const scoreDiff = baselineScan ? currentScore - baselineScore : 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="compare-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-5 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400">
              <ArrowDownUp size={20} strokeWidth={2} />
            </div>
            <div>
              <h2
                id="compare-modal-title"
                className="text-[17px] font-extrabold text-zinc-900 dark:text-zinc-100"
              >
                Scan Comparison & Regression Tracker
              </h2>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Compare current audit findings against a baseline scan to identify regressions and resolved violations.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close comparison"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scan Selector Bar */}
        <div className="border-b border-zinc-100 bg-zinc-50/70 px-6 py-3.5 dark:border-zinc-800 dark:bg-zinc-800/40">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-semibold text-zinc-700 dark:text-zinc-300">
                Compare Current Scan with Baseline:
              </span>
              <select
                value={selectedScanId}
                onChange={(e) => setSelectedScanId(e.target.value)}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-[12px] font-medium text-zinc-800 shadow-sm outline-none transition-colors focus:border-orange-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
              >
                {scans.length === 0 && <option value="">No previous scans found</option>}
                {scans.map((s) => (
                  <option key={s.scanId} value={s.scanId}>
                    {s.startUrl} · {new Date(s.createdAt || Date.now()).toLocaleDateString()} (Score {s.score ?? '—'})
                  </option>
                ))}
              </select>
            </div>

            {baselineScan && (
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Baseline Scan ID: <code className="font-mono text-[10px]">{baselineScan.scanId}</code>
              </span>
            )}
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {baselineScan ? (
            <>
              {/* Score Metric Comparison Cards */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-4 dark:border-zinc-700 dark:bg-zinc-800/40">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Baseline Score
                  </span>
                  <div className="mt-2 text-2xl font-black text-zinc-800 dark:text-zinc-100">
                    {baselineScore} / 100
                  </div>
                  <span className="text-[10px] text-zinc-400">
                    {baselineIssues.length} violation types
                  </span>
                </div>

                <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-4 dark:border-zinc-700 dark:bg-zinc-800/40">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Current Score
                  </span>
                  <div className="mt-2 text-2xl font-black text-zinc-800 dark:text-zinc-100">
                    {currentScore} / 100
                  </div>
                  <span className="text-[10px] text-zinc-400">
                    {currentIssues.length} violation types
                  </span>
                </div>

                <div
                  className={`rounded-xl border p-4 ${
                    scoreDiff > 0
                      ? 'border-emerald-200 bg-emerald-50/50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-300'
                      : scoreDiff < 0
                      ? 'border-red-200 bg-red-50/50 text-red-800 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300'
                      : 'border-zinc-200 bg-zinc-50/50 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800/40 dark:text-zinc-300'
                  }`}
                >
                  <span className="text-[11px] font-bold uppercase tracking-wider">
                    Score Progression
                  </span>
                  <div className="mt-2 flex items-center gap-2 text-2xl font-black">
                    {scoreDiff > 0 ? (
                      <>
                        <TrendingUp size={24} className="text-emerald-600 dark:text-emerald-400" />
                        <span>+{scoreDiff} pts</span>
                      </>
                    ) : scoreDiff < 0 ? (
                      <>
                        <TrendingDown size={24} className="text-red-600 dark:text-red-400" />
                        <span>{scoreDiff} pts</span>
                      </>
                    ) : (
                      <>
                        <Minus size={24} />
                        <span>0 pts (No change)</span>
                      </>
                    )}
                  </div>
                  <span className="text-[10px]">
                    {scoreDiff > 0
                      ? 'Accessibility improved!'
                      : scoreDiff < 0
                      ? 'Regressions detected'
                      : 'Consistent compliance'}
                  </span>
                </div>
              </div>

              {/* Status Breakdown Lists */}
              <div className="space-y-4">
                {/* 1. Resolved / Fixed Issues */}
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-4 dark:border-emerald-900/30 dark:bg-emerald-950/10">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-[13px] font-bold text-emerald-800 dark:text-emerald-300">
                      <CheckCircle2 size={16} className="text-emerald-600" />
                      Resolved Violations ({fixedIssues.length})
                    </span>
                    <span className="text-[11px] text-emerald-700 dark:text-emerald-400">
                      Fixed since baseline
                    </span>
                  </div>
                  {fixedIssues.length > 0 ? (
                    <ul className="mt-3 space-y-2">
                      {fixedIssues.map((issue, idx) => (
                        <li
                          key={idx}
                          className="flex items-center justify-between rounded-lg bg-white p-2.5 text-[11px] shadow-sm dark:bg-zinc-800"
                        >
                          <div className="min-w-0 flex-1">
                            <span className="font-bold text-zinc-900 dark:text-zinc-100">
                              {issue.title}
                            </span>
                            <div className="mt-0.5 font-mono text-[10px] text-zinc-400">
                              {issue.selector}
                            </div>
                          </div>
                          <span className="rounded bg-emerald-100 px-2 py-0.5 text-[9px] font-bold uppercase text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
                            Fixed
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-[11px] text-zinc-400">
                      No issues resolved between these scans.
                    </p>
                  )}
                </div>

                {/* 2. New Regressions */}
                <div className="rounded-xl border border-red-200 bg-red-50/30 p-4 dark:border-red-900/30 dark:bg-red-950/10">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-[13px] font-bold text-red-800 dark:text-red-300">
                      <AlertTriangle size={16} className="text-red-600" />
                      New Regressions ({newRegressions.length})
                    </span>
                    <span className="text-[11px] text-red-700 dark:text-red-400">
                      Issues introduced after baseline
                    </span>
                  </div>
                  {newRegressions.length > 0 ? (
                    <ul className="mt-3 space-y-2">
                      {newRegressions.map((issue, idx) => (
                        <li
                          key={idx}
                          className="flex items-center justify-between rounded-lg bg-white p-2.5 text-[11px] shadow-sm dark:bg-zinc-800"
                        >
                          <div className="min-w-0 flex-1">
                            <span className="font-bold text-zinc-900 dark:text-zinc-100">
                              {issue.title}
                            </span>
                            <div className="mt-0.5 font-mono text-[10px] text-zinc-400">
                              {issue.selector}
                            </div>
                          </div>
                          <span className="rounded bg-red-100 px-2 py-0.5 text-[9px] font-bold uppercase text-red-800 dark:bg-red-900/50 dark:text-red-300">
                            Regression
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-[11px] text-zinc-400">
                      Zero new regressions! No new barriers introduced.
                    </p>
                  )}
                </div>

                {/* 3. Persistent Unresolved Issues */}
                <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-4 dark:border-zinc-700 dark:bg-zinc-800/30">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-bold text-zinc-800 dark:text-zinc-200">
                      Persistent Unresolved Issues ({persistentIssues.length})
                    </span>
                    <span className="text-[11px] text-zinc-400">
                      Present in both scans
                    </span>
                  </div>
                  {persistentIssues.length > 0 ? (
                    <ul className="mt-3 space-y-2">
                      {persistentIssues.slice(0, 5).map((issue, idx) => (
                        <li
                          key={idx}
                          className="flex items-center justify-between rounded-lg bg-white p-2.5 text-[11px] shadow-sm dark:bg-zinc-800"
                        >
                          <span className="truncate font-medium text-zinc-700 dark:text-zinc-300">
                            {issue.title}
                          </span>
                          <span className="font-mono text-[10px] text-zinc-400">
                            {issue.rule}
                          </span>
                        </li>
                      ))}
                      {persistentIssues.length > 5 && (
                        <p className="text-center text-[10px] text-zinc-400 pt-1">
                          + {persistentIssues.length - 5} additional persistent issues
                        </p>
                      )}
                    </ul>
                  ) : (
                    <p className="mt-2 text-[11px] text-zinc-400">
                      No persistent issues.
                    </p>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex min-h-[200px] flex-col items-center justify-center text-center">
              <Globe2 size={32} className="text-zinc-400" />
              <p className="mt-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                Run another scan to compare
              </p>
              <p className="mt-1 text-xs text-zinc-400">
                You need at least two scans saved in your history to run comparisons.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-zinc-100 bg-zinc-50 px-6 py-4 dark:border-zinc-800 dark:bg-zinc-800/60">
          <span className="text-[11px] text-zinc-400">
            Comparisons use normalized WCAG rule fingerprints and DOM target selectors.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-zinc-900 px-5 py-2 text-[12px] font-bold text-white shadow-sm hover:bg-zinc-800 dark:bg-orange-600 dark:hover:bg-orange-500"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
