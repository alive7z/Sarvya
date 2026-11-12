import { ChevronRight, Layers3, OctagonAlert, TriangleAlert, CircleAlert, Info } from 'lucide-react';
import CodeFixPanel from './CodeFixPanel.jsx';

export default function IssueCard({
  issue,
  selected,
  expanded,
  onSelect,
  onInspect,
  onCopy,
  onIgnore,
  onAction,
  onVerify,
  onGenerateFix,
}) {
  const isIgnored = issue.status === 'Ignored';

  const severityStyles = {
    critical: {
      dot: 'bg-red-500',
      badge:
        'border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-500/10 dark:text-red-400',
    },
    serious: {
      dot: 'bg-orange-500',
      badge:
        'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900/50 dark:bg-orange-500/10 dark:text-orange-400',
    },
    moderate: {
      dot: 'bg-amber-500',
      badge:
        'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-500/10 dark:text-amber-400',
    },
    minor: {
      dot: 'bg-blue-500',
      badge:
        'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-500/10 dark:text-blue-400',
    },
  };

  const severity = severityStyles[issue.severity] || {
    dot: 'bg-zinc-400',
    badge:
      'border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  };

  const SeverityIcon = { critical: OctagonAlert, serious: TriangleAlert, moderate: CircleAlert, minor: Info }[issue.severity] || Info;

  return (
    <article
      className={`group relative overflow-hidden rounded-2xl border bg-white transition-[background-color,border-color,box-shadow] duration-200 ease-out dark:bg-zinc-900 ${
        selected
          ? 'border-accent-300 shadow-sm dark:border-accent-800'
          : 'border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700'
      } ${isIgnored ? 'opacity-65' : ''}`}
    >
      {selected && (
        <span className="absolute bottom-0 left-0 top-0 w-[3px] bg-accent-500" />
      )}

      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        aria-expanded={expanded}
        aria-controls={`issue-details-${issue.id}`}
        className={`flex w-full items-start gap-3 p-4 text-left ${selected ? 'bg-accent-50/30 dark:bg-accent-500/5' : 'hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40'}`}
      >
        <SeverityIcon aria-hidden="true" size={17} className="mt-0.5 shrink-0 text-zinc-600 dark:text-zinc-300" />
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-semibold leading-5 text-zinc-900 dark:text-zinc-100">
            {issue.title}
          </span>
          <span className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[10px] text-zinc-500 dark:text-zinc-400">
            <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 font-medium capitalize ${severity.badge}`}>
              {issue.severity}
            </span>
            <code className="break-all font-mono">{issue.rule}</code>
            <span className="text-zinc-300 dark:text-zinc-600" aria-hidden="true">·</span>
            <span>WCAG {issue.wcag}</span>
            <span className="inline-flex items-center gap-1">
              <Layers3 size={11} />
              {issue.isElementView ? `Element ${issue.nodeIndex}/${issue.totalNodes}` : `${issue.count} affected`}
            </span>
          </span>
          {issue.isElementView && issue.selector && (
            <code className="mt-2 block truncate font-mono text-[10px] text-zinc-500 dark:text-zinc-400" title={issue.selector}>
              {issue.selector}
            </code>
          )}
        </span>
        <ChevronRight
          size={16}
          aria-hidden="true"
          className={`mt-0.5 shrink-0 text-zinc-400 transition-transform duration-200 ${expanded ? 'rotate-90 text-accent-500' : ''}`}
        />
      </button>

      {expanded && (
        <div id={`issue-details-${issue.id}`} className="animate-in fade-in duration-200">
          <CodeFixPanel
            issue={issue}
            onInspect={onInspect}
            onCopy={onCopy}
            onAction={onAction}
            onIgnore={onIgnore}
            onVerify={onVerify}
            onGenerateFix={onGenerateFix}
          />
        </div>
      )}
    </article>
  );
}
