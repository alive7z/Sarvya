// Chromium HTTP routing skips redirect hops in Playwright. A CDP Fetch guard pauses
// every hop, including frame/popup targets, before allowing the browser to connect.
export async function protectBrowserContext(context, { signal, validateUrl }) {
  const guards = new WeakMap();
  const install = async (target) => {
    const network = await context.newCDPSession(target);
    network.on('Fetch.requestPaused', async ({ requestId, request, resourceType }) => {
      try {
        if (signal?.aborted || resourceType === 'Media') throw new Error('Request blocked.');
        await validateUrl(request.url);
        await network.send('Fetch.continueRequest', { requestId });
      } catch {
        await network.send('Fetch.failRequest', { requestId, errorReason: 'BlockedByClient' }).catch(() => {});
      }
    });
    await network.send('Fetch.enable', { patterns: [{ urlPattern: '*', requestStage: 'Request' }] });
  };
  const guardPage = (page) => {
    if (!guards.has(page)) {
      page.on('framenavigated', frame => guards.delete(frame));
      guards.set(page, install(page));
    }
    return guards.get(page);
  };
  const guardFrame = (frame) => {
    if (!frame.parentFrame()) return guardPage(frame.page());
    if (!guards.has(frame)) guards.set(frame, install(frame).catch(error => {
      // Same-process frames share the parent's network target. Cross-origin
      // process changes invalidate this entry on framenavigated.
      if (error.message.includes('does not have a separate CDP session')) return guardFrame(frame.parentFrame());
      throw error;
    }));
    return guards.get(frame);
  };
  context.on('page', page => { guardPage(page).catch(() => page.close().catch(() => {})); });
  await context.routeWebSocket('**/*', socket => socket.close());
  await context.route('**/*', async route => {
    try {
      const request = route.request();
      if (signal?.aborted || request.resourceType() === 'media') return await route.abort();
      await validateUrl(request.url());
      await guardFrame(request.frame());
      await route.continue();
    } catch { await route.abort().catch(() => {}); }
  });
  return { guardPage };
}
