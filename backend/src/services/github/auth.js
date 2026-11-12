import { randomBytes, createHash, createCipheriv, createDecipheriv, timingSafeEqual } from 'node:crypto';
import { getScanRedisConnection } from '../../queues/scanQueue.js';
import { env } from '../../config/env.js';
import { RunError } from '../runErrors.js';

export const githubConfig = {
  clientId: process.env.GITHUB_CLIENT_ID || '', clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
  sessionSecret: process.env.GITHUB_SESSION_SECRET || '',
  callbackUrl: process.env.GITHUB_CALLBACK_URL || `${env.frontendOrigin}/api/github/oauth/callback`,
  frontendOrigin: env.frontendOrigin, secure: env.nodeEnv === 'production',
  scope: process.env.GITHUB_OAUTH_SCOPE || 'public_repo',
};
const hash = value => createHash('sha256').update(value).digest('hex');
export const nonce = () => randomBytes(32).toString('base64url');
export const safeEqual = (a, b) => typeof a === 'string' && typeof b === 'string' && Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b));
export function isConfigured(config = githubConfig) {
  try {
    const callback = new URL(config.callbackUrl), frontend = new URL(config.frontendOrigin);
    return Boolean(config.clientId && config.clientSecret && Buffer.byteLength(config.sessionSecret) >= 32
      && ['public_repo', 'repo'].includes(config.scope) && !callback.username && !callback.password
      && callback.origin === frontend.origin && ['http:', 'https:'].includes(callback.protocol)
      && (!config.secure || callback.protocol === 'https:'));
  } catch { return false; }
}
export function cookieValue(req, name) {
  return (req.headers.cookie || '').split(';').map(item => item.trim()).find(item => item.startsWith(`${name}=`))?.slice(name.length + 1) || '';
}
export const cookieOptions = config => ({ httpOnly: true, secure: config.secure, sameSite: 'lax', path: '/api/github' });

export function createGitHubAuthStore({ config = githubConfig, redisProvider = getScanRedisConnection } = {}) {
  const key = createHash('sha256').update(config.sessionSecret).digest();
  const encrypt = value => {
    const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv);
    const bytes = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), bytes]).toString('base64');
  };
  const decrypt = value => {
    if (!value) return null;
    try { const bytes = Buffer.from(value, 'base64'); const decipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(0, 12)); decipher.setAuthTag(bytes.subarray(12, 28)); return JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString('utf8')); }
    catch { return null; }
  };
  const redis = async () => { try { return await redisProvider(); } catch { throw new RunError('GitHub session storage is unavailable. Check Redis.', { status: 503 }); } };
  const storageKey = (kind, id) => `sarvya:github:${kind}:${hash(id)}`;
  const set = async (kind, id, value, seconds) => { await (await redis()).set(storageKey(kind, id), encrypt(value), 'EX', seconds); };
  return {
    async start() {
      const state = nonce(), binder = nonce(), verifier = nonce();
      await set('state', state, { binderHash: hash(binder), verifier }, 600);
      const url = new URL('https://github.com/login/oauth/authorize');
      Object.entries({ client_id: config.clientId, redirect_uri: config.callbackUrl, scope: config.scope, state, code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256' }).forEach(([k, v]) => url.searchParams.set(k, v));
      return { binder, url: url.href };
    },
    async consume(state, binder) {
      if (typeof state !== 'string' || typeof binder !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(state || '') || !/^[A-Za-z0-9_-]{43}$/.test(binder || '')) throw new RunError('GitHub sign-in state is invalid or expired. Try connecting again.', { status: 401 });
      const flow = decrypt(await (await redis()).getdel(storageKey('state', state)));
      if (!flow || !safeEqual(flow.binderHash, hash(binder))) throw new RunError('GitHub sign-in state is invalid or expired. Try connecting again.', { status: 401 });
      return flow.verifier;
    },
    async create(token, user, expiresIn = 28800) {
      const id = nonce(), csrf = nonce(), seconds = Math.max(1, Math.min(28800, Math.floor(expiresIn)));
      await set('session', id, { token, user, csrf }, seconds);
      return { id, csrf, seconds };
    },
    async get(id) { return /^[A-Za-z0-9_-]{43}$/.test(id || '') ? decrypt(await (await redis()).get(storageKey('session', id))) : null; },
    async destroy(id) { if (id) await (await redis()).del(storageKey('session', id)); },
    async limit(identity, limit, seconds) {
      const count = await (await redis()).eval("local n = redis.call('INCR', KEYS[1]); if n == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]); end; return n", 1, storageKey('limit', identity), seconds);
      if (Number(count) > limit) throw new RunError('Too many GitHub requests. Try again later.', { status: 429 });
    },
  };
}
