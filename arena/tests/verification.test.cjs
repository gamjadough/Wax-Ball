// All authentication requests are intercepted; this suite sends no real email.
const { assert, launch, load } = require('./helpers.cjs');
(async () => {
  const browser = await launch(); let checks = 0;
  const pass = name => { checks++; console.log('PASS ' + name); };
  try {
    const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    const mail = []; let quota = false;
    await page.route('https://identitytoolkit.googleapis.com/**', async route => {
      const request = route.request(); const body = request.postDataJSON();
      const sending = request.url().includes(':sendOobCode');
      if (sending) { mail.push(body); assert.equal(request.headers()['x-firebase-locale'], 'ko'); }
      await route.fulfill({ status: sending && quota ? 400 : 200, contentType: 'application/json',
        body: JSON.stringify(sending && quota ? { error: { message: 'QUOTA_EXCEEDED : Email quota exceeded' } } : { idToken: 'simulated-token', refreshToken: 'simulated-refresh', localId: 'verification-test' }) });
    });
    await load(page); await page.locator('#account-entry').click();
    await page.locator('[data-account-mode="signup"]').click();
    await page.locator('#account-nickname').fill('검증 공');
    await page.locator('#account-email').fill('verification@example.invalid');
    await page.locator('#account-password').fill('password123'); await page.locator('#account-submit').click();
    await page.waitForFunction(() => document.getElementById('account-message').textContent.includes('가입을 완료'));
    assert.match(await page.locator('#account-message').textContent(), /발송 요청이 접수/);
    assert.match(await page.locator('#account-message').textContent(), /숫자 인증번호가 아닌 링크/);
    assert.equal(mail.length, 1); assert.equal(mail[0].requestType, 'VERIFY_EMAIL');
    pass('signup explicitly explains request acceptance, spam folder and verification link');
    await page.locator('#account-verify').click();
    assert.match(await page.locator('#account-message').textContent(), /이메일과 비밀번호를 입력/);
    assert.equal(mail.length, 1); pass('missing password shows an explanation without making a resend request');
    await page.locator('#account-password').fill('password123'); await page.locator('#account-verify').click();
    await page.waitForFunction(() => document.getElementById('account-message').textContent.includes('도착을 보장하지'));
    assert.equal(mail.length, 2); pass('successful resend reports acceptance without claiming inbox delivery');
    quota = true; await page.locator('#account-password').fill('password123'); await page.locator('#account-verify').click();
    await page.waitForFunction(() => document.getElementById('account-message').textContent.includes('발송 한도'));
    assert.doesNotMatch(await page.locator('#account-message').textContent(), /요청이 접수/);
    assert.deepEqual(errors, []); pass('quota failure is shown accurately; no JavaScript exceptions');
    console.log(`${checks} verification UI checks passed (simulated delivery).`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
