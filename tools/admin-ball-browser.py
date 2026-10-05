"""Local-only browser integration: real event API, switching and payout."""
import os,socket,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,str(ROOT/'tools/.lifecycle-test-deps'))
from playwright.sync_api import sync_playwright,expect
OUT=ROOT/'tools/test-results';OUT.mkdir(exist_ok=True)
KEY='wax-ball:wakppuball:local-test-save'
with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
server=subprocess.Popen([sys.argv[1],str(ROOT/'tools/local-server.mjs')],cwd=ROOT,env=dict(os.environ,WAKPPU_LOCAL_PORT=str(port)),stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,encoding='utf-8')
try:
    for _ in range(3):server.stdout.readline()
    base=f'http://127.0.0.1:{port}'
    with sync_playwright() as p:
        browser=p.chromium.launch(channel='msedge',headless=True);errors=[]
        def gold(page):return page.evaluate('(k)=>JSON.parse(localStorage.getItem(k)).gold',KEY)
        def hit(page):
            with page.expect_response(lambda r:r.url.endswith('/local/api') and r.request.post_data_json.get('action')=='event_ball_hit') as response:
                page.locator('#ballSvg').click()
            result=response.value.json();assert response.value.ok,result;return result
        def payout(page,expected):
            for i in range(1,6):
                result=hit(page);assert result['clicks']==min(600,i*135),result
                if i<5:assert result['reward']=='0'
            page.locator('#ballSvg').click(force=True)
            page.wait_for_function('(v)=>JSON.parse(localStorage.getItem("wax-ball:wakppuball:local-test-save")).gold===v',arg=expected)
            expect(page.locator('#ballName')).to_have_text('관리자 왁뿌볼')
        for mobile,reduced in ([(False,False)] if '--desktop' in sys.argv else [(False,False),(True,False),(True,True)]):
            ctx=browser.new_context(viewport={'width':390 if mobile else 1100,'height':844},is_mobile=mobile,has_touch=mobile,reduced_motion='reduce' if reduced else 'no-preference')
            ctx.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base) else r.fulfill(status=200,body='',content_type='text/javascript'))
            page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
            lost={'done':False}
            if not mobile:
                def lose_final_response(route):
                    body=route.request.post_data_json
                    if body.get('action')=='event_ball_hit' and not lost['done']:
                        upstream=route.fetch()
                        if upstream.json().get('clicks')==600:
                            lost['done']=True;route.abort('failed');return
                        route.fulfill(response=upstream);return
                    route.continue_()
                page.route('**/local/api',lose_final_response)
            page.goto(base+'/?preview=adminball');page.wait_for_load_state('networkidle')
            expect(page.locator('#ballName')).to_have_text('관리자 왁뿌볼');assert gold(page)=='0'
            page.screenshot(path=str(OUT/('admin-ball-mobile.png' if mobile else 'admin-ball-desktop.png')))
            payout(page,'150000000');payout(page,'300000000')
            if not mobile:assert lost['done']
            page.get_by_role('button',name='환생·꿀·골드 배율 테스트',exact=True).click()
            expect(page.locator('.admin-ball-preview p')).to_contain_text('12,000,000,000G')
            payout(page,'12000000000')
            # Voluntary selection is not overridden by subsequent status polls.
            page.locator('#collectionBtn').click()
            card=page.locator('.card').filter(has=page.get_by_role('heading',name='화이트홀 왁뿌볼',exact=True))
            card.get_by_role('button',name='선택',exact=True).click()
            expect(page.locator('#ballName')).to_have_text('화이트홀 왁뿌볼')
            page.wait_for_timeout(3300);expect(page.locator('#ballName')).to_have_text('화이트홀 왁뿌볼')
            reload_page=ctx.new_page();reload_page.goto(base+'/');reload_page.wait_for_load_state('networkidle')
            expect(reload_page.locator('#ballName')).to_have_text('화이트홀 왁뿌볼');reload_page.close()
            # An ordinary guest joining midway receives the event, with their own yellow-ball base reward.
            guest_ctx=browser.new_context();guest_ctx.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base) else r.fulfill(status=200,body='',content_type='text/javascript'))
            guest=guest_ctx.new_page();guest.goto(base+'/');guest.wait_for_load_state('networkidle')
            guest.evaluate("async()=>{await WakppuAuth.signInAnonymously();await WakppuGameTest.restoreAccount();}")
            expect(guest.locator('#ballName')).to_have_text('관리자 왁뿌볼');guest.locator('#collectionBtn').click()
            guest_card=guest.locator('.card').filter(has=guest.get_by_role('heading',name='관리자 왁뿌볼',exact=True))
            expect(guest_card).to_contain_text('기본 파괴 보상 +10G');guest_ctx.close()
            # Return through the event-only collection entry.
            page.locator('#collectionBtn').click();page.get_by_role('button',name='이벤트 볼 선택',exact=True).click()
            expect(page.locator('#ballName')).to_have_text('관리자 왁뿌볼')
            page.get_by_role('button',name='이벤트 종료',exact=True).click()
            expect(page.locator('#ballName')).to_have_text('화이트홀 왁뿌볼')
            page.locator('#collectionBtn').click();expect(page.locator('#collectionGrid button[data-action="event"]')).to_be_disabled();page.locator('#collectionClose').click()
            # Resume ordinary ball's partial cracks after an automatic event switch.
            page.locator('#ballSvg').click()
            before=page.locator('#ballSvg').inner_html()
            page.evaluate("async()=>{await WakppuAuth.invoke('admin_ball_event',{mode:'start',duration_seconds:300,delay_seconds:0});WakppuAdminBallEvent.update(await WakppuAuth.invoke('status'));}")
            expect(page.locator('#ballName')).to_have_text('관리자 왁뿌볼')
            page.get_by_role('button',name='이벤트 종료',exact=True).click()
            expect(page.locator('#ballName')).to_have_text('화이트홀 왁뿌볼')
            # Remaining two max-hammer hits must finish the 300-hit whitehole.
            page.locator('#ballSvg').click();page.locator('#ballSvg').click()
            page.wait_for_function("document.getElementById('ballWrap').dataset.whiteholePhase!==undefined")
            page.wait_for_function("!document.getElementById('ballWrap').dataset.whiteholePhase")
            if not mobile:
                prior=int(gold(page))
                page.locator('#ballSvg').click();page.locator('#ballSvg').click();page.locator('#ballSvg').click()
                page.evaluate("async()=>{await WakppuAuth.invoke('admin_ball_event',{mode:'start',duration_seconds:300,delay_seconds:0});WakppuAdminBallEvent.update(await WakppuAuth.invoke('status'));}")
                expect(page.locator('#ballName')).to_have_text('화이트홀 왁뿌볼')
                expect(page.locator('#ballName')).to_have_text('관리자 왁뿌볼')
                assert int(gold(page))==prior+1200000000
                page.get_by_role('button',name='이벤트 종료',exact=True).click()
            # Event UI controls also work from the actual administrator panel.
            page.locator('#adminBtn').click();page.locator('#adminBallEventDuration').fill('3');page.locator('#adminBallEventDelay').fill('1')
            page.on('dialog',lambda d:d.accept());page.locator('#adminBallEventStart').click()
            expect(page.locator('#ballName')).to_have_text('관리자 왁뿌볼')
            page.locator('#adminGoldEventStop').click()
            expect(page.locator('#ballName')).to_have_text('관리자 왁뿌볼')
            page.locator('#adminEventMultiplier').fill('7');page.locator('#adminEventDuration').fill('10');page.locator('#adminEventDelay').fill('0');page.locator('#adminGoldEventStart').click()
            expect(page.locator('#ballName')).to_have_text('관리자 왁뿌볼')
            page.wait_for_function("document.getElementById('ballName').textContent==='화이트홀 왁뿌볼'")
            ctx.close()
        assert not errors,errors
        browser.close()
    print('PASS admin event ball: '+('desktop' if '--desktop' in sys.argv else 'desktop/mobile/reduced motion')+', five-hit boundary, repeats, 12B multipliers, response loss retry, late guest join, reload preference, ordinary progress restore, scheduled start, concurrent gold event, expiry and administrator controls')
finally:
    server.terminate();server.wait(timeout=10)
