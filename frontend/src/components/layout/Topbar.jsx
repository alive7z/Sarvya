import { Activity, Settings2, ChevronDown, Check, Wifi, Glasses, Puzzle } from 'lucide-react';
import { useVision } from '../accessibility/VisionPreferences.jsx';
import ThemeToggle from './ThemeToggle.jsx';

const items = [
  ['workspace', 'Workspace'],
  ['vision', 'Assistive Tech & Vision'],
  ['history', 'History'],
  ['monitoring', 'Monitoring'],
  ['github', 'GitHub'],
  ['reports', 'Reports'],
  ['docs', 'Documentation'],
];

export default function Topbar({
  page,
  onNavigate,
  theme,
  onThemeChange,
  demo,
}) {
  const vision = useVision();

  return (
    <header className="app-topbar sticky top-0 z-50 w-full border-b border-zinc-200/80 bg-white/95 shadow-[0_2px_15px_rgba(0,0,0,0.025)] backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-900/95 dark:shadow-[0_2px_15px_rgba(0,0,0,0.15)]">
      <div className="mx-auto flex h-[76px] max-w-[1680px] items-center gap-2 px-3 sm:gap-6 sm:px-5 xl:gap-6 lg:px-10">
        <button
          type="button"
          onClick={() => onNavigate('workspace')}
          aria-label="Sarvya home"
          className="group flex shrink-0 items-center gap-3 rounded-xl text-left transition-opacity duration-200 hover:opacity-90"
        >
          <span className="brand-mark hidden h-10 w-10 items-center justify-center rounded-xl bg-zinc-900 sm:flex text-white shadow-[0_4px_12px_rgba(0,0,0,0.12)] transition-transform duration-300 group-hover:scale-[1.02] dark:bg-accent-600 dark:shadow-accent-950/20">
            <Activity size={21} strokeWidth={2.2} />
          </span>

          <span className="flex flex-col">
            <span className="font-sans text-[16px] font-bold leading-none sm:text-[20px] tracking-[-0.6px] text-zinc-900 dark:text-zinc-100">
              Sar
              <span className="text-accent-500 dark:text-accent-400">
                vya
              </span>
            </span>

            <span className="mt-1.5 hidden font-mono sm:block text-[8px] font-medium tracking-[0.1em] text-zinc-400 dark:text-zinc-500">
              WEB ACCESSIBILITY AUDITOR
            </span>
          </span>
        </button>

        <nav
          className="hidden h-full min-w-0 flex-1 items-center gap-1 xl:flex"
          aria-label="Main navigation"
        >
          {items.map(([id, label]) => {
            const active = page === id;

            return (
              <button
                key={id}
                type="button"
                aria-current={active ? 'page' : undefined}
                onClick={() => onNavigate(id)}
                className={`group relative flex h-full shrink-0 items-center justify-center px-2 2xl:px-3 text-[12px] font-semibold transition-colors duration-200 ${
                  active
                    ? 'text-zinc-900 dark:text-zinc-100'
                    : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
                }`}
              >
                {id === 'vision' && (
                  <Glasses
                    size={14}
                    className={`mr-1.5 transition-colors ${
                      active ? 'text-accent-500' : 'text-zinc-400 group-hover:text-zinc-600'
                    }`}
                  />
                )}
                {label}

                <span
                  className={`absolute bottom-0 left-3 right-3 h-[3px] rounded-t-full bg-accent-500 transition-all duration-300 ${
                    active
                      ? 'scale-x-100 opacity-100'
                      : 'scale-x-0 opacity-0 group-hover:scale-x-75 group-hover:opacity-40'
                  }`}
                />
              </button>
            );
          })}
        </nav>

        <div className="relative ml-auto xl:hidden">
          <select
            aria-label="Navigate"
            value={page}
            onChange={(e) => onNavigate(e.target.value)}
            className="h-10 max-w-[70px] sm:max-w-[125px] cursor-pointer appearance-none rounded-xl border border-zinc-200 bg-zinc-50 py-2 pl-3 pr-8 text-[11px] font-semibold text-zinc-700 outline-none transition-all hover:border-zinc-300 focus:border-accent-400 focus:ring-2 focus:ring-accent-500/10 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
          >
            {[...items, ['extension', 'Browser Extension'], ['settings', 'Settings']].map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>

          <ChevronDown
            size={14}
            className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400"
          />
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:gap-3">
          {/* Extension Quick Button */}
          <button
            type="button"
            onClick={() => onNavigate('extension')}
            className={`hidden items-center gap-1.5 rounded-xl border px-3 py-2 text-[11px] font-bold transition-all sm:flex ${
              page === 'extension'
                ? 'border-accent-500 bg-accent-50 text-accent-600 dark:border-accent-900/60 dark:bg-accent-950/40 dark:text-accent-400'
                : 'border-zinc-200 bg-white text-zinc-700 shadow-sm hover:border-accent-300 hover:text-accent-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
            }`}
            title="Install Sarvya Chrome & Edge Extension"
          >
            <Puzzle size={14} className="text-accent-500" />
            <span>Browser Extension</span>
          </button>

          <button type="button" onClick={vision.edit} aria-label="Colour preferences" title="Colour preferences" className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"><Glasses size={19} aria-hidden="true" /></button>
          <ThemeToggle theme={theme} onChange={onThemeChange} />

          <button
            type="button"
            aria-label="Audit workspace settings"
            title="Settings"
            onClick={() => onNavigate('settings')}
            className={`flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-500 shadow-sm transition-all duration-200 hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900 active:scale-[0.98] dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:bg-zinc-750 dark:hover:text-zinc-200 ${
              page === 'settings'
                ? 'border-accent-500 text-accent-600 dark:border-accent-500 dark:text-accent-400'
                : ''
            }`}
          >
            <Settings2 size={18} />
          </button>
        </div>
      </div>
    </header>
  );
}
