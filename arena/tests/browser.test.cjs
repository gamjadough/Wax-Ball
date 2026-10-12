const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
let playwright;
try { playwright = require('playwright'); }
catch { playwright = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/dodoo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'); }
const { chromium } = playwright;
const artifacts = path.join(__dirname, '..', 'artifacts');
fs.mkdirSync(artifacts, { recursive: true });
const errors = [];
let checks = 0;
function pass(name) { console.log('PASS ' + name); checks++; }
async function snapshot(page) { return page.evaluate(() => window.WaxArena.getSnapshot()); }
async function hitFive(page) { await page.evaluate(() => { for (let i = 0; i < 5; i++) document.getElementById('player-ball').click(); }); }
async function enterBattle(page) {
  const lobbyButton = page.locator('#fight-button');
  if (await lobbyButton.isVisible()) await lobbyButton.click();
  else await page.locator('#start-button').click();
}
(async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || 'msedge' });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1060 } });
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    const response = await page.goto(process.env.TEST_URL || 'http://127.0.0.1:5174');
    assert.equal(response.status(), 200);
    await page.waitForLoadState('networkidle');
    assert.equal((await snapshot(page)).status, 'waiting');
    assert.equal(await page.locator('#player-ball').isDisabled(), true);
    assert.equal(await page.evaluate(() => window.WaxArena.getScreen()), 'lobby');
    assert.equal(await page.locator('#lobby-screen').isVisible(), true);
    assert.equal(await page.locator('#battle-screen').isVisible(), false);
    const waiting = await snapshot(page);
    await page.waitForTimeout(1000);
    await hitFive(page);
    assert.deepEqual(await snapshot(page), waiting);
    for (const menu of await page.locator('[data-unavailable]').all()) {
      await menu.click();
      assert.equal(await page.locator('#menu-notice').textContent(), '아직 개발 안 함 ㅋㅋ');
      assert.deepEqual(await snapshot(page), waiting);
    }
    await page.screenshot({ path: path.join(artifacts, 'lobby-desktop.png'), fullPage: true });
    for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 720 }]) {
      await page.setViewportSize(viewport);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.locator('[data-unavailable]').last().click();
      assert.equal(await page.locator('#menu-notice').textContent(), '아직 개발 안 함 ㅋㅋ');
      await page.screenshot({ path: path.join(artifacts, 'lobby-' + viewport.width + '.png'), fullPage: true });
    }
    await page.setViewportSize({ width: 1440, height: 1060 });
    pass('initial lobby, idle simulation, all menu notices and desktop/mobile layout');
    assert.equal(await page.locator('#battle-log, #log-state, .log-panel').count(), 0);
    assert.equal(await page.getByText('전투 로그', { exact: true }).count(), 0);
    await enterBattle(page);
    assert.equal(await page.locator('#rematch-button').isVisible(), true);
    pass('player-facing combat log removed, instructions and rematch retained');
    await page.clock.install();
    await page.clock.pauseAt(new Date());
    assert.equal((await snapshot(page)).status, 'running');
    for (let i = 1; i <= 4; i++) {
      await page.locator('#player-ball').click();
      assert.equal((await snapshot(page)).player.hits, i);
      assert.equal((await snapshot(page)).ai.health, 1000);
      // CSS transitions use the browser compositor clock, independent of the
      // mocked simulation clock. Let the 80ms crack transition settle.
      await new Promise(resolve => setTimeout(resolve, 120));
      assert.equal(await page.locator(`#player-ball [data-crack="${i}"]`).evaluate(el => getComputedStyle(el).opacity), '1');
    }
    await page.screenshot({ path: path.join(artifacts, 'desktop-cracks.png'), fullPage: true });
    pass('real clicks add progressive cracks without damage');
    await page.locator('#player-ball').click();
    assert.equal((await snapshot(page)).player.breaking, true);
    assert.equal((await snapshot(page)).ai.health, 1000);
    assert.ok(await page.locator('.particle').count() > 0);
    await page.evaluate(() => { for (let i = 0; i < 100; i++) document.getElementById('player-ball').click(); });
    assert.equal((await snapshot(page)).pendingCount, 1);
    await page.clock.runFor(200);
    assert.equal((await snapshot(page)).ai.health, 990);
    assert.equal((await snapshot(page)).player.hits, 0);
    assert.equal(await page.locator('#ai-health').getAttribute('aria-valuenow'), '990');
    assert.ok(await page.locator('.projectile').count() > 0);
    assert.ok(await page.locator('.damage-number').count() > 0);
    await page.locator('#player-ball').click();
    assert.equal((await snapshot(page)).player.hits, 1);
    pass('fifth click shatters once, deals exactly 10, next ball accepts hits during flight');
    await page.clock.runFor(4300);
    assert.equal((await snapshot(page)).player.health, 990);
    pass('AI hits five times and deals 10 damage');
    await page.evaluate(() => { for (let i = 0; i < 30; i++) document.getElementById('rematch-button').click(); });
    assert.equal((await snapshot(page)).ai.health, 1000);
    assert.equal((await snapshot(page)).player.health, 1000);
    assert.equal((await snapshot(page)).player.hits, 0);
    assert.equal(await page.locator('#player-fill').evaluate(el => Math.round(el.getBoundingClientRect().width / el.parentElement.getBoundingClientRect().width * 100)), 100);
    assert.equal(await page.locator('.effects>*').count(), 0);
    assert.equal(await page.evaluate(() => window.WaxArena.getDebugLog().length), 1);
    await page.clock.runFor(900);
    assert.equal((await snapshot(page)).ai.hits, 1);
    pass('30 rapid rematches reset state, effects, diagnostics and keep one AI loop');
    for (let i = 0; i < 12; i++) {
      await page.locator('#rematch-button').click();
      await hitFive(page);
      assert.equal((await snapshot(page)).pendingCount, 1);
      await page.locator('#leave-battle-button').click();
      assert.equal(await page.evaluate(() => window.WaxArena.getScreen()), 'lobby');
      const idle = await snapshot(page);
      await page.clock.runFor(5000);
      await hitFive(page);
      await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
      assert.deepEqual(await snapshot(page), idle);
      assert.equal(idle.pendingCount, 0);
      assert.equal(await page.locator('.effects>*').count(), 0);
      await page.locator('#fight-button').click();
      await page.clock.runFor(900);
      assert.equal((await snapshot(page)).ai.hits, 1);
      assert.equal((await snapshot(page)).player.health, 1000);
    }
    pass('12 lobby returns cancel pending destruction, freeze AI and restart one loop');
    await page.locator('#rematch-button').click();
    await page.clock.runFor(16);
    // Full original 1000 HP battle through the actual DOM input path.
    for (let i = 0; i < 100; i++) { await hitFive(page); await page.clock.runFor(200); }
    const win = await snapshot(page);
    assert.equal(win.status, 'victory');
    assert.equal(win.ai.health, 0);
    assert.equal(win.pendingCount, 0);
    assert.equal(await page.locator('#ai-fill').evaluate(el => el.getBoundingClientRect().width), 0);
    assert.equal(await page.locator('#player-ball').isDisabled(), true);
    assert.match(await page.locator('#result-title').textContent(), /VICTORY/);
    assert.equal(await page.locator('#result').isVisible(), true);
    assert.equal(await page.evaluate(() => window.WaxArena.getScreen()), 'result');
    await page.screenshot({ path: path.join(artifacts, 'victory.png'), fullPage: true });
    await page.clock.runFor(10000);
    await hitFive(page);
    assert.deepEqual(await snapshot(page), win);
    assert.equal(await page.locator('.effects>*').count(), 0);
    pass('full victory, result UI, no extra damage, no pending effects after finish');
    await page.locator('#lobby-button').click();
    assert.equal(await page.evaluate(() => window.WaxArena.getScreen()), 'lobby');
    assert.equal(await page.locator('#gold-amount').textContent(), '0 G');
    const returned = await snapshot(page);
    await page.clock.runFor(10000);
    assert.deepEqual(await snapshot(page), returned);
    await page.locator('#fight-button').click();
    await page.clock.runFor(16);
    await page.clock.runFor(425250);
    const loss = await snapshot(page);
    assert.equal(loss.status, 'defeat');
    assert.equal(loss.player.health, 0);
    assert.match(await page.locator('#result-title').textContent(), /DEFEAT/);
    await page.clock.runFor(10000);
    assert.deepEqual(await snapshot(page), loss);
    pass('full AI defeat, result UI and no post-defeat damage');
    await page.locator('#start-button').click();
    assert.equal((await snapshot(page)).status, 'running');
    assert.equal((await snapshot(page)).player.health, 1000);
    pass('result button restarts after defeat');
    for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 720 }]) {
      await page.setViewportSize(viewport);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      assert.equal(await page.locator('#player-ball').isVisible(), true);
      assert.equal(await page.locator('#battle-log, .log-panel').count(), 0);
      assert.equal(await page.locator('#rematch-button').isVisible(), true);
      await page.locator('#player-ball').click();
      if (viewport.width === 390) await page.screenshot({ path: path.join(artifacts, 'mobile.png'), fullPage: true });
    }
    pass('390px and 320px mobile layout, click input and no horizontal overflow');
    assert.ok(await page.evaluate(() => window.WaxArena.getDebugLog().length <= window.WaxArena.CONFIG.maxLogEntries));
    const touch = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const mobile = await touch.newPage();
    mobile.on('pageerror', e => errors.push(e.message));
    await mobile.goto(process.env.TEST_URL || 'http://127.0.0.1:5174');
    await mobile.waitForLoadState('networkidle');
    await mobile.locator('#fight-button').tap();
    await mobile.locator('#player-ball').tap();
    assert.equal((await snapshot(mobile)).player.hits, 1);
    await touch.close();
    pass('mobile touch input');
    const offline = await browser.newPage({ reducedMotion: 'reduce' });
    offline.on('pageerror', e => errors.push(e.message));
    offline.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    const { pathToFileURL } = require('node:url');
    await offline.goto(pathToFileURL(path.join(__dirname, '..', 'index.html')).href);
    await offline.waitForLoadState('networkidle');
    await enterBattle(offline);
    await hitFive(offline);
    await offline.waitForFunction(() => window.WaxArena.getSnapshot().ai.health === 990);
    assert.equal((await snapshot(offline)).player.hits, 0);
    await offline.close();
    pass('offline file opening and reduced-motion gameplay');
    assert.deepEqual(errors, []);
    pass('browser console and JavaScript runtime: zero errors');
    fs.writeFileSync(path.join(artifacts, 'browser-results.json'), JSON.stringify({ passed: checks, errors, testedHealth: 1000, viewports: ['1440×1060', '390×844', '320×720'] }, null, 2));
    console.log(`${checks} browser checks passed.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
