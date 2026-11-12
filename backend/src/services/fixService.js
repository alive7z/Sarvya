import { chromium } from 'playwright';
import { load } from 'cheerio';
import { browserEnvironment } from './publicNetwork.js';
import AxeBuilder from '@axe-core/playwright';

export function generateFix(ruleId, htmlSnippet = '', failureSummary = '') {
  const snippet = (htmlSnippet || '').trim();
  const summary = (failureSummary || '').trim();

  switch (ruleId) {
    case 'image-alt': {
      if (snippet.includes('<img')) {
        if (/alt=["'][^"']*["']/i.test(snippet)) {
          return snippet.replace(/alt=["'][^"']*["']/i, 'alt="Descriptive label for this image"');
        }
        return snippet.replace(/<img\b/i, '<img alt="Descriptive label for this image"');
      }
      return `${snippet}\n<!-- Add alt="Descriptive text" or alt="" if decorative -->`;
    }

    case 'color-contrast': {
      if (snippet.includes('style=')) {
        return snippet.replace(
          /style=["'][^"']*["']/i,
          'style="color: #111827; background-color: #ffffff; font-weight: 600;"'
        );
      }
      if (/^<[a-z0-9]+/i.test(snippet)) {
        return snippet.replace(
          /^<([a-z0-9]+)/i,
          '<$1 style="color: #111827; background-color: #ffffff; font-weight: 600;"'
        );
      }
      return `<span style="color: #111827; background-color: #ffffff; font-weight: 600;">${snippet}</span>`;
    }

    case 'button-name': {
      if (snippet.includes('<button')) {
        if (!/aria-label=/i.test(snippet)) {
          return snippet.replace(/<button\b/i, '<button aria-label="Action description"');
        }
      }
      return `${snippet}\n<!-- Add accessible text inside the button or an aria-label attribute -->`;
    }

    case 'link-name': {
      if (snippet.includes('<a')) {
        if (!/aria-label=/i.test(snippet)) {
          return snippet.replace(/<a\b/i, '<a aria-label="Descriptive link destination"');
        }
      }
      return `${snippet}\n<!-- Add meaningful anchor text or an aria-label describing the destination -->`;
    }

    case 'label': {
      if (snippet.includes('<input')) {
        const idMatch = snippet.match(/id=["']([^"']+)["']/i);
        const inputId = idMatch ? idMatch[1] : 'field-input';
        let updatedSnippet = snippet;
        if (!idMatch) {
          updatedSnippet = snippet.replace(/<input\b/i, `<input id="${inputId}"`);
        }
        return `<label for="${inputId}">Field Label</label>\n${updatedSnippet}`;
      }
      return `${snippet}\n<!-- Add a visible <label for="..."> or an aria-label attribute -->`;
    }

    case 'html-has-lang': {
      if (snippet.includes('<html')) {
        return snippet.replace(/<html\b[^>]*>/i, '<html lang="en">');
      }
      return '<html lang="en">';
    }

    case 'document-title': {
      return '<title>Descriptive and Unique Page Title - Sarvya</title>';
    }

    case 'meta-viewport': {
      return '<meta name="viewport" content="width=device-width, initial-scale=1">';
    }

    case 'region':
    case 'landmark-one-main': {
      return `<main role="main" aria-label="Main Content">\n  ${snippet}\n</main>`;
    }

    case 'duplicate-id': {
      return `${snippet}\n<!-- Ensure every element on the page has a unique id attribute -->`;
    }

    default: {
      if (summary) {
        return `<!-- Remediation recommendation -->\n<!-- ${summary.replace(/\n/g, ' ')} -->\n${snippet}`;
      }
      return `${snippet}\n<!-- Review WCAG guidance to address this finding -->`;
    }
  }
}

export function buildVerificationDocument(ruleId, proposedFix = '') {
  const clean = (proposedFix || '').trim();

  if (ruleId === 'html-has-lang') {
    return clean.includes('<html')
      ? clean.includes('lang=')
        ? clean
        : clean
      : `<!DOCTYPE html><html><head><title>Test</title></head><body>${clean}</body></html>`;
  }

  if (ruleId === 'document-title') {
    const titleTag = clean.includes('<title')
      ? clean
      : '';
    return `<!DOCTYPE html><html lang="en"><head>${titleTag}</head><body><h1>Document Title Verified</h1></body></html>`;
  }

  if (ruleId === 'meta-viewport') {
    const metaTag = clean.includes('<meta')
      ? clean
      : '';
    return `<!DOCTYPE html><html lang="en"><head><title>Viewport Test</title>${metaTag}</head><body>Content</body></html>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Accessibility Verification Sandbox</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #ffffff; color: #111827; padding: 24px; }
  </style>
</head>
<body>
  ${clean}
</body>
</html>`;
}

export async function verifyFix(ruleId, proposedFix) {
  if (!proposedFix || typeof proposedFix !== 'string') {
    throw new Error('A proposed fix string is required for verification.');
  }

  if (proposedFix.length > 100000 || typeof ruleId !== 'string' || !ruleId || ruleId === 'unknown') throw new Error('Provide a known rule ID and a snippet under 100 KB.');
  let context, browser, timeout;
  try {
    browser = await chromium.launch({ headless: true, env: browserEnvironment(), chromiumSandbox: true, timeout: 15000 });
    timeout = setTimeout(() => browser.close().catch(() => {}), 20000);
    context = await browser.newContext({ serviceWorkers: 'block', acceptDownloads: false });
    await context.route('**/*', route => route.abort());
    await context.routeWebSocket('**/*', socket => socket.close());
    const page = await context.newPage();

    const testHtml = buildVerificationDocument(ruleId, proposedFix);
    // Proposed markup is untrusted: no scripts, frames, event handlers or network.
    const document = load(testHtml);
    document('script,iframe,object,embed,base,meta[http-equiv]').remove();
    document('*').each((_i, el) => { for (const key of Object.keys(el.attribs || {})) if (/^on/i.test(key)) document(el).removeAttr(key); });
    document('head').prepend(`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src data:">`);
    await page.setContent(document.html(), { waitUntil: 'domcontentloaded', timeout: 10000 });

    let builder = new AxeBuilder({ page });
    if (ruleId && ruleId !== 'unknown') {
      try {
        builder = builder.withRules([ruleId]);
      } catch {
        // Fall back to general analyze if specific rule name fails
      }
    }

    const results = await builder.analyze();
    const remainingViolations = results.violations.filter(
      (v) => !ruleId || v.id === ruleId
    );

    const applicable = [...results.passes, ...results.violations].some(v => v.id === ruleId);
    const uncertain = results.incomplete.some(v => v.id === ruleId);
    const isVerified = applicable && !uncertain && remainingViolations.length === 0;

    return {
      verified: isVerified,
      ruleId,
      testHtml,
      timestamp: new Date().toISOString(),
      message: isVerified
        ? `Passed! axe-core confirmed 0 violations for rule "${ruleId}".`
        : `Verification incomplete: the rule failed, was inapplicable, or requires manual review.`,
      remainingViolations: remainingViolations.map((v) => ({
        id: v.id,
        help: v.help,
        impact: v.impact,
      })),
    };
  } finally {
    clearTimeout(timeout);
    if (context) await context.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
  }
}
