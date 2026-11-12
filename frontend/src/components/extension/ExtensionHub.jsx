import PageHeader, { PageSections } from '../layout/PageHeader.jsx';
import { Download, Puzzle, ShieldCheck, ScanLine, FileJson, MousePointer2 } from 'lucide-react';
const cards = [
  [ScanLine, 'Real page audits', 'Runs bundled axe-core on the current page after you press Scan. Shows rule IDs, impacts, affected targets, and checks needing manual review.'],
  [MousePointer2, 'Inspect affected elements', 'Supported selectors scroll to a removable dashed black-and-white highlight. Changed elements and frame or shadow-root targets show a clear explanation.'],
  [FileJson, 'Reports you control', 'Filter findings by impact and download the actual JSON report. Up to 100 targets per rule are retained, with full occurrence counts labelled.'],
  [ShieldCheck, 'Local and private', 'No page data is uploaded. Only activeTab, scripting, and session storage are requested. Clear results anytime; navigation and tab closure clear session results.'],
];
export default function ExtensionHub({ onNavigate }) {
  return <div className="page-stack">
    <PageHeader title="Browser extension" description="Audit a page locally in Chrome or Edge. The extension is available as an unpacked build; store publication is pending." category="Integrations" icon={Puzzle} onNavigate={onNavigate} actions={
      <a href="/downloads/sarvya-extension.zip" download className="inline-flex items-center gap-2 rounded-xl bg-accent-600 px-5 py-3 text-sm font-semibold text-white"><Download size={16} />Download extension ZIP</a>
    } />
    <PageSections items={[["extension-install", "Installation"], ["extension-features", "Capabilities"]]} />
    <section id="extension-install" className="workspace-panel rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
      <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Install the unpacked extension</h2>
      <ol className="mt-4 list-decimal space-y-3 pl-6 text-sm text-zinc-600 dark:text-zinc-300">
        <li>Download the ZIP above and extract it to a folder you can keep. For a source checkout, run <code>npm run release:pack</code> from the repository root after installing dependencies.</li>
        <li>Open <code>chrome://extensions</code> in Chrome or <code>edge://extensions</code> in Edge, then enable Developer mode.</li>
        <li>Select <strong>Load unpacked</strong> and choose the extracted folder containing <code>manifest.json</code>. For a source build, choose <code>extension/dist</code>.</li>
        <li>Open an HTTP(S) website, click the Sarvya extension icon, then choose <strong>Scan current page</strong>.</li>
      </ol>
      <p className="mt-5 text-xs text-zinc-500 dark:text-zinc-400">Downloads are included in the production build. In local development, prepare release artifacts first. Chrome Web Store and Edge Add-ons publication still require the owner's account and review.</p>
    </section>
    <section id="extension-features" className="grid gap-5 md:grid-cols-2">
      {cards.map(([Icon, title, description]) => <article key={title} className="workspace-panel rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900"><Icon size={24} className="text-accent-600 dark:text-accent-300" aria-hidden="true" /><h2 className="mt-4 text-base font-bold text-zinc-900 dark:text-zinc-100">{title}</h2><p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{description}</p></article>)}
    </section>
    <p className="text-xs text-zinc-500 dark:text-zinc-400">Automated audits do not prove WCAG conformance. Browser pages, extension stores, protected content, and some frames cannot be audited. Inspect only pages you are authorised to test.</p>
  </div>;
}
