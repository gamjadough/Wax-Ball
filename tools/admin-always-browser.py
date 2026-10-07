"""Isolated local administrator access, rewards, reload and guest denial."""
import os,socket,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,str(ROOT/'tools/.lifecycle-test-deps'))
from playwright.sync_api import sync_playwright,expect
with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
server=subprocess.Popen([sys.argv[1],str(ROOT/'tools/local-server.mjs')],cwd=ROOT,env=dict(os.environ,WAKPPU_LOCAL_PORT=str(port)),stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,encoding='utf-8')
try:
    for _ in range(3):server.stdout.readline()
    base=f'http://127.0.0.1:{port}'
    with sync_playwright() as p:
        browser=p.chromium.launch(channel='msedge',headless=True)
        for width in [1100,390]:
            context=browser.new_context(viewport={'width':width,'height':844})
            context.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base) else r.fulfill(status=200,body='',content_type='text/javascript'))
            page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
            page.goto(base+'/?preview=adminball');page.wait_for_load_state('networkidle')
            expect(page.locator('#ballName')).to_have_text('관리자 왁뿌볼')
            page.get_by_role('button',name='이벤트 종료',exact=True).click()
            expect(page.locator('#adminBallEventInfo')).to_contain_text('현재 관리자 왁뿌볼 이벤트가 없습니다')
            expect(page.locator('#ballName')).to_have_text('관리자 왁뿌볼')
            def destroy():
                for i in range(1,6):
                    with page.expect_response(lambda r:r.url.endswith('/local/api') and r.request.post_data_json.get('action')=='event_ball_hit') as response:page.locator('#ballSvg').click()
                    result=response.value.json();assert response.value.ok,result
                    assert response.value.request.post_data_json['event_id']=='admin-always'
                    assert result['clicks']==min(600,135*i),result
                    if i<5:assert result['reward']=='0'
                page.wait_for_function("!document.getElementById('ballWrap').classList.contains('admin-ball-breaking')")
                return result
            first=destroy();second=destroy()
            assert int(second['gold'])==int(first['gold'])+int(second['reward'])
            page.goto(base+'/');page.wait_for_load_state('networkidle')
            expect(page.locator('#ballName')).to_have_text('관리자 왁뿌볼')
            # Normal balls remain voluntarily selectable, even for an administrator.
            page.locator('#collectionBtn').click()
            while not page.locator('[data-detail="0"]').count():page.locator('#collectionPrev').click()
            page.locator('[data-detail="0"]').click();page.get_by_role('button',name='선택',exact=True).click()
            expect(page.locator('#ballName')).to_have_text('노란색 왁뿌볼')
            page.wait_for_timeout(3200);expect(page.locator('#ballName')).to_have_text('노란색 왁뿌볼')
            page.reload();page.wait_for_load_state('networkidle');expect(page.locator('#ballName')).to_have_text('노란색 왁뿌볼')
            page.locator('#collectionBtn').click()
            index=page.evaluate('WAKPPU_BALLS.length')
            while not page.locator(f'[data-detail="{index}"]').count():page.locator('#collectionNext').click()
            page.locator(f'[data-detail="{index}"]').click()
            expect(page.locator('#collectionDetail')).to_contain_text('관리자 상시 이용')
            page.get_by_role('button',name='관리자 볼 선택',exact=True).click()
            expect(page.locator('#ballName')).to_have_text('관리자 왁뿌볼')
            page.screenshot(path=str(ROOT/'tools/test-results'/f'admin-always-{width}.png'))
            page.evaluate("async()=>{await WakppuAuth.invoke('admin_ball_event',{mode:'start',duration_seconds:300,delay_seconds:0});await WakppuAuth.invoke('admin_ball_event',{mode:'stop'});WakppuAdminBallEvent.update(await WakppuAuth.invoke('status'));}")
            expect(page.locator('#ballName')).to_have_text('관리자 왁뿌볼')
            destroy()
            page.evaluate("async()=>{await WakppuAuth.signOut();await WakppuAuth.signIn('guest','');await WakppuGameTest.restoreAccount();}")
            expect(page.locator('#ballName')).to_have_text('노란색 왁뿌볼')
            status=page.evaluate("async()=>{try{await WakppuAuth.invoke('event_ball_hit',{event_id:'admin-always',request_id:crypto.randomUUID()});return 200;}catch(e){return e.status;}}")
            assert status==409,status
            page.locator('#collectionBtn').click()
            while not page.locator(f'[data-detail="{index}"]').count():page.locator('#collectionNext').click()
            page.locator(f'[data-detail="{index}"]').click();expect(page.get_by_role('button',name='이벤트 종료',exact=True)).to_be_disabled()
            assert not errors,errors
            context.close()
        browser.close()
    print('PASS desktop/mobile: inactive-event admin access, repeated rewards, reload, normal selection, event stop, guest UI and forged request denial')
finally:
    server.terminate();server.wait(timeout=10)
