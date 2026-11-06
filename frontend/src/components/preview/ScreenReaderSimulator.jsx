import { useMemo, useState } from 'react';
import { Volume2 } from 'lucide-react';
import { readSnippet } from '../../utils/readerContent.js';
import ReaderControls from './ReaderControls.jsx';

export default function ScreenReaderSimulator({ issue }) {
  const [source, setSource] = useState('current');
  const snippet = source === 'current' ? issue?.snippet : issue?.fix;
  const result = useMemo(() => readSnippet(snippet || ''), [snippet]);
  if (!issue) return <p className="p-4 text-[12px] text-zinc-500">Select an issue to read its HTML.</p>;
  return (
    <section aria-label="Issue screen reader" className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
      <h3 className="flex items-center gap-2 text-[13px] text-zinc-800 dark:text-zinc-200"><Volume2 size={16} /> Screen reader · HTML outline</h3>
      <p className="mt-2 text-[11px] leading-5 text-zinc-500 dark:text-zinc-400">An approximate reading of this snippet's names, roles, and text. It does not reproduce NVDA, JAWS, or VoiceOver, and a proposed fix is not a verified result.</p>
      <div role="group" aria-label="Snippet to read" className="my-3 grid grid-cols-2 gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
        {[['current', 'Current HTML'], ['proposed', 'Proposed fix']].map(([value, label]) => <button type="button" key={value} aria-pressed={source === value} onClick={() => setSource(value)} className={`min-h-9 rounded-md px-2 text-[12px] ${source === value ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100' : 'text-zinc-500 dark:text-zinc-400'}`}>{label}</button>)}
      </div>
      {issue.rule === 'color-contrast' && <p className="mb-3 text-[11px] text-zinc-500 dark:text-zinc-400">Speech does not measure color contrast. Review the scan's contrast findings separately.</p>}
      <div className="h-[420px]"><ReaderControls items={result.items} language={result.language} allowFilter={false} /></div>
    </section>
  );
}
