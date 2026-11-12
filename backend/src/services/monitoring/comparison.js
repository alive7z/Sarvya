import { createHash } from 'node:crypto';
import { RunError } from '../runErrors.js';

export function pageIdentity(value) {
  try { const url = new URL(value); url.hash = ''; url.searchParams.sort(); return url.href; } catch { return String(value || ''); }
}
export function scopeIdentity(input) {
  return createHash('sha256').update(JSON.stringify([pageIdentity(input.url || input.startUrl), input.maxPages ?? input.configuration?.maxPages ?? 1, input.maxDepth ?? input.configuration?.maxDepth ?? 1])).digest('hex');
}
const rank = { minor: 1, moderate: 2, serious: 3, critical: 4 };
function evidence(run) {
  const pages = new Set((run.results || []).filter(p => p.status === 'success').map(p => pageIdentity(p.url)));
  const findings = new Map();
  const add = (rule, impact, url, selector, html = '', count = 1) => {
    url = pageIdentity(url || run.startUrl);
    selector = Array.isArray(selector) ? JSON.stringify(selector) : String(selector || '').trim();
    const generated = /(?:[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}|[a-f0-9]{20,}|\d{6,}|:(?:r|R)\d+:|(?:radix|headlessui|ember)[-_:]?\d+)/i.test(selector);
    const strong = Boolean(selector && !['Selector unavailable', 'HTML snippet unavailable'].includes(selector) && !generated);
    const key = createHash('sha256').update(JSON.stringify([rule, url, selector || String(html).replace(/\s+/g, ' ').slice(0, 500)])).digest('hex');
    const previous = findings.get(key);
    findings.set(key, { key, rule, impact: impact || 'moderate', url, selector: selector || '(selector unavailable)', count: (previous?.count || 0) + count, confidence: strong ? 'strong' : 'uncertain' });
  };
  if (Array.isArray(run.results) && run.results.some(p => Array.isArray(p.violations))) {
    for (const page of run.results) for (const violation of page.violations || []) {
      const nodes = violation.affectedElements || violation.nodes || [];
      if (!nodes.length) add(violation.id, violation.impact, page.url, '', violation.description);
      for (const node of nodes) add(violation.id, violation.impact, page.url, node.selector || node.target, node.html);
    }
  } else {
    for (const issue of run.issues || []) {
      if (issue.nodes?.length) for (const node of issue.nodes) add(issue.rule || issue.id, issue.severity, issue.url, node.selector, node.snippet);
      else add(issue.rule || issue.id, issue.severity, issue.url, issue.selector, issue.snippet, issue.count || 1);
    }
  }
  return { pages, findings };
}
export function compareScans(baseline, current) {
  if (baseline?.status !== 'completed' || current?.status !== 'completed') throw new RunError('Comparisons require two completed scans.', { status: 409 });
  const old = evidence(baseline), next = evidence(current), entries = [];
  for (const key of new Set([...old.findings.keys(), ...next.findings.keys()])) {
    const before = old.findings.get(key), after = next.findings.get(key), finding = after || before;
    const comparable = old.pages.has(finding.url) && next.pages.has(finding.url) && finding.confidence === 'strong' && (!before || before.confidence === 'strong');
    let change = !before ? 'new' : !after ? 'resolved' : 'persistent';
    if (!comparable) change = 'uncertain';
    const worsened = comparable && before && after && ((rank[after.impact] || 0) > (rank[before.impact] || 0) || after.count > before.count);
    entries.push({ ...finding, count: after?.count || 0, change, worsened: Boolean(worsened), previousImpact: before?.impact || null, previousCount: before?.count || 0,
      reason: !comparable ? 'Page coverage or selector evidence is insufficient to confirm a change.' : worsened ? 'Severity or affected occurrences increased.' : null });
  }
  const summary = { new: 0, resolved: 0, persistent: 0, uncertain: 0, worsened: 0 };
  for (const item of entries) { summary[item.change]++; if (item.worsened) summary.worsened++; }
  return { baselineScanId: baseline.scanId, scanId: current.scanId, summary, entries,
    coverage: { baselinePages: old.pages.size, currentPages: next.pages.size, sharedPages: [...old.pages].filter(url => next.pages.has(url)).length },
    scoreDelta: Number.isFinite(current.score) && Number.isFinite(baseline.score) ? current.score - baseline.score : null };
}
export function assertBaseline(run, config) {
  if (!run || run.status !== 'completed' || !run.results?.some(p => p.status === 'success') || run.pagesFailed || run.crawlErrors?.length || scopeIdentity(run) !== scopeIdentity(config)) throw new RunError('Choose a completed scan with matching URL/crawl limits and no page or discovery failures.', { status: 400 });
}
