import { useEffect, useId, useMemo, useState } from 'react';
import { Play, Pause, Square, SkipBack, SkipForward, Volume2 } from 'lucide-react';
import useSpeechReader from '../../hooks/useSpeechReader.js';

const button = 'inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 text-[12px] font-medium text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200';

export default function ReaderControls({ items, language = '', onHighlight, allowFilter = true }) {
  const id = useId();
  const [filter, setFilter] = useState('all');
  const filtered = useMemo(() => filter === 'all' ? items : items.filter((item) => item.kind === filter), [items, filter]);
  const reader = useSpeechReader(filtered, language);
  const current = filtered[reader.index];

  useEffect(() => {
    if (reader.status === 'reading' || reader.status === 'paused') onHighlight?.(current);
  }, [current, reader.status, onHighlight]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="grid shrink-0 grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="min-w-0 text-[11px] font-medium text-zinc-600 dark:text-zinc-400" htmlFor={`${id}-voice`}>
          Voice
          <select aria-label="Reading voice" id={`${id}-voice`} value={reader.voiceURI} onChange={(event) => reader.setVoiceURI(event.target.value)} disabled={!reader.supported || !reader.hasVoice} className="mt-1 h-9 w-full min-w-0 rounded-lg border border-zinc-200 bg-white px-2 text-[12px] text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
            {!reader.hasVoice && <option value="">Google voices unavailable</option>}
            {reader.voices.map((voice) => <option key={voice.voiceURI} value={voice.voiceURI}>{voice.name} ({voice.lang}) · {voice.localService ? 'local' : 'online'}</option>)}
          </select>
        </label>
        <label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400" htmlFor={`${id}-speed`}>
          Reading speed · {reader.rate.toFixed(1)}×
          <input id={`${id}-speed`} aria-label="Reading speed" type="range" min="0.5" max="2" step="0.1" value={reader.rate} onChange={(event) => reader.setRate(Number(event.target.value))} disabled={!reader.supported} className="mt-1 block h-9 w-full accent-accent-600" />
        </label>
      </div>
      <div role="group" aria-label="Reading controls" className="flex shrink-0 flex-wrap items-center gap-2">
        <button type="button" className={button} aria-label="Previous reading item" disabled={!filtered.length || reader.index === 0} onClick={() => reader.select(reader.index - 1)}><SkipBack size={14} /></button>
        {reader.status === 'reading' ? (
          <button type="button" className={button} onClick={reader.pause}><Pause size={14} /> Pause</button>
        ) : reader.status === 'paused' ? (
          <button type="button" className={button} onClick={reader.resume}><Play size={14} /> Resume</button>
        ) : (
          <button type="button" className={button} disabled={!reader.supported || !reader.hasVoice || !filtered.length} onClick={reader.play}><Play size={14} /> Read aloud</button>
        )}
        <button type="button" className={button} disabled={!['reading', 'paused'].includes(reader.status)} onClick={reader.stop}><Square size={13} /> Stop</button>
        <button type="button" className={button} aria-label="Next reading item" disabled={!filtered.length || reader.index >= filtered.length - 1} onClick={() => reader.select(reader.index + 1)}><SkipForward size={14} /></button>
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <p role="status" className="flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400"><Volume2 size={13} />{({ idle: 'Ready', reading: 'Reading', paused: 'Paused', finished: 'Finished' })[reader.status]}</p>
        <span className="text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">{filtered.length ? `${reader.index + 1} / ${filtered.length}` : '0'} items</span>
        {allowFilter && <select aria-label="Reading content" value={filter} onChange={(event) => setFilter(event.target.value)} className="h-8 rounded-lg border border-zinc-200 bg-white px-2 text-[11px] text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
          <option value="all">All content</option><option value="heading">Headings</option><option value="link">Links</option><option value="control">Form controls</option><option value="landmark">Landmarks</option><option value="image">Images</option>
        </select>}
      </div>
      {!reader.supported && <p role="status" className="text-[12px] text-amber-700 dark:text-amber-300">Speech is unavailable in this browser. The reading outline is still available.</p>}
      {reader.supported && !reader.hasVoice && <p role="status" className="text-[12px] text-amber-700 dark:text-amber-300">This browser has not exposed any Google voices. Audio is unavailable; the transcript remains readable.</p>}
      {reader.hasVoice && !reader.hasUSEnglish && <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Google US English is unavailable. Another available Google voice is selected.</p>}
      {reader.error && <p role="alert" className="text-[12px] text-red-700 dark:text-red-300">{reader.error}</p>}
      <ol aria-label="Reading transcript" className="min-h-[80px] flex-1 space-y-1 overflow-y-auto overscroll-contain rounded-xl border border-zinc-200 bg-zinc-50/60 p-2 dark:border-zinc-700 dark:bg-zinc-950/30">
        {filtered.map((item, index) => <li key={`${index}-${item.text}`}>
          <button type="button" aria-current={index === reader.index ? 'step' : undefined} onClick={() => { reader.select(index); onHighlight?.(item); }} className={`flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left text-[12px] leading-5 ${index === reader.index ? 'bg-accent-50 text-zinc-900 ring-1 ring-inset ring-accent-200 dark:bg-accent-950/30 dark:text-zinc-100 dark:ring-accent-900' : 'text-zinc-600 hover:bg-white dark:text-zinc-400 dark:hover:bg-zinc-800'}`}>
            <span className="mt-0.5 min-w-4 shrink-0 text-[10px] tabular-nums text-zinc-400">{index + 1}</span><span className="min-w-0 break-words">{item.text}</span>
          </button>
        </li>)}
        {!filtered.length && <li className="px-3 py-5 text-center text-[12px] text-zinc-500 dark:text-zinc-400">No readable items in this category.</li>}
      </ol>
      <p className="shrink-0 text-[10px] leading-4 text-zinc-500 dark:text-zinc-400">Google voices are supplied by your browser and may send text to their provider. Google US English is preferred by default. Changing voice or speed stops playback.</p>
    </div>
  );
}
