"""Regression: inventory reads must preserve pending normal ball rewards."""
import os,socket,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,os.environ.get('WAKPPU_TEST_PYTHON_PATH',str(ROOT/'tools/.test-deps')))
from playwright.sync_api import sync_playwright
with socket.socket() as sock:
    sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
server=subprocess.Popen([sys.argv[1] if len(sys.argv)>1 else 'node',str(ROOT/'tools/local-server.mjs')],cwd=ROOT,env=dict(os.environ,WAKPPU_LOCAL_PORT=str(port)),stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,encoding='utf8')
try:
    assert server.stdout.readline().startswith('Local preview:')
    base=f'http://127.0.0.1:{port}'
    with sync_playwright() as p:
        browser=p.chromium.launch(channel='msedge',headless=True)
        for width in [1200,390]:
            page=browser.new_page(viewport={'width':width,'height':844})
            page.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base) else r.fulfill(status=200,body=''))
            page.goto(base);page.wait_for_load_state('networkidle')
            page.evaluate("async()=>{await WakppuAuth.signIn('guest','');await WakppuItemGame.restore();}")
            page.wait_for_function('WakppuItemGame.read().ready&&WakppuItems.data!==null',timeout=10000)
            for button in ['#drawBtn','#inventoryBtn']:
                before=page.evaluate('WakppuItemGame.read().gold')
                page.locator('#ballSvg').click(position={'x':150,'y':150},click_count=5,delay=80)
                page.wait_for_function('(old)=>WakppuItemGame.read().gold!==old',arg=before,timeout=10000)
                earned=str(int(before)+1)
                assert page.evaluate('WakppuItemGame.read().gold')==earned
                page.locator(button).click();page.wait_for_timeout(150)
                assert page.evaluate('WakppuItemGame.read().gold')==earned
                page.wait_for_timeout(1600)
                server_gold=page.evaluate("async()=>String((await WakppuAuth.invoke('bootstrap')).state.gold)")
                assert server_gold==earned,(width,button,before,earned,server_gold,page.evaluate('WakppuItemGame.read()'))
                page.locator('#itemsClose').click()
            # A stale read that finishes after a transaction must not overwrite it.
            stale=page.evaluate('WakppuItems.data')
            page.evaluate("async(old)=>{const original=WakppuAuth.invoke;let release;WakppuAuth.invoke=(a,b)=>a==='items'?new Promise(r=>release=r):original(a,b);const pending=WakppuItems.refresh();WakppuItems.accept({...old,revision:old.revision+1});release(old);await pending;WakppuAuth.invoke=original;}",stale)
            assert page.evaluate('WakppuItemGame.read().revision')==stale['revision']+1
            page.evaluate('WakppuItemGame.restore()');page.wait_for_timeout(300)
            page.reload();page.wait_for_load_state('networkidle')
            assert page.evaluate('WakppuItemGame.read().gold')==earned
            page.close()
        browser.close()
        print('PASS desktop/mobile: draw and inventory preserve pending rewards, server save, reload and stale read rejection')
finally:
    server.terminate();server.wait(timeout=10)
