import { test, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

// Reuse the browser dependency already required by the backend; no new test package.
const { chromium } = createRequire(new URL('../../backend/package.json', import.meta.url))('playwright');
let server, browser, context, page, baseURL;
const mockSpeech = () => {
  const state = { calls: [], active: null, cancels: 0, voices: [{ name: 'Google US English', voiceURI: 'google-en-us', lang: 'en-US', localService: false }, { name: 'System English', voiceURI: 'system-en', lang: 'en-US', localService: true }], paused: false };
  class Synth extends EventTarget {
    getVoices() { return state.voices; }
    speak(utterance) { state.calls.push(utterance); state.active = utterance; }
    cancel() { const previous = state.active; state.active = null; state.cancels++; queueMicrotask(() => previous?.onerror?.({ error: 'canceled' })); }
    pause() { state.paused = true; }
    resume() { state.paused = false; }
  }
  Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: new Synth() });
  Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: class { constructor(text) { this.text = text; } } });
  window.__speech = state;
};

before(async () => {
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), server: { host: '127.0.0.1', port: 0 }, logLevel: 'error' });
  await server.listen();
  baseURL = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch({ headless: true });
});
after(async () => { await browser?.close(); await server?.close(); });
beforeEach(async () => {
  context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  await context.addInitScript(mockSpeech);
  await context.addInitScript(() => localStorage.setItem('sarvya-vision-v1', 'standard')); page = await context.newPage();
  await page.route('https://fonts.googleapis.com/**', route => route.abort());
  await page.goto(baseURL);
  await page.getByRole('button', { name: 'Open screen reader', exact: true }).waitFor();
});
afterEach(async () => { await context?.close(); });
const readerPanel = () => page.getByRole('region', { name: 'Preview screen reader', exact: true });
const wait = async fn => page.waitForFunction(fn);

 test('outline uses actual names, labels, roles, and hidden-content rules without executing scripts', async () => {
  const result = await page.evaluate(async () => {
    const { readSnippet } = await import('/src/utils/readerContent.js');
    return readSnippet(`<main><h2>Account details</h2><span id="name" hidden>Save profile</span><button aria-labelledby="name">Wrong text</button><label for="email">Email address</label><input id="email" required value="private@example.com"><img alt="A river at sunset"><img alt=""><p aria-hidden="true">SECRET HIDDEN</p><p style="display:none">SECRET CSS</p><script>window.__executed = true</script><a href="/help">Help center</a></main>`).items.map(({ text, kind }) => ({ text, kind }));
  });
  const text = result.map(item => item.text).join(' ');
  assert.match(text, /Heading level 2, Account details/);
  assert.match(text, /Save profile, button/);
  assert.match(text, /Email address, textbox, required/);
  assert.match(text, /Image, A river at sunset/);
  assert.match(text, /Help center, link/);
  assert.doesNotMatch(text, /Wrong text|SECRET|private@example.com|__executed/);
  assert.equal(await page.evaluate(() => window.__executed), undefined);
  assert.equal(result.filter(item => item.kind === 'image').length, 1);
 });

 test('reads the preview, filters structure, loads voices late, controls playback, and ignores stale callbacks', async () => {
  await page.getByRole('button', { name: 'Open screen reader', exact: true }).click();
  const reader = readerPanel();
  await reader.getByRole('combobox', { name: 'Reading content' }).selectOption('heading');
  const entries = await reader.getByRole('list', { name: 'Reading transcript' }).getByRole('button').allTextContents();
  assert.ok(entries.length > 0 && entries.every(text => text.includes('Heading level')));
  await page.evaluate(() => { window.__speech.voices = []; window.speechSynthesis.dispatchEvent(new Event('voiceschanged')); });
  await reader.getByText('This browser has not exposed any Google voices. Audio is unavailable; the transcript remains readable.', { exact: true }).waitFor();
  await page.evaluate(() => { window.__speech.voices = [{ name: 'System English', voiceURI: 'system-en', lang: 'en-US', localService: true }, { name: 'Google UK English Female', voiceURI: 'google-en-gb', lang: 'en-GB', localService: false }, { name: 'Google US English', voiceURI: 'google-en-us', lang: 'en-US', localService: false }]; window.speechSynthesis.dispatchEvent(new Event('voiceschanged')); });
  await reader.getByRole('combobox', { name: 'Reading voice', exact: true }).getByRole('option', { name: /Google US English/ }).waitFor({ state: 'attached' });
  assert.equal(await reader.getByRole('combobox', { name: 'Reading voice', exact: true }).inputValue(), 'google-en-us');
  const voiceNames = await reader.getByRole('combobox', { name: 'Reading voice', exact: true }).getByRole('option').allTextContents();
  assert.ok(voiceNames.length === 2 && voiceNames.every(name => name.startsWith('Google')));
  await reader.getByRole('slider', { name: 'Reading speed' }).fill('1.4');
  await reader.getByRole('button', { name: 'Read aloud', exact: true }).click();
  await wait(() => window.__speech.calls.length > 0);
  assert.equal(await page.evaluate(() => window.__speech.active.rate), 1.4);
  assert.equal(await page.evaluate(() => window.__speech.active.voice.voiceURI), 'google-en-us');
  await reader.getByRole('button', { name: 'Pause', exact: true }).click();
  assert.equal(await page.evaluate(() => window.__speech.paused), true);
  await reader.getByRole('button', { name: 'Resume', exact: true }).click();
  assert.equal(await page.evaluate(() => window.__speech.paused), false);
  await reader.getByRole('button', { name: 'Stop', exact: true }).click();
  await reader.getByRole('combobox', { name: 'Reading content' }).selectOption('all');
  await reader.getByRole('button', { name: 'Read aloud', exact: true }).click();
  const calls = await page.evaluate(() => window.__speech.calls.length);
  await page.evaluate(() => { const current = window.__speech.active; window.__speech.active = null; current.onend(); });
  await wait(() => window.__speech.calls.length > 2);
  assert.equal(await page.evaluate(() => window.__speech.calls.length), calls + 1);
  await page.evaluate(() => { window.__lastUtterance = window.__speech.active; });
  await reader.getByRole('button', { name: 'Close screen reader', exact: true }).click();
  const afterClose = await page.evaluate(() => window.__speech.calls.length);
  await page.evaluate(() => window.__lastUtterance.onend());
  assert.equal(await page.evaluate(() => window.__speech.calls.length), afterClose);
  assert.equal(await page.evaluate(() => window.__speech.active), null);
  assert.equal(await page.getByRole('button', { name: 'Open screen reader', exact: true }).evaluate(el => el === document.activeElement), true);
 });

 test('snippet switching reads actual proposed content and stops an active reader', async () => {
  const issue = page.getByRole('complementary', { name: 'Detected accessibility issues' }).locator('article').first();
  await issue.getByRole('button', { name: /Screen reader simulator/ }).click();
  const reader = page.getByRole('region', { name: 'Issue screen reader' });
  await reader.getByRole('button', { name: 'Read aloud', exact: true }).click();
  await reader.getByRole('button', { name: 'Proposed fix', exact: true }).click();
  assert.equal(await page.evaluate(() => window.__speech.active), null);
  assert.match(await reader.getByRole('list', { name: 'Reading transcript' }).textContent(), /A bright workspace with a desk, chair, and plant/);
  await reader.getByRole('button', { name: 'Read aloud', exact: true }).click();
  await page.getByRole('button', { name: 'Open screen reader', exact: true }).click();
  await readerPanel().getByRole('button', { name: 'Read aloud', exact: true }).click();
  await reader.getByRole('button', { name: 'Read aloud', exact: true }).waitFor();
  await readerPanel().getByRole('button', { name: 'Stop', exact: true }).click();
 });

 test('speech errors and restricted documents show useful fallback states', async () => {
  await page.getByRole('button', { name: 'Open screen reader', exact: true }).click();
  const reader = readerPanel();
  await reader.getByRole('button', { name: 'Read aloud', exact: true }).click();
  await page.evaluate(() => window.__speech.active.onerror({ error: 'voice-unavailable' }));
  await reader.getByRole('alert').filter({ hasText: 'voice-unavailable' }).waitFor();
  await page.route('https://restricted.test/**', route => route.fulfill({ body: '<p>Restricted preview</p>', contentType: 'text/html' }));
  await page.locator('iframe[title="Sample website preview"]').evaluate(frame => { frame.srcdoc = ''; frame.removeAttribute('srcdoc'); frame.src = 'https://restricted.test/'; });
  await reader.getByRole('alert').filter({ hasText: 'unavailable or restricted' }).waitFor();
  assert.equal(await reader.getByRole('button', { name: 'Read aloud', exact: true }).isDisabled(), true);
 });

 test('reader remains keyboard usable and fits mobile widths', async () => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.getByRole('button', { name: 'Preview', exact: true }).click();
  await page.getByRole('button', { name: 'Open screen reader', exact: true }).click();
  await readerPanel().getByRole('combobox', { name: 'Reading content' }).selectOption('link');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await readerPanel().getByRole('button', { name: 'Close screen reader', exact: true }).focus();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Open screen reader', exact: true }).waitFor();
 });

 test('unsupported speech still exposes a transcript and disables playback', async () => {
  await page.addInitScript(() => { delete window.speechSynthesis; delete window.SpeechSynthesisUtterance; });
  await page.reload();
  await page.getByRole('button', { name: 'Open screen reader', exact: true }).click();
  const reader = readerPanel();
  await reader.getByText('Speech is unavailable in this browser. The reading outline is still available.', { exact: true }).waitFor();
  assert.equal(await reader.getByRole('button', { name: 'Read aloud', exact: true }).isDisabled(), true);
  await reader.getByRole('list', { name: 'Reading transcript' }).getByRole('button').first().waitFor();
  assert.ok(await reader.getByRole('list', { name: 'Reading transcript' }).getByRole('button').count() > 0);
 });

 test('demo fixture targets exist, illustrations load, and demo interactions stay local', async () => {
  await page.waitForFunction(() => {
    const doc = document.querySelector('iframe[title="Sample website preview"]')?.contentDocument;
    return doc?.images.length === 3 && Array.from(doc.images).every(image => image.complete && image.naturalWidth > 0);
  });
  const fixture = await page.evaluate(async () => {
    const { demoIssues } = await import('/src/data/demoAudit.js');
    const doc = document.querySelector('iframe[title="Sample website preview"]').contentDocument;
    return {
      missing: demoIssues.flatMap(issue => issue.nodes).filter(node => !doc.querySelector(node.selector)).map(node => node.selector),
      altMissing: Array.from(doc.images).every(image => !image.hasAttribute('alt')),
      languageMissing: !doc.documentElement.hasAttribute('lang'),
      labelMissing: doc.getElementById('email').labels.length === 0,
    };
  });
  assert.deepEqual(fixture, { missing: [], altMissing: true, languageMissing: true, labelMissing: true });
  const frame = page.frameLocator('iframe[title="Sample website preview"]');
  await frame.locator('button.icon-only').click();
  await frame.getByRole('dialog', { name: 'A place of your own.' }).waitFor();
  await frame.getByRole('button', { name: 'Close', exact: true }).click();
  await frame.locator('#email').fill('sample@example.com');
  await frame.getByRole('button', { name: 'Join the list', exact: false }).click();
  await frame.getByRole('status').filter({ hasText: 'No email was sent or stored.' }).waitFor();
 });

 test('never falls back to a system voice when Google voices are unavailable', async () => {
  await page.evaluate(() => { window.__speech.voices = [{ name: 'System English', voiceURI: 'system-en', lang: 'en-US', localService: true }]; });
  await page.getByRole('button', { name: 'Open screen reader', exact: true }).click();
  const reader = readerPanel();
  await reader.getByText('This browser has not exposed any Google voices. Audio is unavailable; the transcript remains readable.', { exact: true }).waitFor();
  assert.equal(await reader.getByRole('button', { name: 'Read aloud', exact: true }).isDisabled(), true);
  assert.equal(await page.evaluate(() => window.__speech.calls.length), 0);
  await reader.getByRole('list', { name: 'Reading transcript' }).getByRole('button').first().waitFor();
  assert.ok(await reader.getByRole('list', { name: 'Reading transcript' }).getByRole('button').count() > 0);
 });

 test('workspace stays at the top on load and refresh while preview highlights still work', async () => {
  await page.waitForFunction(() => document.querySelector('iframe[title="Sample website preview"]')?.contentDocument?.querySelector('img.hero-art.broken'));
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert.equal(await page.evaluate(() => window.scrollY), 0);
  await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }));
  assert.ok(await page.evaluate(() => window.scrollY) > 0);
  await page.reload();
  await page.waitForFunction(() => document.querySelector('iframe[title="Sample website preview"]')?.contentDocument?.querySelector('img.hero-art.broken'));
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert.equal(await page.evaluate(() => window.scrollY), 0);
  const panel = page.getByRole('complementary', { name: 'Detected accessibility issues' });
  const labelIssue = panel.getByRole('button', { name: /Form field has no label/ });
  await labelIssue.scrollIntoViewIfNeeded();
  const before = await page.evaluate(() => window.scrollY);
  await labelIssue.click();
  await page.waitForFunction(() => document.querySelector('iframe[title="Sample website preview"]')?.contentDocument?.querySelector('input#email.broken'));
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert.equal(await page.evaluate(() => window.scrollY), before);
  assert.ok(await page.frameLocator('iframe[title="Sample website preview"]').locator('html').evaluate(() => window.scrollY) > 0);
 });
