// Sarvya Executive PDF & Print Report Generator

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function generateExecutiveReportHtml({ url, scanId, issues = [] }) {
  const safeUrl = url || 'https://sample-page.design';
  let safeHost = 'sample-page.design';
  try {
    safeHost = new URL(safeUrl.startsWith('http') ? safeUrl : `https://${safeUrl}`).host;
  } catch {
    safeHost = safeUrl;
  }

  const criticalCount = issues.filter((i) => i.severity === 'critical').length;
  const seriousCount = issues.filter((i) => i.severity === 'serious').length;
  const moderateCount = issues.filter((i) => i.severity === 'moderate').length;
  const minorCount = issues.filter((i) => i.severity === 'minor').length;
  const verifiedCount = issues.filter((i) => i.status === 'Verified').length;
  const totalCount = issues.length;

  // Calculate score: Start at 100, deduct weighted points per violation
  let rawScore = 100 - (criticalCount * 18 + seriousCount * 10 + moderateCount * 4 + minorCount * 1);
  const score = Math.max(0, Math.min(100, rawScore));

  const scoreBadge =
    score >= 85
      ? { text: 'No automated violations detected', color: '#059669', bg: '#ECFDF5' }
      : score >= 60
      ? { text: 'Needs Remediation', color: '#D97706', bg: '#FFFBEB' }
      : { text: 'Critical Accessibility Barriers', color: '#DC2626', bg: '#FEF2F2' };

  const dateStr = new Date().toLocaleString('en-US', {
    dateStyle: 'full',
    timeStyle: 'short',
  });

  const issuesRows = issues.map((issue, idx) => {
    const severityColors = {
      critical: { color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
      serious: { color: '#EA580C', bg: '#FFF7ED', border: '#FFEDD5' },
      moderate: { color: '#D97706', bg: '#FFFBEB', border: '#FEF3C7' },
      minor: { color: '#2563EB', bg: '#EFF6FF', border: '#DBEAFE' },
    };
    const sColor = severityColors[issue.severity] || severityColors.moderate;

    return `
      <div class="issue-card">
        <div class="issue-header">
          <div class="issue-title-group">
            <span class="issue-num">#${idx + 1}</span>
            <span class="badge" style="background: ${sColor.bg}; color: ${sColor.color}; border: 1px solid ${sColor.border};">
              ${escapeHtml(issue.severity)}
            </span>
            <h3 class="issue-title">${escapeHtml(issue.title)}</h3>
          </div>
          <div class="issue-meta">
            <span class="badge-wcag">WCAG ${escapeHtml(issue.wcag || '2.1')}</span>
            <code class="rule-code">${escapeHtml(issue.rule || issue.ruleId)}</code>
          </div>
        </div>

        <p class="issue-desc">${escapeHtml(issue.explanation || issue.description || '')}</p>

        <div class="code-section">
          <div class="code-label">Affected Target Selector:</div>
          <code class="code-selector">${escapeHtml(issue.selector || 'body')}</code>
        </div>

        ${
          issue.snippet
            ? `
          <div class="code-section">
            <div class="code-label">Current Implementation (HTML):</div>
            <pre class="code-box code-current"><code>${escapeHtml(issue.snippet)}</code></pre>
          </div>
        `
            : ''
        }

        ${
          issue.fix
            ? `
          <div class="code-section">
            <div class="code-label">Recommended Accessible Fix:</div>
            <pre class="code-box code-fix"><code>${escapeHtml(issue.fix)}</code></pre>
          </div>
        `
            : ''
        }

        <div class="issue-footer">
          <span>Occurrences on page: <strong>${issue.count || 1} element(s)</strong></span>
          <span class="status-badge ${issue.status === 'Verified' ? 'status-verified' : ''}">
            ${issue.status === 'Verified' ? '✓ Verified by axe-core' : 'Status: ' + (issue.status || 'Open')}
          </span>
        </div>
      </div>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Sarvya Executive Accessibility Report — ${safeHost}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 15mm 18mm;
    }
    * {
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #111827;
      background: #F3F4F6;
      margin: 0;
      padding: 0;
      font-size: 13px;
      line-height: 1.5;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    /* Screen UI Top Bar */
    .print-bar {
      position: sticky;
      top: 0;
      background: #18181B;
      color: #FFFFFF;
      padding: 14px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 4px 20px rgba(0,0,0,0.25);
      z-index: 1000;
    }
    .print-bar-title {
      display: flex;
      align-items: center;
      gap: 10px;
      font-weight: 700;
      font-size: 14px;
    }
    .print-bar-actions {
      display: flex;
      gap: 10px;
    }
    .btn-print {
      background: #EA580C;
      color: #FFFFFF;
      border: none;
      padding: 8px 18px;
      border-radius: 8px;
      font-weight: 700;
      font-size: 12px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: background 0.15s;
    }
    .btn-print:hover { background: #C2410C; }
    .btn-close {
      background: #27272A;
      color: #D4D4D8;
      border: 1px solid #3F3F46;
      padding: 8px 14px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 12px;
      cursor: pointer;
    }
    .btn-close:hover { background: #3F3F46; color: #FFFFFF; }

    /* Report Container */
    .report-container {
      max-width: 860px;
      margin: 30px auto 60px;
      background: #FFFFFF;
      padding: 48px;
      border-radius: 16px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.06);
    }

    /* Header */
    .report-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #E5E7EB;
      padding-bottom: 24px;
      margin-bottom: 28px;
    }
    .brand-title {
      font-size: 26px;
      font-weight: 800;
      letter-spacing: -0.8px;
      color: #111827;
      margin: 0;
    }
    .brand-title span { color: #EA580C; }
    .brand-sub {
      font-size: 9px;
      font-weight: 800;
      letter-spacing: 0.12em;
      color: #6B7280;
      margin-top: 4px;
    }
    .report-meta {
      text-align: right;
      font-size: 11px;
      color: #6B7280;
    }
    .report-meta strong {
      color: #111827;
      display: block;
      font-size: 12px;
    }

    /* Target URL Callout */
    .target-callout {
      background: #F9FAFB;
      border: 1px solid #E5E7EB;
      border-radius: 10px;
      padding: 12px 18px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      font-size: 12px;
    }
    .target-url {
      font-family: monospace;
      font-size: 12px;
      font-weight: 700;
      color: #EA580C;
    }

    /* Score Banner */
    .score-banner {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border: 1px solid #E5E7EB;
      border-radius: 14px;
      padding: 24px;
      margin-bottom: 28px;
      background: #FAFAFA;
    }
    .score-left {
      display: flex;
      align-items: center;
      gap: 20px;
    }
    .score-circle {
      width: 72px;
      height: 72px;
      border-radius: 50%;
      background: ${score >= 85 ? '#059669' : score >= 60 ? '#D97706' : '#DC2626'};
      color: #FFFFFF;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 14px rgba(0,0,0,0.15);
    }
    .score-circle-num {
      font-size: 24px;
      font-weight: 800;
      line-height: 1;
    }
    .score-circle-max {
      font-size: 9px;
      font-weight: 700;
      opacity: 0.85;
    }
    .score-details h2 {
      margin: 0 0 4px 0;
      font-size: 18px;
      font-weight: 800;
      color: #111827;
    }
    .score-badge {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 700;
      background: ${scoreBadge.bg};
      color: ${scoreBadge.color};
      border: 1px solid ${scoreBadge.color}40;
    }

    /* Metrics Grid */
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-bottom: 32px;
    }
    .metric-card {
      border: 1px solid #E5E7EB;
      border-radius: 10px;
      padding: 16px 12px;
      text-align: center;
      background: #FFFFFF;
    }
    .metric-val {
      font-size: 26px;
      font-weight: 800;
      line-height: 1.1;
    }
    .metric-critical { color: #DC2626; }
    .metric-serious { color: #EA580C; }
    .metric-moderate { color: #D97706; }
    .metric-minor { color: #2563EB; }
    .metric-label {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #6B7280;
      margin-top: 4px;
    }

    /* Section Title */
    .section-title {
      font-size: 16px;
      font-weight: 800;
      color: #111827;
      margin: 32px 0 16px 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid #E5E7EB;
      padding-bottom: 8px;
    }

    /* Issue Card */
    .issue-card {
      border: 1px solid #E5E7EB;
      border-radius: 10px;
      padding: 18px;
      margin-bottom: 16px;
      background: #FFFFFF;
      page-break-inside: avoid;
    }
    .issue-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 10px;
      margin-bottom: 10px;
    }
    .issue-title-group {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .issue-num {
      font-size: 12px;
      font-weight: 800;
      color: #6B7280;
    }
    .badge {
      font-size: 10px;
      font-weight: 800;
      padding: 2px 8px;
      border-radius: 5px;
      text-transform: uppercase;
    }
    .issue-title {
      font-size: 14px;
      font-weight: 700;
      color: #111827;
      margin: 0;
    }
    .issue-meta {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-shrink: 0;
    }
    .badge-wcag {
      background: #F3F4F6;
      color: #4B5563;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 600;
    }
    .rule-code {
      font-family: monospace;
      font-size: 11px;
      color: #EA580C;
    }
    .issue-desc {
      font-size: 12px;
      color: #4B5563;
      line-height: 1.6;
      margin: 0 0 12px 0;
    }
    .code-section {
      margin-bottom: 8px;
    }
    .code-label {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      color: #6B7280;
      margin-bottom: 4px;
    }
    .code-selector {
      font-family: monospace;
      font-size: 11px;
      background: #F3F4F6;
      padding: 3px 6px;
      border-radius: 4px;
      color: #374151;
      display: inline-block;
      max-width: 100%;
      word-break: break-all;
    }
    .code-box {
      font-family: monospace;
      font-size: 11px;
      line-height: 1.6;
      padding: 10px 14px;
      border-radius: 8px;
      margin: 4px 0 0 0;
      white-space: pre-wrap;
      word-break: break-all;
      overflow-x: auto;
    }
    .code-current {
      background: #F9FAFB;
      border: 1px solid #E5E7EB;
      color: #374151;
    }
    .code-fix {
      background: #FFF7ED;
      border: 1px solid #FED7AA;
      color: #9A3412;
    }
    .issue-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 12px;
      padding-top: 10px;
      border-top: 1px solid #F3F4F6;
      font-size: 11px;
      color: #6B7280;
    }
    .status-badge {
      font-weight: 700;
      color: #D97706;
    }
    .status-verified {
      color: #059669;
    }

    /* Disclaimer */
    .report-disclaimer {
      margin-top: 40px;
      padding: 20px;
      border-radius: 10px;
      background: #F9FAFB;
      border: 1px solid #E5E7EB;
      font-size: 11px;
      color: #6B7280;
      line-height: 1.6;
      page-break-inside: avoid;
    }
    .report-disclaimer strong {
      color: #374151;
    }

    /* Print Specific Rules */
    @media print {
      body {
        background: #FFFFFF !important;
        font-size: 11pt;
      }
      .no-print {
        display: none !important;
      }
      .report-container {
        box-shadow: none !important;
        padding: 0 !important;
        margin: 0 !important;
        max-width: 100% !important;
        border-radius: 0 !important;
      }
      .issue-card {
        border-color: #D1D5DB !important;
      }
    }
  </style>
</head>
<body>
  <!-- Print Bar (Screen Only) -->
  <div class="print-bar no-print">
    <div class="print-bar-title">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#EA580C" stroke-width="2.5">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
      </svg>
      <span>Sarvya Executive Audit Report Preview</span>
    </div>
    <div class="print-bar-actions">
      <button class="btn-print" onclick="window.print()">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="6 9 6 2 18 2 18 9"></polyline>
          <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
          <rect x="6" y="14" width="12" height="8"></rect>
        </svg>
        <span>Print / Save as PDF</span>
      </button>
      <button class="btn-close" onclick="window.close()">✕ Close</button>
    </div>
  </div>

  <!-- Main Report Container -->
  <div class="report-container">
    <!-- Header -->
    <header class="report-header">
      <div>
        <h1 class="brand-title">Sar<span>vya</span></h1>
        <div class="brand-sub">WCAG 2.1 CONFORMANCE & ACCESSIBILITY AUDIT REPORT</div>
      </div>
      <div class="report-meta">
        <strong>Report Date:</strong>
        <span>${dateStr}</span>
        <div style="margin-top: 4px;"><strong>Engine:</strong> axe-core 4.x + Chromium Sandbox</div>
      </div>
    </header>

    <!-- Target Site Strip -->
    <div class="target-callout">
      <div>
        <span style="color: #6B7280; font-weight: 600;">Audited Web Property:</span>
        <span class="target-url">${escapeHtml(safeUrl)}</span>
      </div>
      <div>
        <span style="color: #6B7280;">Audit Run ID:</span>
        <code style="font-family: monospace; font-size: 11px;">${escapeHtml(scanId || 'demo-audit')}</code>
      </div>
    </div>

    <!-- Executive Health Score Banner -->
    <div class="score-banner">
      <div class="score-left">
        <div class="score-circle">
          <span class="score-circle-num">${score}</span>
          <span class="score-circle-max">/ 100</span>
        </div>
        <div class="score-details">
          <h2>Accessibility Health Index</h2>
          <span class="score-badge">${scoreBadge.text}</span>
        </div>
      </div>
      <div style="text-align: right; font-size: 11px; color: #6B7280; max-width: 280px;">
        Weighted algorithm measuring barrier impact, critical blocker occurrences, and contrast ratios.
      </div>
    </div>

    <!-- Violation Metrics Breakdown -->
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-val metric-critical">${criticalCount}</div>
        <div class="metric-label">Critical Barriers</div>
      </div>
      <div class="metric-card">
        <div class="metric-val metric-serious">${seriousCount}</div>
        <div class="metric-label">Serious Issues</div>
      </div>
      <div class="metric-card">
        <div class="metric-val metric-moderate">${moderateCount}</div>
        <div class="metric-label">Moderate Issues</div>
      </div>
      <div class="metric-card">
        <div class="metric-val metric-minor">${minorCount}</div>
        <div class="metric-label">Minor Notices</div>
      </div>
    </div>

    <!-- Remediation Plan Heading -->
    <div class="section-title">
      <span>Detected Accessibility Findings & Remediation Plan (${totalCount} Total)</span>
      <span style="font-size: 12px; font-weight: 600; color: #059669;">
        ${verifiedCount} Fixes Verified
      </span>
    </div>

    <!-- Detailed Finding Cards -->
    <div class="issues-list">
      ${
        issues.length === 0
          ? '<p style="text-align: center; color: #059669; font-weight: 700; padding: 40px 0;">✓ Zero accessibility violations detected! Automated checks do not establish WCAG conformance; manual review is still required.</p>'
          : issuesRows
      }
    </div>

    <!-- Legal & Methodological Disclaimer -->
    <div class="report-disclaimer">
      <strong>Methodology & Audit Disclaimer:</strong> This executive report was generated by <strong>Sarvya</strong> utilizing the Deque axe-core 4.x accessibility analysis engine and headless Chromium execution. Automated testing evaluates observable DOM properties against Web Content Accessibility Guidelines (WCAG) 2.1 Level AA and AAA specifications. Automated tools typically detect approximately 30% to 50% of potential barriers; comprehensive compliance certification also requires human expert review, screen reader testing (NVDA, VoiceOver), and keyboard navigation evaluation.
    </div>
  </div>

  <script>
    // Automatically trigger print dialog when opened
    window.addEventListener('load', () => {
      setTimeout(() => {
        window.print();
      }, 400);
    });
  </script>
</body>
</html>`;
}

export function openExecutiveReportWindow({ url, scanId, issues = [] }) {
  const html = generateExecutiveReportHtml({ url, scanId, issues });
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  } else {
    alert('Please allow popups to open the printable executive report window.');
  }
}
