import { Router } from 'express';
import { limitAsync } from '../middleware/security.js';
import { chromium } from 'playwright';
import { createPublicProxy, browserEnvironment } from '../services/publicNetwork.js';
import { safeFetch } from '../services/crawlerService.js';
import { protectBrowserContext } from '../services/browserNetworkGuard.js';
const escapeHtml = value => String(value || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
import { normalizeUrl, assertPublicUrl } from '../services/urlValidator.js';
import { getScan, listScans } from '../services/storageService.js';

const router = Router();
// Remote HTML must never share the origin of authenticated GitHub actions.
router.use((_req, res, next) => {
  res.setHeader('Content-Security-Policy', "sandbox allow-scripts allow-forms allow-popups; frame-ancestors 'self'");
  next();
});

const REAL_BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Sec-Ch-Ua': '"Chromium";v="124", "Google Chrome";v="124"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"Windows"',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1',
};

// Fetch page HTML using standard fetch with real Chrome desktop headers
async function fetchPreviewHtml(targetUrl) {
  const result = await safeFetch(targetUrl, new URL(targetUrl).origin);
  return { html: result.html, finalUrl: result.url };
}

// Sanitize HTML to prevent slow third-party ad/tracker scripts from stalling the preview iframe
function sanitizeHtmlForPreview(html) {
  if (!html) return '';
  let cleaned = html.replace(
    /<script\b[^<]*(?:google-analytics|googletagmanager|doubleclick|clarity\.ms|hotjar|facebook\.net|connect\.facebook|adservice)[^<]*<\/script>/gi,
    ''
  );
  cleaned = cleaned.replace(/<meta\b[^>]*http-equiv=["']refresh["'][^>]*>/gi, '');
  return cleaned;
}

// Fallback: Launch Chromium via Playwright to retrieve rendered HTML when fetch gets blocked (e.g. 403 Cloudflare)
async function fetchWithBrowser(targetUrl) {
  let browser;
  const proxy = await createPublicProxy();
  try {
    browser = await chromium.launch({
      headless: true, env: browserEnvironment(), chromiumSandbox: true, timeout: 15000, proxy: { server: proxy.server, bypass: '<-loopback>' },
      args: [
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--disable-gpu',
        '--disable-extensions',
        '--mute-audio',
      ],
    });
    const context = await browser.newContext({
      serviceWorkers: 'block', acceptDownloads: false,
      viewport: { width: 1280, height: 800 },
      userAgent: REAL_BROWSER_HEADERS['User-Agent'],
    });
    const guard = await protectBrowserContext(context, { validateUrl: assertPublicUrl });
    const page = await context.newPage();
    await guard.guardPage(page);

    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    const html = await page.content();
    if (Buffer.byteLength(html) > 2.5 * 1024 * 1024) throw new Error('Preview exceeds the size limit.');
    const finalUrl = page.url();
    return { html, finalUrl };
  } finally {
    try { if (browser) await browser.close(); } finally { await proxy.close(); }
  }
}

// Build the accessibility overlay script to inject into preview HTML
function buildOverlayScript(issues) {
  // Flatten issues so EVERY SINGLE NODE gets its own marker, outline, and tooltip
  const allItems = [];
  (issues || []).forEach((issue) => {
    const nodes = Array.isArray(issue.nodes) && issue.nodes.length > 0
      ? issue.nodes
      : [
          {
            id: `${issue.id}-node-0`,
            index: 1,
            selector: issue.selector,
            snippet: issue.snippet,
            summary: issue.explanation || '',
            fix: issue.fix,
            boundingBox: issue.boundingBox || null,
          },
        ];

    nodes.forEach((node, idx) => {
      allItems.push({
        id: `${issue.id}-element-${idx}`,
        rule: issue.rule,
        title: issue.title,
        severity: issue.severity || 'moderate',
        wcag: issue.wcag,
        nodeIndex: idx + 1,
        totalNodes: nodes.length,
        selector: node.selector || issue.selector,
        snippet: node.snippet || node.html || issue.snippet || '',
        fix: node.fix || issue.fix || 'No automated fix available.',
        explanation: node.summary || issue.explanation || issue.description || '',
        boundingBox: node.boundingBox || issue.boundingBox || null,
      });
    });
  });

  // Escape items data for safe inline JSON
  const safeJson = JSON.stringify(allItems)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');

  return `
<style id="sarvya-overlay-styles">
  .sarvya-marker {
    position: absolute;
    z-index: 2147483640;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: #ef4444;
    border: 2px solid #fff;
    box-shadow: 0 2px 8px rgba(239,68,68,0.5), 0 0 0 0 rgba(239,68,68,0.4);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 800;
    color: #fff;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    animation: sarvya-pulse 2s ease-in-out infinite;
    transition: transform 0.15s ease, box-shadow 0.15s ease;
    pointer-events: auto;
  }
  .sarvya-marker:hover {
    transform: scale(1.25);
    box-shadow: 0 4px 16px rgba(239,68,68,0.7);
    animation: none;
  }
  .sarvya-marker.serious { background: #f97316; box-shadow: 0 2px 8px rgba(249,115,22,0.5); }
  .sarvya-marker.moderate { background: #eab308; box-shadow: 0 2px 8px rgba(234,179,8,0.5); color: #1a1a1a; }
  .sarvya-marker.minor { background: #3b82f6; box-shadow: 0 2px 8px rgba(59,130,246,0.5); }

  @keyframes sarvya-pulse {
    0%, 100% { box-shadow: 0 2px 8px rgba(239,68,68,0.5), 0 0 0 0 rgba(239,68,68,0.4); }
    50% { box-shadow: 0 2px 8px rgba(239,68,68,0.5), 0 0 0 8px rgba(239,68,68,0); }
  }

  @keyframes sarvya-inspect-pulse {
    0% { box-shadow: 0 0 0 0 rgba(249, 115, 22, 0.9); }
    50% { box-shadow: 0 0 0 16px rgba(249, 115, 22, 0); }
    100% { box-shadow: 0 0 0 0 rgba(249, 115, 22, 0); }
  }

  .sarvya-inspect-active {
    outline: 4px solid #f97316 !important;
    outline-offset: 4px !important;
    border-radius: 6px !important;
    animation: sarvya-inspect-pulse 1.2s ease-in-out infinite !important;
  }

  .sarvya-tooltip {
    position: absolute;
    z-index: 2147483645;
    background: #18181b;
    color: #fafafa;
    border-radius: 14px;
    padding: 16px 18px;
    max-width: 400px;
    min-width: 280px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 12px;
    line-height: 1.6;
    border: 1px solid rgba(255,255,255,0.1);
    box-shadow: 0 16px 45px rgba(0,0,0,0.5);
    pointer-events: auto;
    display: none;
  }
  .sarvya-tooltip.visible { display: block; }
  .sarvya-tooltip .al-title {
    font-weight: 700;
    font-size: 13px;
    margin-bottom: 6px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .sarvya-tooltip .al-badge {
    display: inline-block;
    padding: 2px 7px;
    border-radius: 6px;
    font-size: 9px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .sarvya-tooltip .al-badge.critical { background: #ef4444; color: #fff; }
  .sarvya-tooltip .al-badge.serious { background: #f97316; color: #fff; }
  .sarvya-tooltip .al-badge.moderate { background: #eab308; color: #1a1a1a; }
  .sarvya-tooltip .al-badge.minor { background: #3b82f6; color: #fff; }
  .sarvya-tooltip .al-section { margin-top: 10px; }
  .sarvya-tooltip .al-label {
    font-size: 10px;
    color: #a1a1aa;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    font-weight: 600;
    margin-bottom: 4px;
  }
  .sarvya-tooltip pre {
    background: #27272a;
    border-radius: 8px;
    padding: 8px 10px;
    margin: 4px 0 0 0;
    overflow-x: auto;
    font-size: 11px;
    font-family: 'SF Mono', 'Cascadia Code', 'Fira Code', monospace;
    white-space: pre-wrap;
    word-break: break-all;
    color: #a1e6a1;
    max-height: 140px;
    overflow-y: auto;
  }
  .sarvya-tooltip .al-close {
    position: absolute;
    top: 10px;
    right: 12px;
    background: none;
    border: none;
    color: #71717a;
    cursor: pointer;
    font-size: 18px;
    line-height: 1;
    padding: 2px;
  }
  .sarvya-tooltip .al-close:hover { color: #fafafa; }

  .sarvya-highlight {
    outline: 3px solid #ef4444 !important;
    outline-offset: 3px !important;
    box-shadow: 0 0 0 6px rgba(239,68,68,0.15) !important;
  }
  .sarvya-highlight.serious { outline-color: #f97316 !important; box-shadow: 0 0 0 6px rgba(249,115,22,0.15) !important; }
  .sarvya-highlight.moderate { outline-color: #eab308 !important; box-shadow: 0 0 0 6px rgba(234,179,8,0.15) !important; }
  .sarvya-highlight.minor { outline-color: #3b82f6 !important; box-shadow: 0 0 0 6px rgba(59,130,246,0.15) !important; }
</style>
<script id="sarvya-overlay-script">
(function() {
  'use strict';
  var items = ${safeJson};
  var tooltip = null;
  var activeMarker = null;

  function createTooltip() {
    var el = document.createElement('div');
    el.className = 'sarvya-tooltip';
    el.addEventListener('click', function(e) { e.stopPropagation(); });
    document.body.appendChild(el);
    return el;
  }

  function showTooltip(anchorEl, item) {
    if (!tooltip) tooltip = createTooltip();
    if (activeMarker === anchorEl && tooltip.classList.contains('visible')) {
      tooltip.classList.remove('visible');
      activeMarker = null;
      return;
    }
    activeMarker = anchorEl;

    var snippet = item.snippet || '';
    var fix = item.fix || 'No automated fix available.';

    tooltip.innerHTML =
      '<button class="al-close" title="Close">&times;</button>' +
      '<div class="al-title">' +
        '<span class="al-badge ' + (item.severity || 'moderate') + '">' + (item.severity || 'moderate') + '</span>' +
        '<span>' + escHtml(item.title || item.rule || 'Issue') + (item.totalNodes > 1 ? ' (Node ' + item.nodeIndex + '/' + item.totalNodes + ')' : '') + '</span>' +
      '</div>' +
      '<div style="color:#a1a1aa;font-size:11px;">' + escHtml(item.explanation || '') + '</div>' +
      (item.selector ? '<div style="margin-top:6px;font-family:monospace;font-size:10px;color:#f97316;background:#27272a;padding:3px 6px;border-radius:4px;word-break:break-all;">' + escHtml(item.selector) + '</div>' : '') +
      (snippet ? '<div class="al-section"><div class="al-label">Current Code</div><pre>' + escHtml(snippet) + '</pre></div>' : '') +
      '<div class="al-section"><div class="al-label">Suggested Fix</div><pre>' + escHtml(fix) + '</pre></div>' +
      '<div style="margin-top:10px;display:flex;gap:6px;">' +
        '<button id="al-copy-btn" style="background:#f97316;color:#fff;border:none;border-radius:6px;padding:6px 12px;font-size:11px;font-weight:700;cursor:pointer;">Copy Fix</button>' +
      '</div>';

    var copyBtn = tooltip.querySelector('#al-copy-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', function() {
        navigator.clipboard.writeText(fix);
        copyBtn.textContent = 'Copied!';
        setTimeout(function() { copyBtn.textContent = 'Copy Fix'; }, 2000);
      });
    }

    tooltip.querySelector('.al-close').addEventListener('click', function() {
      tooltip.classList.remove('visible');
      activeMarker = null;
    });

    var rect = anchorEl.getBoundingClientRect();
    var left = rect.left + window.scrollX + (rect.width > 30 ? 20 : rect.width + 8);
    var top = rect.top + window.scrollY - 10;

    if (left + 400 > document.documentElement.scrollWidth) {
      left = rect.left + window.scrollX - 410;
    }
    if (left < 4) left = 4;
    if (top < 4) top = 4;

    tooltip.style.left = left + 'px';
    tooltip.style.top = top + 'px';
    tooltip.classList.add('visible');
  }

  function escHtml(s) {
    var d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML;
  }

  function placeMarkers() {
    // Remove old markers
    document.querySelectorAll('.sarvya-marker').forEach(function(m) { m.remove(); });
    document.querySelectorAll('.sarvya-highlight').forEach(function(m) {
      m.classList.remove('sarvya-highlight', 'critical', 'serious', 'moderate', 'minor');
    });

    var markerIndex = 0;
    items.forEach(function(item) {
      var selector = item.selector || '';
      if (!selector || selector === 'Selector unavailable') return;

      try {
        var el = document.querySelector(selector);
        if (!el) return;

        markerIndex++;
        var severity = item.severity || 'moderate';

        // Add outline highlight to the element
        el.classList.add('sarvya-highlight', severity);

        // Create marker badge
        var marker = document.createElement('div');
        marker.className = 'sarvya-marker ' + severity;
        marker.textContent = markerIndex;
        marker.title = (item.title || item.rule) + ' (' + severity + ') - Node #' + (item.nodeIndex || markerIndex);
        marker.dataset.selector = selector;
        marker.dataset.issueId = item.id;

        // Position marker relative to element
        var rect = el.getBoundingClientRect();
        marker.style.position = 'absolute';
        marker.style.left = Math.max(0, rect.left + window.scrollX - 12) + 'px';
        marker.style.top = Math.max(0, rect.top + window.scrollY - 12) + 'px';

        marker.addEventListener('click', function(e) {
          e.stopPropagation();
          e.preventDefault();
          showTooltip(marker, item);
        });

        document.body.appendChild(marker);
      } catch(e) {
        // Skip invalid selector
      }
    });
  }

  // Handle INSPECT message from parent window (Inspect button click or Node pill click)
  window.addEventListener('message', function(event) {
    if (!event.data || event.data.type !== 'SARVYA_INSPECT') return;
    var selector = event.data.selector;
    if (!selector) return;

    try {
      var el = document.querySelector(selector);
      if (el) {
        // Remove previous inspect pulses
        document.querySelectorAll('.sarvya-inspect-active').forEach(function(node) {
          node.classList.remove('sarvya-inspect-active');
        });

        // Add pulsing inspection class
        el.classList.add('sarvya-inspect-active');
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Find corresponding marker & item to show fix tooltip
        var marker = Array.from(document.querySelectorAll('.sarvya-marker')).find(function(m) {
          return m.dataset.selector === selector;
        });
        var matchedItem = items.find(function(i) { return i.selector === selector; }) || items[0];

        var targetAnchor = marker || el;
        if (matchedItem && targetAnchor) {
          setTimeout(function() { showTooltip(targetAnchor, matchedItem); }, 350);
        }

        setTimeout(function() {
          el.classList.remove('sarvya-inspect-active');
        }, 4000);
      }
    } catch(e) {}
  });

        setTimeout(function() {
          el.classList.remove('sarvya-inspect-active');
        }, 4000);
      }
    } catch(err) {
      // Ignore selector errors
    }
  });

  // Close tooltip on outside click
  document.addEventListener('click', function() {
    if (tooltip) { tooltip.classList.remove('visible'); activeMarker = null; }
  });

  // Re-position markers on scroll/resize
  var debounceTimer;
  function debouncedPlace() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(placeMarkers, 200);
  }
  window.addEventListener('scroll', debouncedPlace);
  window.addEventListener('resize', debouncedPlace);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { setTimeout(placeMarkers, 300); });
  } else {
    setTimeout(placeMarkers, 300);
  }
  window.addEventListener('load', function() { setTimeout(placeMarkers, 600); });
})();
</script>`;
}

// Generate fallback HTML for screenshot view with overlaid error markers
function buildScreenshotHtml(targetUrl, screenshot, issues) {
  const safeJson = JSON.stringify(issues || [])
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Snapshot Preview - ${targetUrl}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #09090b; color: #fafafa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .banner {
      background: #18181b;
      border-bottom: 1px solid #27272a;
      padding: 10px 16px;
      font-size: 11px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      position: sticky;
      top: 0;
      z-index: 100;
    }
    .banner-left { display: flex; align-items: center; gap: 8px; font-weight: 500; }
    .badge { background: #f97316; color: #fff; padding: 2px 7px; border-radius: 6px; font-weight: 800; font-size: 9px; }
    .banner a { color: #f97316; text-decoration: none; font-weight: 600; }
    .container { position: relative; max-width: 1280px; margin: 0 auto; }
    .screenshot { width: 100%; display: block; }
  </style>
</head>
<body>
  <div class="banner">
    <div class="banner-left">
      <span class="badge">AUDIT SNAPSHOT</span>
      <span>Live Chromium capture with detected accessibility markers</span>
    </div>
    <a href="${escapeHtml(targetUrl)}" target="_blank" rel="noopener">Open target website ↗</a>
  </div>
  <div class="container">
    <img class="screenshot" src="${screenshot}" alt="Audit screenshot for ${targetUrl}" />
  </div>
  ${buildOverlayScript(issues)}
</body>
</html>`;
}

router.get('/', limitAsync(2, async (req, res) => {
  const { url, scanId } = req.query;

  let targetUrl = url;
  let scan = null;
  if (scanId) {
    scan = getScan(scanId);
    if (!targetUrl && scan) {
      targetUrl = scan.startUrl;
    }
  }

  if (!targetUrl) {
    return res.status(400).send('Missing url or scanId parameter.');
  }

  try {
    const normalized = normalizeUrl(targetUrl);
    await assertPublicUrl(normalized);

    let htmlContent = null;
    let finalUrl = normalized;
    const issues = scan?.issues || [];

    // 1. If scan has rendered HTML snapshot, use it directly (never blocked by 403!)
    const matchedPage =
      scan?.results?.find((p) => p.url === normalized) || scan?.results?.[0];

    if (matchedPage?.html) {
      htmlContent = matchedPage.html;
      finalUrl = matchedPage.url || normalized;
    }

    // 2. If not stored in scan, attempt direct fetch with real Chrome desktop headers
    if (!htmlContent) {
      try {
        const fetched = await fetchPreviewHtml(normalized);
        htmlContent = fetched.html;
        finalUrl = fetched.finalUrl || normalized;
      } catch (fetchErr) {
        // 3. If direct fetch fails (e.g. 403 Forbidden Cloudflare), try headless browser fallback!
        try {
          const browserResult = await fetchWithBrowser(normalized);
          htmlContent = browserResult.html;
          finalUrl = browserResult.finalUrl || normalized;
        } catch {
          // 4. If browser fetch also fails, check if we have a screenshot from the scan!
          if (matchedPage?.screenshot) {
            const screenshotHtml = buildScreenshotHtml(
              normalized,
              matchedPage.screenshot,
              issues
            );
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.setHeader('X-Frame-Options', 'ALLOWALL');
            res.setHeader('Access-Control-Allow-Origin', '*');
            return res.send(screenshotHtml);
          }
          // Rethrow if no fallback available
          throw fetchErr;
        }
      }
    }

    // Inject base tag so relative links, images, and fonts resolve correctly
    let modifiedHtml = sanitizeHtmlForPreview(htmlContent);
    const baseUrl = finalUrl || normalized;
    const baseTag = `<base href="${escapeHtml(baseUrl)}">`;

    if (/<head[^>]*>/i.test(modifiedHtml)) {
      modifiedHtml = modifiedHtml.replace(
        /<head[^>]*>/i,
        (match) => `${match}\n${baseTag}`
      );
    } else {
      modifiedHtml = `${baseTag}\n${modifiedHtml}`;
    }

    // Inject error overlay script if issues are available
    if (issues.length > 0) {
      const overlayScript = buildOverlayScript(issues);
      if (/<\/body>/i.test(modifiedHtml)) {
        modifiedHtml = modifiedHtml.replace(
          /<\/body>/i,
          `${overlayScript}\n</body>`
        );
      } else {
        modifiedHtml += overlayScript;
      }
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('X-Frame-Options', 'ALLOWALL');
    res.setHeader('Access-Control-Allow-Origin', '*');
    // Keep the sandbox policy, including when serving captured target HTML.
    res.send(modifiedHtml);
  } catch (err) {
    // If an earlier scan exists in history for this URL that has a screenshot, use it!
    const allScans = listScans();
    const pastScan = allScans.find(
      (s) => s.startUrl === targetUrl && s.results?.[0]?.screenshot
    );
    if (pastScan?.results?.[0]?.screenshot) {
      const screenshotHtml = buildScreenshotHtml(
        targetUrl,
        pastScan.results[0].screenshot,
        pastScan.issues || []
      );
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('X-Frame-Options', 'ALLOWALL');
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.send(screenshotHtml);
    }

    res.status(502).send(`<!DOCTYPE html>
<html>
<head><style>body{font-family:system-ui,sans-serif;padding:2rem;color:#333;text-align:center;background:#fafafa;} .box{border:1px solid #e5e5e5;padding:2rem;border-radius:16px;background:#fff;max-width:500px;margin:3rem auto;box-shadow:0 4px 20px rgba(0,0,0,0.06);}</style></head>
<body>
<div class="box">
  <div style="font-size:36px;margin-bottom:12px;">🔍</div>
  <h3 style="margin:0 0 8px;font-size:18px;">Preview unavailable</h3>
  <p style="color:#666;font-size:13px;line-height:1.7;">Preview could not be loaded. Scan a public website and try again.</p>
  <p style="margin-top:16px;"><a href="${escapeHtml(targetUrl)}" target="_blank" rel="noopener" style="color:#f97316;font-weight:600;font-size:13px;">Open website in new tab →</a></p>
</div>
</body>
</html>`);
  }
}));

// Endpoint to get scan issues as JSON (for frontend overlay approach)
router.get('/scan-data/:scanId', (req, res) => {
  const scan = getScan(req.params.scanId);
  if (!scan) {
    return res.status(404).json({ error: 'Scan not found.' });
  }
  res.json({
    scanId: scan.scanId,
    url: scan.startUrl,
    issues: scan.issues || [],
    score: scan.score,
    severityCounts: scan.severityCounts,
  });
});

export default router;
