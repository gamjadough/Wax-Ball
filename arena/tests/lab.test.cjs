const { assert, fs, path, artifacts, launch, monitor, load, snapshot, clock, fits, noOverflow } = require('./helpers.cjs');
(async () => {
  const browser = await launch(); const errors = []; let checks = 0;
  const pass = name => { checks++; console.log('PASS ' + name); };
  try {
    for (const [width, height] of [[1440,960],[1280,800],[1024,768],[844,390],[667,375],[568,320],[568,240]]) {
      const mobile = width <= 1024;
      const context = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile, reducedMotion: 'reduce' });
      // Isolated test browser only; check the UI against a nonzero saved balance.
      await context.addInitScript(() => localStorage.setItem('wax-ball-arena.progress.v1', JSON.stringify({ version: 1, gold: 125, wins: 0, losses: 0, history: [] })));
      const page = await context.newPage(); monitor(page, errors); await load(page); await clock(page);
      const idle = await snapshot(page); const progress = await page.evaluate(() => WaxArena.getProgress());
      await page.locator('#lab-open').click();
      assert.equal(await page.evaluate(() => WaxArena.getScreen()), 'lab');
      assert.equal(await page.locator('.topbar').isVisible(), false);
      assert.equal(await page.locator('#lab-gold').textContent(), '125 G');
      for (const selector of ['#lab-back','#lab-upgrade','#lab-draw']) await fits(page, selector, 44);
      for (const selector of ['#lab-gold','.lab-tank','.scientist-art','.scientist-name']) await fits(page, selector);
      await noOverflow(page);
      const upgrade = await page.locator('#lab-upgrade').boundingBox(), draw = await page.locator('#lab-draw').boundingBox();
      assert.ok(upgrade.x < width / 3 && draw.y > upgrade.y + upgrade.height);
      const tank = await page.locator('.lab-tank').boundingBox(), scientist = await page.locator('.scientist-art').boundingBox();
      assert.ok(tank.x > width / 2 && scientist.y > tank.y, 'reference arrangement');
      await page.screenshot({ path: path.join(artifacts, `lab-${width}x${height}.png`), fullPage: true });
      for (const action of ['upgrade','draw']) {
        if (mobile) await page.locator('#lab-' + action).tap(); else await page.locator('#lab-' + action).click();
        assert.equal(await page.locator('#lab-dialog').evaluate(el => el.open), true);
        assert.equal(await page.locator('#lab-future-action').isDisabled(), true);
        await fits(page, '#lab-dialog'); await fits(page, '#lab-dialog-close', 44);
        await fits(page, '#lab-future-action', 44);
        if (action === 'upgrade') assert.match(await page.locator('#lab-risk').textContent(), /파괴될 수/);
        assert.deepEqual(await page.evaluate(() => WaxArena.getProgress()), progress);
        await page.clock.runFor(1000); assert.deepEqual(await snapshot(page), idle);
        if (width === 844) await page.screenshot({ path: path.join(artifacts, `lab-dialog-${action}.png`) });
        await page.keyboard.press('Escape');
        assert.equal(await page.evaluate(() => document.activeElement.id), 'lab-' + action);
      }
      if (mobile) {
        await page.locator('#lab-upgrade').tap();
        await page.setViewportSize({ width: height, height: width });
        await page.locator('#orientation-gate').waitFor({ state: 'visible' });
        assert.equal(await page.locator('#lab-dialog').evaluate(el => el.open), false);
        await page.clock.runFor(1000); assert.deepEqual(await snapshot(page), idle);
        await page.setViewportSize({ width, height });
        await page.locator('#orientation-gate').waitFor({ state: 'hidden' });
        await page.clock.runFor(20);
        assert.equal(await page.evaluate(() => WaxArena.getScreen()), 'lab');
        assert.equal(await page.evaluate(() => document.activeElement.id), 'lab-back');
      }
      await page.locator('#lab-back').click();
      assert.equal(await page.evaluate(() => WaxArena.getScreen()), 'lobby');
      assert.equal(await page.locator('.topbar').isVisible(), true);
      assert.equal(await page.evaluate(() => document.activeElement.id), 'lab-open');
      assert.deepEqual(await page.evaluate(() => WaxArena.getProgress()), progress);
      await page.locator('#lab-open').focus(); await page.keyboard.press('Enter');
      await page.locator('#lab-draw').focus(); await page.keyboard.press('Space');
      assert.equal(await page.locator('#lab-dialog').evaluate(el => el.open), true);
      await page.locator('#lab-dialog-close').click(); await page.locator('#lab-back').click();
      pass(`${width}×${height}: lab layout, upgrade/draw panels, no gold spending, focus, keyboard, rotation`);
      await context.close();
    }
    assert.deepEqual(errors, []); pass('zero browser, console or HTTP errors');
    fs.writeFileSync(path.join(artifacts,'lab-results.json'), JSON.stringify({ passed: checks, errors }, null, 2));
    console.log(`${checks} laboratory checks passed.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
