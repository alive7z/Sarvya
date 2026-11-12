import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
export function validateUrl(value) {
  let url; try { url = new URL(value); } catch { throw new Error('Use a complete http:// or https:// URL.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Only HTTP(S) URLs without credentials are supported.');
  url.hash = ''; return url.href;
}
export async function audit(value, { timeout = 45000, signal, launch = options => chromium.launch(options) } = {}) {
  const url = validateUrl(value);
  if (!Number.isInteger(timeout) || timeout < 1000 || timeout > 300000) throw new Error('Timeout must be 1000–300000 milliseconds.');
  signal?.throwIfAborted();
  let browser, timer;
  const abort = () => browser?.close().catch(() => {});
  try {
    // This is a local tool: localhost is intentionally supported, unlike the hosted scanner.
    browser = await launch({ headless: true, chromiumSandbox: true, timeout: Math.min(timeout, 30000) });
    signal?.addEventListener('abort', abort, { once: true }); signal?.throwIfAborted();
    let expired = false;
    timer = setTimeout(() => { expired = true; abort(); }, timeout);
    const context = await browser.newContext({ serviceWorkers: 'block', acceptDownloads: false });
    const page = await context.newPage();
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
    if (response && response.status() >= 400) throw new Error(`Target returned HTTP ${response.status()}.`);
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    signal?.throwIfAborted(); if (expired) throw new Error('Audit timed out.');
    return { url: page.url(), requestedUrl: url, timestamp: result.timestamp, tool: result.testEngine, scope: 'Single page, WCAG 2.1 A/AA automated checks',
      occurrences: result.violations.reduce((sum, v) => sum + v.nodes.length, 0), violations: result.violations, incomplete: result.incomplete,
      passedRules: result.passes.length, limitations: ['Automated checks do not prove WCAG conformance.', 'Cross-origin frames, protected content, and dynamic states may need manual review.'] };
  } catch (error) {
    signal?.throwIfAborted();
    if (/Executable doesn't exist/.test(error.message)) throw new Error('Chromium is missing. Run sarvya --install-browser first.');
    throw error;
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); await browser?.close().catch(() => {}); }
}
