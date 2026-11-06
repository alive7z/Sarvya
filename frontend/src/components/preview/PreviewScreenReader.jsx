import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw, Volume2, X } from 'lucide-react';
import { collectReadingItems } from '../../utils/readerContent.js';
import ReaderControls from './ReaderControls.jsx';

export default function PreviewScreenReader({ frameRef, sourceKey, demo, onClose }) {
  const [result, setResult] = useState({ items: [], language: '', truncated: false });
  const [error, setError] = useState('');
  const highlighted = useRef(null);
  const clearHighlight = useCallback(() => {
    const previous = highlighted.current;
    if (!previous) return;
    for (const [property, value, priority] of previous.styles) {
      if (value) previous.element.style.setProperty(property, value, priority);
      else previous.element.style.removeProperty(property);
    }
    highlighted.current = null;
  }, []);
  const highlight = useCallback((item) => {
    clearHighlight();
    const element = item?.element;
    if (!element?.isConnected) return;
    highlighted.current = { element, styles: ['outline', 'outline-offset'].map((property) => [property, element.style.getPropertyValue(property), element.style.getPropertyPriority(property)]) };
    element.style.setProperty('outline', '3px solid #2563eb', 'important');
    element.style.setProperty('outline-offset', '3px', 'important');
    element.scrollIntoView({ block: 'center', behavior: 'instant' });
  }, [clearHighlight]);
  const refresh = useCallback(() => {
    clearHighlight();
    try {
      const frame = frameRef.current;
      const document = frame?.contentDocument;
      if (!document?.body || document.readyState === 'loading') throw new Error('The preview is loading or its document is not accessible. Reload the outline after it finishes.');
      setResult(collectReadingItems(document)); setError('');
    } catch {
      setResult({ items: [], language: '', truncated: false });
      setError('This preview document is unavailable or restricted by the browser. Read individual issue snippets instead, or reload the outline after the preview loads.');
    }
  }, [frameRef, clearHighlight]);
  useEffect(() => {
    const frame = frameRef.current;
    refresh(); frame?.addEventListener('load', refresh);
    return () => { frame?.removeEventListener('load', refresh); clearHighlight(); };
  }, [refresh, sourceKey, frameRef, clearHighlight]);
  return (
    <section onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); onClose(); } }} id="preview-screen-reader" aria-label="Preview screen reader" className="absolute inset-0 z-30 flex min-h-0 flex-col gap-3 overflow-y-auto bg-white p-4 dark:bg-zinc-900">
      <div className="flex shrink-0 items-start justify-between gap-2">
        <div><h3 className="flex items-center gap-2 text-[14px] text-zinc-900 dark:text-zinc-100"><Volume2 size={17} /> Screen reader</h3><p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">{demo ? 'Demo preview' : 'Preview document'} · reading outline</p></div>
        <div className="flex gap-1">
          <button type="button" onClick={refresh} aria-label="Reload reading outline" title="Reload reading outline" className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"><RefreshCw size={15} /></button>
          <button type="button" onClick={onClose} aria-label="Close screen reader" className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"><X size={17} /></button>
        </div>
      </div>
      <p className="shrink-0 text-[11px] leading-4 text-zinc-500 dark:text-zinc-400">Reads accessible names and visible text in preview DOM order. This is a reading aid, not a full accessibility tree or a replacement for NVDA/VoiceOver testing.</p>
      {error && <p role="alert" className="text-[12px] text-amber-700 dark:text-amber-300">{error}</p>}
      {result.truncated && <p role="status" className="text-[11px] text-amber-700 dark:text-amber-300">This outline is limited to 500 items / 30,000 characters. Audit smaller sections for complete coverage.</p>}
      <div className="min-h-[280px] flex-1"><ReaderControls items={result.items} language={result.language} onHighlight={highlight} /></div>
    </section>
  );
}
