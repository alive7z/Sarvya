import { Check, MoreHorizontal, AlertTriangle, ListChecks, ShieldCheck } from 'lucide-react';
import IssueCard from './IssueCard.jsx';
import IssueFilters from './IssueFilters.jsx';

export default function IssuePanel({
  className = '',
  issues = [],
  visibleIssues = [],
  activeId,
  expanded,
  query,
  onQueryChange,
  status,
  onStatusChange,
  severity,
  onSeverityChange,
  onSort,
  onSelect,
  onCopy,
  onIgnore,
  onAction,
  onVerify,
  onGenerateFix,
  viewMode = 'rules',
  onViewModeChange,
  totalNodesCount = 0,
  rulesCount = 0,
  scanState = 'idle',
}) {
  const severityCounts = [
    {
      label: 'Critical',
      severity: 'critical',
      color: 'bg-red-500',
      count: issues.filter((i) => i.severity === 'critical').length,
    },
    {
      label: 'Serious',
      severity: 'serious',
      color: 'bg-orange-500',
      count: issues.filter((i) => i.severity === 'serious').length,
    },
    {
      label: 'Moderate',
      severity: 'moderate',
      color: 'bg-amber-500',
      count: issues.filter((i) => i.severity === 'moderate').length,
    },
  ];

  return (
    <aside
      className={`flex h-[650px] min-w-0 flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_4px_14px_rgba(0,0,0,0.035),0_14px_35px_rgba(0,0,0,0.035)] transition-shadow duration-300 hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-[0_5px_25px_rgba(0,0,0,0.18)] sm:h-[680px] ${className}`}
      aria-label="Detected accessibility issues"
    >
      <div className="flex shrink-0 items-start justify-between gap-4 px-5 pb-5 pt-6 sm:px-6">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-orange-100 bg-orange-50 text-orange-600 dark:border-orange-900/40 dark:bg-orange-500/10 dark:text-orange-400">
            <ListChecks size={21} strokeWidth={1.9} />
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[17px] font-extrabold tracking-[-0.5px] text-zinc-900 dark:text-zinc-100">
                Detected issues
              </h2>

              <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-100 px-2 font-mono text-[11px] font-bold text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                {visibleIssues.length}
              </span>

              {/* View Mode Toggle: By Rule vs All Issues */}
              {totalNodesCount > 0 && (
                <div className="ml-1 inline-flex rounded-lg border border-zinc-200 bg-zinc-100 p-0.5 dark:border-zinc-700 dark:bg-zinc-800">
                  <button
                    type="button"
                    onClick={() => onViewModeChange?.('rules')}
                    className={`rounded-md px-2 py-0.5 text-[10px] font-bold transition-all ${
                      viewMode === 'rules'
                        ? 'bg-white text-orange-600 shadow-2xs dark:bg-zinc-900 dark:text-orange-400'
                        : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
                    }`}
                    title="Group issues by rule (with node switcher inside)"
                  >
                    By Rule ({rulesCount || issues.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => onViewModeChange?.('elements')}
                    className={`rounded-md px-2 py-0.5 text-[10px] font-bold transition-all ${
                      viewMode === 'elements'
                        ? 'bg-white text-orange-600 shadow-2xs dark:bg-zinc-900 dark:text-orange-400'
                        : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
                    }`}
                    title="View all individual failing elements (matches Total Issues count)"
                  >
                    All Issues ({totalNodesCount})
                  </button>
                </div>
              )}
            </div>

            <p className="mt-1 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
              {viewMode === 'elements'
                ? `Showing all ${visibleIssues.length} affected DOM elements with individual fixes`
                : `Grouped into ${visibleIssues.length} rules (${totalNodesCount} total affected elements)`}
            </p>
          </div>
        </div>

        <button
          type="button"
          aria-label="Issue panel options"
          title="Issue panel options"
          onClick={() =>
            onAction?.(
              viewMode === 'elements'
                ? 'Viewing all individual failing DOM elements.'
                : 'Viewing issues grouped by WCAG accessibility rule.'
            )
          }
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-500 transition-all duration-200 hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900 active:scale-95 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-white"
        >
          <MoreHorizontal size={19} />
        </button>
      </div>

      <div className="shrink-0">
        <IssueFilters
          query={query}
          onQueryChange={onQueryChange}
          status={status}
          onStatusChange={onStatusChange}
          severity={severity}
          onSeverityChange={onSeverityChange}
          onSort={onSort}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 [scrollbar-color:#d4d4d8_transparent] [scrollbar-width:thin] sm:px-4">
        {visibleIssues.length > 0 ? (
          <div className="space-y-3">
            {visibleIssues.map((issue, index) => (
              <IssueCard
                key={issue.id}
                issue={issue}
                index={index}
                selected={activeId === issue.id}
                expanded={expanded === issue.id}
                onSelect={() => onSelect(issue)}
                onInspect={(target) => onSelect(target || issue, true)}
                onCopy={() => onCopy(issue.fix)}
                onIgnore={() => onIgnore(issue)}
                onAction={onAction}
                onVerify={onVerify}
                onGenerateFix={onGenerateFix}
              />
            ))}
          </div>
        ) : (
          <div className="flex h-full min-h-[260px] flex-col items-center justify-center px-5 text-center">
            <div
              className={`flex h-16 w-16 items-center justify-center rounded-2xl border shadow-sm ${
                scanState === 'completed' && issues.length === 0
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-900/40 dark:bg-emerald-500/10 dark:text-emerald-400'
                  : issues.length
                  ? 'border-amber-100 bg-amber-50 text-amber-600 dark:border-amber-900/40 dark:bg-amber-500/10 dark:text-amber-400'
                  : 'border-zinc-200 bg-zinc-50 text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500'
              }`}
            >
              {scanState === 'completed' && issues.length === 0 ? (
                <ShieldCheck size={32} strokeWidth={2} />
              ) : issues.length ? (
                <Check size={28} strokeWidth={1.8} />
              ) : (
                <ListChecks size={28} strokeWidth={1.6} />
              )}
            </div>

            <h3 className="mt-5 text-[15px] font-bold tracking-tight text-zinc-800 dark:text-zinc-200">
              {scanState === 'completed' && issues.length === 0
                ? 'Flawless! 0 Accessibility Issues'
                : issues.length
                ? 'No matching issues'
                : 'No scan results yet'}
            </h3>

            <p className="mt-2 max-w-[290px] text-[12px] leading-6 text-zinc-500 dark:text-zinc-400">
              {scanState === 'completed' && issues.length === 0
                ? 'This webpage passed all automated WCAG 2.1 Level A & AA checks with zero detected barriers.'
                : issues.length
                ? 'No findings match your current filters. Try adjusting your search or filter options.'
                : 'Run an accessibility audit to discover and review issues across your website.'}
            </p>

            {scanState === 'completed' && issues.length === 0 && (
              <span className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                <Check size={14} />
                100/100 WCAG Compliance
              </span>
            )}

            {issues.length > 0 && (
              <span className="mt-5 inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-[10px] font-semibold text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                <Check size={13} />
                No results found
              </span>
            )}
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-zinc-100 bg-zinc-50/70 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-800/30 sm:px-5">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          {severityCounts.map((item) => (
            <div
              key={item.severity}
              className="flex items-center gap-2"
            >
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${item.color}`}
              />

              <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                {item.label}
              </span>

              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-zinc-200 bg-white px-1.5 font-mono text-[10px] font-bold text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                {item.count}
              </span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
