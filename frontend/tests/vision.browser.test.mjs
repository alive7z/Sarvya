import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import { createServer } from 'vite';
const require = createRequire(new URL('../../backend/package.json', import.meta.url));
const { chromium } = require('playwright');
const axe = require('axe-core');
let server, browser, baseURL;
before(async () => {
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), server: { host: '127.0.0.1', port: 0 }, logLevel: 'error' });
  await server.listen(); baseURL = `http://127.0.0.1:${server.httpServer.address().port}`; browser = await chromium.launch();
});
after(async () => { await browser?.close(); await server?.close(); });
async function open(options = {}) {
  const context = await browser.newContext({ reducedMotion: 'reduce', ...options });
  const page = await context.newPage();
  await page.route('https://fonts.googleapis.com/**', r => r.abort());
  await page.route('**/api/**', r => r.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"Service unavailable"}' }));
  await page.goto(baseURL); return { context, page };
}
async function checkContrast(page, label) {
  await page.evaluate(axe.source);
  const result = await page.evaluate(() => window.axe.run(document, { runOnly: ['color-contrast'], resultTypes: ['violations'] }));
  assert.deepEqual(result.violations.flatMap(v => v.nodes.map(n => ({ target: n.target, summary: n.failureSummary }))), [], label);
}
test('welcome is keyboard usable, saves a preference, restores it, and can be reopened without losing the workspace', async () => {
  const { context, page } = await open();
  try {
    await page.getByRole('heading', { name: 'Are you colour blind?' }).waitFor();
    await checkContrast(page, 'welcome contrast');
    await page.screenshot({ path: '/private/tmp/sarvya-vision-welcome.png', fullPage: true });
    await page.getByRole('radio', { name: /Red–green · protan/ }).focus(); await page.keyboard.press('Space');
    await page.getByRole('button', { name: 'Continue to workspace' }).click();
    assert.equal(await page.evaluate(() => localStorage.getItem('sarvya-vision-v1')), 'protan');
    await page.getByRole('heading', { name: 'Audit workspace', exact: true }).waitFor();
    await page.reload(); await page.getByRole('heading', { name: 'Audit workspace', exact: true }).waitFor();
    await page.getByRole('searchbox', { name: 'Search issues', exact: true }).fill('image');
    await page.getByRole('button', { name: 'Colour preferences', exact: true }).click();
    await page.getByRole('radio', { name: 'Monochrome', exact: false }).check();
    await page.getByRole('button', { name: 'Continue to workspace' }).click();
    assert.equal(await page.getByRole('searchbox', { name: 'Search issues', exact: true }).inputValue(), 'image');
    assert.equal(await page.getByRole('button', { name: 'Colour preferences', exact: true }).evaluate(el => el === document.activeElement), true);
    assert.equal(await page.locator('.app-shell').evaluate(el => getComputedStyle(el).getPropertyValue('--vision-action').trim()), '#303640');
  } finally { await context.close(); }
});
test('invalid or unavailable storage still allows entry, and the welcome fits a phone', async () => {
  const { context, page } = await open({ viewport: { width: 375, height: 850 } });
  try {
    await page.evaluate(() => localStorage.setItem('sarvya-vision-v1', 'invalid')); await page.reload();
    await page.getByRole('heading', { name: 'Are you colour blind?' }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.addInitScript(() => { Storage.prototype.setItem = () => { throw Error('Disabled'); }; }); await page.reload();
    await page.getByRole('button', { name: 'Skip and use original colours' }).click();
    await page.getByRole('heading', { name: 'Audit workspace', exact: true }).waitFor();
    await page.setViewportSize({ width: 320, height: 850 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.getByRole('status').getByText(/could not save/).waitFor();
  } finally { await context.close(); }
});
function contrast(a, b) {
  const luminance = hex => {
    const value = hex.trim().replace('#', '');
    const full = value.length === 3 ? [...value].map(c => c + c).join('') : value;
    const channels = full.match(/../g).map(c => parseInt(c, 16) / 255).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4);
    return channels.reduce((total, c, i) => total + c * [.2126, .7152, .0722][i], 0);
  };
  const l1 = luminance(a), l2 = luminance(b); return (Math.max(l1, l2) + .05) / (Math.min(l1, l2) + .05);
}
async function checkRoles(page, label) {
  const roles = await page.locator('.app-shell').evaluate(el => {
    const style = getComputedStyle(el);
    return Object.fromEntries(['vision-action', 'vision-action-ink', 'vision-action-text', 'vision-danger', 'vision-success', 'vision-warning', 'surface', 'surface-2', 'line', 'ink', 'page', 'score-track'].map(k => [k, style.getPropertyValue(`--${k}`).trim()]));
  });
  for (const name of ['vision-action-text', 'vision-danger', 'vision-success', 'vision-warning']) {
    for (const surface of ['surface', 'surface-2']) assert.ok(contrast(roles[name], roles[surface]) >= 4.5, `${label} ${name} on ${surface}`);
  }
  assert.ok(contrast(roles['vision-action'], roles['vision-action-ink']) >= 4.5, `${label} primary action`);
  assert.ok(contrast(roles.line, roles.surface) >= 3, `${label} control boundary`);
  assert.ok(contrast(roles.ink, roles.surface) >= 3, `${label} focus ring`);
  assert.ok(contrast(roles['vision-action-text'], roles['score-track']) >= 3, `${label} score arc`);
}
const profiles = { protan: 'protanopia', deutan: 'deuteranopia', tritan: 'tritanopia', mono: 'achromatopsia', unsure: 'none' };
for (const [profile, simulation] of Object.entries(profiles)) {
  test(`${profile}: actual UI text contrast in both themes and browser colour-vision simulation`, async () => {
    const { context, page } = await open();
    try {
      await page.getByRole('radio', { name: new RegExp(profile === 'mono' ? 'Monochrome' : profile === 'unsure' ? 'Not sure' : `· ${profile}`) }).check();
      await checkContrast(page, `${profile} welcome`);
      await page.getByRole('button', { name: 'Continue to workspace' }).click();
      for (const theme of ['light', 'dark']) {
        if (theme === 'dark') await page.getByRole('button', { name: 'Switch to dark theme' }).click();
        await checkContrast(page, `${profile} ${theme} workspace`);
        await checkRoles(page, `${profile} ${theme}`);
        const navEnd = await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button').last().boundingBox();
        const extension = await page.getByRole('button', { name: 'Browser Extension', exact: true }).boundingBox();
        assert.ok(navEnd.x + navEnd.width <= extension.x, 'Header actions do not overlap navigation');
        for (const target of ['Assistive Tech & Vision', 'History', 'Monitoring', 'GitHub', 'Reports', 'Documentation']) {
          await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: target, exact: true }).click();
          await checkContrast(page, `${profile} ${theme} ${target}`);
        }
        await page.getByRole('button', { name: 'Audit workspace settings' }).click();
        await checkContrast(page, `${profile} ${theme} settings`);
        await page.getByRole('button', { name: 'Browser Extension', exact: true }).click();
        await checkContrast(page, `${profile} ${theme} extension`);
        await page.getByRole('button', { name: 'Sarvya home' }).click();
      }
      const cdp = await context.newCDPSession(page);
      await cdp.send('Emulation.setEmulatedVisionDeficiency', { type: simulation });
      await fs.mkdir('/private/tmp/sarvya-vision-checks', { recursive: true });
      await page.screenshot({ path: `/private/tmp/sarvya-vision-checks/${profile}.png`, fullPage: true });
      // Labels and distinct severity shapes survive hue loss; no page-wide CSS filter is applied.
      assert.ok(await page.getByText('critical', { exact: true }).count());
      assert.equal(await page.locator('.app-shell').evaluate(el => getComputedStyle(el).filter), 'none');
    } finally { await context.close(); }
  });
}
