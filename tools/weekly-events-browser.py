"""Native Playwright: admin-only recurring schedules on mobile and desktop."""
import os,socket,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,os.environ.get('WAKPPU_TEST_PYTHON_PATH',str(ROOT/'tools/.test-deps')))
from playwright.sync_api import sync_playwright,expect
with socket.socket() as s:s.bind(('127.0.0.1',0));port=s.getsockname()[1]
server=subprocess.Popen(['node',str(ROOT/'tools/local-server.mjs')],cwd=ROOT,env=dict(os.environ,WAKPPU_LOCAL_PORT=str(port)),stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,encoding='utf-8')
try:
    assert server.stdout.readline().startswith('Local preview:');server.stdout.readline();password=server.stdout.readline().strip().split(': ',1)[1]
    base=f'http://127.0.0.1:{port}'
    with sync_playwright() as p:
        browser=p.chromium.launch(channel='msedge',headless=True)
        for width in [390,1200]:
            context=browser.new_context(viewport={'width':width,'height':900},is_mobile=width<500,has_touch=True)
            context.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base) else r.fulfill(status=200,body=''))
            page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
            page.goto(base)
            try:page.wait_for_load_state('networkidle',timeout=2000)
            except Exception:pass
            page.evaluate("async()=>{await WakppuAuth.signIn('guest','');await WakppuItemGame.restore();}")
            page.wait_for_function('WakppuItemGame.read().ready')
            expect(page.locator('#adminBtn')).to_be_hidden();expect(page.locator('#adminWeeklyEvents')).to_be_hidden()
            denied=page.evaluate("async()=>{try{await WakppuAuth.invoke('admin_weekly_events',{mode:'enable'});return false;}catch(e){return e.status===403;}}")
            assert denied
            page.evaluate("async(args)=>{await WakppuAuth.signIn(args[0],args[1]);await WakppuItemGame.restore();}",['dodoonglee@gmail.com',password])
            page.wait_for_function("document.querySelector('#adminBtn').hidden===false")
            page.locator('#adminBtn').click();page.locator('#adminWeeklyEvents').scroll_into_view_if_needed()
            page.on('dialog',lambda d:d.accept())
            # The same isolated server is shared across viewport tests.
            if page.locator('#weeklyDisable').is_enabled():page.locator('#weeklyDisable').click();expect(page.locator('#weeklyList')).to_contain_text('꺼짐')
            page.locator('#weeklyEnable').click();expect(page.locator('#weeklyStatus')).to_contain_text('켰습니다')
            expect(page.locator('#weeklyList')).to_contain_text('07:00');expect(page.locator('#weeklyList')).to_contain_text('21:00')
            expect(page.locator('#weeklyList')).to_contain_text('Gold ×100 10분');expect(page.locator('#weeklyList')).to_contain_text('관리자 볼 15분')
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
            out=ROOT/'tools/test-results';out.mkdir(exist_ok=True)
            page.screenshot(path=str(out/f'weekly-events-{width}.png'))
            page.reload();page.wait_for_function("document.querySelector('#adminBtn').hidden===false")
            page.locator('#adminBtn').click();expect(page.locator('#weeklyList')).to_contain_text('반복 중')
            page.locator('#weeklyDisable').click();expect(page.locator('#weeklyStatus')).to_contain_text('껐습니다')
            state=page.evaluate("async()=>await WakppuAuth.invoke('status')");assert state['gold_event'] is None and state['admin_ball_event'] is None
            assert not errors,errors
            context.close();print(f'PASS {width}px: player denial, admin enable/disable, exact display and reload persistence',flush=True)
        browser.close()
finally:
    server.terminate();server.wait(timeout=10)
