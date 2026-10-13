const { assert, fs, path, artifacts, launch, monitor, load, snapshot, clock } = require('./helpers.cjs');
(async () => {
  const browser = await launch(); const errors = []; let checks = 0;
  const pass = label => { checks++; console.log('PASS ' + label); };
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
    monitor(page, errors); await load(page); await clock(page);
    let idle = await snapshot(page);
    assert.equal(await page.locator('#gold-amount').textContent(), '0 G');
    for (const button of await page.locator('#lobby-screen [data-unavailable]').all()) {
      await button.click(); assert.match(await page.locator('#menu-notice').textContent(), /아직 개발 안 함/);
    }
    await page.clock.runFor(5000); assert.deepEqual(await snapshot(page), idle);
    await page.screenshot({ path: path.join(artifacts, 'comic-lobby-desktop.png'), fullPage: true });
    pass('reference lobby: profile, wallet, shop, lab, friend notice; no idle simulation');
    const modeButton = page.locator('#mode-open');
    assert.equal(await modeButton.evaluate(el => el.tagName), 'BUTTON');
    assert.equal(await modeButton.locator('button').count(), 0);
    for (const target of ['text', 'mode-name', 'arrow', 'space', 'left-edge', 'right-edge']) {
      if (target === 'text') await modeButton.locator('span').first().click();
      else if (target === 'mode-name') await modeButton.locator('b').click();
      else if (target === 'arrow') await modeButton.locator('[aria-hidden]').click();
      else {
        const box = await modeButton.boundingBox();
        await modeButton.click({ position: { x: target === 'left-edge' ? 5 : target === 'right-edge' ? box.width - 5 : box.width / 2, y: box.height - 6 } });
      }
      assert.equal(await page.evaluate(() => window.WaxArena.getScreen()), 'modes', target);
      assert.equal(await page.evaluate(() => document.activeElement.id), 'ai-mode-button');
      assert.deepEqual(await snapshot(page), idle);
      await page.locator('#mode-back').click();
      idle = await snapshot(page);
    }
    for (const key of ['Enter', 'Space']) {
      await modeButton.focus(); await page.keyboard.press(key);
      assert.equal(await page.evaluate(() => window.WaxArena.getScreen()), 'modes', key);
      await page.locator('#mode-back').click();
      idle = await snapshot(page);
    }
    pass('whole mode button: label, current mode, arrow, padding, both edges and keyboard');
    await page.locator('#mode-open').click();
    assert.equal(await page.evaluate(() => window.WaxArena.getScreen()), 'modes');
    assert.equal(await page.locator('.mode-card').count(), 4);
    const grid = await page.locator('.mode-cards').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length);
    assert.equal(grid, 2);
    for (const button of await page.locator('#mode-screen [data-unavailable]').all()) {
      await button.click(); assert.match(await page.locator('#mode-notice').textContent(), /아직 개발 안 함/);
    }
    assert.deepEqual(await snapshot(page), idle);
    await page.screenshot({ path: path.join(artifacts, 'comic-modes-desktop.png'), fullPage: true });
    pass('four reference modes in 2×2 grid; unavailable modes never start a match');
    await page.locator('#ai-mode-button').click();
    assert.equal(await page.locator('#difficulty-dialog').evaluate(el => el.open), true);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'ai-difficulty');
    await page.clock.runFor(4000); assert.deepEqual(await snapshot(page), idle);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#difficulty-dialog').evaluate(el => el.open), false);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'ai-mode-button');
    pass('AI click opens modal; simulation stays idle; Escape restores focus');
    const speeds = { entry: 1500, beginner: 850, intermediate: 450, advanced: 200 };
    for (const [difficulty, speed] of Object.entries(speeds)) {
      await page.locator('#ai-mode-button').click();
      await page.locator('#ai-difficulty').selectOption(difficulty);
      assert.ok((await page.locator('#difficulty-help').textContent()).includes((speed / 1000).toFixed(2)));
      await page.locator('#confirm-battle').click();
      await page.clock.runFor(20);
      const battle = await snapshot(page); assert.equal(battle.difficulty, difficulty); assert.equal(battle.aiHitIntervalMs, speed);
      await page.clock.runFor(speed * 5 + 180);
      const hit = await snapshot(page); assert.equal(hit.player.health, 990); assert.equal(hit.ai.health, 1000);
      await page.locator('#leave-battle-button').click(); await page.locator('#mode-open').click();
      pass(difficulty + ': selected speed produces exactly one 10-damage AI attack');
    }
    await page.locator('#mode-back').click(); await page.locator('#fight-button').click();
    await page.screenshot({ path: path.join(artifacts, 'comic-difficulty-desktop.png') });
    await page.locator('#difficulty-close').click();
    assert.equal(await page.evaluate(() => document.activeElement.id), 'fight-button');
    pass('lobby Start opens difficulty; close restores lobby focus');
    const touchContext = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
    const touch = await touchContext.newPage(); monitor(touch, errors); await load(touch); await clock(touch);
    for (const region of ['label', 'left-padding', 'right-padding']) {
      const button = touch.locator('#mode-open');
      if (region === 'label') await button.locator('b').tap();
      else {
        const box = await button.boundingBox();
        await button.tap({ position: { x: region === 'left-padding' ? 5 : box.width - 5, y: box.height - 6 } });
      }
      assert.equal(await touch.evaluate(() => window.WaxArena.getScreen()), 'modes', region);
      await touch.locator('#mode-back').tap();
    }
    await touchContext.close();
    pass('real mobile taps on current mode text and both padding edges open mode selection');
    assert.deepEqual(errors, []); pass('zero browser, console or HTTP errors');
    fs.writeFileSync(path.join(artifacts, 'lobby-results.json'), JSON.stringify({ passed: checks, errors }, null, 2));
    console.log(`${checks} lobby checks passed.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
