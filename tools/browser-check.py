"""Isolated browser regression checks; never contacts production services.

Run with Python and Playwright installed, plus Microsoft Edge.
Optional --node specifies the Node executable used by the local sample server.
Standalone administrator UI is covered by tools/admin-site-browser.py against
tools/admin-site-fixture.mjs; this suite checks gameplay and its moderation UI.
"""
import argparse
import json
import os
from pathlib import Path
import socket
import subprocess
import sys

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, os.environ.get('WAKPPU_TEST_PYTHON_PATH', str(ROOT / 'tools' / '.test-deps')))
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
    parser.add_argument('--only', help='Run one named regression check')
    args = parser.parse_args()
    OUT.mkdir(exist_ok=True)
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        port = sock.getsockname()[1]
    env = dict(os.environ, WAKPPU_LOCAL_PORT=str(port), WAKPPU_LOCAL_SLEEP_TIME='2026-11-22T12:00:00+09:00')
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
                if args.only and name != args.only:
                    return
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
                assert page.locator('#ballSvg .hit').count()==1
                assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
                page.screenshot(path=str(OUT/'mobile.png'), full_page=True)

            def shop_unlock(page):
                page.locator('#unlockBtn').click()
                expect(page.locator('#ballName')).to_have_text('초록색 왁뿌볼')
                assert saved(page)['gold']=='31960'
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
                assert saved(page)['unlocked']==[True]+[False]*(page.evaluate('WAKPPU_BALLS.length')-1)
                hit(page)
                expect(page.locator('#goldValue')).to_have_text('2')

            def switching(page):
                hit(page)
                page.locator('#collectionBtn').click()
                page.locator('[data-detail="1"]').click()
                button=page.locator('[data-action="select"][data-index="1"]')
                # Ball switching during the payout delay must not cancel earned Gold.
                if button.is_enabled(): button.click()
                else: page.locator('#collectionClose').click()
                page.wait_for_timeout(1500)
                assert saved(page)['gold']=='11', saved(page)

            def invalid_rebirth(page):
                assert saved(page)['rebirths']==0, saved(page)['rebirths']
                hit(page)
                page.wait_for_timeout(1400)

            def large_reward(page):
                hit(page, 2)
                page.wait_for_timeout(1500)
                assert saved(page)['gold']==str(9007199254740993+5000000*(2**25))
                # Rebirth 25 is no longer the cap; the button opens the cost dialog.
                page.locator('#rebirthBtn').click()
                expect(page.locator('#rebirthText')).to_contain_text('환생할 수 있습니다')
                expect(page.locator('#rebirthConfirm')).to_be_disabled()
                page.locator('[data-close="rebirth"]').click()
                page.reload()
                assert saved(page)['gold']==str(9007199254740993+5000000*(2**25))

            def all_art(page):
                for ball in page.evaluate('WAKPPU_BALLS.map(b=>({id:b.id,grade:b.grade}))'):
                    ball_id=ball['id']
                    page.evaluate('(id)=>WakppuGameTest.run("last",id)', ball_id)
                    assert page.locator('#ballSvg .hit').count()==1, ball_id
                    hit(page, 1)
                    if ball['grade']=='초월':
                        page.wait_for_function("document.querySelector('[data-transcendent-phase]')?.dataset.transcendentPhase==='release'")
                        assert page.locator('.transcendent-fx').count()>=5,ball_id
                    else:
                        expect(page.locator('#ballSvg .shard')).to_have_count(27)
                page.evaluate('WakppuGameTest.end()')
                assert saved(page)['gold']=='0'

            def max_rebirth(page):
                assert saved(page)['rebirths']==page.evaluate('REBIRTH_COSTS.length')
                page.locator('#rebirthBtn').click()
                expect(page.locator('#rebirthText')).to_contain_text('최대 환생 달성')
                expect(page.locator('#rebirthConfirm')).to_be_hidden()

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

            def admin_login(page):
                page.evaluate("async password=>{const r=await WakppuAuth.signIn('dodoonglee@gmail.com',password);if(r.error)throw r.error;await WakppuItemGame.restore()}", password)
                page.wait_for_function('WakppuItemGame.read().ready')
                expect(page.locator('#adminBtn')).to_be_visible()

            def rpc(page, action, **body):
                return page.evaluate("b=>WakppuAuth.invoke(b.action,b.body)", {'action':action,'body':body})

            def admin(page):
                admin_login(page)
                # The full administrator site has its own SQL-backed UI suite.
                # Keep game-side announcement rendering and preview isolation here.
                rpc(page,'admin_announcement',message='공지 해제 테스트')
                page.reload(wait_until='networkidle')
                expect(page.locator('#serverAnnouncementText')).to_have_text('공지 해제 테스트')
                rpc(page,'admin_announcement',clear=True)
                page.reload(wait_until='networkidle')
                expect(page.locator('#serverAnnouncement')).to_be_hidden()
                page.wait_for_function('WakppuItemGame.read().ready')
                before=saved(page)
                assert rpc(page,'admin_test',ball_id='blackhole')['authorized']
                page.evaluate("WakppuGameTest.run('break','blackhole')")
                page.wait_for_timeout(1500)
                assert saved(page)==before
                page.evaluate('WakppuGameTest.end()')
                assert saved(page)==before
                page.screenshot(path=str(OUT/'desktop.png'),full_page=True)

            def moderation(page):
                admin_login(page)
                target='local-player'
                rpc(page,'admin_ranking_visibility',user_id=target,hidden=True)
                assert not any(r['nickname']=='테스트손님' for r in rpc(page,'rankings'))
                rpc(page,'admin_ranking_visibility',user_id=target,hidden=False)
                guest=page.context.new_page()
                try:
                    guest.goto(base,wait_until='networkidle')
                    guest.locator('#accountBtn').click()
                    guest.locator('#guestNicknameInput').fill('제재대상')
                    guest.locator('#guestStartBtn').click()
                    expect(guest.locator('#account')).to_be_hidden()
                    rpc(page,'admin_ban',user_id=target,mode='temporary',duration_hours=24,reason='브라우저 제재 테스트')
                    expect(guest.locator('#maintenanceTitle')).to_have_text('계정 이용 제한',timeout=12000)
                    expect(guest.locator('#game')).to_be_hidden()
                    expect(guest.locator('.maintenance-note')).to_contain_text('브라우저 제재 테스트')
                    code=guest.evaluate("async()=>{try{await WakppuAuth.invoke('save_progress',{gold:'99999'});return 200;}catch(e){return e.status;}}")
                    assert code==403
                    rpc(page,'admin_ranking_visibility',user_id=target,hidden=True)
                    rpc(page,'admin_unban',user_id=target)
                    row=next(r for r in rpc(page,'admin_search',query=target) if r['id']==target)
                    assert row['moderation']['status']=='active' and row['ranking_hidden']
                    guest.evaluate('WakppuItemGame.restore()')
                    expect(guest.locator('#game')).to_be_visible()
                    rpc(page,'admin_ranking_visibility',user_id=target,hidden=False)
                    rpc(page,'admin_ban',user_id=target,mode='permanent',reason='브라우저 제재 테스트')
                    expect(guest.locator('#maintenanceTitle')).to_have_text('계정 이용 제한',timeout=12000)
                    rpc(page,'admin_unban',user_id=target)
                finally:
                    guest.close()

            def email_link(page):
                page.locator('#accountBtn').click()
                page.locator('#guestNicknameInput').fill('이메일테스트')
                page.locator('#guestStartBtn').click()
                expect(page.locator('#account')).to_be_hidden()
                original_id=page.evaluate('async()=> (await WakppuAuth.session()).data.session.user.id')
                # Let the existing 500ms game-save debounce settle before the baseline.
                page.wait_for_timeout(650)
                original_state=page.evaluate("async()=> (await WakppuAuth.invoke('bootstrap')).state")
                page.locator('#accountBtn').click()
                expect(page.locator('#signOutBtn')).to_be_visible()
                page.locator('#linkEmailInput').fill('dodoonglee@gmail.com')
                page.locator('#linkEmailBtn').click()
                expect(page.locator('#accountStatus')).to_contain_text('이미 사용 중인 이메일')
                expect(page.locator('#guestExitDialog')).to_be_visible()
                page.locator('#guestExitCancel').click()
                expect(page.locator('#guestExitDialog')).to_be_hidden()
                assert page.evaluate('async()=> (await WakppuAuth.session()).data.session.user.id')==original_id
                page.locator('#linkEmailInput').fill('guest-link@example.test')
                page.locator('#linkEmailBtn').click()
                expect(page.locator('#checkEmailLinkBtn')).to_be_visible()
                page.reload()
                page.locator('#accountBtn').click()
                expect(page.locator('#checkEmailLinkBtn')).to_be_visible()
                page.locator('#checkEmailLinkBtn').click()
                expect(page.locator('#emailPasswordForm')).to_be_visible()
                expect(page.locator('#signOutBtn')).to_be_hidden()
                page.locator('#linkPasswordInput').fill('local-sample-password')
                page.locator('#linkPasswordConfirm').fill('different-password')
                page.locator('#completeEmailLinkBtn').click()
                expect(page.locator('#accountStatus')).to_contain_text('일치하지 않습니다')
                page.locator('#linkPasswordConfirm').fill('local-sample-password')
                page.locator('#completeEmailLinkBtn').click()
                expect(page.locator('#signOutBtn')).to_be_visible()
                assert page.evaluate('async()=> (await WakppuAuth.session()).data.session.user.id')==original_id
                after=page.evaluate("async()=> (await WakppuAuth.invoke('bootstrap')).state")
                assert after==original_state, {'before':original_state,'after':after}
                page.screenshot(path=str(OUT/'email-link-complete.png'),full_page=True)
                page.locator('#signOutBtn').click()
                page.locator('#accountBtn').click()
                page.locator('#accountEmail').fill('guest-link@example.test')
                page.locator('#accountPassword').fill('local-sample-password')
                page.locator('#signInBtn').click()
                expect(page.locator('#account')).to_be_hidden()
                assert page.evaluate('async()=> (await WakppuAuth.session()).data.session.user.id')==original_id
                after=page.evaluate("async()=> (await WakppuAuth.invoke('bootstrap')).state")
                assert after==original_state, {'before':original_state,'after':after}

            check('mobile-core', core, mobile=True)
            check('shop-unlock-save', shop_unlock, fixture(gold='31970'))
            check('rebirth', rebirth, fixture(gold='2000000', unlocked=[True,True]+[False]*11, selected=1))
            check('switch-during-break', switching, fixture(gold='10', unlocked=[True,True]+[False]*11))
            check('invalid-rebirth-save', invalid_rebirth, fixture(rebirths=1024))
            check('large-reward-exact-save', large_reward, fixture(gold='9007199254740993',rebirths=25,
                  unlocked=[True]*13,selected=12,hammerOwned=True,hammerLevel=10))
            check('max-rebirth-save', max_rebirth, fixture(rebirths=1000))
            check('all-ball-art-break', all_art)
            check('admin-partial-restore', partial_restore)
            check('guest-ranking-permission', guest)
            check('admin-test-isolation', admin)
            check('ranking-hide-ban-ui', moderation)
            check('guest-email-link-and-relogin', email_link)
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
