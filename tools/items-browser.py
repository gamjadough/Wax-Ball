"""Local-only end-to-end draws, inventory, effects, persistence and mobile layout."""
import os,socket,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,os.environ.get('WAKPPU_TEST_PYTHON_PATH',str(ROOT/'tools/.test-deps')))
from playwright.sync_api import sync_playwright,expect
with socket.socket() as sock:
    sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
server=subprocess.Popen(['node',str(ROOT/'tools/local-server.mjs')],cwd=ROOT,env=dict(os.environ,WAKPPU_LOCAL_PORT=str(port)),stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,encoding='utf-8')
try:
    assert server.stdout.readline().startswith('Local preview:')
    server.stdout.readline();server.stdout.readline()
    base=f'http://127.0.0.1:{port}'
    with sync_playwright() as p:
        browser=p.chromium.launch(channel='msedge',headless=True)
        context=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
        context.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base) else r.fulfill(status=200,body=''))
        page=context.new_page();errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(base+'/?preview=items');page.wait_for_load_state('domcontentloaded')
        page.wait_for_function('WakppuItemGame.read().ready&&WakppuItems.data?.pity===98')
        item=lambda:page.evaluate('WakppuItems.data')
        assert page.locator('#shopBtn').bounding_box()['x']<page.locator('#drawBtn').bounding_box()['x']
        assert page.locator('#inventoryBtn').bounding_box()['x']<page.locator('#collectionBtn').bounding_box()['x']
        page.locator('#drawBtn').click();expect(page.locator('#itemsPity')).to_contain_text('98 / 100')
        for n,gold in [(1,'95000000000000000000'),(3,'81000000000000000000'),(5,'59000000000000000000')]:
            before=item()['total']
            page.locator('[data-pulls="'+str(n)+'"]').click()
            page.locator('[data-pulls="'+str(n)+'"]').dispatch_event('click')
            page.wait_for_function('!WakppuItems.busy')
            assert item()['gold']==gold,item()
            assert item()['total']==before+n
            assert page.locator('.draw-result').count()==n
        assert sum(item()['inventory'].values())==57
        out=ROOT/'tools/test-results';out.mkdir(exist_ok=True)
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        page.screenshot(path=str(out/'items-draw-mobile.png'))
        page.locator('#itemsClose').click();page.locator('#inventoryBtn').click()
        page.locator('[data-filter="legendary"]').click()
        assert page.locator('.item-card').count()==2
        page.locator('[data-filter="all"]').click()
        for id in ['hero_golden_honey','legendary_golden_coating','common_mini_hammer','hero_explosion_crystal']:
            page.locator('[data-use="'+id+'"]').click();page.wait_for_function('!WakppuItems.busy')
            assert item()['effects'].get(id),item()
        expiry=item()['effects']['hero_golden_honey']['expires_at']
        page.locator('[data-use="hero_golden_honey"]').click();page.wait_for_function('!WakppuItems.busy')
        assert item()['effects']['hero_golden_honey']['expires_at']==expiry+900000
        # Consume the last copy: hide its inventory card but retain the active effect.
        while item()['inventory']['hero_golden_honey']>0:
            page.locator('[data-use="hero_golden_honey"]').click();page.wait_for_function('!WakppuItems.busy')
        expect(page.locator('[data-use="hero_golden_honey"]')).to_have_count(0)
        expect(page.locator('#itemEffects')).to_contain_text('황금')
        assert item()['effects']['hero_golden_honey']['expires_at']>expiry+900000
        page.locator('[data-use="common_honey_small"]').click()
        expect(page.locator('#itemsStatus')).to_contain_text('강한 효과')
        assert 'common_honey_small' not in item()['effects']
        page.screenshot(path=str(out/'items-inventory-mobile.png'),full_page=True)
        page.locator('#itemsClose').click()
        page.locator('#ballSvg').click(position={'x':150,'y':150})
        page.wait_for_function("WakppuItemGame.read().gold==='59000000000000000008'")
        page.wait_for_timeout(1000)
        assert item()['effects']['common_mini_hammer']['remaining']==19
        assert item()['effects']['legendary_golden_coating']['remaining']==19
        prior=item();page.reload();page.wait_for_load_state('domcontentloaded')
        page.wait_for_function('(revision)=>WakppuItems.data?.revision===revision',arg=prior['revision'])
        assert item()['effects']==prior['effects']
        # Ordinary page also retains the same server inventory.
        page.goto(base);page.wait_for_load_state('domcontentloaded')
        page.wait_for_function('WakppuItemGame.read().ready')
        # No demo reset on ordinary URL. Verify a new draw persists over reload.
        page.locator('#drawBtn').click();page.locator('[data-pulls="1"]').click();page.wait_for_function('!WakppuItems.busy')
        snapshot=item();page.reload();page.wait_for_load_state('domcontentloaded')
        page.wait_for_function('(revision)=>WakppuItems.data?.revision===revision',arg=snapshot['revision'])
        assert item()['inventory']==snapshot['inventory'] and item()['pity']==snapshot['pity']
        before_test=item();page.evaluate("WakppuGameTest.run('last','yellow')")
        page.locator('#drawBtn').click();expect(page.locator('[data-pulls=\"1\"]')).to_be_disabled();page.locator('#itemsClose').click()
        page.locator('#ballSvg').click(position={'x':150,'y':150});page.wait_for_timeout(1300)
        assert item()['inventory']==before_test['inventory'] and item()['effects']==before_test['effects']
        page.evaluate('WakppuGameTest.end()')
        page.locator('#rebirthBtn').click();page.locator('#rebirthConfirm').click()
        page.wait_for_timeout(900);page.evaluate('WakppuItems.refresh()')
        page.wait_for_function("Object.keys(WakppuItems.data.effects).length===0")
        assert item()['inventory']==snapshot['inventory'] and item()['pity']==snapshot['pity']
        page.locator('#drawBtn').click();expect(page.locator('[data-pulls=\"1\"]')).to_be_disabled();page.locator('#itemsClose').click()
        page.locator('#inventoryBtn').click();page.set_viewport_size({'width':1200,'height':800})
        page.screenshot(path=str(out/'items-inventory-desktop.png'))
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        # Render sparse and empty snapshots to verify owned-only rank filters and empty messages.
        page.evaluate("WakppuItems.accept({...WakppuItems.data,inventory:{common_mini_hammer:1,hero_golden_honey:0}})")
        expect(page.locator('.item-card')).to_have_count(1)
        expect(page.locator('[data-use="hero_golden_honey"]')).to_have_count(0)
        page.locator('[data-filter="legendary"]').click()
        expect(page.locator('.item-card')).to_have_count(0)
        expect(page.locator('#inventoryList')).to_contain_text('이 등급에 보유한 아이템이 없습니다.')
        page.locator('[data-filter="all"]').click()
        page.evaluate("WakppuItems.accept({...WakppuItems.data,inventory:{common_mini_hammer:0}})")
        expect(page.locator('.item-card')).to_have_count(0)
        expect(page.locator('#inventoryList')).to_contain_text('보유한 아이템이 없습니다.')
        assert not errors,errors
        browser.close();print('PASS mobile draws 1/3/5, repeated click, filter, effects, one-time reward, reload and desktop layout')
finally:
    server.terminate();server.wait(timeout=10)
