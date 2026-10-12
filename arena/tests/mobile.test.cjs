const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
let playwright;
try { playwright = require('playwright'); }
catch { playwright = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/dodoo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'); }
const { chromium } = playwright;
const url = process.env.TEST_URL || 'http://127.0.0.1:5174';
const artifacts = path.join(__dirname, '..', 'artifacts');
fs.mkdirSync(artifacts, { recursive: true });
const errors = [];
const results = [];
const sizes = [
  [320, 568], [360, 640], [375, 667], [390, 844],
  [412, 915], [430, 932], [667, 375], [844, 390]
];
async function inViewport(page, selector, minimum = 0) {
  const box = await page.locator(selector).boundingBox();
  const screen = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
  assert.ok(box, `${selector} must be visible`);
  assert.ok(box.x >= -1 && box.y >= -1 && box.x + box.width <= screen.width + 1 && box.y + box.height <= screen.height + 1,
    `${selector} outside ${screen.width}×${screen.height}: ${JSON.stringify(box)}`);
  assert.ok(box.width >= minimum && box.height >= minimum, `${selector} touch target smaller than ${minimum}px`);
}
async function noOverflow(page) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'horizontal overflow');
}
async function snapshot(page) { return page.evaluate(() => window.WaxArena.getSnapshot()); }
(async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || 'msedge' });
  try {
    for (const [width, height] of sizes) {
      const context = await browser.newContext({ viewport: { width, height }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
      const page = await context.newPage();
      page.on('pageerror', e => errors.push(e.message));
      page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
      await page.goto(url);
      await page.waitForLoadState('networkidle');
      await noOverflow(page);
      await inViewport(page, '#fight-button', 44);
      for (const menu of await page.locator('[data-unavailable]').all()) {
        await inViewport(page, `[data-unavailable]:nth-child(${await menu.evaluate(el => Array.from(el.parentElement.children).indexOf(el) + 1)})`, 44);
      }
      if (width === 390 || width === 320 || width === 844) await page.screenshot({ path: path.join(artifacts, `phone-lobby-${width}x${height}.png`), fullPage: true });
      await page.locator('#fight-button').tap();
      await page.clock.install();
      await page.clock.pauseAt(new Date());
      await noOverflow(page);
      for (const selector of ['#player-health', '#ai-health', '#player-ball', '#ai-ball', '#rematch-button', '#leave-battle-button']) {
        await inViewport(page, selector, /ball|button/.test(selector) ? 44 : 0);
      }
      await page.evaluate(() => scrollTo(0, 0));
      for (let i = 1; i <= 4; i++) {
        await page.locator('#player-ball').tap();
        assert.equal((await snapshot(page)).player.hits, i);
        assert.equal((await snapshot(page)).ai.health, 1000);
      }
      await new Promise(resolve => setTimeout(resolve, 100));
      if (width === 390 || width === 320 || width === 844) await page.screenshot({ path: path.join(artifacts, `phone-battle-${width}x${height}.png`), fullPage: true });
      await page.locator('#player-ball').tap();
      await page.clock.runFor(200);
      assert.equal((await snapshot(page)).ai.health, 990);
      assert.equal(await page.evaluate(() => visualViewport.scale), 1, 'tap must not zoom page');
      await page.locator('#rematch-button').tap();
      assert.equal((await snapshot(page)).ai.health, 1000);
      assert.equal((await snapshot(page)).player.hits, 0);
      await page.locator('#leave-battle-button').tap();
      assert.equal(await page.evaluate(() => window.WaxArena.getScreen()), 'lobby');
      const idle = await snapshot(page);
      await page.clock.runFor(5000);
      assert.deepEqual(await snapshot(page), idle);
      await inViewport(page, '#fight-button', 44);
      results.push({ width, height, status: 'passed' });
      console.log(`PASS ${width}×${height}: lobby, battle in viewport, 44px targets, real taps, damage, reset, return`);
      await context.close();
    }
    // Test rotating during a live fight, and smaller visual height when browser
    // chrome is visible. State must survive layout changes.
    const rotate = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await rotate.newPage();
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(url); await page.waitForLoadState('networkidle');
    await page.locator('#fight-button').tap();
    await page.clock.install(); await page.clock.pauseAt(new Date());
    await page.locator('#player-ball').tap();
    for (const viewport of [{ width: 390, height: 650 }, { width: 844, height: 390 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      await noOverflow(page);
      await inViewport(page, '#player-ball', 44);
      await inViewport(page, '#rematch-button', 44);
      assert.equal((await snapshot(page)).player.hits, 1);
    }
    console.log('PASS browser toolbar height and live portrait/landscape rotation');
    await rotate.close();
    // Only result-layout fixtures use shortened HP. Combat rules are also tested
    // by the original full-1000-HP browser suite.
    for (const viewport of [{ width: 320, height: 568 }, { width: 844, height: 390 }]) {
      const context = await browser.newContext({ viewport, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
      await context.route('**/js/config.js', async route => {
        const response = await route.fetch();
        const source = (await response.text()).replace('maxHealth: 1000', 'maxHealth: 10');
        await route.fulfill({ response, body: source });
      });
      const result = await context.newPage();
      result.on('pageerror', e => errors.push(e.message));
      await result.goto(url); await result.waitForLoadState('networkidle');
      await result.locator('#fight-button').tap();
      for (let i = 0; i < 5; i++) await result.locator('#player-ball').tap();
      await result.waitForFunction(() => window.WaxArena.getSnapshot().status === 'victory');
      await inViewport(result, '#result-title');
      await inViewport(result, '#start-button', 44);
      await inViewport(result, '#lobby-button', 44);
      await result.screenshot({ path: path.join(artifacts, `phone-result-${viewport.width}x${viewport.height}.png`), fullPage: true });
      await result.locator('#start-button').tap();
      assert.equal((await snapshot(result)).status, 'running');
      console.log(`PASS ${viewport.width}×${viewport.height}: result buttons, reduced motion, rematch`);
      await context.close();
    }
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(artifacts, 'mobile-results.json'), JSON.stringify({ passed: results.length + 3, results, errors, engineHealth: 1000, resultFixtureHealth: 10 }, null, 2));
    console.log('11 mobile checks passed. Console errors: 0.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
