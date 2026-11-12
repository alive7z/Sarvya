// Executed only after the user invokes the extension; never sends page data away.
export async function runAudit() {
  if (globalThis.__sarvyaScanning) throw new Error('An audit is already running on this page.');
  globalThis.__sarvyaScanning = true;
  let timer;
  try {
    const results = await Promise.race([
      globalThis.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } }),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('The audit took too long. Reload the page and try again.')), 20000); }),
    ]);
    const reduce = rule => ({ id: rule.id, impact: rule.impact, help: rule.help, helpUrl: rule.helpUrl, tags: rule.tags, count: rule.nodes.length,
      nodes: rule.nodes.slice(0, 100).map(node => ({ target: node.target, html: node.html.slice(0, 1000), failureSummary: (node.failureSummary || '').slice(0, 2000) })),
      truncated: rule.nodes.length > 100 });
    return { url: location.href, title: document.title.slice(0, 200), timestamp: results.timestamp, tool: results.testEngine,
      violations: results.violations.map(reduce), incomplete: results.incomplete.map(reduce),
      occurrences: results.violations.reduce((n, v) => n + v.nodes.length, 0),
      limitations: 'Automated checks do not prove WCAG conformance. Up to 100 nodes per rule are retained; cross-origin frames and dynamic states may need manual review.' };
  } finally { clearTimeout(timer); globalThis.__sarvyaScanning = false; }
}
export function inspectTarget(target) {
  document.getElementById('sarvya-inspection')?.remove();
  if (!Array.isArray(target) || target.length !== 1 || typeof target[0] !== 'string') throw new Error('This target is inside a frame or shadow root. Inspect its selector manually.');
  let element; try { element = document.querySelector(target[0]); } catch { throw new Error('This selector cannot be inspected automatically.'); }
  if (!element) throw new Error('The element has changed or is no longer on this page. Re-scan to update the findings.');
  element.scrollIntoView({ block: 'center', behavior: 'instant' });
  const host = document.createElement('div'); host.id = 'sarvya-inspection';
  host.style.cssText = 'all:initial!important;position:fixed!important;inset:0!important;pointer-events:none!important;z-index:2147483647!important';
  const shadow = host.attachShadow({ mode: 'closed' });
  const outline = document.createElement('div'); const rect = element.getBoundingClientRect();
  outline.style.cssText = `position:fixed;left:${Math.max(0, rect.left - 4)}px;top:${Math.max(0, rect.top - 4)}px;width:${rect.width + 8}px;height:${rect.height + 8}px;border:4px dashed #111;box-shadow:0 0 0 3px white;box-sizing:border-box;pointer-events:none`;
  const close = document.createElement('button'); close.type = 'button'; close.textContent = 'Sarvya: inspected element — close highlight';
  close.style.cssText = 'position:fixed;bottom:20px;right:20px;padding:14px;background:#fff;color:#111;border:2px solid #111;border-radius:8px;font:14px system-ui;pointer-events:auto';
  close.onclick = () => host.remove(); shadow.append(outline, close); document.documentElement.append(host); close.focus();
  const remove = () => host.remove(); window.addEventListener('scroll', remove, { once: true, capture: true }); window.addEventListener('resize', remove, { once: true });
  setTimeout(remove, 15000); return { inspected: true };
}
