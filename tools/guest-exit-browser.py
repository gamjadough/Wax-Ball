"""Guest deletion/switch UI on the actual game, using isolated opt-in fixtures."""
import os,socket,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,os.environ.get('WAKPPU_TEST_PYTHON_PATH',str(ROOT/'tools/.test-deps')))
from playwright.sync_api import sync_playwright,expect
with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
server=subprocess.Popen(['node',str(ROOT/'tools/local-server.mjs')],cwd=ROOT,env=dict(os.environ,WAKPPU_LOCAL_PORT=str(port),WAKPPU_LOCAL_GUEST_EXIT_TEST='1',WAKPPU_LOCAL_SLEEP_TIME='2026-10-21T10:00:00Z'),stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,encoding='utf-8')
try:
    assert server.stdout.readline().startswith('Local preview:');server.stdout.readline();server.stdout.readline()
    base=f'http://127.0.0.1:{port}'
    with sync_playwright() as p:
        browser=p.chromium.launch(channel='msedge',headless=True)
        for width,height in [(1200,900),(390,844),(320,640),(844,390)]:
            ctx=browser.new_context(viewport={'width':width,'height':height},is_mobile=width<1000,has_touch=width<1000)
            ctx.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base) else r.fulfill(status=200,body=''))
            page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
            page.goto(base+'/',wait_until='domcontentloaded');page.wait_for_function('!!window.WakppuAuth&&!!window.WakppuItemGame')
            page.evaluate('WakppuAuth.signIn("guest","")');page.reload();page.wait_for_function('WakppuItemGame.read().ready')
            fixture=page.evaluate('''async()=>{const s=JSON.parse(sessionStorage.getItem('wakppu-local-session'));return (await fetch('/local/guest-exit-fixture',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+s.token},body:'{}'})).json();}''')
            guest=page.evaluate('JSON.parse(sessionStorage.getItem("wakppu-local-session"))')
            page.locator('#accountBtn').click();expect(page.locator('#signOutBtn')).to_be_visible();page.locator('#signOutBtn').click();expect(page.locator('#guestExitWarning')).to_contain_text('파기(영구 삭제)');page.locator('#guestExitCancel').click()
            assert page.evaluate('WakppuItemGame.read().account')==guest['user']['id']
            page.locator('#linkEmailInput').fill(fixture['email']);page.locator('#linkEmailBtn').click();expect(page.locator('#guestExitDialog')).to_be_visible();expect(page.locator('#guestExitEmail')).to_have_text(fixture['email'])
            page.locator('#guestExitPassword').fill('wrong-password');page.locator('#guestExitConfirm').click();expect(page.locator('#guestExitStatus')).to_contain_text('비밀번호')
            assert page.evaluate('WakppuItemGame.read().account')==guest['user']['id'];assert page.evaluate('JSON.parse(sessionStorage.getItem("wakppu-local-session")).token')==guest['token']
            page.locator('#guestExitPassword').fill(fixture['password'])
            # Server failure must not adopt the target session or erase current progress.
            page.evaluate('''async()=>{const s=JSON.parse(sessionStorage.getItem('wakppu-local-session'));await fetch('/local/guest-exit-fixture',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+s.token},body:'{"fail":true}'});}''')
            page.locator('#guestExitConfirm').click();expect(page.locator('#guestExitStatus')).to_contain_text('삭제 실패');assert page.evaluate('WakppuItemGame.read().account')==guest['user']['id']
            page.evaluate('''async()=>{const s=JSON.parse(sessionStorage.getItem('wakppu-local-session'));await fetch('/local/guest-exit-fixture',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+s.token},body:'{}'});}''')
            page.locator('#guestExitPassword').fill(fixture['password']);page.screenshot(path=str(ROOT/f'tools/test-results/guest-switch-{width}.png'))
            assert page.locator('#guestExitConfirm').bounding_box()['height']>=44
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
            page.locator('#guestExitConfirm').click();page.wait_for_function('(id)=>WakppuItemGame.read().ready&&WakppuItemGame.read().account===id',arg=fixture['id'])
            assert page.evaluate('WakppuItemGame.read().gold')==fixture['gold']
            assert page.request.post(base+'/local/current',headers={'Authorization':'Bearer '+guest['token']},data={}).status==401
            page.reload();page.wait_for_function('WakppuItemGame.read().ready');assert page.evaluate('WakppuItemGame.read().gold')==fixture['gold']
            # Registered users retain normal logout and their server account.
            page.locator('#accountBtn').click();page.locator('#signOutBtn').click();page.wait_for_function('!WakppuItemGame.read().account');expect(page.locator('#guestExitDialog')).to_be_hidden()
            page.locator('#accountBtn').click();page.locator('#guestNicknameInput').fill('새빠른시작');page.locator('#guestStartBtn').click();page.wait_for_function('WakppuItemGame.read().ready')
            fresh=page.evaluate('JSON.parse(sessionStorage.getItem("wakppu-local-session"))')
            page.locator('#accountBtn').click();page.locator('#signOutBtn').click();page.locator('#guestExitConfirm').click();page.wait_for_function('!WakppuItemGame.read().account');assert page.evaluate('WakppuItemGame.read().gold')=='0'
            assert page.request.post(base+'/local/current',headers={'Authorization':'Bearer '+fresh['token']},data={}).status==401
            page.reload();page.wait_for_function('!!window.WakppuItemGame');assert page.evaluate('WakppuItemGame.read().account') is None
            assert not errors,errors;ctx.close();print(f'PASS {width}x{height}: cancel, password failure, server rollback, switch/no merge/reload, ordinary logout and guest deletion',flush=True)
        browser.close()
finally:
    server.terminate();server.wait(timeout=10)
