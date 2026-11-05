import api from './api.js';

const completedScans = new Map();

function getWcagCriterion(ruleId) {
  const criteria = {
    'image-alt': '1.1.1',
    'color-contrast': '1.4.3',
    'html-has-lang': '3.1.1',
    'link-name': '2.4.4',
    'button-name': '4.1.2',
    'select-name': '4.1.2',
    label: '1.3.1',
    'document-title': '2.4.2',
    'heading-order': '1.3.1',
    'meta-viewport': '1.4.4',
    'landmark-one-main': '1.3.1',
    'aria-roles': '4.1.2',
    'aria-allowed-attr': '4.1.2',
    'aria-required-attr': '4.1.2',
    'duplicate-id': '4.1.1',
  };

  return criteria[ruleId] || 'WCAG 2.1';
}

export async function createScan(url, options = {}) {
  const { data } = await api.post('/api/scan', {
    url,
    maxPages: options.maxPages ?? 1,
    maxDepth: options.maxDepth ?? 1,
  });

  const pages = Array.isArray(data.results) ? data.results : [];

  // Use processed issues from backend if provided, otherwise transform raw violations
  let issues = [];
  if (Array.isArray(data.issues) && data.issues.length > 0) {
    issues = data.issues.map((iss, index) => {
      const rawNodes = Array.isArray(iss.nodes) && iss.nodes.length > 0
        ? iss.nodes
        : (Array.isArray(iss.affectedElements) ? iss.affectedElements : []);

      const nodes = rawNodes.length > 0
        ? rawNodes.map((n, nIdx) => ({
            id: n.id || `${iss.id}-node-${nIdx}`,
            index: nIdx + 1,
            selector: Array.isArray(n.selector) ? n.selector.join(', ') : (n.selector || (Array.isArray(n.target) ? n.target.join(', ') : iss.selector)),
            snippet: n.snippet || n.html || iss.snippet || '',
            summary: n.summary || '',
            fix: n.fix || iss.fix,
            boundingBox: n.boundingBox || iss.boundingBox || null,
          }))
        : [
            {
              id: `${iss.id}-node-0`,
              index: 1,
              selector: iss.selector,
              snippet: iss.snippet,
              summary: iss.explanation || '',
              fix: iss.fix,
              boundingBox: iss.boundingBox || null,
            },
          ];

      return {
        ...iss,
        count: nodes.length,
        nodes,
      };
    });
  } else {
    const rawViolations = Array.isArray(data.violations)
      ? data.violations
      : pages.flatMap((page) =>
          (Array.isArray(page.violations) ? page.violations : []).map(
            (violation) => ({
              ...violation,
              url: violation.url || page.url,
            })
          )
        );

    issues = rawViolations.map((violation, index) => {
      const rawNodes = Array.isArray(violation.affectedElements)
        ? violation.affectedElements
        : Array.isArray(violation.nodes)
          ? violation.nodes
          : [];

      const firstNode = rawNodes[0] || {};

      const selector = Array.isArray(firstNode.selector)
        ? firstNode.selector.join(', ')
        : Array.isArray(firstNode.target)
          ? firstNode.target.join(', ')
          : firstNode.selector || 'Selector unavailable';

      const nodes = rawNodes.length > 0
        ? rawNodes.map((n, nIdx) => {
            const nodeSel = Array.isArray(n.selector)
              ? n.selector.join(', ')
              : Array.isArray(n.target)
                ? n.target.join(', ')
                : n.selector || `Target ${nIdx + 1}`;
            const nodeHtml = n.html || n.snippet || firstNode.html || '';
            const nodeFix = n.fix || firstNode.fix || `Review remediation guidance: ${violation.helpUrl || violation.help || 'No guidance available'}`;
            return {
              id: `${violation.id || 'issue'}-${index}-node-${nIdx}`,
              index: nIdx + 1,
              selector: nodeSel,
              snippet: nodeHtml,
              summary: n.summary || n.failureSummary || '',
              fix: nodeFix,
              boundingBox: n.boundingBox || null,
            };
          })
        : [
            {
              id: `${violation.id || 'issue'}-${index}-node-0`,
              index: 1,
              selector,
              snippet: firstNode.html || 'No HTML snippet available.',
              summary: violation.description || '',
              fix: firstNode.fix || `Review remediation guidance: ${violation.helpUrl || ''}`,
              boundingBox: null,
            },
          ];

      return {
        id: `${violation.id || 'issue'}-${index}`,
        title: violation.help || violation.id || 'Accessibility issue',
        rule: violation.id || 'unknown',
        severity: ['critical', 'serious', 'moderate', 'minor'].includes(violation.impact)
          ? violation.impact
          : 'moderate',
        wcag: getWcagCriterion(violation.id),
        count: nodes.length,
        selector,
        explanation: violation.description || violation.help || 'Review this accessibility finding.',
        snippet: firstNode.html || 'No HTML snippet available.',
        fix: firstNode.fix || firstNode.summary || `Review the remediation guidance: ${violation.helpUrl || violation.help || 'No guidance available'}`,
        helpUrl: violation.helpUrl,
        url: violation.url || data.startUrl || url,
        status: 'Not tested',
        nodes,
      };
    });
  }

  if ((data.pagesScanned ?? 0) === 0 && (data.pagesFailed ?? 0) > 0) {
    const failedPage = pages.find((page) => page.status === 'error');
    throw new Error(failedPage?.error || 'No pages could be scanned.');
  }

  const scanId = data.scanId || `scan-${Date.now()}`;

  const scan = {
    ...data,
    scanId,
    status: 'completed',
    startUrl: data.startUrl || url,
    score: data.score,
    pagesScanned: data.pagesScanned ?? pages.length,
    pagesFailed: data.pagesFailed ?? 0,
    pagesDiscovered: data.pagesDiscovered ?? pages.length,
    truncated: data.truncated ?? false,
    totalViolationTypes: data.totalViolationTypes ?? issues.length,
    totalAffectedElements:
      data.totalAffectedElements ?? issues.reduce((sum, issue) => sum + (issue.count || 1), 0),
    severityCounts: data.severityCounts || {},
    issues,
    results: pages,
    crawlErrors: data.crawlErrors || [],
  };

  completedScans.set(scanId, scan);
  return scan;
}

export async function getScan(scanId) {
  if (completedScans.has(scanId)) {
    return completedScans.get(scanId);
  }

  try {
    const { data } = await api.get(`/api/scans/${encodeURIComponent(scanId)}`);
    completedScans.set(scanId, data);
    return data;
  } catch {
    throw new Error('Scan result is unavailable. Please run the scan again.');
  }
}

export async function listScans() {
  try {
    const { data } = await api.get('/api/scans');
    return Array.isArray(data) ? data : [];
  } catch {
    return Array.from(completedScans.values());
  }
}

export async function getScanIssues(scanId) {
  const scan = await getScan(scanId);
  return scan.issues;
}

export async function generateFixApi(ruleId, snippet, summary) {
  const { data } = await api.post('/api/fixes/generate', { ruleId, snippet, summary });
  return data;
}

export async function verifyFixApi(ruleId, fix) {
  const { data } = await api.post('/api/fixes/verify', { ruleId, fix });
  return data;
}
