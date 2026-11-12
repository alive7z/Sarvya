import { ArrowRight, ScanLine, MousePointer2, Wrench, ShieldCheck, CircleHelp, History, CalendarClock, FileDown, Code2, ChevronDown } from 'lucide-react';

const panel = 'workspace-panel rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900';
const muted = 'text-sm leading-6 text-zinc-600 dark:text-zinc-400';
const steps = [
  [ScanLine, 'Choose your scope', 'Enter a public website address. Scan one page first, or use Scan all pages to set a page limit and crawl depth.'],
  [MousePointer2, 'Understand each finding', 'Review the severity, rule, and affected elements. Select a finding to inspect its preview where highlighting is supported.'],
  [Wrench, 'Review a proposed fix', 'Read the explanation and suggested change. Check that it fits your content and source code before applying it.'],
  [ShieldCheck, 'Verify and review', 'Verify supported snippets in isolation, then check the real page. Keyboard navigation and other requirements still need human review.'],
];
const concepts = [
  ['Severity', 'Helps you prioritise attention. Start with critical and serious findings, then review the remaining issues.'],
  ['Affected elements', 'Shows where a rule failed. One rule can affect several elements, so rule counts and occurrence counts can differ.'],
  ['Accessibility score', 'A project-defined estimate based on automated findings. It is not an official WCAG rating or proof of compliance.'],
  ['Verification status', 'A proposed or copied fix is not verified. An isolated check applies only to the tested snippet and supported rule.'],
];
const tools = [
  ['history', History, 'Revisit an audit', 'Open stored runs and review the findings captured at that time.', 'Open history'],
  ['monitoring', CalendarClock, 'Track changes over time', 'Schedule audits, choose a baseline, and review regression notifications.', 'Open monitoring'],
  ['reports', FileDown, 'Share your findings', 'Export the current audit with its rule details, evidence, and remediation proposals.', 'Open reports'],
];
const endpoints = [
  ['POST', '/api/scan', 'Submit an audit; returns a queued run ID.'],
  ['GET', '/api/scans/:id', 'Read the run status, progress, and completed results.'],
  ['POST', '/api/crawl', 'Queue bounded discovery of links on the same origin.'],
  ['GET', '/api/scans', 'List stored scan runs.'],
  ['POST', '/api/fixes/generate', 'Create a remediation proposal for review.'],
  ['POST', '/api/fixes/verify', 'Check a supported snippet in an isolated browser.'],
  ['GET', '/api/monitors', 'List saved recurring audit schedules.'],
  ['GET', '/api/github/repos', 'List repositories after GitHub authentication is configured.'],
  ['GET', '/api/health', 'Check API process liveness.'],
];

export default function DocumentationGuide({ onNavigate }) {
  return <div className="space-y-6">
    <section id="quick-start" aria-labelledby="guide-start-title" className={`${panel} overflow-hidden`}>
      <div className="grid lg:grid-cols-[1.5fr_1fr]">
        <div className="p-6 sm:p-8 lg:p-10">
          <span className="text-xs font-semibold uppercase tracking-wider text-accent-700 dark:text-accent-300">Start here</span>
          <h2 id="guide-start-title" className="mt-3 text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl dark:text-zinc-100">From your first scan to a clear next step.</h2>
          <p className={`${muted} mt-4 max-w-2xl`}>Use this guide to run an audit, understand the evidence, and decide what to improve. Begin with a single page to get familiar with the workspace.</p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => onNavigate('workspace')} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-accent-600 px-5 py-3 text-sm font-semibold text-white hover:bg-accent-700">Start an audit <ArrowRight size={16} aria-hidden="true" /></button>
            <a href="#audit-workflow" className="inline-flex min-h-11 items-center rounded-xl border border-zinc-300 px-4 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">Explore the workflow</a>
          </div>
        </div>
        <aside aria-labelledby="guide-before-title" className="border-t border-zinc-200 bg-zinc-50/70 p-6 sm:p-8 lg:border-l lg:border-t-0 lg:p-10 dark:border-zinc-700 dark:bg-zinc-800/40">
          <h3 id="guide-before-title" className="text-base font-bold text-zinc-900 dark:text-zinc-100">Before you begin</h3>
          <ul className="mt-4 space-y-4 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
            <li className="flex gap-3"><span aria-hidden="true" className="mt-1 font-semibold text-accent-700 dark:text-accent-300">01</span><span>Choose a public website you are authorised to audit.</span></li>
            <li className="flex gap-3"><span aria-hidden="true" className="mt-1 font-semibold text-accent-700 dark:text-accent-300">02</span><span>Enter example.com, www.example.com, or a full URL. HTTPS is added when missing.</span></li>
            <li className="flex gap-3"><span aria-hidden="true" className="mt-1 font-semibold text-accent-700 dark:text-accent-300">03</span><span>Allow time for the background scan to finish before reviewing its results.</span></li>
          </ul>
        </aside>
      </div>
    </section>

    <section id="audit-workflow" aria-labelledby="guide-workflow-title" className="space-y-4">
      <div><h2 id="guide-workflow-title" className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">The audit workflow</h2><p className={`${muted} mt-1`}>Four steps to turn automated findings into informed decisions.</p></div>
      <ol className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {steps.map(([Icon, title, description], index) => <li key={title} className={`${panel} p-6`}>
          <div className="flex items-center justify-between"><span className="flex h-10 w-10 items-center justify-center rounded-xl border border-accent-200 bg-accent-50 text-accent-700 dark:border-accent-800 dark:bg-accent-950/30 dark:text-accent-300"><Icon size={20} aria-hidden="true" /></span><span aria-label={`Step ${index + 1}`} className="font-mono text-xs font-medium text-zinc-500 dark:text-zinc-400">0{index + 1}</span></div>
          <h3 className="mt-5 text-base font-bold text-zinc-900 dark:text-zinc-100">{title}</h3><p className={`${muted} mt-2`}>{description}</p>
        </li>)}
      </ol>
    </section>

    <section id="understand-results" aria-labelledby="guide-results-title" className={`${panel} p-6 sm:p-8`}>
      <h2 id="guide-results-title" className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Read your results with confidence</h2>
      <p className={`${muted} mt-2`}>These terms appear throughout the workspace and reports.</p>
      <dl className="mt-6 grid gap-x-10 gap-y-6 md:grid-cols-2">{concepts.map(([term, description]) => <div key={term} className="border-t border-zinc-200 pt-4 dark:border-zinc-700"><dt className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{term}</dt><dd className={`${muted} mt-2`}>{description}</dd></div>)}</dl>
      <div className="mt-6 flex gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50"><CircleHelp size={19} className="mt-0.5 shrink-0 text-zinc-600 dark:text-zinc-300" aria-hidden="true" /><p className="text-sm leading-6 text-zinc-600 dark:text-zinc-300">A scan with no automated violations still needs manual accessibility testing. Embedded previews and highlights also depend on what the target page supports.</p></div>
    </section>

    <section id="next-steps-guide" aria-labelledby="guide-next-title" className="space-y-4">
      <div><h2 id="guide-next-title" className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Keep your work moving</h2><p className={`${muted} mt-1`}>Return to past evidence, monitor changes, or share a report.</p></div>
      <div className="grid gap-4 md:grid-cols-3">{tools.map(([page, Icon, title, description, label]) => <article key={page} className={`${panel} flex flex-col p-6`}>
        <Icon size={22} className="text-accent-700 dark:text-accent-300" aria-hidden="true" /><h3 className="mt-4 text-base font-bold text-zinc-900 dark:text-zinc-100">{title}</h3><p className={`${muted} mb-5 mt-2`}>{description}</p>
        <button type="button" onClick={() => onNavigate(page)} className="mt-auto inline-flex min-h-10 items-center justify-between gap-3 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">{label}<ArrowRight size={15} aria-hidden="true" /></button>
      </article>)}</div>
    </section>

    <details id="api-reference" className={`${panel} group overflow-hidden`}>
      <summary className="flex cursor-pointer list-none items-center gap-3 p-6 sm:p-8 [&::-webkit-details-marker]:hidden">
        <Code2 size={21} className="shrink-0 text-zinc-600 dark:text-zinc-300" aria-hidden="true" /><span className="min-w-0 flex-1"><span className="block text-base font-bold text-zinc-900 dark:text-zinc-100">API reference</span><span className="mt-1 block text-sm text-zinc-600 dark:text-zinc-400">Optional technical details for integrations.</span></span><ChevronDown size={18} className="shrink-0 text-zinc-600 transition-transform group-open:rotate-180 dark:text-zinc-300" aria-hidden="true" />
      </summary>
      <div className="border-t border-zinc-200 p-6 sm:p-8 dark:border-zinc-700"><p className={`${muted} mb-5`}>Scan and crawl submissions return a queued run ID. Read the corresponding status endpoint for progress and results. Access restrictions apply in deployed workspaces.</p><div className="overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">Available Sarvya API endpoints</caption><thead><tr className="border-b border-zinc-200 dark:border-zinc-700"><th scope="col" className="pb-3 pr-4 font-semibold text-zinc-700 dark:text-zinc-300">Method</th><th scope="col" className="pb-3 pr-4 font-semibold text-zinc-700 dark:text-zinc-300">Endpoint</th><th scope="col" className="pb-3 font-semibold text-zinc-700 dark:text-zinc-300">Purpose</th></tr></thead><tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">{endpoints.map(([method, endpoint, purpose]) => <tr key={endpoint}><td className="py-4 pr-4 align-top font-mono text-xs font-semibold text-zinc-700 dark:text-zinc-300">{method}</td><td className="py-4 pr-4 align-top"><code className="whitespace-nowrap text-xs text-zinc-700 dark:text-zinc-300">{endpoint}</code></td><td className="min-w-[200px] py-4 align-top text-zinc-600 dark:text-zinc-400">{purpose}</td></tr>)}</tbody></table></div></div>
    </details>
  </div>;
}
