import { runAudit, inspectTarget } from '../content/audit.js';
const active = new Set();
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  // Only the packaged popup can request privileged injection; no external/page bridge.
  if (sender.id !== chrome.runtime.id || !sender.url?.startsWith(chrome.runtime.getURL('popup/'))) return false;
  (async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !/^https?:\/\//i.test(tab.url || '')) throw new Error('Open an HTTP(S) website. Browser pages and extension stores cannot be audited.');
    const key = `tab-${tab.id}`;
    if (message.type === 'state') {
      const saved = (await chrome.storage.session.get(key))[key];
      if (saved?.result && saved.result.url !== tab.url) { await chrome.storage.session.remove(key); return { status: 'idle' }; }
      if (saved?.status === 'processing' && Date.now() - saved.startedAt > 30000) {
        const failed = { status: 'failed', error: 'The audit was interrupted. Reload the page and scan again.' };
        await chrome.storage.session.set({ [key]: failed }); return failed;
      }
      return saved || { status: 'idle' };
    }
    if (message.type === 'clear') { await chrome.storage.session.remove(key); return { status: 'idle' }; }
    if (message.type === 'inspect') {
      const saved = (await chrome.storage.session.get(key))[key];
      if (saved?.result?.url !== tab.url) throw new Error('The page changed. Re-scan before inspecting.');
      const node = saved.result.violations[message.rule]?.nodes[message.node];
      if (!node) throw new Error('Finding not found. Re-scan the page.');
      const [result] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: inspectTarget, args: [node.target] });
      if (result?.error) throw new Error('The element could not be inspected.');
      return result?.result;
    }
    if (message.type !== 'scan') throw new Error('Unsupported action.');
    if (active.has(tab.id)) throw new Error('An audit is already running for this tab.');
    if (active.size >= 2) throw new Error('Two tabs are already being audited. Wait for one to finish.');
    active.add(tab.id);
    try {
    const old = Object.entries(await chrome.storage.session.get(null)).filter(([id]) => id.startsWith('tab-') && id !== key).sort((a,b) => (b[1].finishedAt || b[1].startedAt || 0) - (a[1].finishedAt || a[1].startedAt || 0));
    await chrome.storage.session.remove(old.slice(3).map(([id]) => id));
    await chrome.storage.session.set({ [key]: { status: 'processing', startedAt: Date.now() } });
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['lib/axe.min.js'] });
      const [execution] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: runAudit });
      if (execution?.error || !execution?.result) throw new Error('This page could not be audited. Reload it and try again.');
      const result = execution.result;
      const current = await chrome.tabs.get(tab.id);
      if (current.url !== result.url) throw new Error('The page changed during the audit. Re-scan it.');
      if (JSON.stringify(result).length > 2_000_000) throw new Error('The result exceeds the session limit. Try a smaller page.');
      const state = { status: 'completed', finishedAt: Date.now(), result }; await chrome.storage.session.set({ [key]: state }); return state;
    } catch (error) {
      await chrome.storage.session.set({ [key]: { status: 'failed', error: 'Audit failed. The page may restrict extension access; reload and try again.' } }); throw error;
    } finally { active.delete(tab.id); }
  })().then(result => respond({ ok: true, result }), error => respond({ ok: false, error: error.message || 'This action is unavailable on the current page.' }));
  return true;
});
chrome.tabs.onRemoved.addListener(id => { active.delete(id); chrome.storage.session.remove(`tab-${id}`); });
chrome.tabs.onUpdated.addListener((id, change) => { if (change.url) chrome.storage.session.remove(`tab-${id}`); });
