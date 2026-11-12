import { createHash, timingSafeEqual } from 'node:crypto';
const digest = value => createHash('sha256').update(value).digest();
export function frontendOrigins(origin, production = false) {
  const allowed = new Set([origin]);
  if (production || !origin) return allowed;
  try {
    const url = new URL(origin);
    // Development aliases only, with the configured protocol and port unchanged.
    if (['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
      for (const hostname of ['localhost', '127.0.0.1', '[::1]']) { url.hostname = hostname; allowed.add(url.origin); }
    }
  } catch { /* An invalid configured origin cannot broaden access. */ }
  return allowed;
}
export function createSecurity({ production, username, password, origin, limit = 600, now = Date.now } = {}) {
  if (production && (!username || username.includes(':') || typeof password !== 'string' || password.length < 20)) throw new Error('Production requires ACCESS_USER and an ACCESS_PASSWORD of at least 20 characters.');
  const allowed = frontendOrigins(origin, production);
  const expected = digest(`${username}:${password}`);
  const buckets = new Map();
  return (req, res, next) => {
    res.set({ 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Permissions-Policy': 'camera=(), microphone=(), geolocation=()', 'Cache-Control': 'no-store' });
    if (production) res.set('Strict-Transport-Security', 'max-age=31536000');
    if (req.path === '/api/health') return next();
    const timestamp = now();
    for (const [key, entry] of buckets) if (entry.until <= timestamp) buckets.delete(key);
    const key = req.ip || 'unknown';
    let bucket = buckets.get(key);
    if (!bucket) {
      if (buckets.size >= 5000) return res.status(429).json({ error: 'The service is busy. Try again shortly.' });
      bucket = { count: 0, until: timestamp + 60000 }; buckets.set(key, bucket);
    }
    if (++bucket.count > limit) return res.set('Retry-After', String(Math.max(1, Math.ceil((bucket.until - timestamp) / 1000)))).status(429).json({ error: 'Too many requests. Try again shortly.' });

    if (production) {
      const header = req.headers.authorization || '';
      const value = /^Basic [a-z0-9+/=]+$/i.test(header) ? Buffer.from(header.slice(6), 'base64').toString('utf8') : '';
      if (!timingSafeEqual(digest(value), expected)) return res.set('WWW-Authenticate', 'Basic realm="Sarvya", charset="UTF-8"').status(401).json({ error: 'Sign in to this private Sarvya workspace.' });
    }
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.headers.origin && !allowed.has(req.headers.origin)) return res.status(403).json({ error: 'This request origin is not allowed.' });
    next();
  };
}
export function limitAsync(maximum, handler) {
  let active = 0;
  return async (req, res, next) => {
    if (active >= maximum) return res.status(429).set('Retry-After', '5').json({ error: 'Browser capacity is busy. Try again shortly.' });
    active++;
    try { await handler(req, res, next); } catch (error) { next(error); }
    finally { active--; }
  };
}
