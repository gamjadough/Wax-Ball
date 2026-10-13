const { assert, fs, path, artifacts, launch, monitor, load, clock, start, smash, fits, noOverflow } = require('./helpers.cjs');
async function progress(page) { return page.evaluate(() => window.WaxArena.getProgress()); }
async function fixture(context) {
  // Short HP is only a test fixture; the full browser suite uses actual 1,000 HP.
  await context.route('**/js/config.js', async route => {
    const response = await route.fetch(); await route.fulfill({ response, body: (await response.text()).replace('maxHealth: 1000', 'maxHealth: 10') });
  });
}
(async () => {
  const browser = await launch(); const errors = []; let checks = 0;
  const pass = name => { checks++; console.log('PASS ' + name); };
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 960 } }); await fixture(context);
    const page = await context.newPage(); monitor(page, errors); await load(page); await clock(page);
    assert.equal((await progress(page)).gold, 0); assert.equal(await page.locator('#record-summary').textContent(), '0승 · 0패');
    for (const [index, difficulty] of ['entry','beginner','intermediate','advanced'].entries()) {
      await start(page, difficulty); await smash(page); await page.clock.runFor(200);
      assert.match(await page.locator('#result-reward').textContent(), /승리 보상 \+50 G/);
      assert.equal((await progress(page)).gold, (index + 1) * 50); assert.equal((await progress(page)).wins, index + 1);
      const settled = await progress(page);
      await page.clock.runFor(5000); await smash(page);
      await page.evaluate(() => { window.dispatchEvent(new Event('pageshow')); document.dispatchEvent(new Event('visibilitychange')); });
      assert.deepEqual(await progress(page), settled);
      await page.locator('#lobby-button').click();
      assert.equal(await page.locator('#gold-amount').textContent(), `${(index + 1) * 50} G`);
    }
    pass('all four difficulties award 50 once; repeated result events and lobby returns do not duplicate rewards');
    await page.reload(); await page.waitForLoadState('networkidle');
    assert.equal((await progress(page)).gold, 200); assert.equal(await page.locator('#record-summary').textContent(), '4승 · 0패');
    await start(page, 'advanced'); await page.clock.runFor(1200);
    assert.match(await page.locator('#result-reward').textContent(), /패배.*보상 없음/);
    assert.equal((await progress(page)).gold, 200); assert.equal((await progress(page)).losses, 1);
    await page.locator('#start-button').click(); await smash(page); await page.clock.runFor(200);
    assert.equal((await progress(page)).gold, 250); assert.equal((await progress(page)).wins, 5);
    pass('reload restores progress; defeat grants no gold; rematch awards a new win once');
    for (const viewport of [{ width: 568, height: 240 }, { width: 568, height: 320 }, { width: 844, height: 390 }]) {
      await page.setViewportSize(viewport);
      for (const selector of ['#result-reward', '#result-save-note', '#start-button', '#lobby-button']) await fits(page, selector, selector.includes('button') ? 44 : 0);
      await noOverflow(page);
      await page.screenshot({ path: path.join(artifacts, `reward-result-${viewport.width}x${viewport.height}.png`) });
    }
    pass('reward result and both action buttons fit small landscape phones');
    await page.setViewportSize({ width: 1440, height: 960 }); await page.locator('#lobby-button').click();
    const saved = await progress(page);
    await start(page); await smash(page); await page.locator('#leave-battle-button').click();
    assert.deepEqual(await progress(page), saved);
    await start(page); await page.locator('#rematch-button').click(); await page.reload(); await page.waitForLoadState('networkidle');
    assert.deepEqual(await progress(page), saved);
    pass('unfinished, abandoned and refreshed matches grant no rewards or records');
    const second = await context.newPage(); monitor(second, errors); await load(second); await clock(second);
    await start(second); await smash(second); await second.clock.runFor(200);
    await page.waitForFunction(() => window.WaxArena.getProgress().gold === 300);
    assert.equal(await page.locator('#gold-amount').textContent(), '300 G');
    pass('a second tab saves its win and updates the first tab wallet');
    await context.close();
    const corrupt = await browser.newContext({ viewport: { width: 844, height: 390 } }); await fixture(corrupt);
    await corrupt.addInitScript(() => localStorage.setItem('wax-ball-arena.progress.v1', '{bad json'));
    const bad = await corrupt.newPage(); monitor(bad, errors); await load(bad); await clock(bad);
    assert.equal((await progress(bad)).issue, 'corrupt'); await start(bad); await smash(bad); await bad.clock.runFor(200);
    assert.equal((await progress(bad)).gold, 50); assert.equal((await progress(bad)).issue, ''); await corrupt.close();
    pass('corrupted savings do not crash gameplay and a new result restores valid savings');
    const blocked = await browser.newContext({ viewport: { width: 844, height: 390 } }); await fixture(blocked);
    await blocked.addInitScript(() => { Storage.prototype.setItem = () => { throw new DOMException('Quota exceeded', 'QuotaExceededError'); }; });
    const temporary = await blocked.newPage(); monitor(temporary, errors); await load(temporary); await clock(temporary);
    await start(temporary); await smash(temporary); await temporary.clock.runFor(200);
    assert.equal((await progress(temporary)).gold, 50); assert.equal((await progress(temporary)).issue, 'unavailable');
    assert.match(await temporary.locator('#result-save-note').textContent(), /저장 불가/);
    await temporary.locator('#lobby-button').click(); assert.match(await temporary.locator('#record-summary').textContent(), /1승.*저장 불가/);
    await blocked.close(); pass('storage failure retains session rewards and shows an accurate saving notice');
    assert.deepEqual(errors, []); pass('zero browser, console or HTTP errors');
    fs.writeFileSync(path.join(artifacts, 'rewards-results.json'), JSON.stringify({ passed: checks, errors }, null, 2));
    console.log(`${checks} reward browser checks passed.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
