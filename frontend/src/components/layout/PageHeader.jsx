import { ArrowLeft, ChevronRight } from 'lucide-react';

export default function PageHeader({ title, description, icon: Icon, onNavigate, actions, category = 'Workspace' }) {
  return (
    <header className="page-header">
      <div className="min-w-0 flex-1">
        <p className="mb-3 flex items-center gap-2 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
          Sarvya <ChevronRight size={12} aria-hidden="true" /> {category}
        </p>
        <div className="flex items-start gap-3">
          {Icon && <span className="page-header-icon"><Icon size={21} strokeWidth={1.7} aria-hidden="true" /></span>}
          <div className="min-w-0">
            <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.8px] text-zinc-900 dark:text-zinc-100 sm:text-[34px]">{title}</h1>
            <p className="mt-2 max-w-[680px] text-[13px] leading-6 text-zinc-500 dark:text-zinc-400">{description}</p>
          </div>
        </div>
      </div>
      {(actions || onNavigate) && (
        <div className="page-header-actions">
          {actions}
          {onNavigate && <button type="button" onClick={() => onNavigate('workspace')} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 text-[12px] font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"><ArrowLeft size={15} /> Workspace</button>}
        </div>
      )}
    </header>
  );
}

export function PageSections({ items }) {
  return (
    <nav aria-label="Page sections" className="page-sections">
      <span className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500">On this page</span>
      {items.map(([id, label]) => <a key={id} href={`#${id}`} className="rounded-lg px-3 py-2 text-[12px] font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100">{label}</a>)}
    </nav>
  );
}
