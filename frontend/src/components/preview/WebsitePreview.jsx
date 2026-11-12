import { DEMO_HOST } from '../../data/demoAudit.js';
import { useEffect, useState, useCallback, useRef } from 'react';
import PreviewToolbar from './PreviewToolbar.jsx';
import IssueHighlight from './IssueHighlight.jsx';
import PreviewScreenReader from './PreviewScreenReader.jsx';
import { Glasses, Info, X } from 'lucide-react';

const VISION_DESCRIPTIONS = {
  deuteranopia: {
    title: 'Deuteranopia (Green-Blindness)',
    stat: '~5% of males · Red-Green cone deficiency',
    advice:
      'Green and red look nearly identical (olive/yellow). Check that error and success states use distinct icons and clear text, not just color coding (WCAG 1.4.1).',
  },
  protanopia: {
    title: 'Protanopia (Red-Blindness)',
    stat: '~1% of males · Long-wavelength red cone absent',
    advice:
      'Red appears very dark or black. Ensure critical danger banners and red callouts have high luminance contrast and text labels (WCAG 1.4.3).',
  },
  tritanopia: {
    title: 'Tritanopia (Blue-Blindness)',
    stat: '~0.01% of people · Short-wavelength blue cone absent',
    advice:
      'Blue appears greenish, yellow looks magenta/grey. Ensure hyperlinks have visible underlines rather than relying solely on blue font color.',
  },
  achromatopsia: {
    title: 'Achromatopsia (Monochromacy)',
    stat: '1 in 33,000 people · Complete absence of color vision',
    advice:
      'The entire page is seen strictly in grayscale. All visual hierarchy, charts, buttons, and state indicators must depend 100% on shape and contrast.',
  },
  lowvision: {
    title: 'Low Vision / Cataracts Simulator',
    stat: '> 250M people worldwide · Blurred acuity & reduced contrast',
    advice:
      'Simulates reduced visual acuity and contrast sensitivity. Check if font sizes, button hit targets, and layout containers remain clear.',
  },
};

export default function WebsitePreview({
  className = '',
  iframeRef,
  srcDoc,
  demo,
  url,
  scanId,
  scanState,
  capturedHtml,
  selector,
  active,
  issues = [],
  inspectTrigger,
  viewport = 'desktop',
  visionMode = 'normal',
  onVisionModeChange,
  onViewportChange,
  onRefresh,
}) {
  const awaitingScan = !demo && scanState !== 'completed';
  const isMobile = viewport === 'mobile';
  const [frameFailed, setFrameFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [readerOpen, setReaderOpen] = useState(false);
  const readerButtonRef = useRef(null);
  const closeReader = () => { setReaderOpen(false); readerButtonRef.current?.focus(); };

  // Build preview URL: use relative path so Vite proxy proxies it to backend
  // Include scanId so the backend injects the interactive red error markers & tooltips!
  const previewUrl =
    !demo && !awaitingScan && url
      ? `/api/preview?url=${encodeURIComponent(url)}${
          scanId ? `&scanId=${encodeURIComponent(scanId)}` : ''
        }`
      : undefined;

  useEffect(() => {
    setFrameFailed(false);
    if (previewUrl) {
      setLoading(true);
      const timer = setTimeout(() => {
        setLoading(false);
      }, 1200);
      return () => clearTimeout(timer);
    } else {
      setLoading(false);
    }
  }, [previewUrl, srcDoc]);

  const handleIframeLoad = useCallback(() => {
    setLoading(false);
  }, []);

  const handleIframeError = useCallback(() => {
    setFrameFailed(true);
    setLoading(false);
  }, []);

  const handleRefresh = () => {
    setFrameFailed(false);
    if (previewUrl) setLoading(true);
    onRefresh?.();
  };

  const totalViolations = issues.length;

  // Determine CSS filter based on visionMode
  const getFilterStyle = () => {
    switch (visionMode) {
      case 'deuteranopia':
        return { filter: 'url(#filter-deuteranopia)' };
      case 'protanopia':
        return { filter: 'url(#filter-protanopia)' };
      case 'tritanopia':
        return { filter: 'url(#filter-tritanopia)' };
      case 'achromatopsia':
        return { filter: 'url(#filter-achromatopsia) grayscale(100%)' };
      case 'lowvision':
        return { filter: 'blur(1.8px) contrast(0.72) brightness(0.96)' };
      default:
        return {};
    }
  };

  const activeVisionInfo = VISION_DESCRIPTIONS[visionMode];

  return (
    <section
      className={`workspace-panel flex h-[650px] min-w-0 flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_4px_14px_rgba(0,0,0,0.035),0_14px_35px_rgba(0,0,0,0.035)] transition-shadow duration-300 hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-[0_5px_25px_rgba(0,0,0,0.18)] sm:h-[680px] ${className}`}
      aria-label="Website preview"
    >
      {/* Hidden SVG Color Matrix Filter Definitions for Color Blindness Simulation */}
      <svg
        style={{ position: 'absolute', width: 0, height: 0, pointerEvents: 'none' }}
        aria-hidden="true"
      >
        <defs>
          {/* Deuteranopia (Green-Blind) Matrix */}
          <filter id="filter-deuteranopia">
            <feColorMatrix
              type="matrix"
              values="0.625, 0.375, 0,   0, 0
                      0.70,  0.30,  0,   0, 0
                      0,     0.30,  0.70,0, 0
                      0,     0,     0,   1, 0"
            />
          </filter>
          {/* Protanopia (Red-Blind) Matrix */}
          <filter id="filter-protanopia">
            <feColorMatrix
              type="matrix"
              values="0.567, 0.433, 0,     0, 0
                      0.558, 0.442, 0,     0, 0
                      0,     0.242, 0.758, 0, 0
                      0,     0,     0,     1, 0"
            />
          </filter>
          {/* Tritanopia (Blue-Blind) Matrix */}
          <filter id="filter-tritanopia">
            <feColorMatrix
              type="matrix"
              values="0.95,  0.05,  0,     0, 0
                      0,     0.433, 0.567, 0, 0
                      0,     0.475, 0.525, 0, 0
                      0,     0,     0,     1, 0"
            />
          </filter>
          {/* Achromatopsia (Complete Monochromacy) Matrix */}
          <filter id="filter-achromatopsia">
            <feColorMatrix
              type="matrix"
              values="0.299, 0.587, 0.114, 0, 0
                      0.299, 0.587, 0.114, 0, 0
                      0.299, 0.587, 0.114, 0, 0
                      0,     0,     0,     1, 0"
            />
          </filter>
        </defs>
      </svg>

      <IssueHighlight
        frameRef={iframeRef}
        selector={selector}
        inspectTrigger={inspectTrigger}
      />

      <div className="shrink-0">
        <PreviewToolbar
          url={url}
          demo={demo}
          active={active}
          viewport={viewport}
          visionMode={visionMode}
          onVisionModeChange={onVisionModeChange}
          onViewportChange={onViewportChange}
          onRefresh={handleRefresh}
          readerOpen={readerOpen}
          onReaderToggle={() => setReaderOpen((open) => !open)}
          readerButtonRef={readerButtonRef}
        />
      </div>

      {/* Active Vision Simulation Notification Banner */}
      {activeVisionInfo && (
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-purple-200 bg-purple-50/90 px-4 py-2.5 text-purple-900 dark:border-purple-900/60 dark:bg-purple-950/60 dark:text-purple-200">
          <div className="flex min-w-0 items-center gap-2.5">
            <Glasses size={16} className="shrink-0 text-purple-600 dark:text-purple-400" />
            <div className="min-w-0 text-xs">
              <span className="font-bold">{activeVisionInfo.title}</span>
              <span className="mx-1.5 opacity-60">·</span>
              <span className="text-[11px] opacity-85">{activeVisionInfo.advice}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onVisionModeChange?.('normal')}
            className="flex shrink-0 items-center gap-1 rounded-md border border-purple-200 bg-white px-2 py-1 text-[10px] font-bold text-purple-700 shadow-sm hover:bg-purple-100 dark:border-purple-800 dark:bg-zinc-800 dark:text-purple-300"
          >
            Reset
            <X size={12} />
          </button>
        </div>
      )}

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-zinc-100/80 dark:bg-zinc-950/70">
        {readerOpen && !awaitingScan && <PreviewScreenReader frameRef={iframeRef} capturedHtml={capturedHtml} sourceKey={previewUrl || srcDoc} demo={demo} onClose={closeReader} />}
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-3 sm:p-5">
          <div
            className={`flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-[0_8px_28px_rgba(0,0,0,0.09),0_20px_48px_rgba(0,0,0,0.04)] transition-[width,box-shadow,border-color] duration-300 ease-in-out dark:border-zinc-700 dark:shadow-[0_12px_36px_rgba(0,0,0,0.3)] ${
              isMobile ? 'w-[340px] max-w-full' : 'w-full'
            }`}
          >
            {/* Browser chrome header */}
            <div className="flex h-10 shrink-0 items-center gap-3 border-b border-zinc-200 bg-zinc-50 px-4 dark:border-zinc-700 dark:bg-zinc-800">
              <div className="flex shrink-0 items-center gap-1.5">
                <span className="h-[9px] w-[9px] rounded-full bg-red-400" />
                <span className="h-[9px] w-[9px] rounded-full bg-amber-400" />
                <span className="h-[9px] w-[9px] rounded-full bg-emerald-400" />
              </div>

              <div className="flex min-w-0 flex-1 items-center justify-center rounded-md border border-zinc-200 bg-white px-3 py-1.5 dark:border-zinc-700 dark:bg-zinc-900">
                <span className="truncate text-center font-mono text-[10px] text-zinc-500 dark:text-zinc-400">
                  {url || DEMO_HOST}
                </span>
              </div>

              {scanId && !demo && (
                <span className="hidden shrink-0 items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[9px] font-bold text-red-600 sm:inline-flex dark:bg-red-950/60 dark:text-red-400">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
                  {totalViolations} Markers Active
                </span>
              )}
            </div>

            {/* Preview Frame Container with live SVG filter applied */}
            {awaitingScan ? (
              <div role="status" className="flex flex-1 items-center justify-center p-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
                {['failed', 'cancelled'].includes(scanState) ? 'No preview is available for this run. Start another scan to inspect the website.' : 'The website preview will be available when the scan completes.'}
              </div>
            ) : previewUrl && frameFailed ? (
              <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 bg-white p-6 text-center dark:bg-zinc-900">
                <div className="text-4xl">🔍</div>
                <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                  Preview could not load this website
                </p>
                <p className="max-w-sm text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                  Some websites restrict embedded previews with security headers.
                  The full accessibility scan findings remain accessible on the left.
                </p>
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
                >
                  Open website in new tab →
                </a>
              </div>
            ) : (
              <div
                className="relative flex min-h-0 flex-1 transition-[filter] duration-300"
                style={getFilterStyle()}
              >
                {loading && (
                  <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/90 backdrop-blur-sm dark:bg-zinc-900/90">
                    <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-zinc-200 border-t-orange-500" />
                    <p className="mt-3 text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                      Loading website & injecting error markers…
                    </p>
                    <p className="mt-1 text-[10px] text-zinc-400">
                      Preparing interactive accessibility inspection
                    </p>
                  </div>
                )}
                <iframe
                  key={previewUrl || 'sample-preview'}
                  title={demo ? 'Sample website preview' : 'Target website preview'}
                  ref={iframeRef}
                  src={previewUrl}
                  srcDoc={previewUrl ? undefined : srcDoc}
                  sandbox={demo ? "allow-scripts allow-forms allow-same-origin allow-popups allow-popups-to-escape-sandbox" : "allow-scripts allow-forms allow-popups"}
                  data-selected-selector={selector || ''}
                  onLoad={handleIframeLoad}
                  onError={handleIframeError}
                  className="block h-full min-h-0 w-full flex-1 border-0 bg-white"
                />
              </div>
            )}
          </div>
        </div>

        {/* Legend / Status Footer */}
        <div className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-2 border-t border-zinc-200 bg-white px-4 py-3 sm:px-6 dark:border-zinc-800 dark:bg-zinc-900">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-zinc-600 dark:text-zinc-400">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500 shadow-sm shadow-red-500/50" />
            Critical error
          </span>

          <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-zinc-600 dark:text-zinc-400">
            <span className="h-2.5 w-2.5 rounded-full bg-orange-500 shadow-sm shadow-orange-500/50" />
            Serious
          </span>

          <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-zinc-600 dark:text-zinc-400">
            <span className="h-2.5 w-2.5 rounded-full bg-yellow-500 shadow-sm shadow-yellow-500/50" />
            Moderate
          </span>

          <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-zinc-600 dark:text-zinc-400">
            <span className="h-2.5 w-2.5 rounded-full bg-blue-500 shadow-sm shadow-blue-500/50" />
            Minor
          </span>

          <span className="ml-auto text-[10px] text-zinc-400 dark:text-zinc-500">
            {visionMode !== 'normal'
              ? `Simulating ${activeVisionInfo?.title} · Filter active`
              : demo
              ? 'Sample preview · select issues to see highlighted elements'
              : scanId
              ? 'Live website preview · click red markers for issue details & code fixes'
              : 'Target website preview · scan site to overlay markers'}
          </span>
        </div>
      </div>
    </section>
  );
}
