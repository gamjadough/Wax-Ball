"""Actual game shop -> candy exchange -> inventory equip -> gameplay, not prototype."""
import os,socket,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,os.environ.get('WAKPPU_TEST_PYTHON_PATH',str(ROOT/'tools/.test-deps')))
from playwright.sync_api import sync_playwright,expect
with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
server=subprocess.Popen(['node',str(ROOT/'tools/local-server.mjs')],cwd=ROOT,env=dict(os.environ,WAKPPU_LOCAL_PORT=str(port),WAKPPU_LOCAL_PUMPKIN_SKINS_PREVIEW='1',WAKPPU_LOCAL_SLEEP_TIME='2026-10-20T10:00:00Z'),stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,encoding='utf-8')
try:
    assert server.stdout.readline().startswith('Local preview:');server.stdout.readline();password=server.stdout.readline().strip().split(': ',1)[1]
    base=f'http://127.0.0.1:{port}'
    with sync_playwright() as p:
        browser=p.chromium.launch(channel='msedge',headless=True)
        for width,height,reduced in [(1200,900,False),(390,844,False),(320,640,False),(844,390,False),(390,844,True)]:
            ctx=browser.new_context(viewport={'width':width,'height':height},is_mobile=width<1000,has_touch=width<1000,reduced_motion='reduce' if reduced else 'no-preference')
            ctx.add_init_script("document.addEventListener('DOMContentLoaded',()=>{const s=document.createElement('style');s.textContent='.halloween-local{display:none!important}';document.head.append(s);});window.skinAudio=[];const play=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){skinAudio.push(this.src);return play.call(this);};")
            ctx.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base) else r.fulfill(status=200,body=''))
            page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('dialog',lambda d:d.accept())
            page.goto(base+'/?preview=halloween',wait_until='domcontentloaded');page.wait_for_function('WakppuLimited.data?.tokens===450&&WakppuItemGame.read().ready');page.evaluate('WakppuPumpkinInventory.refresh()');page.wait_for_function('WakppuPumpkinInventory.data?.tokens==="450"')
            page.evaluate("window.scareThemes=[];const start=WakppuHalloweenEffects.startScare;WakppuHalloweenEffects.startScare=o=>{scareThemes.push(o.theme||'base');return start({...o,random:()=>0});};")
            print('READY '+str(width),flush=True)
            page.locator('#shopBtn').click();page.locator('#shopHalloweenTab').click()
            expect(page.locator('#shopHalloween .pumpkin-skin-cards .skin-card')).to_have_count(3)
            for skin,balance in [('wisp','400'),('ghost','300'),('eclipse','100')]:
                button=page.locator('#shopHalloween [data-pumpkin-exchange="pumpkin_'+skin+'"]');expect(button).to_be_enabled();assert button.bounding_box()['height']>=44;button.click()
                page.wait_for_function('(n)=>!WakppuPumpkinInventory.busy&&WakppuPumpkinInventory.data.tokens===n',arg=balance)
            page.screenshot(path=str(ROOT/f'tools/test-results/pumpkin-shop-{width}.png'))
            page.locator('[data-close="shop"]').click();page.locator('#collectionBtn').click();page.locator('#limitedCollectionTab').click();page.locator('[data-limited-detail]').click();page.locator('[data-limited-buy]').click();page.wait_for_function('!WakppuLimited.busy&&WakppuLimited.data.tokens===0');page.locator('[data-limited-select]').click()
            for skin in ['wisp','ghost','eclipse']:
                page.locator('#inventoryBtn').click();page.locator('#inventorySkinsTab').click()
                button=page.locator('#inventorySkinsPage [data-pumpkin-equip="pumpkin_'+skin+'"]');expect(button).to_be_enabled();assert button.bounding_box()['height']>=44;button.click()
                page.wait_for_function('(id)=>!WakppuPumpkinInventory.busy&&WakppuPumpkinInventory.equipped()===id',arg=skin)
                expect(page.locator('#ballSvg [data-pumpkin-skin="'+skin+'"]')).to_have_count(1)
                page.screenshot(path=str(ROOT/f'tools/test-results/pumpkin-inventory-{width}.png'))
                page.locator('#itemsClose').click()
                page.locator('#shopBtn').click();page.locator('#shopPurchaseTab').click();page.locator('#hammerLevelSelect').select_option('9');page.wait_for_function('!WakppuItemGame.read().busy');page.locator('[data-close="shop"]').click()
                gold=int(page.evaluate('WakppuItemGame.read().gold'))
                page.locator('#ballSvg').click();page.wait_for_function('WakppuLimited.data?.clicks===90&&!WakppuItemGame.read().busy')
                assert int(page.evaluate('WakppuItemGame.read().gold'))==gold
                if skin!='wisp':expect(page.locator('#ballSvg [data-pumpkin-seam="'+skin+'"]')).not_to_have_count(0)
                page.locator('#shopBtn').click();page.locator('#hammerLevelSelect').select_option('auto');page.wait_for_function('!WakppuItemGame.read().busy');page.locator('[data-close="shop"]').click()
                page.locator('#ballSvg').click();page.wait_for_function('(g)=>BigInt(WakppuItemGame.read().gold)===BigInt(g)+1500000000n',arg=str(gold))
                page.wait_for_timeout(2500);assert page.evaluate('(id)=>scareThemes.includes(id)',skin);assert int(page.evaluate('WakppuItemGame.read().gold'))==gold+1500000000
                page.wait_for_function('(name)=>skinAudio.some(x=>x.endsWith(name))',arg=f'{skin}-final.wav')
                assert page.locator('.pumpkin-shard,.eclipse-shell-sector,.eclipse-umbra,.eclipse-corona').count()==0
                assert page.evaluate('''()=>{const ids=[...document.querySelectorAll('svg [id]')].map(n=>n.id);return new Set(ids).size===ids.length;}''')
                assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
            page.reload();page.wait_for_function('WakppuPumpkinInventory.equipped()==="eclipse"&&WakppuLimited.data?.selected===WakppuLimitedData.ball.id')
            expect(page.locator('#ballSvg [data-pumpkin-skin="eclipse"]')).to_have_count(1)
            page.screenshot(path=str(ROOT/f'tools/test-results/pumpkin-game-{width}.png'))
            page.locator('#rebirthBtn').click();page.locator('#rebirthConfirm').click();page.wait_for_timeout(800);page.evaluate('WakppuPumpkinInventory.refresh()');assert page.evaluate('WakppuPumpkinInventory.data.owned.pumpkin_eclipse')
            page.evaluate('''async()=>{const s=JSON.parse(sessionStorage.getItem('wakppu-local-session'));await fetch('/local/halloween-demo',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+s.token},body:JSON.stringify({mode:'ended'})});await WakppuPumpkinInventory.refresh();}''')
            page.locator('#inventoryBtn').click();page.locator('#inventorySkinsTab').click();page.locator('#inventorySkinsPage [data-pumpkin-equip="pumpkin_wisp"]').click();page.wait_for_function('!WakppuPumpkinInventory.busy&&WakppuPumpkinInventory.equipped()==="wisp"');page.locator('#pumpkinSkinUnequip').click();page.wait_for_function('!WakppuPumpkinInventory.busy&&!WakppuPumpkinInventory.equipped()')
            assert not errors,errors;ctx.close();print(f'PASS live shop/equip/reload/rebirth/expiry/layout {width}x{height} reduced={reduced}',flush=True)
        ctx=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
        ctx.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base) else r.fulfill(status=200,body=''))
        page=ctx.new_page();page.goto(base+'/',wait_until='domcontentloaded');page.evaluate('(password)=>WakppuAuth.signIn("dodoonglee@gmail.com",password)',password);page.reload();page.wait_for_function('WakppuPumpkinInventory.data?.admin_content_access&&WakppuLimited.data?.admin_access')
        assert page.evaluate('WakppuPumpkinInventory.data.active')==False
        assert page.evaluate('WakppuPumpkinInventory.data.tokens')=='0'
        page.locator('#inventoryBtn').click();page.locator('#inventorySkinsTab').click();expect(page.locator('#inventorySkinsPage [data-pumpkin-equip]')).to_have_count(3)
        page.locator('#inventorySkinsPage [data-pumpkin-equip="pumpkin_eclipse"]').click();page.wait_for_function('!WakppuPumpkinInventory.busy&&WakppuPumpkinInventory.equipped()==="eclipse"')
        assert page.evaluate('WakppuPumpkinInventory.data.tokens')=='0';ctx.close();browser.close();print('PASS authenticated admin free equipment out of season; no candy charged',flush=True)
finally:
    server.terminate();server.wait(timeout=10)
