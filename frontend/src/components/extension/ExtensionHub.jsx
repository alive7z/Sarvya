import PageHeader, { PageSections } from '../layout/PageHeader.jsx';
import { useState } from 'react';
import {
  Puzzle,
  Check,
  Copy,
  ExternalLink,
  Sparkles,
  ShieldCheck,
  Eye,
  Volume2,
  Code2,
  Layers,
  ArrowRight,
  Monitor,
} from 'lucide-react';

export default function ExtensionHub({ onNavigate }) {
  const [copied, setCopied] = useState(false);
  const extensionPath = 'c:\\Users\\nt200\\OneDrive\\Desktop\\HackAccess\\DevX\\extension';

  function handleCopyPath() {
    navigator.clipboard.writeText(extensionPath);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="page-stack">
      <PageHeader title="Browser extension" description="Installation instructions and a guide to the AccessLens browser extension's audit and review tools." category="Integrations" icon={Puzzle} onNavigate={onNavigate} actions={(
            <button
              type="button"
              onClick={handleCopyPath}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-600 px-5 py-3.5 text-xs font-bold text-white shadow-md transition-all hover:bg-orange-500 active:scale-95"
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
              <span>{copied ? 'Folder Path Copied!' : 'Copy Extension Path'}</span>
            </button>      )} />
      <PageSections items={[["extension-install", "Installation"], ["extension-features", "Capabilities"]]} />

      {/* 3-Step Installation Guide */}
      <section id="extension-install" className="workspace-panel rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
        <h2 className="text-lg font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">
          Install the extension
        </h2>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          No compile or build step required. The extension is pre-bundled and ready to load.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* Step 1 */}
          <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-5 dark:border-zinc-700 dark:bg-zinc-800/40">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500 font-mono text-sm font-bold text-white">
              1
            </div>
            <h3 className="mt-3 text-sm font-bold text-zinc-900 dark:text-zinc-100">
              Open Extensions Manager
            </h3>
            <p className="mt-1.5 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
              Open a new tab in Chrome or Edge and navigate to:
            </p>
            <code className="mt-2 block rounded-md bg-white p-2 font-mono text-[11px] font-semibold text-orange-600 shadow-sm dark:bg-zinc-900 dark:text-orange-400">
              chrome://extensions
            </code>
          </div>

          {/* Step 2 */}
          <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-5 dark:border-zinc-700 dark:bg-zinc-800/40">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500 font-mono text-sm font-bold text-white">
              2
            </div>
            <h3 className="mt-3 text-sm font-bold text-zinc-900 dark:text-zinc-100">
              Enable Developer Mode
            </h3>
            <p className="mt-1.5 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
              In the top-right corner of the Extensions page, toggle the switch labeled <strong className="text-zinc-700 dark:text-zinc-200">"Developer mode"</strong> to ON.
            </p>
          </div>

          {/* Step 3 */}
          <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-5 dark:border-zinc-700 dark:bg-zinc-800/40">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500 font-mono text-sm font-bold text-white">
              3
            </div>
            <h3 className="mt-3 text-sm font-bold text-zinc-900 dark:text-zinc-100">
              Click "Load unpacked"
            </h3>
            <p className="mt-1.5 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
              Click the top-left button and select this folder from your disk:
            </p>
            <div className="mt-2 flex items-center justify-between gap-2 rounded-md bg-white p-2 font-mono text-[10px] text-zinc-700 shadow-sm dark:bg-zinc-900 dark:text-zinc-300">
              <span className="truncate">{extensionPath}</span>
              <button
                type="button"
                onClick={handleCopyPath}
                className="shrink-0 text-orange-500 hover:text-orange-600 font-bold"
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Showcase Grid */}
      <section id="extension-features">
        <h2 className="mb-2 text-[18px] text-zinc-900 dark:text-zinc-100">Extension capabilities</h2>
        <p className="mb-5 text-[13px] text-zinc-500 dark:text-zinc-400">An overview of scanning, inspection, and remediation tools.</p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400">
            <Layers size={20} />
          </div>
          <h3 className="mt-4 text-base font-bold text-zinc-900 dark:text-zinc-100">
            In-Page Pulsing Error Markers
          </h3>
          <p className="mt-2 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
            AccessLens scans the active webpage's real DOM and pins glowing, pulsing badges over each inaccessible button, unlabelled image, or low-contrast text. Clicking any badge scrolls directly to the element.
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
            <Code2 size={20} />
          </div>
          <h3 className="mt-4 text-base font-bold text-zinc-900 dark:text-zinc-100">
            ⚡ Apply Fix Live to DOM
          </h3>
          <p className="mt-2 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
            Developers can click "Apply Fix Live" directly inside the in-page drawer. The extension dynamically mutates the active page's DOM element (adding alt, aria-label, or contrast styles) so you can test fixes in real time before editing source code.
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400">
            <Volume2 size={20} />
          </div>
          <h3 className="mt-4 text-base font-bold text-zinc-900 dark:text-zinc-100">
            Hear Screen Reader Speech
          </h3>
          <p className="mt-2 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
            Click "Hear Screen Reader Voice" on any error badge. The extension uses the browser's native Web Speech synthesis engine to speak aloud what a blind user hears through NVDA or VoiceOver before vs. after your fix.
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
            <Eye size={20} />
          </div>
          <h3 className="mt-4 text-base font-bold text-zinc-900 dark:text-zinc-100">
            On-Page Color Blindness Shaders
          </h3>
          <p className="mt-2 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
            Toggle Deuteranopia (green-blind), Protanopia (red-blind), Tritanopia (blue-blind), or Achromatopsia (monochrome) directly in the extension popup. SVG matrix shaders apply directly to the entire live page.
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
            <ShieldCheck size={20} />
          </div>
          <h3 className="mt-4 text-base font-bold text-zinc-900 dark:text-zinc-100">
            Zero-Leak Shadow DOM
          </h3>
          <p className="mt-2 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
            All in-page overlays, tooltips, and floating docks run inside an isolated Shadow DOM container. Host website CSS never breaks AccessLens, and AccessLens never breaks host website layout.
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400">
            <Monitor size={20} />
          </div>
          <h3 className="mt-4 text-base font-bold text-zinc-900 dark:text-zinc-100">
            Floating On-Page Mini-Dock
          </h3>
          <p className="mt-2 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
            A sleek floating pill sits in the bottom-right corner of the page showing live issue counts, allowing you to toggle markers on/off, change vision filters, or trigger a re-scan without having to reopen the popup.
          </p>
        </div>
      </div>
      </section>
    </div>
  );
}
