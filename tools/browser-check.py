"""Isolated browser regression checks; never contacts production services.

Run with Python and Playwright installed, plus Microsoft Edge.
Optional --node specifies the Node executable used by the local sample server.
"""
import argparse
import json
import os
from pathlib import Path
import socket
import subprocess
import sys

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'tools' / '.test-deps'))
from playwright.sync_api import sync_playwright, expect

SAVE_KEY = 'wax-ball:wakppuball:local-test-save'
OUT = ROOT / 'tools' / 'test-results'


def fixture(**changes):
    data = dict(version=3, gold='0', rebirths=0, unlocked=[True]+[False]*12,
                discovered=['yellow'], selected=0, hammerOwned=False,
                hammerLevel=0, honeyExpiresAt=0)
    data.update(changes)
    return data


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--node', default='node')
    args = parser.parse_args()
    OUT.mkdir(exist_ok=True)
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        port = sock.getsockname()[1]
    env = dict(os.environ, WAKPPU_LOCAL_PORT=str(port))
    server = subprocess.Popen([args.node, str(ROOT/'tools/local-server.mjs')],
                              cwd=ROOT, env=env, stdout=subprocess.PIPE,
                              stderr=subprocess.STDOUT, text=True, encoding='utf-8')
    results = []
    try:
        assert server.stdout.readline().startswith('Local preview:')
        server.stdout.readline()
        password = server.stdout.readline().split(': ', 1)[1].strip()
        base = f'http://127.0.0.1:{port}'
        with sync_playwright() as p:
            browser = p.chromium.launch(channel='msedge', headless=True)

            def check(name, test, saved=None, mobile=False):
                context = browser.new_context(viewport={'width':390 if mobile else 1100,
                                                       'height':844 if mobile else 820},
                                              is_mobile=mobile, has_touch=mobile)
                # Every external script/service is isolated from this test.
                context.route('**/*', lambda route: route.continue_() if route.request.url.startswith(base)
                              else route.fulfill(status=200, body='', content_type='text/javascript'))
                if saved is not None:
                    context.add_init_script(f"if(!sessionStorage.getItem('fixture')) {{localStorage.setItem({json.dumps(SAVE_KEY)}, {json.dumps(json.dumps(saved))});sessionStorage.setItem('fixture','1');}}")
                page = context.new_page()
                errors = []
                page.on('pageerror', lambda error: errors.append(str(error)))
                try:
                    page.goto(base)
                    page.wait_for_load_state('networkidle')
                    test(page)
                    assert not errors, errors
                    results.append({'name':name, 'passed':True})
                except Exception as error:
                    page.screenshot(path=str(OUT/(name+'.png')), full_page=True)
                    results.append({'name':name, 'passed':False, 'error':str(error), 'pageErrors':errors})
                finally:
                    context.close()

            def saved(page):
                return page.evaluate('(key)=>JSON.parse(localStorage.getItem(key))', SAVE_KEY)

            def hit(page, count=5):
                box = page.locator('#ballSvg').bounding_box()
                for _ in range(count):
                    if page.evaluate('navigator.maxTouchPoints > 0'):
                        page.touchscreen.tap(box['x']+box['width']/2, box['y']+box['height']/2)
                    else:
                        page.mouse.click(box['x']+box['width']/2, box['y']+box['height']/2)

            def core(page):
                expect(page.locator('#ballName')).to_have_text('노란색 왁뿌볼')
                expect(page.locator('#unlockBtn')).to_be_disabled()
                hit(page, 20)  # Extra input during destruction must not duplicate rewards.
                expect(page.locator('#goldValue')).to_have_text('1')
                page.wait_for_timeout(1300)
                assert saved(page)['gold']=='1'
                page.reload()
                expect(page.locator('#goldValue')).to_have_text('1')
                assert page.locator('.hit').count()==1
                assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
                page.screenshot(path=str(OUT/'mobile.png'), full_page=True)

            def shop_unlock(page):
                page.locator('#unlockBtn').click()
                expect(page.locator('#ballName')).to_have_text('초록색 왁뿌볼')
                assert saved(page)['gold']=='1990'
                page.locator('#shopBtn').click()
                page.locator('#honeyBtn').click()
                expect(page.locator('#honeyBtn')).to_be_disabled()
                page.locator('#hammerBtn').click()
                page.locator('#hammerBtn').click()
                assert saved(page)['hammerLevel']==2
                assert saved(page)['gold']=='1360'
                page.locator('[data-close="shop"]').click()
                hit(page, 2)
                expect(page.locator('#goldValue')).to_have_text('1.4K')
                page.wait_for_timeout(1300)
                assert saved(page)['gold']=='1380'
                page.reload()
                expect(page.locator('#ballName')).to_have_text('초록색 왁뿌볼')
                assert saved(page)['hammerLevel']==2

            def rebirth(page):
                page.locator('#rebirthBtn').click()
                page.locator('#rebirthConfirm').click()
                assert saved(page)['gold']=='0'
                assert saved(page)['rebirths']==1
                assert saved(page)['unlocked']==[True]+[False]*12
                hit(page)
                expect(page.locator('#goldValue')).to_have_text('2')

            def switching(page):
                hit(page)
                page.locator('#collectionBtn').click()
                button=page.locator('[data-action="select"][data-index="1"]')
                # Ball switching during the payout delay must not cancel earned Gold.
                if button.is_enabled(): button.click()
                else: page.locator('#collectionClose').click()
                page.wait_for_timeout(1500)
                assert saved(page)['gold']=='11', saved(page)

            def invalid_rebirth(page):
                assert saved(page)['rebirths']<=25, saved(page)['rebirths']
                hit(page)
                page.wait_for_timeout(1400)

            def large_reward(page):
                hit(page, 2)
                page.wait_for_timeout(1500)
                assert saved(page)['gold']==str(9007199254740993+5000000*(2**25))
                expect(page.locator('#rebirthBtn')).to_be_disabled()
                page.reload()
                assert saved(page)['gold']==str(9007199254740993+5000000*(2**25))

            def all_art(page):
                for ball_id in page.evaluate('WAKPPU_BALLS.map(b=>b.id)'):
                    page.evaluate('(id)=>WakppuGameTest.run("last",id)', ball_id)
                    assert page.locator('.hit').count()==1, ball_id
                    hit(page, 1)
                    expect(page.locator('.shard')).to_have_count(27)
                page.evaluate('WakppuGameTest.end()')
                assert saved(page)['gold']=='0'

            def partial_restore(page):
                hit(page, 2)
                assert page.locator('.crack:visible').count()>0
                page.evaluate('WakppuGameTest.run("ball","sun")')
                page.evaluate('WakppuGameTest.end()')
                # The existing 2 hits must survive an admin preview.
                hit(page, 3)
                expect(page.locator('#goldValue')).to_have_text('1')

            def guest(page):
                page.locator('#accountBtn').click()
                page.locator('#guestNicknameInput').fill('테스트손님')
                page.locator('#guestStartBtn').click()
                expect(page.locator('#account')).to_be_hidden()
                expect(page.locator('#adminBtn')).to_be_hidden()
                page.locator('#rankingBtn').click()
                expect(page.locator('#rankingList')).to_contain_text('테스트손님')
                response=page.evaluate("async()=>{try {await WakppuAuth.invoke('admin_search');return false;} catch(e){return e.message;}}")
                assert response=='admin only', response

            def admin(page):
                page.locator('#accountBtn').click()
                page.locator('#accountEmail').fill('dodoonglee@gmail.com')
                page.locator('#accountPassword').fill(password)
                page.locator('#signInBtn').click()
                expect(page.locator('#adminBtn')).to_be_visible()
                page.locator('#adminBtn').click()
                page.locator('#adminResults button').first.click()
                page.locator('#adminUnban').click()
                expect(page.locator('#adminStatus')).to_have_text('완료했습니다.')
                page.locator('#adminBall').select_option('blackhole')
                before=saved(page)
                page.locator('#adminTestBreak').click()
                page.wait_for_timeout(1500)
                assert saved(page)==before
                page.locator('#adminBtn').click()
                page.locator('#adminEndTest').click()
                page.locator('[data-close="admin"]').click()
                assert saved(page)==before
                page.screenshot(path=str(OUT/'desktop.png'), full_page=True)

            check('mobile-core', core, mobile=True)
            check('shop-unlock-save', shop_unlock, fixture(gold='2000'))
            check('rebirth', rebirth, fixture(gold='2000000', unlocked=[True,True]+[False]*11, selected=1))
            check('switch-during-break', switching, fixture(gold='10', unlocked=[True,True]+[False]*11))
            check('invalid-rebirth-save', invalid_rebirth, fixture(rebirths=1024))
            check('large-reward-exact-save', large_reward, fixture(gold='9007199254740993',rebirths=25,
                  unlocked=[True]*13,selected=12,hammerOwned=True,hammerLevel=10))
            check('all-ball-art-break', all_art)
            check('admin-partial-restore', partial_restore)
            check('guest-ranking-permission', guest)
            check('admin-test-isolation', admin)
            browser.close()
        (OUT/'browser-results.json').write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
        for item in results:
            print(('PASS ' if item['passed'] else 'FAIL ')+item['name'])
            if not item['passed']: print(item['error'])
        return 0 if all(item['passed'] for item in results) else 1
    finally:
        server.terminate()
        server.wait(timeout=10)


if __name__=='__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    raise SystemExit(main())
