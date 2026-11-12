export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const csv = value => {
  const text = String(value ?? '');
  const safe = /^[=+@\t\r\n-]|^\s+[=+@-]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
};
const guidance = value => { try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : '#'; } catch { return '#'; } };
export function formatReport(result, format = 'json') {
  if (format === 'json') return JSON.stringify(result, null, 2) + '\n';
  if (format === 'csv') return [['URL', 'Rule', 'Impact', 'Selector', 'Help', 'HTML'], ...result.violations.flatMap(v => v.nodes.map(n => [result.url, v.id, v.impact, n.target.join(' > '), v.help, n.html]))].map(row => row.map(csv).join(',')).join('\r\n') + '\r\n';
  if (format !== 'html') throw new Error('Format must be json, html, or csv.');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Sarvya audit report</title><style>body{font:16px/1.6 system-ui;max-width:1000px;margin:40px auto;padding:24px;color:#17202d}article{border:1px solid #687587;padding:20px;margin:20px 0;border-radius:12px}code{white-space:pre-wrap;overflow-wrap:anywhere}a{color:#0755b5}h1,h2{line-height:1.3}</style></head><body><h1>Accessibility audit</h1><p>${escapeHtml(result.url)}</p><p>${escapeHtml(result.timestamp)} · axe-core ${escapeHtml(result.tool.version)} · ${result.occurrences} violation occurrences</p><p>Automated checks do not prove WCAG compliance. Incomplete checks and other requirements need human review.</p><p>${result.incomplete.length} rules require manual review.</p>${result.violations.map(v => `<article><h2>${escapeHtml(v.help)}</h2><p>${escapeHtml(v.id)} · ${escapeHtml(v.impact || 'Unspecified impact')} · ${v.nodes.length} occurrences</p><a href="${escapeHtml(guidance(v.helpUrl))}" rel="noopener noreferrer">Rule guidance</a>${v.nodes.map(n => `<p><code>${escapeHtml(n.target.join(' > '))}</code></p><pre><code>${escapeHtml(n.html)}</code></pre><p>${escapeHtml(n.failureSummary)}</p>`).join('')}</article>`).join('') || '<p>No automated violations detected within this scan scope.</p>'}</body></html>\n`;
}
