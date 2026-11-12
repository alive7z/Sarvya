import DocumentationGuide from '../components/education/DocumentationGuide.jsx';
import { normalizeWebsiteUrl } from '../utils/websiteUrl.js';
import { demoIssues, demoHtml, DEMO_HOST } from '../data/demoAudit.js';
import PageHeader, { PageSections } from '../components/layout/PageHeader.jsx';
import { useEffect, useRef, useState } from 'react';
import Topbar from '../components/layout/Topbar.jsx';
import ScanForm from '../components/scan/ScanForm.jsx';
import SummaryCards from '../components/dashboard/SummaryCards.jsx';
import IssuePanel from '../components/issues/IssuePanel.jsx';
import CrawlModal from '../components/crawl/CrawlModal.jsx';
import WebsitePreview from '../components/preview/WebsitePreview.jsx';
import ReportActions from '../components/reports/ReportActions.jsx';
import MonitoringPanel from '../components/monitoring/MonitoringPanel.jsx';
import GitHubIntegration from '../components/github/GitHubIntegration.jsx';
import CompareModal from '../components/compare/CompareModal.jsx';
import VerificationModal from '../components/issues/VerificationModal.jsx';
import AssistiveVisionHub from '../components/education/AssistiveVisionHub.jsx';
import ExtensionHub from '../components/extension/ExtensionHub.jsx';
import ExecutiveReportModal from '../components/reports/ExecutiveReportModal.jsx';
import {
  createScan,
  cancelScan,
  ACTIVE_SCAN_STATES,
  listScans,
  verifyFixApi,
  generateFixApi,
} from '../services/scanService.js';
import useScanStatus from '../hooks/useScanStatus.js';
import {
  Activity,
  ArrowUpRight,
  Check,
  Clock3,
  FileDown,
  Globe2,
  Moon,
  Sun,
  X,
  ShieldCheck,
  ArrowLeft,
  BookOpen,
  History,
  Settings2,
  FileText,
  CheckCircle2,
  ExternalLink,
  AlertCircle,
  Code2,
  RefreshCw,
  LoaderCircle,
  Download,
  Printer,
} from 'lucide-react';

const cardStyle =
  'workspace-panel overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-[0_4px_14px_rgba(0,0,0,0.035),0_14px_35px_rgba(0,0,0,0.035)] transition-all duration-300 hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-black/10';

const primaryButton =
  'inline-flex min-h-[44px] items-center justify-center gap-2.5 rounded-xl bg-zinc-900 px-5 text-[12px] font-bold text-white shadow-[0_4px_14px_rgba(0,0,0,0.12)] transition-all duration-200 hover:bg-zinc-800 hover:shadow-[0_8px_22px_rgba(0,0,0,0.18)] active:scale-[0.99] dark:bg-accent-600 dark:hover:bg-accent-500';

const secondaryButton =
  'inline-flex min-h-[43px] items-center justify-center gap-2.5 rounded-xl border border-zinc-200 bg-white px-4 text-[12px] font-bold text-zinc-700 shadow-sm transition-all duration-200 hover:border-accent-300 hover:bg-accent-50 hover:text-accent-600 hover:shadow-md active:scale-[0.99] dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:border-accent-800 dark:hover:bg-accent-500/10 dark:hover:text-accent-400';

function Badge({ children, tone = 'neutral' }) {
  const tones = {
    neutral:
      'border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
    orange:
      'border-accent-200 bg-accent-50 text-accent-700 dark:border-accent-900/50 dark:bg-accent-500/10 dark:text-accent-400',
    green:
      'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-500/10 dark:text-emerald-400',
  };

  return (
    <span
      className={`inline-flex w-fit items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.04em] ${
        tones[tone] || tones.neutral
      }`}
    >
      {children}
    </span>
  );
}

function safeHost(value) {
  try {
    return value ? new URL(value).host : DEMO_HOST;
  } catch {
    return DEMO_HOST;
  }
}

export default function AuditDashboard() {
  const [issues, setIssues] = useState(demoIssues);
  const [activeId, setActiveId] = useState('image-alt');
  const [expanded, setExpanded] = useState('image-alt');
  const [query, setQuery] = useState('');
  const [severity, setSeverity] = useState('All severities');
  const [page, setPage] = useState(() => new URLSearchParams(window.location.search).has('github') || window.location.hash.startsWith('#github') ? 'github' : 'workspace');
  const [url, setUrl] = useState('');
  useEffect(() => {
    const current = new URL(window.location.href);
    if (page === 'github' && !current.hash.startsWith('#github')) current.hash = 'github';
    else if (page !== 'github' && current.hash.startsWith('#github')) current.hash = '';
    window.history.replaceState(null, '', current);
  }, [page]);
  const [scanId, setScanId] = useState('');
  const [scanState, setScanState] = useState('idle');
  const [scanError, setScanError] = useState('');
  const [cancelPending, setCancelPending] = useState(false);
  const loadedResult = useRef(null);
  const [demo, setDemo] = useState(true);
  const [theme, setTheme] = useState('light');
  const [mobileTab, setMobileTab] = useState('issues');
  const [showCrawl, setShowCrawl] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [toast, setToast] = useState('');
  const [filter, setFilter] = useState('All issues');
  const [viewport, setViewport] = useState('desktop');
  const [visionMode, setVisionMode] = useState('normal');
  const [verifyModalIssue, setVerifyModalIssue] = useState(null);
  const [inspectTrigger, setInspectTrigger] = useState(null);
  const [viewMode, setViewMode] = useState('rules');

  const iframe = useRef(null);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [page]);

  const { scan: scanResult, error: statusError } = useScanStatus(scanId);

  function flattenIssuesToNodes(rawIssues) {
    const result = [];
    rawIssues.forEach((issue) => {
      const nodes = Array.isArray(issue.nodes) && issue.nodes.length > 0
        ? issue.nodes
        : [
            {
              id: `${issue.id}-node-0`,
              index: 1,
              selector: issue.selector,
              snippet: issue.snippet,
              fix: issue.fix,
              summary: issue.explanation || '',
              boundingBox: issue.boundingBox || null,
            },
          ];

      nodes.forEach((node, idx) => {
        result.push({
          ...issue,
          id: `${issue.id}-element-${idx}`,
          parentRuleId: issue.id,
          count: 1,
          nodeIndex: idx + 1,
          totalNodes: nodes.length,
          selector: node.selector || issue.selector,
          snippet: node.snippet || node.html || issue.snippet,
          fix: node.fix || issue.fix,
          summary: node.summary || issue.explanation,
          boundingBox: node.boundingBox || issue.boundingBox || null,
          isElementView: true,
        });
      });
    });
    return result;
  }

  const totalNodesCount = issues.reduce(
    (sum, iss) => sum + (Array.isArray(iss.nodes) && iss.nodes.length > 0 ? iss.nodes.length : (Number(iss.count) || 1)),
    0
  );

  const displayIssues = viewMode === 'elements' ? flattenIssuesToNodes(issues) : issues;

  const active = displayIssues.find((issue) => issue.id === activeId) || issues.find((issue) => issue.id === activeId) || displayIssues[0] || issues[0];

  const visibleIssues = displayIssues.filter(
    (issue) =>
      (severity === 'All severities' ||
        issue.severity === severity.toLowerCase()) &&
      (filter !== 'Open' || issue.status !== 'Ignored') &&
      (filter !== 'Verified' || issue.status === 'Verified') &&
      `${issue.title} ${issue.rule} ${issue.wcag} ${issue.selector || ''}`
        .toLowerCase()
        .includes(query.toLowerCase())
  );

  useEffect(() => {
    if (!toast) return;

    const timer = setTimeout(() => setToast(''), 3200);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!scanResult) return;
    setScanState(scanResult.status);
    setScanError(scanResult.error || '');
    if (scanResult.status === 'completed' && loadedResult.current !== scanResult.scanId) {
      loadedResult.current = scanResult.scanId;
      const findings = scanResult.issues || [];
      setIssues(findings); setActiveId(findings[0]?.id || ''); setExpanded(findings[0]?.id || '');
      setToast(`Scan completed: ${findings.length} violation type(s) across ${scanResult.pagesScanned} page(s).`);
    }
  }, [scanResult]);

  useEffect(() => { if (statusError) setScanError(statusError); }, [statusError]);

  async function handleCancelScan() {
    if (!scanId || cancelPending) return;
    setCancelPending(true);
    try { const run = await cancelScan(scanId); setScanState(run.status); setScanError(''); }
    catch (error) { setScanError(error.userMessage || error.message || 'Could not request cancellation.'); }
    finally { setCancelPending(false); }
  }

  async function startScan(event) {
    event?.preventDefault();

    setScanError('');

    let normalized;

    try {
      normalized = normalizeWebsiteUrl(url);
    } catch (error) {
      setScanError(error.message);
      return;
    }

    setUrl(normalized);
    setScanState('submitting');
    setDemo(false);
    setIssues([]);
    setActiveId('');
    setExpanded('');
    setScanId('');

    try {
      const scan = await createScan(normalized);

      setScanId(scan.scanId);
      setScanState(scan.status);
    } catch (error) {
      setScanState('failed');
      setIssues([]);
      setActiveId('');
      setExpanded('');
      setScanError(
        error.userMessage ||
          error.message ||
          'The accessibility scan failed. Check that the backend is running on port 3000.'
      );
    }
  }

  async function handleStartCrawl(options = {}) {
    const target = String(options.url || url || '').trim();
    if (!target) {
      setScanError('Enter a website URL before crawling.');
      setShowCrawl(false);
      return;
    }
    let normalized;
    try {
      normalized = normalizeWebsiteUrl(target);
    } catch (error) {
      setScanError(error.message);
      setShowCrawl(false);
      return;
    }

    setUrl(normalized);
    setShowCrawl(false);
    setScanError('');
    setScanState('submitting');
    setDemo(false);
    setIssues([]);
    setActiveId('');
    setExpanded('');
    setScanId('');
    setToast(`Submitting an audit of up to ${options.maxPages || 5} pages…`);

    try {
      const scan = await createScan(normalized, {
        maxPages: options.maxPages || 5,
        maxDepth: options.maxDepth ?? 1,
      });

      setScanId(scan.scanId);
      setScanState(scan.status);
    } catch (error) {
      setScanState('failed');
      setScanError(
        error.userMessage || error.message || 'Multi-page crawl and audit failed.'
      );
    }
  }

  function handleVerifyFix(issue) {
    if (!issue) return;
    setVerifyModalIssue(issue);
  }

  async function handleGenerateFix(issue) {
    setToast(`Generating tailored fix for "${issue.rule}"…`);
    try {
      const result = await generateFixApi(
        issue.rule,
        issue.snippet,
        issue.explanation
      );
      if (result.fix) {
        setIssues((items) =>
          items.map((item) =>
            item.id === issue.id ? { ...item, fix: result.fix } : item
          )
        );
        setToast(`Updated suggested fix for "${issue.rule}".`);
      }
    } catch (err) {
      setToast(err.userMessage || err.message || 'Could not generate fix.');
    }
  }

  function handleInspect(target) {
    if (!target) return;
    const isString = typeof target === 'string';
    const selector = isString ? target : (target.selector || '');
    const rule = isString ? (active?.rule || '') : (target.rule || active?.rule || '');
    const targetId = isString ? (active?.id || '') : (target.id || active?.id || '');

    if (!isString && target.id) {
      setActiveId(target.id);
      setExpanded(target.id);
    }
    setInspectTrigger({ id: targetId, selector, time: Date.now() });

    if (iframe.current?.contentWindow) {
      try {
        iframe.current.contentWindow.postMessage(
          {
            type: 'SARVYA_INSPECT',
            selector,
            rule,
          },
          '*'
        );
      } catch {
        // Ignore iframe postMessage error
      }
    }

    setMobileTab('preview');
    setToast(`Inspecting: focused on "${selector || rule}"`);
  }

  function loadScanIntoWorkspace(pastScan) {
    if (!pastScan) return;
    setUrl(pastScan.startUrl || '');
    setIssues(pastScan.issues || []);
    setScanId(pastScan.scanId || '');
    setActiveId(pastScan.issues?.[0]?.id || '');
    setExpanded(pastScan.issues?.[0]?.id || '');
    setDemo(false);
    setScanState(pastScan.status || 'completed');
    setScanError(pastScan.error || '');
    loadedResult.current = pastScan.status === 'completed' ? pastScan.scanId : null;
    setPage('workspace');
    setToast(`Loaded scan for ${pastScan.startUrl}`);
  }

  function toggleDecision(issue) {
    const next = issue.status === 'Ignored' ? 'Not tested' : 'Ignored';

    setIssues((items) =>
      items.map((item) =>
        item.id === issue.id ? { ...item, status: next } : item
      )
    );
  }

  async function copyFix(fix) {
    try {
      await navigator.clipboard.writeText(fix);
      setToast('Suggested fix copied to clipboard');
    } catch {
      setToast('Clipboard access is unavailable');
    }
  }

  function exportCsv() {
    if (!issues.length) {
      setToast('Run a scan before exporting a report');
      return;
    }

    const rows = [
      [
        'Issue',
        'Severity',
        'WCAG',
        'Rule',
        'Elements',
        'Target Selector',
        'Suggested Fix',
        'Status',
      ],
      ...issues.map((issue) => [
        issue.title,
        issue.severity,
        issue.wcag,
        issue.rule,
        issue.count,
        issue.selector,
        issue.fix,
        issue.status,
      ]),
    ];

    const csv = rows
      .map((row) =>
        row
          .map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`)
          .join(',')
      )
      .join('\n');

    const objectUrl = URL.createObjectURL(
      new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    );

    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = `sarvya-audit-${Date.now()}.csv`;
    link.click();

    URL.revokeObjectURL(objectUrl);
    setToast('CSV report exported');
  }

  function exportJson() {
    if (!issues.length) {
      setToast('Run a scan before exporting JSON');
      return;
    }

    const payload = {
      scanId,
      url: url || 'Sample Demo Audit',
      date: new Date().toISOString(),
      issuesCount: issues.length,
      issues,
    };

    const objectUrl = URL.createObjectURL(
      new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json',
      })
    );

    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = `sarvya-report-${Date.now()}.json`;
    link.click();

    URL.revokeObjectURL(objectUrl);
    setToast('JSON report exported');
  }

  return (
    <div
      className={`app-shell theme-${theme} min-h-screen bg-[#f7f8fa] font-sans text-zinc-900 transition-colors duration-300 dark:bg-[#131312] dark:text-zinc-100 ${
        theme === 'dark' ? 'dark' : ''
      }`}
    >
      <Topbar
        page={page}
        onNavigate={setPage}
        theme={theme}
        onThemeChange={setTheme}
        demo={demo}
      />

      {page === 'workspace' ? (
        <main
          id="workspace"
          className="page-main"
        >
          <PageHeader title="Audit workspace" description="Find accessibility barriers, inspect findings, and review suggested fixes." category="Audit" actions={(
            <div className="flex flex-wrap items-center gap-2">
              {demo ? (
                <button
                  type="button"
                  disabled={ACTIVE_SCAN_STATES.includes(scanState)}
                  onClick={() => {
                    setUrl('');
                    setIssues([]);
                    setActiveId('');
                    setDemo(false);
                    setScanState('idle');
                    setToast('Workspace cleared. Enter a website URL to scan.');
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[11px] font-bold text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                >
                  Clear Demo Data
                </button>
              ) : (
                <button
                  type="button"
                  disabled={ACTIVE_SCAN_STATES.includes(scanState)}
                  onClick={() => {
                    setUrl('');
                    setIssues(demoIssues);
                    setActiveId('image-alt');
                    setDemo(true);
                    setScanState('idle');
                    setToast('Loaded sample demo audit.');
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[11px] font-bold text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                >
                  Load Sample Data
                </button>
              )}

              <div className="inline-flex w-fit shrink-0 items-center gap-2.5 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-[11px] font-semibold text-zinc-600 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                <Clock3 size={16} className="text-accent-500" />
                <span>
                  {scanState === 'completed' ? 'Scan completed' : ACTIVE_SCAN_STATES.includes(scanState) ? 'Scan in progress' : scanState === 'cancelled' ? 'Scan cancelled' : scanState === 'failed' ? 'Scan failed' : 'Ready to scan'}
                </span>
              </div>

              {url && (
                <button
                  type="button"
                  onClick={startScan}
                  disabled={ACTIVE_SCAN_STATES.includes(scanState)}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-accent-200 bg-accent-50 px-4 text-[11px] font-bold text-accent-600 shadow-sm transition-all hover:bg-accent-100 active:scale-95 disabled:opacity-60 dark:border-accent-900/50 dark:bg-accent-500/10 dark:text-accent-400"
                >
                  <RefreshCw
                    size={14}
                    className={ACTIVE_SCAN_STATES.includes(scanState) ? 'animate-spin' : ''}
                  />
                  Rescan site
                </button>
              )}
            </div>
          )} />
          <PageSections items={[["scan-setup", "Scan setup"], ["scan-summary", "Overview"], ["scan-findings", "Findings"], ["scan-next-steps", "Next steps"]]} />


          <div id="scan-setup" className="mb-5">
            <ScanForm
              url={url}
              onUrlChange={setUrl}
              onSubmit={startScan}
              onCrawl={() => setShowCrawl(true)}
              busy={ACTIVE_SCAN_STATES.includes(scanState)}
              demo={demo}
              state={scanState}
              progress={scanResult?.progress}
              stage={scanResult?.stage}
              attempt={scanResult?.attempt}
              maxAttempts={scanResult?.maxAttempts}
              onCancel={scanId ? handleCancelScan : undefined}
              cancelPending={cancelPending || scanState === 'cancelling'}
              error={scanError}
            />
          </div>

          <div id="scan-summary"><SummaryCards issues={issues} scanState={scanState} scoreFromScan={scanResult?.score} /></div>

          <section id="scan-findings" className="mt-8">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-[20px] font-extrabold tracking-[-0.6px] text-zinc-900 dark:text-zinc-100 sm:text-[23px]">
                  Findings & inspection
                </h2>

                <p className="mt-1.5 text-[12px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                  Explore detected issues and inspect affected elements.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center rounded-xl border border-zinc-200 bg-zinc-100 p-1 md:hidden dark:border-zinc-700 dark:bg-zinc-800">
                  {[
                    ['issues', 'Issues'],
                    ['preview', 'Preview'],
                  ].map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setMobileTab(id)}
                      aria-pressed={mobileTab === id}
                      className={`rounded-lg px-4 py-2 text-[11px] font-bold transition-all duration-200 ${
                        mobileTab === id
                          ? 'bg-white text-accent-600 shadow-sm dark:bg-zinc-700 dark:text-accent-400'
                          : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <span className="hidden max-w-[250px] items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-[11px] font-medium text-zinc-500 shadow-sm sm:inline-flex dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                  <Globe2 size={14} className="shrink-0 text-accent-500" />
                  <span className="truncate">{safeHost(url)}</span>
                </span>
              </div>
            </div>

            <div className="grid min-w-0 grid-cols-1 items-start gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)]">
              <IssuePanel
                className={mobileTab === 'preview' ? 'hidden md:flex' : ''}
                issues={issues}
                visibleIssues={visibleIssues}
                activeId={activeId}
                expanded={expanded}
                query={query}
                onQueryChange={setQuery}
                status={filter}
                onStatusChange={setFilter}
                severity={severity}
                onSeverityChange={setSeverity}
                onSort={() => setToast('Sorted by severity')}
                onSelect={(issue, inspectOnly) => {
                  if (inspectOnly) {
                    handleInspect(issue);
                  } else {
                    setActiveId(issue.id);
                    setExpanded(expanded === issue.id ? '' : issue.id);
                  }
                }}
                onCopy={copyFix}
                onIgnore={toggleDecision}
                onAction={setToast}
                onVerify={handleVerifyFix}
                onGenerateFix={handleGenerateFix}
                viewMode={viewMode}
                onViewModeChange={(mode) => {
                  setViewMode(mode);
                  setToast(mode === 'elements' ? `Showing all ${totalNodesCount} individual issues` : `Grouped into ${issues.length} WCAG rules`);
                }}
                totalNodesCount={totalNodesCount}
                rulesCount={issues.length}
                scanState={scanState}
              />

              <WebsitePreview
                capturedHtml={scanResult?.results?.find(result => result.url === url)?.html || scanResult?.results?.find(result => result.status === 'success')?.html}
                scanState={scanState}
                className={mobileTab === 'issues' ? 'hidden md:flex' : ''}
                iframeRef={iframe}
                srcDoc={demoHtml}
                demo={demo}
                url={url}
                scanId={scanId}
                selector={active?.selector}
                active={active}
                issues={issues}
                inspectTrigger={inspectTrigger}
                viewport={viewport}
                visionMode={visionMode}
                onVisionModeChange={setVisionMode}
                onViewportChange={setViewport}
                onRefresh={() => {
                  if (iframe.current) {
                    if (demo) {
                      iframe.current.srcdoc = demoHtml;
                    } else {
                      iframe.current.src = iframe.current.src;
                    }
                  }
                  setToast('Preview refreshed');
                }}
              />
            </div>
          </section>

          <div id="scan-next-steps"><ReportActions
            onExport={exportCsv}
            onCompare={() => setShowCompare(true)}
            onPullRequest={() => setPage('github')}
          /></div>

          <footer className="mt-9 flex flex-col gap-3 border-t border-zinc-200 pt-6 text-[11px] text-zinc-400 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800 dark:text-zinc-500">
            <span className="flex items-center gap-2 font-bold tracking-[0.04em]">
              SARVYA
              <span className="h-1 w-1 rounded-full bg-accent-500" />
              BUILT FOR A MORE ACCESSIBLE WEB
            </span>

            <span>
              Automated results are a guide and do not establish complete WCAG
              conformance.
            </span>
          </footer>
        </main>
      ) : (
        <main className="page-main">
          <AppPage
            page={page}
            theme={theme}
            setTheme={setTheme}
            onToast={setToast}
            onExportCsv={exportCsv}
            onExportJson={exportJson}
            onPrintPdf={() => setShowReportModal(true)}
            onNavigate={setPage}
            onLoadScan={loadScanIntoWorkspace}
          />
        </main>
      )}

      <CrawlModal
        open={showCrawl}
        url={url}
        onUrlChange={setUrl}
        onClose={() => setShowCrawl(false)}
        onStart={handleStartCrawl}
      />

      <CompareModal
        open={showCompare}
        currentScan={{ scanId, startUrl: url }}
        currentIssues={issues}
        onClose={() => setShowCompare(false)}
        onLoadScan={loadScanIntoWorkspace}
      />

      <ExecutiveReportModal
        open={showReportModal}
        onClose={() => setShowReportModal(false)}
        url={url}
        scanId={scanId}
        issues={issues}
      />

      <VerificationModal
        open={!!verifyModalIssue}
        issue={verifyModalIssue}
        onClose={() => setVerifyModalIssue(null)}
        onFixVerified={(id, fixedCode) => {
          setIssues((items) =>
            items.map((item) => {
              const matches = item.id === id || id?.startsWith(`${item.id}-element-`) || id?.startsWith(`${item.id}-node-`);
              if (matches) {
                const updatedNodes = Array.isArray(item.nodes)
                  ? item.nodes.map((n, idx) => {
                      if (verifyModalIssue?.activeNodeIndex === idx || n.selector === verifyModalIssue?.selector) {
                        return { ...n, fix: fixedCode };
                      }
                      return n;
                    })
                  : item.nodes;
                return { ...item, status: 'Verified', fix: fixedCode, nodes: updatedNodes };
              }
              return item;
            })
          );
          setToast('Fix verified and confirmed in Chromium sandbox!');
        }}
      />

      {toast && (
        <div
          role="status"
          className="fixed bottom-5 right-5 z-[100] flex max-w-[min(420px,calc(100vw-40px))] items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3.5 text-[12px] font-semibold text-zinc-700 shadow-[0_12px_45px_rgba(0,0,0,0.15)] dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
            <Check size={16} />
          </span>

          <span className="flex-1 leading-relaxed">{toast}</span>

          <button
            type="button"
            aria-label="Dismiss notification"
            onClick={() => setToast('')}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
          >
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}

function HistoryView({ onLoadScan, onToast }) {
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);

  async function fetchHistory() {
    setLoading(true);
    try {
      const data = await listScans();
      setScans(Array.isArray(data) ? data : []);
    } catch {
      setScans([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchHistory();
  }, []);

  return (
    <section id="scan-history" className={cardStyle}>
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-100 px-6 py-6 sm:px-8 dark:border-zinc-800">
        <div>
          <h2 className="text-[18px] font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">
            Previous audit scans
          </h2>
          <p className="mt-2 text-[12px] text-zinc-500 dark:text-zinc-400">
            Persisted history from your Sarvya scans and crawls.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchHistory}
          className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[11px] font-bold text-zinc-700 shadow-sm transition-all hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <div className="p-6 sm:p-8">
        {loading ? (
          <div className="flex min-h-[220px] flex-col items-center justify-center">
            <LoaderCircle size={28} className="animate-spin text-accent-500" />
            <p className="mt-3 text-[12px] text-zinc-400">Loading audit history…</p>
          </div>
        ) : scans.length > 0 ? (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {scans.map((scan) => {
              const issuesCount =
                scan.issues?.length || scan.totalViolationTypes || 0;
              const score = scan.score;

              return (
                <div
                  key={scan.scanId}
                  className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <Globe2 size={16} className="shrink-0 text-accent-500" />
                      <span className="truncate font-mono text-[13px] font-bold text-zinc-900 dark:text-zinc-100">
                        {scan.startUrl}
                      </span>

                      {score !== undefined && (
                        <span
                          className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                            score >= 80
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                              : score >= 50
                              ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
                              : 'bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-400'
                          }`}
                        >
                          Score {score}/100
                        </span>
                      )}
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-zinc-500 dark:text-zinc-400">
                      <span>
                        {new Date(
                          scan.createdAt || Date.now()
                        ).toLocaleString()}
                      </span>
                      <span>•</span>
                      <span>{scan.pagesScanned ?? 0} page(s) audited</span>
                      <span>•</span>
                      <span>{!scan.status || scan.status === 'completed' ? `${issuesCount} violation types detected` : `${scan.status} · results pending`}</span>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => onLoadScan(scan)}
                      className="inline-flex min-h-[38px] items-center gap-2 rounded-xl bg-zinc-900 px-4 text-[11px] font-bold text-white shadow-sm transition-all hover:bg-zinc-800 dark:bg-accent-600 dark:hover:bg-accent-500"
                    >
                      {ACTIVE_SCAN_STATES.includes(scan.status) ? 'View progress' : 'Load into workspace'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex min-h-[300px] flex-col items-center justify-center px-6 py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-50 text-zinc-400 shadow-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500">
              <Clock3 size={28} strokeWidth={1.6} />
            </div>

            <h3 className="mt-6 text-[17px] font-bold text-zinc-800 dark:text-zinc-200">
              No saved scans yet
            </h3>

            <p className="mt-2.5 max-w-[420px] text-[12px] leading-relaxed text-zinc-500 dark:text-zinc-400">
              Scan any website from the Workspace tab or run a multi-page crawl.
              Every completed audit will be saved here automatically.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function AppPage({
  page,
  theme,
  setTheme,
  onToast,
  onExportCsv,
  onExportJson,
  onPrintPdf,
  onNavigate,
  onLoadScan,
}) {
  const title = {
    history: 'Scan history',
    monitoring: 'Monitoring',
    github: 'GitHub integration',
    reports: 'Reports & export',
    docs: 'Documentation',
    settings: 'Settings',
  }[page];

  const descriptions = {
    history: 'Review previous runs and compare accessibility changes over time.',
    monitoring:
      'Schedule recurring scans and get notified when new issues appear.',
    github:
      'Review proposed source changes and open pull requests with approval.',
    reports:
      'Export findings and remediation details for your team in CSV and JSON formats.',
    docs: 'Learn how to use Sarvya and understand audit results.',
    settings: 'Manage your workspace preferences and API connection.',
  };

  const icons = {
    history: History,
    reports: FileText,
    docs: BookOpen,
    settings: Settings2,
  };

  if (page === 'vision') {
    return <AssistiveVisionHub onNavigate={onNavigate} />;
  }

  if (page === 'extension') {
    return <ExtensionHub onNavigate={onNavigate} />;
  }

  if (page === 'monitoring') {
    return <MonitoringPanel onNavigate={onNavigate} onLoadScan={onLoadScan} />;
  }

  if (page === 'github') {
    return <GitHubIntegration onNavigate={onNavigate} />;
  }

  return (
    <div className={`page-stack page-${page}`}>
      <PageHeader
        title={title}
        description={descriptions[page]}
        icon={icons[page]}
        onNavigate={onNavigate}
        category={page === 'docs' ? 'Resources' : page === 'settings' ? 'Preferences' : 'Manage'}
      />
      <PageSections items={{
        history: [['scan-history', 'Saved scans']],
        reports: [['report-exports', 'Export results'], ['report-fields', 'Report contents']],
        docs: [['quick-start', 'Getting started'], ['audit-workflow', 'Workflow'], ['understand-results', 'Understanding results'], ['next-steps-guide', 'Next steps'], ['api-reference', 'API reference']],
        settings: [['appearance', 'Appearance'], ['api-connection', 'API connection'], ['scan-guidance', 'Scan guidance']],
      }[page] || []} />

      {page === 'history' && (
        <HistoryView onLoadScan={onLoadScan} onToast={onToast} />
      )}

      {page === 'reports' && (
        <div className="page-detail-grid">
          <section id="report-exports" className={cardStyle}>
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-100 px-6 py-6 sm:px-8 dark:border-zinc-800">
              <div>
                <h2 className="text-[18px] font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">
                  Export audit results
                </h2>

                <p className="mt-2 max-w-[640px] text-[12px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                  Download findings with severity, WCAG references, selectors,
                  and remediation suggestions.
                </p>
              </div>

              <div className="flex gap-2">
                <Badge tone="green">CSV READY</Badge>
                <Badge tone="orange">JSON READY</Badge>
              </div>
            </div>

            <div className="p-6 sm:p-8 space-y-4">
              <div className="flex flex-col gap-5 rounded-xl border border-zinc-200 bg-zinc-50/60 p-5 sm:flex-row sm:items-center dark:border-zinc-700 dark:bg-zinc-800/40">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-accent-100 bg-accent-50 text-accent-600 dark:border-accent-900/40 dark:bg-accent-500/10 dark:text-accent-400">
                  <FileDown size={23} />
                </div>

                <div className="min-w-0 flex-1">
                  <h3 className="text-[14px] font-bold text-zinc-900 dark:text-zinc-100">
                    Spreadsheet export (CSV)
                  </h3>

                  <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                    Comma-separated values · compatible with Excel, Google
                    Sheets, and issue trackers
                  </p>
                </div>

                <button
                  type="button"
                  onClick={onExportCsv}
                  className={primaryButton}
                >
                  <FileDown size={16} />
                  Download CSV
                </button>
              </div>

              <div className="flex flex-col gap-5 rounded-xl border border-zinc-200 bg-zinc-50/60 p-5 sm:flex-row sm:items-center dark:border-zinc-700 dark:bg-zinc-800/40">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-accent-100 bg-accent-50 text-accent-600 dark:border-accent-900/40 dark:bg-accent-500/10 dark:text-accent-400">
                  <Download size={23} />
                </div>

                <div className="min-w-0 flex-1">
                  <h3 className="text-[14px] font-bold text-zinc-900 dark:text-zinc-100">
                    Structured data report (JSON)
                  </h3>

                  <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                    Full audit payload with selectors, remediation snippets, and
                    metadata for CI/CD pipelines
                  </p>
                </div>

                <button
                  type="button"
                  onClick={onExportJson}
                  className={secondaryButton}
                >
                  <Download size={16} />
                  Download JSON
                </button>
              </div>

              <div className="flex flex-col gap-5 rounded-xl border border-zinc-200 bg-zinc-50/60 p-5 sm:flex-row sm:items-center dark:border-zinc-700 dark:bg-zinc-800/40">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-accent-100 bg-accent-50 text-accent-600 dark:border-accent-900/40 dark:bg-accent-500/10 dark:text-accent-400">
                  <Printer size={23} />
                </div>

                <div className="min-w-0 flex-1">
                  <h3 className="text-[14px] font-bold text-zinc-900 dark:text-zinc-100">
                    Executive Audit Report (PDF / Print)
                  </h3>

                  <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                    Printable document with accessibility scores, severity breakdown, and detailed remediation guidelines
                  </p>
                </div>

                <button
                  type="button"
                  onClick={onPrintPdf || (() => window.print())}
                  className={primaryButton}
                >
                  <Printer size={16} />
                  Print / Save PDF
                </button>
              </div>
            </div>
          </section>

          <section id="report-fields" className={`${cardStyle} p-6 sm:p-8`}>
            <h2 className="text-[17px] font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">
              Included report fields
            </h2>

            <div className="mt-6 grid gap-4">
              {[
                'Issue title and axe-core rule ID',
                'Severity and affected node count',
                'WCAG criterion and guidelines',
                'Target CSS selector & safe snippet',
                'Suggested remediation code snippet',
                'Verification state and tested status',
              ].map((field) => (
                <div
                  key={field}
                  className="flex items-center gap-3 text-[12px] text-zinc-600 dark:text-zinc-400"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                    <Check size={14} />
                  </span>

                  {field}
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {page === 'docs' && <DocumentationGuide onNavigate={onNavigate} />}

      {page === 'settings' && (
        <div className="page-settings-grid">
          <section id="appearance" className={cardStyle}>
            <div className="border-b border-zinc-100 px-6 py-6 sm:px-8 dark:border-zinc-800">
              <h2 className="text-[18px] font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">
                Appearance
              </h2>

              <p className="mt-2 text-[12px] text-zinc-500 dark:text-zinc-400">
                Adjust the workspace to your preference.
              </p>
            </div>

            <div className="flex flex-col gap-5 px-6 py-7 sm:flex-row sm:items-center sm:justify-between sm:px-8">
              <div>
                <h3 className="text-[13px] font-bold text-zinc-800 dark:text-zinc-200">
                  Color theme
                </h3>

                <p className="mt-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                  Choose a light or dark workspace.
                </p>
              </div>

              <div className="inline-flex w-fit items-center gap-1 rounded-xl border border-zinc-200 bg-zinc-100 p-1 dark:border-zinc-700 dark:bg-zinc-800">
                {[
                  ['light', 'Light', Sun],
                  ['dark', 'Dark', Moon],
                ].map(([value, label, Icon]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setTheme(value)}
                    aria-pressed={theme === value}
                    className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-[11px] font-bold transition-all duration-200 ${
                      theme === value
                        ? 'bg-white text-accent-600 shadow-sm dark:bg-zinc-700 dark:text-accent-400'
                        : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
                    }`}
                  >
                    <Icon size={16} />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section id="api-connection" className={cardStyle}>
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-100 px-6 py-6 sm:px-8 dark:border-zinc-800">
              <div>
                <h2 className="text-[18px] font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">
                  API connection
                </h2>

                <p className="mt-2 text-[12px] text-zinc-500 dark:text-zinc-400">
                  The frontend connects to this API base URL.
                </p>
              </div>

              <Badge tone="green">CONNECTED</Badge>
            </div>

            <div className="px-6 py-7 sm:px-8">
              <div className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-zinc-50/70 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-700 dark:bg-zinc-800/50">
                <span className="text-[12px] font-semibold text-zinc-600 dark:text-zinc-400">
                  API base URL
                </span>

                <code className="break-all rounded-lg border border-zinc-200 bg-white px-3 py-2 font-mono text-[11px] text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                  {import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}
                </code>
              </div>

              <p className="mt-5 text-[11px] leading-[1.9] text-zinc-500 dark:text-zinc-400">
                Defaulting to{' '}
                <code className="rounded bg-zinc-100 px-1.5 py-1 font-mono dark:bg-zinc-800">
                  http://localhost:3000
                </code>
                . Backend services include Chromium scanner, axe-core analysis,
                crawler, fix verification, and continuous monitoring.
              </p>
            </div>
          </section>

          <section id="scan-guidance" className={`${cardStyle} p-6 sm:p-8`}>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-50 text-accent-600 dark:bg-accent-500/10 dark:text-accent-400">
                <AlertCircle size={19} />
              </div>

              <div>
                <h2 className="text-[16px] font-extrabold text-zinc-900 dark:text-zinc-100">
                  About scan results
                </h2>

                <p className="mt-2 text-[12px] leading-[1.9] text-zinc-500 dark:text-zinc-400">
                  The score shown in the workspace is a project-defined estimate
                  based on issue severity and affected element counts. It is an
                  automated benchmark designed to guide remediation efforts.
                </p>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
