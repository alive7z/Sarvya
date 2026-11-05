import * as cheerio from 'cheerio';
import { normalizeUrl, assertPublicUrl } from './urlValidator.js';

const TIMEOUT_MS = 10000;
const MAX_REDIRECTS = 5;
const MAX_HTML_BYTES = 2.5 * 1024 * 1024;
const REQUEST_DELAY_MS = 150;

export async function safeFetch(rawUrl, allowedOrigin) {
  let currentUrl = normalizeUrl(rawUrl);
  const visited = new Set();

  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
    if (new URL(currentUrl).origin !== allowedOrigin) {
      throw new Error(`Cross-origin navigation blocked from ${allowedOrigin} to ${new URL(currentUrl).origin}`);
    }

    if (visited.has(currentUrl)) {
      throw new Error('Redirect loop detected.');
    }
    visited.add(currentUrl);

    await assertPublicUrl(currentUrl);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    let response;
    try {
      response = await fetch(currentUrl, {
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'User-Agent': 'AccessLens-Auditor/1.0 (+https://accesslens.dev)',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });
    } finally {
      clearTimeout(timeout);
    }

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      await response.body?.cancel();

      if (!location) {
        throw new Error('Redirect location header missing.');
      }

      if (redirects === MAX_REDIRECTS) {
        throw new Error('Too many redirects.');
      }

      currentUrl = normalizeUrl(new URL(location, currentUrl).href);
      continue;
    }

    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('text/html') && !contentType.toLowerCase().includes('application/xhtml')) {
      await response.body?.cancel();
      throw new Error(`URL did not return an HTML document (received ${contentType}).`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Empty response received from target.');
    }

    const chunks = [];
    let size = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_HTML_BYTES) {
          await reader.cancel();
          throw new Error('HTML response exceeds 2.5 MB maximum preview size.');
        }
        chunks.push(Buffer.from(value));
      }
    } finally {
      reader.releaseLock();
    }

    return {
      url: currentUrl,
      status: response.status,
      html: Buffer.concat(chunks).toString('utf8'),
    };
  }

  throw new Error('Unable to complete request.');
}

export async function crawlWebsite(startUrl, { maxPages = 10, maxDepth = 2 } = {}) {
  const boundedMaxPages = Math.min(Math.max(Number(maxPages) || 1, 1), 50);
  const boundedMaxDepth = Math.min(Math.max(Number(maxDepth) || 0, 0), 3);

  const start = normalizeUrl(startUrl);
  const origin = new URL(start).origin;

  await assertPublicUrl(start);

  const queue = [{ url: start, depth: 0 }];
  const scheduled = new Set([start]);
  const pages = [];
  const errors = [];
  let attempted = 0;

  while (queue.length > 0 && attempted < boundedMaxPages) {
    const current = queue.shift();
    attempted++;

    try {
      const result = await safeFetch(current.url, origin);
      const $ = cheerio.load(result.html);
      const links = new Set();

      $('a[href]').each((_, element) => {
        const href = $(element).attr('href');
        if (!href) return;

        try {
          const target = normalizeUrl(new URL(href, result.url).href);

          // Disallow logout, auth, checkout, or download endpoints
          const targetPath = new URL(target).pathname.toLowerCase();
          if (
            targetPath.includes('logout') ||
            targetPath.includes('signout') ||
            targetPath.endsWith('.pdf') ||
            targetPath.endsWith('.zip') ||
            targetPath.endsWith('.png') ||
            targetPath.endsWith('.jpg')
          ) {
            return;
          }

          if (new URL(target).origin === origin && !scheduled.has(target)) {
            links.add(target);
          }
        } catch {
          // Ignore invalid URLs
        }
      });

      pages.push({
        url: result.url,
        depth: current.depth,
        status: 'success',
        title: $('title').first().text().trim() || result.url,
        linksFound: links.size,
      });

      if (current.depth < boundedMaxDepth) {
        for (const link of links) {
          if (scheduled.size >= 500) break;
          scheduled.add(link);
          queue.push({
            url: link,
            depth: current.depth + 1,
          });
        }
      }
    } catch (error) {
      errors.push({
        url: current.url,
        depth: current.depth,
        message: error.message,
      });
    }

    if (queue.length > 0 && attempted < boundedMaxPages) {
      await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY_MS));
    }
  }

  return {
    startUrl: start,
    maxPages: boundedMaxPages,
    maxDepth: boundedMaxDepth,
    pagesDiscovered: scheduled.size,
    pagesAttempted: attempted,
    pagesCrawled: pages.length,
    errorsCount: errors.length,
    pages,
    errors,
    truncated: queue.length > 0,
  };
}
