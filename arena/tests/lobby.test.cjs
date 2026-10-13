const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
let playwright;
try { playwright = require('playwright'); }
catch { playwright = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/dodoo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'); }
const url = process.env.TEST_URL || 'http://127.0.0.1:5174';
const artifacts = path.join(__dirname, '..', 'artifacts');
fs.mkdirSync(artifacts, { recursive: true });
const errors = [];
let checks = 0;
function pass(name) { checks++; console.log('PASS ' + name); }
async function snapshot(page) { return page.evaluate(() => window.WaxArena.getSnapshot()); }
(async () => {
  const browser = await playwright.chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || 'msedge' });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 960 }, reducedMotion: 'reduce' });
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    const response = await page.goto(url);
    assert.equal(response.status(), 200);
    await page.waitForLoadState('networkidle');
    assert.equal(await page.locator('.hero-stage, .play-card').count(), 2);
    assert.equal(await page.locator('#gold-amount').textContent(), '0 G');
    await page.clock.install(); await page.clock.pauseAt(new Date());
    for (const viewport of [{ width: 1440, height: 960 }, { width: 1280, height: 800 }, { width: 1024, height: 768 }, { width: 768, height: 1024 }]) {
      await page.setViewportSize(viewport);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      for (const selector of ['#fight-button', '#ai-difficulty', '[data-unavailable]:nth-child(1)', '[data-unavailable]:nth-child(2)', '[data-unavailable]:nth-child(3)']) {
        const box = await page.locator(selector).boundingBox();
        assert.ok(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width && box.y + box.height <= viewport.height, `${selector} outside ${viewport.width}x${viewport.height}`);
        assert.ok(box.width >= 44 && box.height >= 44);
      }
      await page.screenshot({ path: path.join(artifacts, `lobby-new-${viewport.width}.png`), fullPage: true });
      pass(`${viewport.width}x${viewport.height}: new layout, all controls in viewport, no overflow`);
    }
    const idle = await snapshot(page);
    for (const button of await page.locator('[data-unavailable]').all()) {
      await button.click();
      assert.equal(await page.locator('#menu-notice').textContent(), '아직 개발 안 함 ㅋㅋ');
      await page.clock.runFor(1000);
      assert.deepEqual(await snapshot(page), idle);
    }
    pass('all three secondary menus announce their status and keep lobby simulation idle');
    await page.locator('#ai-difficulty').focus();
    await page.keyboard.press('End');
    assert.equal(await page.locator('#ai-difficulty').inputValue(), 'advanced');
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'fight-button');
    await page.keyboard.press('Enter');
    assert.equal((await snapshot(page)).difficulty, 'advanced');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'player-ball');
    await page.locator('#leave-battle-button').click();
    assert.equal(await page.evaluate(() => document.activeElement.id), 'fight-button');
    pass('keyboard difficulty selection, start, player focus and lobby return focus');
    for (const [difficulty, interval, hits] of [['entry', 1500, 0], ['beginner', 850, 1], ['intermediate', 450, 2], ['advanced', 200, 5]]) {
      await page.locator('#ai-difficulty').selectOption(difficulty);
      await page.locator('#fight-button').click();
      await page.clock.runFor(1100);
      assert.equal((await snapshot(page)).aiHitIntervalMs, interval);
      assert.equal((await snapshot(page)).ai.hits, hits);
      await page.locator('#rematch-button').click();
      assert.equal((await snapshot(page)).difficulty, difficulty);
      await page.locator('#leave-battle-button').click();
      assert.equal(await page.locator('#ai-difficulty').inputValue(), difficulty);
      const returned = await snapshot(page);
      await page.clock.runFor(5000);
      assert.deepEqual(await snapshot(page), returned);
    }
    pass('all four difficulties retain speed and selection across rematches and lobby returns');
    assert.deepEqual(errors, []);
    pass('zero console or JavaScript errors');
    fs.writeFileSync(path.join(artifacts, 'lobby-results.json'), JSON.stringify({ passed: checks, errors, url }, null, 2));
    console.log(`${checks} lobby checks passed.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
