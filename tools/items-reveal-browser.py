"""Isolated local mobile touch tests: reveal queue, reload, skips, 30-item use and haste."""
import os,socket,subprocess,sys,json
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,os.environ.get('WAKPPU_TEST_PYTHON_PATH',str(ROOT/'tools/.test-deps')))
from playwright.sync_api import sync_playwright,expect
with socket.socket() as sock:
    sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
server=subprocess.Popen(['node',str(ROOT/'tools/local-server.mjs')],cwd=ROOT,env=dict(os.environ,WAKPPU_LOCAL_PORT=str(port)),stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,encoding='utf-8')
try:
    assert server.stdout.readline().startswith('Local preview:')
    base=f'http://127.0.0.1:{port}'
    with sync_playwright() as p:
        browser=p.chromium.launch(channel='msedge',headless=True)
        for width,height in [(360,740),(390,844),(430,932),(1200,900)]:
            context=browser.new_context(viewport={'width':width,'height':height},is_mobile=width<500,has_touch=True)
            context.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base) else r.fulfill(status=200,body=''))
            page=context.new_page();errors=[]
            page.on('pageerror',lambda e:errors.append(str(e)))
            page.goto(base+'/?preview=items');page.wait_for_load_state('domcontentloaded')
            try:page.wait_for_load_state('networkidle',timeout=2000)
            except Exception:pass # The game polls status continuously.
            page.wait_for_function('WakppuItemGame.read().ready&&WakppuItems.data?.pity===98')
            def reset():
                if page.locator('#itemsModal').is_visible():page.locator('#itemsClose').tap()
                page.locator('.local-items-preview button').first.tap()
                page.wait_for_function('!document.querySelector(".local-items-preview button").disabled&&Object.keys(WakppuItems.data.effects).length===0')
            reset()
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
            page.locator('#drawBtn').tap();expect(page.locator('#drawPanel')).to_contain_text('0.1%')
            expect(page.locator('.local-items-preview')).to_be_hidden()
            page.locator('[data-pulls="5"]').tap();page.locator('[data-pulls="5"]').dispatch_event('click')
            page.wait_for_function('!WakppuItems.busy&&WakppuDrawReveal.pending')
            prior=page.evaluate('WakppuItems.data');assert prior['gold']=='78000000000000000000' and prior['total']==103
            assert sum(prior['inventory'].values())==95
            assert page.locator('#drawResults .draw-result').count()==0
            expect(page.locator('[data-pulls="1"]')).to_be_disabled()
            page.locator('#drawWaxBall').tap()
            page.locator('#itemsClose').tap();page.locator('#drawBtn').tap()
            expect(page.locator('.draw-progress')).to_contain_text('1 / 5')
            page.reload();page.wait_for_function('WakppuItemGame.read().ready&&WakppuDrawReveal.pending')
            page.locator('#drawBtn').tap();assert page.locator('.draw-ball-crack').count()>0
            assert page.evaluate('WakppuItems.data.inventory')==prior['inventory']
            page.locator('#drawSkipOne').tap();expect(page.locator('#drawNext')).to_be_visible()
            page.locator('#drawNext').tap();expect(page.locator('.draw-progress')).to_contain_text('2 / 5')
            page.locator('#drawSkipAll').tap();expect(page.locator('#drawResults .draw-result')).to_have_count(5)
            assert page.evaluate('WakppuItems.data.gold')==prior['gold'] and page.evaluate('WakppuItems.data.total')==103
            # Deterministic presentation preview exercises every rarity with server-free sample results.
            page.locator('#itemsClose').tap();page.locator('.local-items-preview button').nth(1).tap()
            for index,steps in enumerate([2,3,4,5,6]):
                for hit in range(steps):
                    assert page.locator('#drawWaxBall').is_visible()
                    page.locator('#drawWaxBall').tap()
                    if hit<steps-1:assert page.locator('#drawNext').count()==0
                expect(page.locator('#drawNext')).to_be_visible()
                if index==4:
                    page.wait_for_timeout(950) # Let the heart reveal settle for visual QA.
                    page.screenshot(path=str(ROOT/f'tools/test-results/items30-heart-{width}.png'))
                page.locator('#drawNext').tap()
            expect(page.locator('#drawResults .draw-result')).to_have_count(5)
            assert not page.evaluate('WakppuDrawReveal.pending')
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
            # Use all 30 definitions independently, preserving the real UI suppression rule.
            defs=page.evaluate('WakppuItemData.list')
            def select_item(id):
                if page.locator('#inventoryDetail').is_visible():page.locator('#inventoryBack').tap()
                grade=next(d['rank'] for d in defs if d['id']==id)
                page.locator('[data-filter="'+grade+'"]').tap()
                while page.locator('[data-item="'+id+'"]').count()==0:page.locator('#inventoryNext').tap()
                page.locator('[data-item="'+id+'"]').tap()
            for d in defs if width==390 else [d for d in defs if d['id'] in ['common_wax_feather','hero_haste_wax','transcendent_wax_heart']]:
                reset();page.locator('#inventoryBtn').tap();page.locator('[data-filter="all"]').tap()
                select_item(d['id'])
                page.locator('[data-use="'+d['id']+'"]').tap();page.wait_for_function('!WakppuItems.busy')
                data=page.evaluate('WakppuItems.data');assert data['inventory'][d['id']]==2 and d['id'] in data['effects'],data
            # Strong damage must not suppress the separate haste-animation benefit.
            reset();page.locator('#inventoryBtn').tap()
            for id in ['legendary_destruction_core','hero_haste_wax']:
                select_item(id)
                page.locator('[data-use="'+id+'"]').tap();page.wait_for_function('!WakppuItems.busy')
            effective=page.evaluate('WakppuItemData.effective(WakppuItems.data.effects)')
            assert effective['damage']['value']==300 and effective['animation']['value']==150
            page.locator('#itemsClose').tap();page.locator('#ballSvg').tap(position={'x':150,'y':150})
            page.wait_for_function('!WakppuItemGame.read().busy')
            page.locator('#ballSvg').tap(position={'x':150,'y':150})
            page.wait_for_function('!!document.querySelector(".shard")')
            duration=page.evaluate('Math.max(...[...document.querySelectorAll(".shard")].flatMap(n=>n.getAnimations().map(a=>a.effect.getTiming().duration)))')
            assert 430<=duration<=600,duration
            # Reduced-motion path still allows touch reveal and completion without a timed animation.
            page.wait_for_function('!WakppuItemGame.read().busy');page.emulate_media(reduced_motion='reduce')
            page.locator('.local-items-preview button').nth(1).tap();page.locator('#drawSkipAll').tap()
            assert not errors,errors
            print(f'PASS {width}: actual 5-pull atomic grant, duplicate rejection, touch cracks 2/3/4/5/6, close/reload resume, single/all skip, inventory, haste animation {duration:.0f}ms, reduced motion',flush=True)
            context.close()
        browser.close()
finally:
    server.terminate();server.wait(timeout=10)
