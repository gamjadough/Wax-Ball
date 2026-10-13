"""Regression: an old retried item response must never restore consumed stock."""
import os,socket,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,os.environ.get('WAKPPU_TEST_PYTHON_PATH',str(ROOT/'tools/.test-deps')))
from playwright.sync_api import sync_playwright,expect
with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
server=subprocess.Popen(['node',str(ROOT/'tools/local-server.mjs')],cwd=ROOT,env=dict(os.environ,WAKPPU_LOCAL_PORT=str(port)),stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,encoding='utf8')
try:
    assert server.stdout.readline().startswith('Local preview:')
    base=f'http://127.0.0.1:{port}'
    with sync_playwright() as p:
        browser=p.chromium.launch(channel='msedge',headless=True)
        for width in [390,1200]:
            ctx=browser.new_context(viewport={'width':width,'height':900},is_mobile=width<500,has_touch=True)
            ctx.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base) else r.fulfill(status=200,body=''))
            page=ctx.new_page();errors=[];requests=[]
            page.on('pageerror',lambda e:errors.append(str(e)))
            def capture(req):
                if req.url.endswith('/local/api') and req.method=='POST':
                    b=req.post_data_json
                    if b.get('action')=='item_use':requests.append(b)
            page.on('request',capture)
            page.goto(base+'/?preview=items')
            try:page.wait_for_load_state('networkidle',timeout=2000)
            except Exception:pass
            page.wait_for_function('WakppuItemGame.read().ready&&WakppuItems.data?.pity===98')
            page.add_style_tag(content='.local-items-preview{display:none}')
            item='hero_golden_honey'
            page.locator('#inventoryBtn').click();page.locator('[data-filter="hero"]').click();page.locator('[data-item="'+item+'"]').click()
            for count in [2,1]:
                page.locator('[data-use="'+item+'"]').click();page.wait_for_function('!WakppuItems.busy')
                assert page.evaluate('(id)=>WakppuItems.data.inventory[id]',item)==count
            before=page.evaluate('WakppuItems.data')
            page.locator('#itemsClose').click();page.locator('#rebirthBtn').click();page.locator('#rebirthConfirm').click()
            page.wait_for_timeout(900);page.evaluate('WakppuItems.refresh()')
            page.wait_for_function('Object.keys(WakppuItems.data.effects).length===0')
            assert page.evaluate('(id)=>WakppuItems.data.inventory[id]',item)==1
            # Real idempotent retry returns a historic snapshot, not current stock.
            stale=page.evaluate('(b)=>WakppuAuth.invoke(b.action,b)',requests[0])
            assert stale['inventory'][item]==2 and stale['revision']<before['revision']
            saved=page.evaluate("()=>WakppuAuth.invoke('items')")
            assert saved['inventory'][item]==1 and saved['effects']=={}
            page.evaluate('(r)=>WakppuItems.accept(r)',stale)
            shown=page.evaluate('(id)=>WakppuItems.data.inventory[id]',item)
            assert shown==1,('STALE RESPONSE RESTORED USED ITEM: server=1, UI='+str(shown))
            assert page.evaluate('Object.keys(WakppuItems.data.effects).length')==0
            assert page.evaluate('WakppuItemGame.read().gold')=='0'
            # Even the latest pre-rebirth transaction must not restore expired effects/Gold.
            latest_old=page.evaluate('(b)=>WakppuAuth.invoke(b.action,b)',requests[1])
            assert latest_old['revision']==before['revision']
            assert page.evaluate('(r)=>WakppuItems.accept(r)',latest_old) is False
            assert page.evaluate('WakppuItemGame.read().gold')=='0'
            assert page.evaluate('Object.keys(WakppuItems.data.effects).length')==0
            # A legitimately fresh draw snapshot may increase inventory; do not clamp counts.
            fresh=page.evaluate("()=>WakppuAuth.invoke('items')")
            assert fresh['inventory']==before['inventory'] and fresh['pity']==before['pity']
            page.reload();page.wait_for_function('WakppuItems.data!==null&&WakppuItemGame.read().ready')
            assert page.evaluate('(id)=>WakppuItems.data.inventory[id]',item)==1
            page.locator('#inventoryBtn').click();page.locator('[data-filter="hero"]').click();page.locator('[data-item="'+item+'"]').click()
            page.locator('[data-use="'+item+'"]').click();page.wait_for_function('!WakppuItems.busy')
            expect(page.locator('[data-item="'+item+'"]')).to_have_count(0)
            assert page.evaluate('(id)=>WakppuItems.data.inventory[id]',item)==0
            page.evaluate('(r)=>WakppuItems.accept(r)',stale)
            assert page.evaluate('(id)=>WakppuItems.data.inventory[id]',item)==0
            out=ROOT/'tools/test-results';out.mkdir(exist_ok=True)
            page.screenshot(path=str(out/f'items-rebirth-{width}.png'))
            assert not errors,errors
            ctx.close();print(f'PASS {width}px: 3→2→1→rebirth→1→reload→1→use→0; historic retry rejected',flush=True)
        browser.close()
finally:
    server.terminate();server.wait(timeout=10)
