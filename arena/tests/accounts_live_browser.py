"""Live Firebase UI smoke test using disposable imported accounts, no mail."""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT = Path(__file__).resolve().parents[1]
USERS = json.loads((ROOT/'artifacts/account-live-fixture.json').read_text(encoding='utf-8'))
URL = os.environ.get('TEST_URL','http://127.0.0.1:5174')
with sync_playwright() as p:
    browser=p.chromium.launch(channel='msedge',headless=True)
    errors=[]
    def login(page,user):
        page.on('pageerror',lambda error:errors.append(str(error)))
        assert page.goto(URL).status==200
        page.wait_for_load_state('networkidle')
        page.locator('#account-open').click()
        page.locator('#account-email').fill(user['email'])
        page.locator('#account-password').fill(user['password'])
        page.locator('#account-submit').click()
        page.wait_for_function("document.getElementById('account-message').textContent === '로그인했습니다.'")
        page.locator('#account-close').click()
        assert page.locator('#profile-name').inner_text()==user['nickname']
    try:
        a=browser.new_context(viewport={'width':1440,'height':960})
        def shortened(route):
            response=route.fetch()
            route.fulfill(response=response,body=response.text().replace('maxHealth: 1000','maxHealth: 10'))
        a.route('**/js/config.js',shortened)
        page=a.new_page();login(page,USERS[0])
        baseline=page.evaluate('WaxArena.getProgress().gold')
        page.locator('#fight-button').click();page.locator('#ai-difficulty').select_option('entry');page.locator('#confirm-battle').click()
        for _ in range(5):page.locator('#player-ball').click()
        page.wait_for_function('(gold)=>WaxArena.getProgress().gold===gold',arg=baseline+50)
        assert '온라인 계정에 저장' in page.locator('#result-save-note').inner_text()
        b=browser.new_context(viewport={'width':844,'height':390})
        second=b.new_page();login(second,USERS[0])
        assert second.evaluate('WaxArena.getProgress().gold')==baseline+50
        second.locator('#account-open').click();second.locator('#account-logout').click();second.locator('#account-close').click()
        second.locator('#account-open').click();second.locator('#account-email').fill(USERS[1]['email']);second.locator('#account-password').fill(USERS[1]['password']);second.locator('#account-submit').click()
        second.wait_for_function("document.getElementById('account-message').textContent === '로그인했습니다.'")
        assert second.evaluate('WaxArena.getProgress().gold')==0
        second.locator('#account-close').click()
        second.screenshot(path=str(ROOT/'artifacts/accounts-live-mobile.png'))
        assert errors==[],errors
        print('PASS real browser login, victory save, independent browser restore, account isolation and logout')
        (ROOT/'artifacts/accounts-live-browser-results.json').write_text(json.dumps({'url':URL,'passed':True,'errors':errors}),encoding='utf-8')
    finally:browser.close()
