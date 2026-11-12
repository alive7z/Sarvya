import { Router } from 'express';
import { createGitHubClient, exchangeOAuthCode } from '../services/github/client.js';
import { createGitHubAuthStore, githubConfig, isConfigured, cookieValue, cookieOptions, safeEqual } from '../services/github/auth.js';
import { createReviewService } from '../services/github/reviewService.js';
import { RunError } from '../services/runErrors.js';

const SESSION = 'sarvya_github', FLOW = 'sarvya_github_flow';
export function createGitHubRouter({ config = githubConfig, auth = createGitHubAuthStore({ config }), reviews = createReviewService(), clientFactory = createGitHubClient, exchange = exchangeOAuthCode } = {}) {
  const router = Router();
  router.use((_req, res, next) => { res.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' }); next(); });
  const ready = () => { if (!isConfigured(config)) throw new RunError('GitHub OAuth is not configured. Set GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, GITHUB_SESSION_SECRET, and GITHUB_CALLBACK_URL on the API server.', { status: 503 }); };
  const route = handler => async (req, res, next) => {
    try { await handler(req, res); }
    catch (error) {
      if (error.status === 401 && res.locals.sessionId) { await auth.destroy(res.locals.sessionId).catch(() => {}); res.clearCookie(SESSION, cookieOptions(config)); }
      next(error);
    }
  };
  const authenticated = async (req, res, write = false) => {
    ready();
    const sessionId = cookieValue(req, SESSION), session = await auth.get(sessionId);
    if (!session) throw new RunError('Connect GitHub before accessing repositories.', { status: 401 });
    res.locals.sessionId = sessionId;
    if (write && (req.get('Origin') !== config.frontendOrigin || !safeEqual(req.get('X-CSRF-Token'), session.csrf))) throw new RunError('This GitHub action requires a valid same-origin review session. Reload the integration page.', { status: 403 });
    await auth.limit(`${session.user.id}:${write ? 'writes' : 'reads'}`, write ? 120 : 600, 3600);
    return { ...session, api: clientFactory(session.token) };
  };
  const returnTo = status => { const target = new URL(config.frontendOrigin); target.searchParams.set('github', status); return target.href; };
  router.get('/session', route(async (req, res) => {
    if (!isConfigured(config)) return res.json({ configured: false, authenticated: false });
    const session = await auth.get(cookieValue(req, SESSION));
    res.json({ configured: true, authenticated: Boolean(session), ...(session ? { user: session.user, csrfToken: session.csrf } : {}) });
  }));
  router.get('/oauth/start', route(async (req, res) => {
    ready(); await auth.limit(`oauth:${req.ip}`, 20, 600);
    const flow = await auth.start();
    res.cookie(FLOW, flow.binder, { ...cookieOptions(config), maxAge: 600000 });
    res.redirect(flow.url);
  }));
  router.get('/oauth/callback', route(async (req, res) => {
    ready();
    try {
      const verifier = await auth.consume(req.query.state, cookieValue(req, FLOW));
      if (req.query.error || typeof req.query.code !== 'string' || !req.query.code || req.query.code.length > 512) throw new RunError('GitHub authorization was declined.', { status: 401 });
      const { token, expiresIn } = await exchange({ code: req.query.code, verifier, config });
      // Always identify the authenticated GitHub account after the token exchange.
      const profile = await clientFactory(token)('GET', '/user');
      if (!Number.isSafeInteger(profile.id) || !profile.login) throw new RunError('GitHub account could not be verified.', { status: 401 });
      const session = await auth.create(token, { id: profile.id, login: profile.login }, expiresIn);
      await auth.destroy(cookieValue(req, SESSION));
      res.cookie(SESSION, session.id, { ...cookieOptions(config), maxAge: session.seconds * 1000 });
      res.clearCookie(FLOW, cookieOptions(config)); res.redirect(returnTo('connected'));
    } catch {
      res.clearCookie(FLOW, cookieOptions(config)); res.redirect(returnTo('failed'));
    }
  }));
  router.delete('/session', route(async (req, res) => {
    await authenticated(req, res, true); await auth.destroy(cookieValue(req, SESSION));
    res.clearCookie(SESSION, cookieOptions(config)); res.status(204).end();
  }));
  router.get('/repos', route(async (req, res) => {
    const { api } = await authenticated(req, res);
    const page = Number(req.query.page || 1);
    if (!Number.isInteger(page) || page < 1 || page > 100) throw new RunError('Repository page must be 1–100.', { status: 400 });
    const repos = await api('GET', `/user/repos?per_page=30&page=${page}&sort=updated&affiliation=owner,collaborator,organization_member`);
    if (!Array.isArray(repos)) throw new RunError('GitHub returned an invalid repository list.', { status: 502 });
    res.json({ repositories: repos.filter(r => r.permissions?.push && !r.archived && !r.disabled).map(r => ({ id: r.id, fullName: r.full_name, defaultBranch: r.default_branch, isPrivate: r.private })), nextPage: repos.length === 30 && page < 100 ? page + 1 : null });
  }));
  router.post('/reviews', route(async (req, res) => { const { user, api } = await authenticated(req, res, true); res.status(201).json(await reviews.create(user, api, req.body?.repository)); }));
  router.get('/reviews/:id', route(async (req, res) => { const { user } = await authenticated(req, res); res.json(await reviews.get(user, req.params.id)); }));
  router.get('/reviews/:id/files', route(async (req, res) => { const { user, api } = await authenticated(req, res); res.json(await reviews.files(user, api, req.params.id)); }));
  router.get('/reviews/:id/source', route(async (req, res) => { const { user, api } = await authenticated(req, res); res.json(await reviews.source(user, api, req.params.id, req.query.path)); }));
  router.post('/reviews/:id/patches', route(async (req, res) => { const { user, api } = await authenticated(req, res, true); res.status(201).json(await reviews.add(user, api, req.params.id, req.body || {})); }));
  router.patch('/reviews/:id/patches/:patchId', route(async (req, res) => { const { user } = await authenticated(req, res, true); res.json(await reviews.decide(user, req.params.id, req.params.patchId, req.body || {})); }));
  router.delete('/reviews/:id/patches/:patchId', route(async (req, res) => { const { user } = await authenticated(req, res, true); res.json(await reviews.decide(user, req.params.id, req.params.patchId, req.body || {}, true)); }));
  router.post('/pull-requests', route(async (req, res) => { const { user, api } = await authenticated(req, res, true); res.status(201).json(await reviews.publish(user, api, req.body || {})); }));
  return router;
}
export default createGitHubRouter();
