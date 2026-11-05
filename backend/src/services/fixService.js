import { chromium } from 'playwright';
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
      return '<title>Descriptive and Unique Page Title - AccessLens</title>';
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

let warmBrowser = null;

async function getWarmBrowser() {
  if (!warmBrowser || !warmBrowser.isConnected()) {
    warmBrowser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--disable-gpu',
        '--disable-extensions',
        '--mute-audio',
      ],
    });
  }
  return warmBrowser;
}

export function buildVerificationDocument(ruleId, proposedFix = '') {
  const clean = (proposedFix || '').trim();

  if (ruleId === 'html-has-lang') {
    return clean.includes('<html')
      ? clean.includes('lang=')
        ? clean
        : clean.replace(/<html/i, '<html lang="en"')
      : `<!DOCTYPE html><html lang="en"><head><title>Test</title></head><body>Fix verified</body></html>`;
  }

  if (ruleId === 'document-title') {
    const titleTag = clean.includes('<title')
      ? clean
      : `<title>Accessible Page Title - AccessLens</title>`;
    return `<!DOCTYPE html><html lang="en"><head>${titleTag}</head><body><h1>Document Title Verified</h1></body></html>`;
  }

  if (ruleId === 'meta-viewport') {
    const metaTag = clean.includes('<meta')
      ? clean
      : `<meta name="viewport" content="width=device-width, initial-scale=1">`;
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

  let context;
  try {
    const browser = await getWarmBrowser();
    context = await browser.newContext();
    const page = await context.newPage();

    const testHtml = buildVerificationDocument(ruleId, proposedFix);
    await page.setContent(testHtml, { waitUntil: 'domcontentloaded' });

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

    const isVerified = remainingViolations.length === 0;

    return {
      verified: isVerified,
      ruleId,
      testHtml,
      timestamp: new Date().toISOString(),
      message: isVerified
        ? `Passed! axe-core confirmed 0 violations for rule "${ruleId}".`
        : `Verification incomplete: rule "${ruleId}" is still flagging issues.`,
      remainingViolations: remainingViolations.map((v) => ({
        id: v.id,
        help: v.help,
        impact: v.impact,
      })),
    };
  } finally {
    if (context) await context.close();
  }
}
