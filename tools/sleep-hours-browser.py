"""Local-only closure, overnight return, anonymous visits and manual maintenance."""
import os,socket,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,os.environ.get('WAKPPU_TEST_PYTHON_PATH',str(ROOT/'tools/.test-deps')))
from playwright.sync_api import sync_playwright,expect
with socket.socket() as sock:
    sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
server=subprocess.Popen(['node',str(ROOT/'tools/local-server.mjs')],cwd=ROOT,env=dict(os.environ,WAKPPU_LOCAL_PORT=str(port),WAKPPU_LOCAL_SLEEP_TIME='2026-10-07T22:59:58+09:00'),stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,encoding='utf-8')
try:
    assert server.stdout.readline().startswith('Local preview:')
    server.stdout.readline();password=server.stdout.readline().split(': ',1)[1].strip()
    base=f'http://127.0.0.1:{port}'
    with sync_playwright() as p:
        browser=p.chromium.launch(channel='msedge',headless=True);errors=[]
        def new_page(mobile=False):
            ctx=browser.new_context(viewport={'width':390 if mobile else 1100,'height':844},is_mobile=mobile,has_touch=mobile)
            ctx.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base) else r.fulfill(status=200,body=''))
            page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
            page.goto(base);page.wait_for_load_state('domcontentloaded');return page
        admin=new_page()
        admin.evaluate('(password)=>WakppuAuth.signIn("dodoonglee@gmail.com",password)',password)
        admin.evaluate('WakppuGameTest.restoreAccount()');expect(admin.locator('#adminBtn')).to_be_visible()
        def clock(time):
            result=admin.evaluate("async(time)=>{const s=JSON.parse(sessionStorage.getItem('wakppu-local-session'));const r=await fetch('/local/sleep-clock',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+s.token},body:JSON.stringify({time})});return r.status;}",time)
            assert result==200
        clock('2026-10-07T22:59:58+09:00')
        guest=new_page(True);guest.evaluate('async()=>{await WakppuAuth.signInAnonymously();await WakppuGameTest.restoreAccount();}')
        expect(guest.locator('#game')).to_be_visible()
        gold=guest.evaluate('WakppuItemGame.read().gold')
        # Close while already playing; actual API clock and status drive the UI.
        clock('2026-10-07T23:00:00+09:00')
        expect(guest.locator('#maintenance')).to_be_visible(timeout=7000)
        expect(guest.locator('#maintenanceTitle')).to_have_text('수면 시간')
        expect(guest.locator('#game')).to_be_hidden()
        guest.evaluate("document.getElementById('ballSvg').dispatchEvent(new MouseEvent('click',{bubbles:true}))")
        assert guest.evaluate('WakppuItemGame.read().gold')==gold
        assert guest.evaluate("async()=>{try{await WakppuAuth.invoke('item_draw',{count:1});return 0;}catch(e){return e.status;}}") ==503
        # Device wall-clock changes must not override the server's schedule.
        guest.clock.set_fixed_time(1577836800000)
        expect(guest.locator('#maintenanceTitle')).to_have_text('수면 시간')
        guest.reload();expect(guest.locator('#maintenanceTitle')).to_have_text('수면 시간',timeout=7000)
        visitor=new_page(True);expect(visitor.locator('#maintenanceTitle')).to_have_text('수면 시간',timeout=7000)
        expect(visitor.locator('#game')).to_be_hidden()
        expect(admin.locator('#game')).to_be_visible()
        assert admin.evaluate("WakppuAuth.invoke('bootstrap').then(()=>true)")
        clock('2026-10-08T05:59:59+09:00')
        expect(guest.locator('#game')).to_be_hidden()
        # Opening must not turn off a separately enabled maintenance.
        admin.evaluate("WakppuAuth.invoke('admin_maintenance',{enabled:true,message:'별도 점검'})")
        clock('2026-10-08T06:00:00+09:00')
        expect(guest.locator('#maintenanceTitle')).to_have_text('왁뿌볼 패치 중',timeout=7000)
        expect(guest.locator('#game')).to_be_hidden()
        admin.evaluate("WakppuAuth.invoke('admin_maintenance',{enabled:false})")
        expect(guest.locator('#game')).to_be_visible(timeout=7000)
        expect(visitor.locator('#game')).to_be_visible(timeout=7000)
        guest.wait_for_function('WakppuItemGame.read().ready')
        assert guest.evaluate('WakppuItemGame.read().gold')==gold
        # Bans remain the primary notice even during the sleep schedule.
        admin.evaluate("WakppuAuth.invoke('admin_ban',{user_id:'local-player',mode:'permanent',reason:'로컬 차단 검증'})")
        clock('2026-10-08T23:00:00+09:00')
        expect(guest.locator('#maintenanceTitle')).to_have_text('계정 이용 제한',timeout=7000)
        assert guest.evaluate('document.documentElement.scrollWidth<=innerWidth')
        out=ROOT/'tools/test-results';out.mkdir(exist_ok=True)
        visitor.reload();expect(visitor.locator('#maintenanceTitle')).to_have_text('수면 시간',timeout=7000)
        visitor.screenshot(path=str(out/'sleep-hours-mobile.png'))
        admin.screenshot(path=str(out/'sleep-hours-admin-desktop.png'))
        assert not errors,errors
        browser.close();print('PASS overnight closure/opening, anonymous visits, admin exemption, server rejection, device clock change, manual maintenance, bans and mobile layout')
finally:
    server.terminate();server.wait(timeout=10)
