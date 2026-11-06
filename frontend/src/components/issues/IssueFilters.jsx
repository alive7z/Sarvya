
import { Filter, ListFilter, ArrowDownUp, ChevronDown } from 'lucide-react';
import IssueSearch from './IssueSearch.jsx';

export default function IssueFilters({
  query,
  onQueryChange,
  status,
  onStatusChange,
  severity,
  onSeverityChange,
  onSort,
}) {
  const selectStyles =
    'h-10 w-full cursor-pointer appearance-none bg-transparent pl-3 pr-7 text-[12px] font-medium sm:pl-9 text-zinc-700 outline-none focus:outline-none dark:text-zinc-300';

  const filterStyles =
    'group relative flex min-w-0 flex-1 items-center rounded-xl border border-zinc-200 bg-white transition-all duration-200 hover:border-zinc-300 hover:bg-zinc-50 focus-within:border-accent-400 focus-within:ring-4 focus-within:ring-accent-500/10 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:border-zinc-600 dark:hover:bg-zinc-800/80';

  return (
    <div className="space-y-2.5 border-b border-zinc-100 bg-white px-4 pb-4 pt-0 dark:border-zinc-800 dark:bg-zinc-900 sm:px-5">
      <div className="flex items-center gap-2">
        <IssueSearch value={query} onChange={onQueryChange} />
        <button
          type="button"
          title="Sort by severity"
          aria-label="Sort issues by severity"
          onClick={onSort}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-500 hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          <ArrowDownUp size={16} />
        </button>
      </div>

      <div className="flex items-center gap-2.5">
        <div className={filterStyles}>
          <ListFilter
            size={15}
            className="pointer-events-none absolute left-3 hidden text-zinc-400 sm:block transition-colors duration-200 group-focus-within:text-accent-500 dark:text-zinc-500"
          />

          <select
            aria-label="Filter issue status"
            value={status}
            onChange={(e) => onStatusChange(e.target.value)}
            className={selectStyles}
          >
            <option value="All issues">All issues</option>
            <option value="Open">Open</option>
            <option value="Verified">Verified</option>
          </select>

          <ChevronDown
            size={14}
            className="pointer-events-none absolute right-3 text-zinc-400 dark:text-zinc-500"
          />
        </div>

        <div className={filterStyles}>
          <Filter
            size={15}
            className="pointer-events-none absolute left-3 hidden text-zinc-400 sm:block transition-colors duration-200 group-focus-within:text-accent-500 dark:text-zinc-500"
          />

          <select
            aria-label="Filter severity"
            value={severity}
            onChange={(e) => onSeverityChange(e.target.value)}
            className={selectStyles}
          >
            <option value="All severities">All severities</option>
            <option value="Critical">Critical</option>
            <option value="Serious">Serious</option>
            <option value="Moderate">Moderate</option>
          </select>

          <ChevronDown
            size={14}
            className="pointer-events-none absolute right-3 text-zinc-400 dark:text-zinc-500"
          />
        </div>

      </div>
    </div>
  );
}
