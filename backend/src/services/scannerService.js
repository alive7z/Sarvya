import { createPublicProxy, browserEnvironment } from './publicNetwork.js';
import { protectBrowserContext } from './browserNetworkGuard.js';
import { env } from '../config/env.js';
import { assertPublicUrl } from './urlValidator.js';
import { RunError, isTransient, publicError } from './runErrors.js';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { generateFix } from './fixService.js';

export function calculateScore(severityCounts = {}) {
  const critical = severityCounts.critical || 0;
  const serious = severityCounts.serious || 0;
  const moderate = severityCounts.moderate || 0;
  const minor = severityCounts.minor || 0;

  const totalDeduction = critical * 12 + serious * 6 + moderate * 3 + minor * 1;
  return Math.max(0, Math.min(100, 100 - totalDeduction));
}

function getWcagCriterion(ruleId) {
  const map = {
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
  return map[ruleId] || 'WCAG 2.1';
}

export async function scanPages(pages, { signal, onProgress = async () => {}, validateUrl = assertPublicUrl, launchBrowser = (options) => chromium.launch(options), proxyFactory = createPublicProxy } = {}) {
  const pageList = Array.isArray(pages) ? pages : [pages];
  signal?.throwIfAborted();
  const proxy = await proxyFactory();
  let browser;
  try { browser = await launchBrowser({ headless: true, env: browserEnvironment(), timeout: env.navigationTimeoutMs, chromiumSandbox: true, proxy: { server: proxy.server, bypass: '<-loopback>' }, args: ['--disable-dev-shm-usage', '--disable-background-networking', '--force-webrtc-ip-handling-policy=disable_non_proxied_udp'] }); }
  catch (error) { await proxy.close(); throw error; }
  const abort = () => { browser.close().catch(() => {}); };
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) abort();
  const results = [];
  let primaryPreview = null;

  try {
    for (const pageInfo of pageList) {
      const targetUrl = typeof pageInfo === 'string' ? pageInfo : pageInfo.url;
      let context;

      try {
        signal?.throwIfAborted();
        try { await validateUrl(targetUrl); } catch { throw new RunError('A target address is unavailable or blocked.'); }
        await onProgress({ stage: 'navigation', completedPages: results.length, totalPages: pageList.length, currentUrl: targetUrl });
        context = await browser.newContext({
          serviceWorkers: 'block', acceptDownloads: false,
          viewport: { width: 1280, height: 800 },
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        });

        const guard = await protectBrowserContext(context, { signal, validateUrl });
        const page = await context.newPage();
        await guard.guardPage(page);
        const response = await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: env.navigationTimeoutMs });
        if (response && response.status() >= 400) {
          throw new RunError(`The target returned HTTP ${response.status()}.`, { retryable: response.status() === 429 || response.status() >= 500 });
        }
        signal?.throwIfAborted();
        await onProgress({ stage: 'accessibility-analysis', completedPages: results.length, totalPages: pageList.length, currentUrl: targetUrl });

        // Run axe analysis
        const axeResults = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze();

        signal?.throwIfAborted();
        await onProgress({ stage: 'preview-capture', completedPages: results.length, totalPages: pageList.length, currentUrl: targetUrl });

        // Collect bounding boxes for unique violation target selectors (deduped for speed)
        const allSelectors = [];
        for (const v of axeResults.violations) {
          for (const n of v.nodes) {
            const sel = Array.isArray(n.target)
              ? n.target.join(', ')
              : String(n.target || '');
            if (sel) allSelectors.push(sel);
          }
        }

        const uniqueSelectors = [...new Set(allSelectors)].slice(0, 60);

        let boundingBoxes = {};
        try {
          boundingBoxes = await page.evaluate((selectors) => {
            const results = {};
            for (const sel of selectors) {
              try {
                const el = document.querySelector(sel);
                if (el) {
                  const rect = el.getBoundingClientRect();
                  results[sel] = {
                    x: Math.round(rect.x),
                    y: Math.round(rect.y),
                    width: Math.round(rect.width),
                    height: Math.round(rect.height),
                  };
                }
              } catch {
                // Ignore invalid selector
              }
            }
            return results;
          }, uniqueSelectors);
        } catch {
          // Ignore evaluate failure
        }

        const title = (await page.title()) || targetUrl;

        // Capture screenshot of primary page for fallback preview
        let screenshot = null;
        if (!primaryPreview) {
          try {
            const buffer = await page.screenshot({ type: 'jpeg', quality: 60 });
            screenshot = `data:image/jpeg;base64,${buffer.toString('base64')}`;
          } catch {
            // Ignore screenshot failure
          }
        }

        // Map violations
        const violations = axeResults.violations.map((violation) => {
          const affectedElements = violation.nodes.map((node) => {
            const selector = Array.isArray(node.target)
              ? node.target.join(', ')
              : String(node.target || '');
            const html = node.html || '';
            const summary = node.failureSummary || '';
            const fix = generateFix(violation.id, html, summary);

            return {
              selector,
              html,
              summary,
              fix,
              boundingBox: boundingBoxes[selector] || null,
            };
          });

          return {
            id: violation.id,
            impact: violation.impact || 'moderate',
            description: violation.description || '',
            help: violation.help || violation.id,
            helpUrl: violation.helpUrl || '',
            tags: violation.tags || [],
            affectedElements,
          };
        });

        let renderedHtml = null;
        try {
          renderedHtml = await page.content();
        } catch {
          // Ignore html capture failure
        }

        const pageResult = {
          url: targetUrl,
          title,
          status: 'success',
          violations,
          screenshot,
          html: renderedHtml,
        };

        if (!primaryPreview && screenshot) {
          primaryPreview = {
            url: targetUrl,
            title,
            screenshot,
          };
        }

        results.push(pageResult);
      } catch (err) {
        signal?.throwIfAborted();
        results.push({
          url: targetUrl,
          status: 'error',
          error: publicError(err),
          retryable: isTransient(err),
        });
      } finally {
        if (context) await context.close().catch(() => {});
      }
      signal?.throwIfAborted();
      await onProgress({ stage: 'page-completed', completedPages: results.length, totalPages: pageList.length, failedPages: results.filter((page) => page.status === 'error').length, currentUrl: targetUrl });
    }
  } finally {
    signal?.removeEventListener('abort', abort);
    await browser.close().catch(() => {});
    await proxy.close();
  }

  // Aggregate violations
  const allViolations = results.flatMap((page) =>
    (page.violations || []).map((violation) => ({
      ...violation,
      url: page.url,
    }))
  );

  const severityCounts = {
    critical: 0,
    serious: 0,
    moderate: 0,
    minor: 0,
  };

  for (const v of allViolations) {
    if (Object.hasOwn(severityCounts, v.impact)) {
      severityCounts[v.impact]++;
    }
  }

  const score = calculateScore(severityCounts);

  // Build frontend-friendly issue objects
  const issues = allViolations.map((violation, index) => {
    const firstElement = violation.affectedElements?.[0] || {};
    const nodes = (violation.affectedElements || []).map((el, elIdx) => ({
      id: `${violation.id}-${index}-node-${elIdx}`,
      index: elIdx + 1,
      selector: el.selector || 'body',
      snippet: el.html || 'HTML snippet unavailable',
      summary: el.summary || '',
      fix: el.fix || generateFix(violation.id, el.html, el.summary),
      boundingBox: el.boundingBox || null,
    }));

    return {
      id: `${violation.id}-${index}`,
      title: violation.help || violation.id,
      rule: violation.id,
      severity: violation.impact || 'moderate',
      wcag: getWcagCriterion(violation.id),
      count: nodes.length || 1,
      selector: firstElement.selector || 'body',
      explanation: violation.description || violation.help,
      snippet: firstElement.html || 'HTML snippet unavailable',
      fix: firstElement.fix || generateFix(violation.id, firstElement.html, firstElement.summary),
      helpUrl: violation.helpUrl,
      url: violation.url,
      status: 'Not tested',
      boundingBox: firstElement.boundingBox || null,
      nodes,
    };
  });

  const successfulPages = results.filter((p) => p.status === 'success');
  const failedPages = results.filter((p) => p.status === 'error');

  return {
    pagesScanned: successfulPages.length,
    pagesFailed: failedPages.length,
    totalViolationTypes: allViolations.length,
    totalAffectedElements: allViolations.reduce(
      (sum, v) => sum + (v.affectedElements?.length || 0),
      0
    ),
    severityCounts,
    score,
    issues,
    violations: allViolations,
    results,
    primaryPreview,
  };
}
