"""Local-only desktop/mobile rebirth, exact Gold persistence and cap checks."""
import os,socket,subprocess,sys
print('Loading Playwright', flush=True)
from pathlib import Path
sys.path.insert(0, sys.argv[1] if len(sys.argv)>1 else str(Path(__file__).resolve().parent / '.test-deps'))
from playwright.sync_api import sync_playwright, expect

ROOT=Path(__file__).resolve().parent.parent
with socket.socket() as sock:
    sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
server=subprocess.Popen(['node',str(ROOT/'tools/local-server.mjs')],cwd=ROOT,env=dict(os.environ,WAKPPU_LOCAL_PORT=str(port)),stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,encoding='utf-8')
assert server.stdout.readline().startswith('Local preview:')
import atexit
def stop_server():
    server.terminate();server.wait(timeout=10)
atexit.register(stop_server)
base=f'http://127.0.0.1:{port}'
out=ROOT/'tools/test-results';out.mkdir(exist_ok=True)
def ready(page):
    page.wait_for_load_state('domcontentloaded')
    try:page.wait_for_load_state('networkidle',timeout=2000)
    except Exception:pass # Status polling can keep the network busy.
    page.wait_for_selector('aside[data-ready="true"]')
def saved(response,count):
    if not response.url.endswith('/local/api') or response.request.method!='POST':return False
    body=response.request.post_data_json
    return body.get('action')=='save_progress' and body.get('rebirths')==count

with sync_playwright() as p:
    print('Launching browser', flush=True)
    browser = p.chromium.launch(headless=True, channel='msedge')
    for width, height in [(1280, 900), (390, 844)]:
        page = browser.new_page(viewport={'width': width, 'height': height})
        page.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base) else r.fulfill(status=200,body=''))
        page.set_default_timeout(15000)
        print('Opening local preview', width, flush=True)
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto(base+'/?preview=rebirth500')
        ready(page)
        expect(page.locator('#rebirthBtn')).to_contain_text('999회')
        expect(page.locator('#rebirthBtn')).to_be_enabled()
        before = page.evaluate('async()=> (await WakppuAuth.invoke("bootstrap")).state.gold')
        assert len(str(before)) == 396
        print(width, '1000th cost:', page.locator('#goldValue').inner_text())
        page.locator('#rebirthBtn').click()
        last_cost_text=page.evaluate('WakppuGold.compact(REBIRTH_COSTS[999])')
        expect(page.locator('#rebirthText')).to_contain_text(last_cost_text)
        with page.expect_response(lambda r:saved(r,1000)) as save_result:
            page.locator('#rebirthConfirm').click()
        assert save_result.value.ok
        print('After confirmation:', page.locator('#rebirthBtn').inner_text(), 'errors:', errors, flush=True)
        expect(page.locator('#rebirthBtn')).to_contain_text('1000회')
        expect(page.locator('#goldValue')).to_have_text('0')
        expect(page.locator('#rebirthBtn')).to_be_disabled()
        assert page.evaluate('async()=> (await WakppuAuth.invoke("bootstrap")).state.rebirths') == 1000
        page.reload()
        ready(page)
        expect(page.locator('#rebirthBtn')).to_contain_text('1000회')
        expect(page.locator('#goldValue')).to_have_text('0')
        result = page.evaluate('''async()=>{
          const user=(await WakppuAuth.session()).data.session.user;
          const gold='9'.repeat(4096);
          await WakppuAuth.invoke('admin_gold',{user_id:user.id,mode:'set',value:gold});
          await WakppuGameTest.restoreAccount();
          return (await WakppuAuth.invoke('bootstrap')).state.gold===gold;
        }''')
        assert result
        expect(page.locator('#goldValue')).to_have_text('1e4096')
        page.reload()
        ready(page)
        expect(page.locator('#goldValue')).to_have_text('1e4096')
        assert not errors, errors
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        page.screenshot(path=str(out/f'rebirth-500-{width}.png'))
        for count in [499,500,501]:
            page.evaluate("""async count=>{
              const user=(await WakppuAuth.session()).data.session.user;
              await WakppuAuth.invoke('admin_rebirths',{user_id:user.id,mode:'set',value:String(count)});
              await WakppuAuth.invoke('admin_gold',{user_id:user.id,mode:'set',value:String(REBIRTH_COSTS[count]-1n)});
              await WakppuGameTest.restoreAccount();
            }""",count)
            expect(page.locator('#rebirthBtn')).to_be_disabled()
            page.evaluate("""async count=>{
              const user=(await WakppuAuth.session()).data.session.user;
              await WakppuAuth.invoke('admin_gold',{user_id:user.id,mode:'set',value:String(REBIRTH_COSTS[count])});
              await WakppuGameTest.restoreAccount();
            }""",count)
            expect(page.locator('#rebirthBtn')).to_be_enabled()
            page.locator('#rebirthBtn').click()
            expected=page.evaluate('(count)=>WakppuGold.compact(REBIRTH_COSTS[count])',count)
            expect(page.locator('#rebirthText')).to_contain_text(expected)
            if count==500:page.screenshot(path=str(out/f'rebirth501-{width}.png'))
            with page.expect_response(lambda r:saved(r,count+1)) as save_result:
                page.locator('#rebirthConfirm').click()
            assert save_result.value.ok
            expect(page.locator('#rebirthBtn')).to_contain_text(str(count+1)+'회')
            expect(page.locator('#goldValue')).to_have_text('0')
            assert page.evaluate('async()=> (await WakppuAuth.invoke("bootstrap")).state.rebirths')==count+1
            page.reload()
            ready(page)
            expect(page.locator('#rebirthBtn')).to_contain_text(str(count+1)+'회')
        assert not errors,errors
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        print(width,'PASS: cost-1 disabled, exact cost enabled, 499/500/501 transitions and reload')
        print(width, 'PASS: 999→1000, reload, exact 4096-digit Gold, no JS errors/overflow')
        page.close()
    browser.close()
