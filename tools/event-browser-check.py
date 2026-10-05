"""Real admin/participant UI on isolated local data; never calls production."""
import json, os, socket, subprocess, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,str(ROOT/'tools/.test-deps'))
from playwright.sync_api import sync_playwright, expect
with socket.socket() as sock:
    sock.bind(('127.0.0.1',0)); port=sock.getsockname()[1]
server=subprocess.Popen(['node',str(ROOT/'tools/local-server.mjs')],cwd=ROOT,
    env=dict(os.environ,WAKPPU_LOCAL_PORT=str(port)),stdout=subprocess.PIPE,
    stderr=subprocess.STDOUT,text=True,encoding='utf-8')
try:
    assert server.stdout.readline().startswith('Local preview:')
    server.stdout.readline();password=server.stdout.readline().split(': ',1)[1].strip()
    base=f'http://127.0.0.1:{port}'
    with sync_playwright() as p:
        browser=p.chromium.launch(channel='msedge',headless=True)
        contexts=[];errors=[]
        def new_page(mobile=False):
            ctx=browser.new_context(viewport={'width':390 if mobile else 1100,'height':844 if mobile else 820})
            ctx.route('**/*',lambda route: route.continue_() if route.request.url.startswith(base) else route.fulfill(status=200,body='',content_type='text/javascript'))
            contexts.append(ctx);page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
            page.goto(base);page.wait_for_load_state('networkidle');return page
        admin=new_page();admin.locator('#accountBtn').click()
        admin.locator('#accountEmail').fill('dodoonglee@gmail.com');admin.locator('#accountPassword').fill(password)
        admin.locator('#signInBtn').click();expect(admin.locator('#adminBtn')).to_be_visible()
        admin.locator('#adminBtn').click();expect(admin.locator('#adminGoldEventStart')).to_be_visible()
        admin.on('dialog',lambda d:d.accept());admin.locator('#adminGoldEventStart').click()
        expect(admin.locator('#goldEventBanner')).to_contain_text('초 후 시작');expect(admin.locator('#adminGoldEventStart')).to_be_disabled()
        guest=new_page(mobile=True);guest.locator('#accountBtn').click();guest.locator('#guestNicknameInput').fill('이벤트참가자');guest.locator('#guestStartBtn').click()
        expect(guest.locator('#goldEventBanner')).to_contain_text('초 후 시작');expect(guest.locator('#adminBtn')).to_be_hidden()
        guest.reload();expect(guest.locator('#goldEventBanner')).to_contain_text('초 후 시작')
        # Accelerate only the simulated server clock in status responses (not production).
        def advance(route):
            reply=route.fetch();data=reply.json()
            if route.request.post_data_json.get('action')=='status' and data.get('gold_event'):
                data['server_time']=data['gold_event']['starts_at']
            route.fulfill(response=reply,json=data)
        guest.route('**/local/api',advance)
        expect(guest.locator('#goldEventBanner')).to_contain_text('남은 시간',timeout=7000)
        before=int(guest.evaluate("JSON.parse(localStorage.getItem('wax-ball:wakppuball:local-test-save')).gold"))
        box=guest.locator('#ballSvg').bounding_box()
        for _ in range(5):guest.mouse.click(box['x']+box['width']/2,box['y']+box['height']/2)
        guest.wait_for_timeout(1600)
        after=int(guest.evaluate("JSON.parse(localStorage.getItem('wax-ball:wakppuball:local-test-save')).gold"))
        assert after-before==10,(before,after)
        assert guest.evaluate('document.documentElement.scrollWidth<=innerWidth')
        out=ROOT/'tools/test-results';out.mkdir(exist_ok=True)
        admin.screenshot(path=str(out/'gold-event-admin.png'),full_page=True)
        guest.screenshot(path=str(out/'gold-event-mobile.png'),full_page=True)
        admin.locator('#adminGoldEventStop').click()
        expect(guest.locator('#goldEventBanner')).to_be_hidden(timeout=7000)
        assert guest.evaluate('WakppuGoldEvent.multiplier()')==1
        assert not errors,errors
        for ctx in contexts:ctx.close()
        browser.close()
        print(json.dumps({'passed':True,'checks':['admin buttons','announcement','late join/reload','guest hidden','x10 actual payout','mobile overflow','global stop','no page errors']},ensure_ascii=False))
finally:
    server.terminate();server.wait(timeout=10)
