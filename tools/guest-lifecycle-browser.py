"""Local-only lifecycle UI and first-hit integration check."""
import os
from pathlib import Path
import socket
import subprocess
import sys
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,str(ROOT/'tools/.lifecycle-test-deps'))
from playwright.sync_api import sync_playwright,expect

with socket.socket() as sock:
    sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
server=subprocess.Popen([sys.argv[1],str(ROOT/'tools/local-server.mjs')],cwd=ROOT,
    env=dict(os.environ,WAKPPU_LOCAL_PORT=str(port)),stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,encoding='utf-8')
try:
    server.stdout.readline();server.stdout.readline()
    password=server.stdout.readline().split(': ',1)[1].strip()
    base=f'http://127.0.0.1:{port}'
    with sync_playwright() as p:
        browser=p.chromium.launch(channel='msedge',headless=True)
        contexts=[];errors=[]
        def make_page(mobile=False):
            ctx=browser.new_context(viewport={'width':390 if mobile else 1200,'height':844},is_mobile=mobile,has_touch=mobile)
            contexts.append(ctx)
            ctx.route('**/*',lambda route:route.continue_() if route.request.url.startswith(base) else route.fulfill(status=200,body='',content_type='text/javascript'))
            page=ctx.new_page();page.on('pageerror',lambda error:errors.append(str(error)))
            page.goto(base);page.wait_for_load_state('networkidle');return page
        guest=make_page()
        guest.locator('#accountBtn').click();guest.locator('#guestNicknameInput').fill('첫플레이확인');guest.locator('#guestStartBtn').click()
        expect(guest.locator('#account')).to_be_hidden()
        guest.wait_for_timeout(750)
        admin=make_page(True)
        admin.locator('#accountBtn').click();admin.locator('#accountEmail').fill('dodoonglee@gmail.com');admin.locator('#accountPassword').fill(password);admin.locator('#signInBtn').click()
        expect(admin.locator('#account')).to_be_hidden();admin.locator('#adminBtn').click()
        admin.locator('#guestLifecycleSearch').click()
        expect(admin.locator('#guestLifecycleStatus')).to_contain_text('총 1개')
        expect(admin.locator('#guestLifecycleRows')).to_contain_text('첫플레이확인')
        expect(admin.locator('#guestLifecycleRows')).to_contain_text('30분 대기')
        admin.locator('#guestLifecycleRows').scroll_into_view_if_needed()
        admin.screenshot(path=str(ROOT/'tools/test-results/guest-lifecycle-mobile.png'),full_page=True)
        # One click before breaking a ball must already be durable server activity.
        guest.locator('#ballSvg').click()
        guest.wait_for_timeout(500)
        admin.locator('#guestLifecycleSearch').click()
        expect(admin.locator('#guestLifecycleStatus')).to_contain_text('총 0개')
        admin.locator('#guestLifecycleFilter').select_option('protected')
        expect(admin.locator('#guestLifecycleRows')).to_contain_text('플레이 기록 있음')
        expect(admin.locator('#guestLifecycleRows')).to_contain_text('대상 아님')
        admin.locator('#guestLifecycleQuery').fill('존재하지않음');admin.locator('#guestLifecycleSearch').click()
        expect(admin.locator('#guestLifecycleStatus')).to_contain_text('총 0개')
        try:
            guest.evaluate("async()=>await WakppuAuth.invoke('admin_guest_accounts')")
            raise AssertionError('Guest could read lifecycle list')
        except Exception as error:
            assert 'admin only' in str(error)
        assert not errors,errors
        browser.close()
    print('PASS lifecycle mobile list/search/filter, auto-save exclusion, one-hit protection, player permissions and no browser errors')
finally:
    server.terminate();server.wait(timeout=10)
