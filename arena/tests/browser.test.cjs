const { assert, fs, path, artifacts, launch, monitor, load, snapshot, clock, start, smash } = require('./helpers.cjs');
(async () => {
  const browser = await launch(); const errors = []; let checks = 0;
  const pass = label => { checks++; console.log('PASS ' + label); };
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 960 } }); monitor(page, errors); await load(page); await clock(page); await start(page, 'advanced');
    for (let i = 0; i < 4; i++) await page.locator('#player-ball').click();
    assert.equal((await snapshot(page)).player.hits, 4); assert.equal((await snapshot(page)).ai.health, 1000);
    assert.match(await page.locator('#player-speech').textContent(), /금 갔어/);
    assert.equal(await page.locator('#player-ball [data-crack="4"]').evaluate(el => getComputedStyle(el).opacity), '1');
    await page.locator('#player-ball').click(); await smash(page); await page.clock.runFor(180);
    assert.equal((await snapshot(page)).ai.health, 990);
    await page.locator('#player-ball').click(); assert.equal((await snapshot(page)).player.hits, 1);
    await page.screenshot({ path: path.join(artifacts, 'comic-battle-desktop.png'), fullPage: true });
    pass('real clicks, comic speech, progressive cracks, one attack and next ball');
    for (let i = 0; i < 20; i++) { await page.locator('#rematch-button').click(); await page.clock.runFor(20); const reset = await snapshot(page); assert.equal(reset.player.health, 1000); assert.equal(reset.ai.health, 1000); assert.equal(reset.pendingCount, 0); }
    await page.clock.runFor(1200); assert.equal((await snapshot(page)).player.health, 990);
    pass('20 rematches clear effects, attacks and retain one AI loop');
    for (let i = 0; i < 6; i++) {
      await page.locator('#rematch-button').click(); await smash(page); await page.locator('#leave-battle-button').click(); const idle = await snapshot(page); await page.clock.runFor(3000); assert.deepEqual(await snapshot(page), idle); await start(page, 'advanced');
    }
    pass('lobby return cancels pending destruction and freezes simulation');
    await page.locator('#rematch-button').click(); await page.clock.runFor(20);
    for (let i = 0; i < 100; i++) { await smash(page); await page.clock.runFor(180); }
    const win = await snapshot(page); assert.equal(win.status, 'victory'); assert.equal(win.ai.health, 0);
    assert.match(await page.locator('#result-title').textContent(), /VICTORY/);
    assert.equal(await page.locator('#player-health').getAttribute('aria-valuenow'), String(win.player.health));
    assert.equal(await page.locator('#ai-health').getAttribute('aria-valuenow'), '0');
    await page.clock.runFor(10000); await smash(page); assert.deepEqual(await snapshot(page), win);
    assert.equal(await page.locator('#effects>*').count(), 0);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'start-button');
    await page.keyboard.press('Shift+Tab'); assert.equal(await page.evaluate(() => document.activeElement.id), 'lobby-button');
    await page.keyboard.press('Tab'); assert.equal(await page.evaluate(() => document.activeElement.id), 'start-button');
    await page.screenshot({ path: path.join(artifacts, 'comic-victory-desktop.png') });
    pass('full victory: HP, freeze, effects cleanup, result focus trap');
    // Result controls stay visible on the smallest supported phone.
    await page.setViewportSize({ width: 568, height: 240 });
    await page.clock.runFor(20);
    const { fits } = require('./helpers.cjs');
    await fits(page, '#start-button', 44); await fits(page, '#lobby-button', 44);
    await page.screenshot({ path: path.join(artifacts, 'comic-result-mobile.png') });
    pass('result controls fit 568×240 with browser bars');
    await page.setViewportSize({ width: 1440, height: 960 }); await page.locator('#start-button').click(); await page.clock.runFor(20);
    await page.clock.runFor(100300);
    const loss = await snapshot(page); assert.equal(loss.status, 'defeat'); assert.equal(loss.player.health, 0);
    assert.match(await page.locator('#result-title').textContent(), /DEFEAT/);
    await page.clock.runFor(5000); assert.deepEqual(await snapshot(page), loss);
    await page.locator('#lobby-button').click(); assert.equal(await page.evaluate(() => window.WaxArena.getScreen()), 'lobby');
    pass('full AI defeat, no post-match attacks, result return to lobby');
    const offline = await browser.newPage({ viewport: { width: 844, height: 390 }, reducedMotion: 'reduce' }); monitor(offline, errors);
    const { pathToFileURL } = require('node:url'); await offline.goto(pathToFileURL(path.join(__dirname, '..', 'index.html')).href); await offline.waitForLoadState('networkidle');
    await offline.locator('#fight-button').click(); await offline.locator('#confirm-battle').click(); await smash(offline); await offline.waitForFunction(() => window.WaxArena.getSnapshot().ai.health === 990); await offline.close();
    pass('offline file opening and reduced motion');
    assert.deepEqual(errors, []); pass('zero browser, console or HTTP errors');
    fs.writeFileSync(path.join(artifacts, 'browser-results.json'), JSON.stringify({ passed: checks, errors }, null, 2)); console.log(`${checks} browser checks passed.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
