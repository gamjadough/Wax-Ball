"""Local integration: shared shop, draw persistence and server-season currency slot."""
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
    base=f'http://127.0.0.1:{port}'
    with sync_playwright() as p:
        browser=p.chromium.launch(channel='msedge',headless=True)
        for width in [320,390,1200]:
            context=browser.new_context(viewport={'width':width,'height':900},is_mobile=width<500,has_touch=True)
            context.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base) else r.fulfill(status=200,body=''))
            page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
            page.goto(base+'/?preview=items')
            try:page.wait_for_load_state('networkidle',timeout=2000)
            except Exception:pass # Periodic status polling; readiness asserted explicitly.
            page.wait_for_function('WakppuItems.data?.pity===98&&WakppuLimited.data!==null')
            page.add_style_tag(content='.local-items-preview{display:none}')
            expect(page.locator('#drawBtn')).to_have_count(0)
            expect(page.locator('#halloweenCurrency')).to_be_hidden()
            page.locator('#shopBtn').click()
            expect(page.locator('#shopPurchase')).to_be_visible();expect(page.locator('#shopDraw')).to_be_hidden()
            for id in ['honeyBtn','coatingBtn','hammerBtn']:expect(page.locator('#'+id)).to_be_visible()
            page.locator('#shopDrawTab').click()
            expect(page.locator('#shopDraw')).to_be_visible();expect(page.locator('#shopPurchase')).to_be_hidden()
            expect(page.locator('#itemsModal')).to_be_hidden()
            page.locator('[data-pulls="1"]').click();page.wait_for_function('!WakppuItems.busy&&WakppuDrawReveal.pending')
            before=page.evaluate('WakppuItems.data');page.locator('#drawWaxBall').click()
            page.locator('#shopPurchaseTab').click();page.locator('#shopDrawTab').click()
            assert page.locator('.draw-ball-crack').count()>0
            page.locator('[data-close="shop"]').click();expect(page.locator('#shopBtn')).to_be_focused()
            page.reload();page.wait_for_function('WakppuDrawReveal.pending&&WakppuItems.data!==null')
            page.add_style_tag(content='.local-items-preview{display:none}')
            page.locator('#shopBtn').click();page.locator('#shopDrawTab').click()
            assert page.locator('.draw-ball-crack').count()>0
            assert page.evaluate('WakppuItems.data.inventory')==before['inventory']
            page.locator('#drawSkipAll').click();expect(page.locator('.draw-result')).to_have_count(1)
            expect(page.locator('#shopItemsStatus')).to_contain_text('모두 확인')
            out=ROOT/'tools/test-results';out.mkdir(exist_ok=True)
            page.screenshot(path=str(out/f'shop-draw-{width}.png'))
            page.locator('#shopDrawTab').focus();page.keyboard.press('ArrowLeft')
            expect(page.locator('#shopPurchaseTab')).to_be_focused();expect(page.locator('#shopPurchase')).to_be_visible()
            page.keyboard.press('Escape');expect(page.locator('#shop')).to_be_hidden()
            # Change only isolated local server season; real production schedule is untouched.
            page.evaluate("""async()=>{const s=JSON.parse(sessionStorage.getItem('wakppu-local-session'));await fetch('/local/halloween-demo',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+s.token},body:JSON.stringify({mode:'active'})});await WakppuItemGame.restore();await WakppuLimited.refresh();}""")
            expect(page.locator('#halloweenCurrency')).to_be_visible();expect(page.locator('#halloweenCurrencyValue')).to_have_text('100')
            assert page.evaluate("document.querySelector('#halloweenCurrency').previousElementSibling.classList.contains('gold')&&document.querySelector('#halloweenCurrency').nextElementSibling.id==='shopBtn'")
            page.locator('#collectionBtn').click();page.locator('#limitedCollectionTab').click();page.locator('[data-limited-detail]').click();page.locator('[data-limited-buy]').click();page.wait_for_function('!WakppuLimited.busy')
            expect(page.locator('#halloweenCurrencyValue')).to_have_text('0')
            page.locator('#collectionClose').click()
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
            page.screenshot(path=str(out/f'shop-candy-{width}.png'))
            page.evaluate("""async()=>{const s=JSON.parse(sessionStorage.getItem('wakppu-local-session'));await fetch('/local/halloween-demo',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+s.token},body:JSON.stringify({mode:'ended'})});await WakppuLimited.refresh();}""")
            expect(page.locator('#halloweenCurrency')).to_be_hidden()
            assert page.evaluate('WakppuLimited.data.owned[WakppuLimitedData.ball.id]')
            assert not errors,errors
            context.close();print(f'PASS {width}px: shop purchase/draw, reveal reload, keyboard, server-season candy/purchase/expiry',flush=True)
        browser.close()
finally:
    server.terminate();server.wait(timeout=10)
