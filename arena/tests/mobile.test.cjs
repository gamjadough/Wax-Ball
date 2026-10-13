const { assert, fs, path, artifacts, launch, monitor, load, snapshot, clock, start, smash, fits, noOverflow } = require('./helpers.cjs');
(async () => {
  const browser = await launch(); const errors = []; let checks = 0;
  const pass = label => { checks++; console.log('PASS ' + label); };
  try {
    for (const [width, height] of [[568,240],[667,260],[844,280],[568,320],[640,360],[667,375],[720,320],[740,360],[844,390],[915,412],[932,430],[1024,768]]) {
      const context = await browser.newContext({ viewport: { width, height }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
      const page = await context.newPage(); monitor(page, errors); await load(page); await clock(page);
      await fits(page, '#fight-button', 44); await fits(page, '#mode-open', 44); await noOverflow(page);
      await page.screenshot({ path: path.join(artifacts, `comic-lobby-${width}.png`) });
      await page.locator('#mode-open').tap();
      for (const selector of ['.ai-mode','.friend-mode','.boss-mode','.team-mode']) await fits(page, selector, 44);
      await noOverflow(page); await page.screenshot({ path: path.join(artifacts, `comic-modes-${width}.png`) });
      await page.locator('#ai-mode-button').tap();
      for (const selector of ['#difficulty-dialog','#ai-difficulty','#confirm-battle','#difficulty-close']) await fits(page, selector, selector === '#difficulty-dialog' ? 0 : 44);
      await page.screenshot({ path: path.join(artifacts, `comic-difficulty-${width}.png`) });
      await page.locator('#confirm-battle').tap(); await page.clock.runFor(20);
      for (const selector of ['#player-ball','#ai-ball','#player-health','#ai-health','#leave-battle-button','#rematch-button']) await fits(page, selector, selector.includes('button') || selector === '#player-ball' ? 44 : 0);
      await noOverflow(page); await page.screenshot({ path: path.join(artifacts, `comic-battle-${width}.png`) });
      for (let i = 0; i < 4; i++) await page.locator('#player-ball').tap();
      assert.equal((await snapshot(page)).player.hits, 4);
      assert.equal((await snapshot(page)).ai.health, 1000);
      await page.locator('#player-ball').tap();
      const pending = await snapshot(page); assert.equal(pending.pendingCount, 1);
      await page.setViewportSize({ width: height, height: width });
      await page.locator('#orientation-gate').waitFor({ state: 'visible' });
      const paused = await snapshot(page);
      assert.equal(await page.locator('#game-root').evaluate(el => el.inert), true);
      await smash(page); await page.clock.runFor(12000);
      assert.deepEqual(await snapshot(page), paused, 'portrait freezes AI, pending destruction and programmatic input');
      await page.screenshot({ path: path.join(artifacts, `comic-portrait-${height}.png`) });
      await page.setViewportSize({ width, height });
      await page.locator('#orientation-gate').waitFor({ state: 'hidden' });
      await page.clock.runFor(220);
      const resumed = await snapshot(page); assert.equal(resumed.ai.health, 990); assert.equal(resumed.player.health, 1000);
      await page.locator('#rematch-button').tap(); await page.clock.runFor(20);
      assert.equal((await snapshot(page)).time < 100, true);
      await page.locator('#leave-battle-button').tap();
      assert.equal(await page.evaluate(() => window.WaxArena.getScreen()), 'lobby');
      // Rotating with an open native modal must not hide the orientation notice.
      await page.locator('#fight-button').tap(); await page.setViewportSize({ width: height, height: width });
      await page.locator('#orientation-gate').waitFor({ state: 'visible' });
      assert.equal(await page.locator('#difficulty-dialog').evaluate(el => el.open), false);
      await page.setViewportSize({ width, height }); await page.locator('#orientation-gate').waitFor({ state: 'hidden' });
      await page.locator('#fight-button').tap(); await page.locator('#difficulty-close').tap();
      pass(`${width}×${height}: all screens fit, ≥44px controls, touch, portrait freeze/resume, modal rotation`);
      await context.close();
    }
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await context.newPage(); monitor(page, errors); await load(page); await clock(page);
    assert.equal(await page.locator('#orientation-gate').isVisible(), true);
    const idle = await snapshot(page); await page.clock.runFor(5000); await smash(page); assert.deepEqual(await snapshot(page), idle);
    await page.setViewportSize({ width: 844, height: 390 }); await page.locator('#orientation-gate').waitFor({ state: 'hidden' }); await start(page);
    await page.setViewportSize({ width: 844, height: 320 });
    await fits(page, '#player-ball', 44); await fits(page, '#rematch-button', 44); await noOverflow(page);
    pass('initial portrait blocks gameplay; reduced browser-toolbar height fits');
    await context.close();
    const barsContext = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
    const bars = await barsContext.newPage(); monitor(bars, errors); await load(bars); await clock(bars);
    // Reproduce browsers whose layout viewport stays tall while toolbars reduce
    // only the VisualViewport; also reserve space equivalent to safe-area insets.
    await bars.evaluate(() => {
      Object.defineProperty(visualViewport, 'height', { configurable: true, get: () => 240 });
      visualViewport.dispatchEvent(new Event('resize'));
    });
    await bars.addStyleTag({ content: '#game-root{padding:8px 28px 12px}' });
    await fits(bars, '#fight-button', 44); await fits(bars, '#mode-open', 44);
    await bars.locator('#mode-open').tap();
    for (const selector of ['.ai-mode','.friend-mode','.boss-mode','.team-mode']) await fits(bars, selector, 44);
    await bars.locator('#ai-mode-button').tap();
    for (const selector of ['#difficulty-dialog','#ai-difficulty','#confirm-battle','#difficulty-close']) await fits(bars, selector, selector === '#difficulty-dialog' ? 0 : 44);
    await bars.locator('#confirm-battle').tap(); await bars.clock.runFor(20);
    for (const selector of ['#player-ball','#ai-ball','#player-health','#ai-health','#leave-battle-button','#rematch-button']) await fits(bars, selector, selector.includes('button') || selector === '#player-ball' ? 44 : 0);
    await bars.evaluate(() => window.scrollTo(0, 1000));
    assert.equal(await bars.evaluate(() => scrollY), 0);
    await bars.screenshot({ path: path.join(artifacts, 'mobile-visible-viewport-240.png') });
    await bars.evaluate(() => { delete visualViewport.height; visualViewport.dispatchEvent(new Event('resize')); });
    assert.equal(await bars.locator('html').evaluate(el => el.classList.contains('viewport-tight')), false);
    assert.equal((await snapshot(bars)).status, 'running');
    pass('240px VisualViewport inside 390px layout, safe areas, toolbar restoration, no page scroll');
    await barsContext.close(); assert.deepEqual(errors, []); pass('zero browser, console or HTTP errors');
    fs.writeFileSync(path.join(artifacts, 'mobile-results.json'), JSON.stringify({ passed: checks, errors }, null, 2));
    console.log(`${checks} mobile checks passed.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
