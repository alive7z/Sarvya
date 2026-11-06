import { DEMO_HOST } from '../../data/demoAudit.js';
import { useState, useRef, useEffect } from 'react';
import {
  ExternalLink,
  Volume2,
  Globe2,
  RefreshCw,
  Monitor,
  Smartphone,
  Eye,
  Glasses,
  ChevronDown,
  Check,
  RotateCcw,
} from 'lucide-react';

const VISION_OPTIONS = [
  {
    id: 'normal',
    label: 'Normal Vision',
    desc: 'Standard trichromatic color perception',
    badge: 'Standard',
    color: 'bg-emerald-500',
  },
  {
    id: 'deuteranopia',
    label: 'Deuteranopia',
    sub: 'Green-Blind',
    desc: 'Red & green blend together (~5% of men)',
    badge: '5% Men',
    color: 'bg-emerald-400',
  },
  {
    id: 'protanopia',
    label: 'Protanopia',
    sub: 'Red-Blind',
    desc: 'Red appears dark/dim (~1% of men)',
    badge: '1% Men',
    color: 'bg-red-400',
  },
  {
    id: 'tritanopia',
    label: 'Tritanopia',
    sub: 'Blue-Blind',
    desc: 'Blue & yellow confused (~0.01%)',
    badge: '0.01%',
    color: 'bg-blue-400',
  },
  {
    id: 'achromatopsia',
    label: 'Achromatopsia',
    sub: 'Monochrome',
    desc: 'Total color blindness (1 in 33,000)',
    badge: 'Grayscale',
    color: 'bg-zinc-400',
  },
  {
    id: 'lowvision',
    label: 'Low Vision',
    sub: 'Blur & Cataracts',
    desc: 'Reduced optical acuity & contrast',
    badge: 'Blur',
    color: 'bg-amber-400',
  },
];

export default function PreviewToolbar({
  url,
  demo,
  viewport = 'desktop',
  active,
  visionMode = 'normal',
  onVisionModeChange,
  onRefresh,
  onViewportChange,
  readerOpen = false,
  onReaderToggle,
  readerButtonRef,
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when user clicks outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [dropdownOpen]);

  const changeViewport = (next) => {
    onViewportChange?.(next === viewport ? 'desktop' : next);
  };

  const activeOption =
    VISION_OPTIONS.find((opt) => opt.id === visionMode) || VISION_OPTIONS[0];

  return (
    <>
      <div className="flex flex-col gap-4 border-b border-zinc-100 bg-white px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-accent-100 bg-accent-50 text-accent-600 dark:border-accent-900/40 dark:bg-accent-500/10 dark:text-accent-400">
              <Eye size={19} strokeWidth={1.9} />
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="text-[16px] font-extrabold tracking-[-0.5px] text-zinc-900 dark:text-zinc-100">
                  Live preview
                </h2>

                <span className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[9px] font-bold tracking-[0.025em] text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      demo ? 'bg-accent-500' : 'bg-emerald-500'
                    }`}
                  />
                  {demo ? 'DEMO PAGE' : 'CONTROLLED PREVIEW'}
                </span>

                {visionMode !== 'normal' && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-200 bg-purple-50 px-2.5 py-0.5 text-[9px] font-bold text-purple-700 dark:border-purple-800/60 dark:bg-purple-950/40 dark:text-purple-300">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-purple-500" />
                    SIMULATING: {activeOption.label.toUpperCase()}
                  </span>
                )}
              </div>

              <div className="mt-1.5 flex min-w-0 items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                <Globe2 size={13} className="shrink-0" />
                <span className="max-w-[230px] truncate sm:max-w-[320px]">
                  {url || `https://${DEMO_HOST}`}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Custom Styled Color Blindness & Vision Simulator Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              aria-haspopup="listbox"
              aria-expanded={dropdownOpen}
              title="Simulate how color-blind or low-vision users perceive this website"
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-[11px] font-semibold transition-all duration-200 active:scale-95 ${
                visionMode !== 'normal'
                  ? 'border-purple-300 bg-purple-50 text-purple-800 shadow-sm dark:border-purple-800/80 dark:bg-purple-950/50 dark:text-purple-300'
                  : 'border-zinc-200 bg-white text-zinc-700 shadow-sm hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:border-zinc-600'
              }`}
            >
              <Glasses
                size={15}
                className={`shrink-0 ${
                  visionMode !== 'normal'
                    ? 'text-purple-600 dark:text-purple-400 animate-pulse'
                    : 'text-zinc-400 dark:text-zinc-500'
                }`}
              />

              <span className="flex items-center gap-1.5 whitespace-nowrap">
                <span className="font-bold">
                  Vision: {activeOption.label}
                </span>
                {activeOption.sub && (
                  <span className="hidden text-[10px] opacity-75 sm:inline">
                    ({activeOption.sub})
                  </span>
                )}
              </span>

              <ChevronDown
                size={14}
                className={`text-zinc-400 transition-transform duration-200 dark:text-zinc-500 ${
                  dropdownOpen ? 'rotate-180 text-purple-600 dark:text-purple-400' : ''
                }`}
              />
            </button>

            {/* Custom Popover Floating Menu */}
            {dropdownOpen && (
              <div
                role="listbox"
                aria-label="Color blindness vision simulator options"
                className="absolute right-0 top-full z-50 mt-2 w-72 rounded-2xl border border-zinc-200 bg-white p-2 shadow-[0_12px_45px_rgba(0,0,0,0.18)] animate-in fade-in zoom-in-95 duration-150 dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-[0_14px_45px_rgba(0,0,0,0.45)]"
              >
                <div className="mb-1.5 flex items-center justify-between border-b border-zinc-100 px-3 py-2 dark:border-zinc-800">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                    Simulate Vision Deficiency
                  </span>
                  {visionMode !== 'normal' && (
                    <button
                      type="button"
                      onClick={() => {
                        onVisionModeChange?.('normal');
                        setDropdownOpen(false);
                      }}
                      className="flex items-center gap-1 text-[10px] font-bold text-purple-600 hover:underline dark:text-purple-400"
                    >
                      <RotateCcw size={11} />
                      Reset
                    </button>
                  )}
                </div>

                <div className="space-y-1">
                  {VISION_OPTIONS.map((opt) => {
                    const isSelected = visionMode === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => {
                          onVisionModeChange?.(opt.id);
                          setDropdownOpen(false);
                        }}
                        className={`group flex w-full items-start justify-between gap-3 rounded-xl p-2.5 text-left transition-all duration-150 ${
                          isSelected
                            ? 'bg-purple-50 text-purple-900 dark:bg-purple-950/60 dark:text-purple-200 font-semibold shadow-sm'
                            : 'text-zinc-700 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800/80'
                        }`}
                      >
                        <div className="flex items-start gap-2.5 min-w-0 flex-1">
                          <span
                            className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${opt.color} shadow-sm`}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold leading-none">
                                {opt.label}
                              </span>
                              {opt.sub && (
                                <span className="text-[10px] font-medium opacity-70">
                                  ({opt.sub})
                                </span>
                              )}
                            </div>
                            <p className="mt-1 text-[10px] leading-snug text-zinc-400 dark:text-zinc-400">
                              {opt.desc}
                            </p>
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-1.5">
                          <span
                            className={`rounded px-1.5 py-0.5 font-mono text-[9px] font-bold ${
                              isSelected
                                ? 'bg-purple-200/60 text-purple-800 dark:bg-purple-900/60 dark:text-purple-300'
                                : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
                            }`}
                          >
                            {opt.badge}
                          </span>
                          {isSelected && (
                            <Check size={14} className="text-purple-600 dark:text-purple-400" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div
            className="hidden h-6 w-px bg-zinc-200 sm:block dark:bg-zinc-700"
            aria-hidden="true"
          />

          <button
            ref={readerButtonRef}
            type="button"
            aria-label={readerOpen ? 'Hide screen reader' : 'Open screen reader'}
            title="Screen reader"
            aria-expanded={readerOpen}
            aria-controls="preview-screen-reader"
            onClick={onReaderToggle}
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${readerOpen ? 'border-accent-300 bg-accent-50 text-accent-700 dark:border-accent-800 dark:bg-accent-950/40 dark:text-accent-400' : 'border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400'}`}
          >
            <Volume2 size={16} />
          </button>

          <button
            type="button"
            aria-label="Refresh preview"
            title="Refresh preview"
            onClick={onRefresh}
            className="group flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-500 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-accent-300 hover:bg-accent-50 hover:text-accent-600 active:scale-95 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:border-accent-800 dark:hover:bg-accent-500/10 dark:hover:text-accent-400"
          >
            <RefreshCw
              size={16}
              className="transition-transform duration-500 group-hover:rotate-180"
            />
          </button>

          <div
            className="mx-1 h-6 w-px bg-zinc-200 dark:bg-zinc-700"
            aria-hidden="true"
          />

          <div
            className="flex items-center gap-1 rounded-xl border border-zinc-200 bg-zinc-50 p-1 dark:border-zinc-700 dark:bg-zinc-800"
            role="group"
            aria-label="Preview viewport"
          >
            <button
              type="button"
              aria-label="Desktop viewport"
              title="Desktop viewport"
              aria-pressed={viewport === 'desktop'}
              onClick={() => changeViewport('desktop')}
              className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-200 active:scale-95 ${
                viewport === 'desktop'
                  ? 'bg-white text-accent-600 shadow-sm dark:bg-zinc-700 dark:text-accent-400'
                  : 'text-zinc-400 hover:bg-white/80 hover:text-zinc-700 dark:text-zinc-500 dark:hover:bg-zinc-700 dark:hover:text-zinc-200'
              }`}
            >
              <Monitor size={16} />
            </button>

            <button
              type="button"
              aria-label="Mobile viewport"
              title="Mobile viewport"
              aria-pressed={viewport === 'mobile'}
              onClick={() => changeViewport('mobile')}
              className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-200 active:scale-95 ${
                viewport === 'mobile'
                  ? 'bg-white text-accent-600 shadow-sm dark:bg-zinc-700 dark:text-accent-400'
                  : 'text-zinc-400 hover:bg-white/80 hover:text-zinc-700 dark:text-zinc-500 dark:hover:bg-zinc-700 dark:hover:text-zinc-200'
              }`}
            >
              <Smartphone size={16} />
            </button>
          </div>

          <button
            type="button"
            aria-label="Open preview in new window"
            title="Open preview in new window"
            onClick={() => {
              const target = url || 'about:blank';
              window.open(target, '_blank', 'noopener');
            }}
            className="group flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-500 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-accent-300 hover:bg-accent-50 hover:text-accent-600 active:scale-95 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:border-accent-800 dark:hover:bg-accent-500/10 dark:hover:text-accent-400"
          >
            <ExternalLink size={16} />
          </button>
        </div>
      </div>

      <div className="flex min-h-[43px] items-center justify-between gap-3 border-b border-zinc-100 bg-zinc-50/70 px-5 py-2.5 sm:px-6 dark:border-zinc-800 dark:bg-zinc-800/40">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${
              active ? 'bg-accent-500' : 'bg-zinc-300 dark:bg-zinc-600'
            }`}
          />

          <span className="truncate text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
            {active
              ? `${active.count} affected ${
                  active.count === 1 ? 'element' : 'elements'
                } selected`
              : 'Select an issue to inspect elements'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {visionMode !== 'normal' && (
            <button
              type="button"
              onClick={() => onVisionModeChange?.('normal')}
              className="text-[10px] font-semibold text-purple-600 hover:underline dark:text-purple-400"
            >
              Reset Vision Filter
            </button>
          )}

          <span className="shrink-0 rounded-md border border-zinc-200 bg-white px-2.5 py-1 font-mono text-[9px] font-semibold uppercase tracking-wider text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
            {viewport}
          </span>
        </div>
      </div>
    </>
  );
}
