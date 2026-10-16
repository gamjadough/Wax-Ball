"""Local sample accounts only: purchase cap, chosen hammer level, persistence and upgrades."""
import os,socket,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,os.environ.get('WAKPPU_TEST_PYTHON_PATH',str(ROOT/'tools/.test-deps')))
from playwright.sync_api import sync_playwright,expect
with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
server=subprocess.Popen(['node',str(ROOT/'tools/local-server.mjs')],cwd=ROOT,env=dict(os.environ,WAKPPU_LOCAL_PORT=str(port),WAKPPU_LOCAL_SLEEP_TIME='2026-10-16T03:00:00Z'),stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,encoding='utf-8')
try:
    assert server.stdout.readline().startswith('Local preview:');server.stdout.readline();password=server.stdout.readline().strip().split(': ',1)[1]
    base=f'http://127.0.0.1:{port}'
    with sync_playwright() as p:
        browser=p.chromium.launch(channel='msedge',headless=True)
        for mobile in [False,True]:
            ctx=browser.new_context(viewport={'width':390 if mobile else 1100,'height':844},is_mobile=mobile,has_touch=mobile)
            ctx.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base) else r.fulfill(status=200,body=''))
            page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
            page.goto(base+'/');page.wait_for_function('!!window.WakppuAuth')
            assert page.evaluate('(password)=>WakppuAuth.signIn("dodoonglee@gmail.com",password).then(r=>!r.error)',password)
            page.evaluate('WakppuAuth.invoke("admin_gold",{user_id:"local-admin",mode:"set",value:"1000000000000000000000000000000"})')
            page.reload();page.wait_for_function('WakppuItems.data&&WakppuItemGame.read().ready')
            page.locator('#shopBtn').click();page.locator('#shopPurchaseTab').click();selector=page.locator('#hammerLevelSelect')
            if not mobile:
                expect(selector).to_be_disabled()
                for _ in range(5):page.locator('#hammerBtn').click()
            else:
                # The local administrator is shared by both viewports; the first pass bought seven levels.
                expect(selector).to_be_enabled()
            max_level=page.evaluate('(async()=>{await WakppuItemGame.flush();return (await WakppuAuth.invoke("bootstrap")).state.hammer_level})()')
            assert selector.locator('option').count()==max_level+1
            before=page.evaluate('WakppuItemGame.read().gold');selector.select_option('1');page.wait_for_function('!WakppuItemGame.read().busy')
            expect(selector).to_have_value('1');expect(page.locator('#hammerInfo')).to_contain_text('사용: Lv.1');expect(page.locator('#hammerInfo')).to_contain_text('균열 증가: +3')
            assert page.evaluate('WakppuItemGame.read().gold')==before
            saved=page.evaluate('WakppuAuth.invoke("bootstrap").then(r=>r.state)');assert saved['hammer_level']==max_level;assert saved['hammer_selected_level']==1
            page.locator('#hammerBtn').click();expect(page.locator('#hammerInfo')).to_contain_text('사용: Lv.1')
            selector.select_option('auto');page.wait_for_function('!WakppuItemGame.read().busy');page.locator('#hammerBtn').click()
            expect(page.locator('#hammerInfo')).to_contain_text('사용: Lv.'+str(max_level+2))
            selector.select_option('1');page.wait_for_function('!WakppuItemGame.read().busy')
            selector.scroll_into_view_if_needed();a=page.locator('#hammerBtn').bounding_box();b=selector.bounding_box();assert b['x']>a['x']+a['width'];assert abs((a['y']+a['height'])-(b['y']+b['height']))<2
            page.screenshot(path=str(ROOT/'tools/test-results'/('hammer-selection-mobile.png' if mobile else 'hammer-selection-desktop.png')))
            page.reload();page.wait_for_function('WakppuItems.data&&WakppuItemGame.read().ready');page.locator('#shopBtn').click();page.locator('#shopPurchaseTab').click();expect(selector).to_have_value('1')
            page.locator('[data-close="shop"]').click()
            page.locator('#ballSvg').click(position={'x':150,'y':150})
            saved=page.evaluate('(async()=>{await WakppuItemGame.flush();return (await WakppuAuth.invoke("bootstrap")).state})()')
            assert saved['current_clicks']==3,saved
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');assert not errors,errors;ctx.close()
            # Reset only local hit progress for the next viewport.
            if not mobile:
                cleanup=browser.new_context();cp=cleanup.new_page();cp.goto(base+'/');cp.wait_for_function('!!window.WakppuAuth');cp.evaluate('(password)=>WakppuAuth.signIn("dodoonglee@gmail.com",password)',password)
                cp.evaluate('(async()=>{const r=await WakppuAuth.invoke("bootstrap");const i=await WakppuAuth.invoke("items");await WakppuAuth.invoke("save_progress",{...r.state,current_clicks:0,item_revision:i.revision})})()');cleanup.close()
        browser.close();print('PASS desktop/mobile: ownership cap, lower-level damage, free selection, manual/auto upgrades, reload, no overflow or JS errors')
finally:
    server.terminate();server.wait(timeout=10)
