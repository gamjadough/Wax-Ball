"""Local-only heart buff: descriptions, strongest channels, shop stacking, timing, save."""
import os,socket,subprocess,sys,time
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
            page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
            page.goto(base+'/?preview=items')
            try:page.wait_for_load_state('networkidle',timeout=2000)
            except Exception:pass
            page.wait_for_function('WakppuItemGame.read().ready&&WakppuItems.data?.pity===98')
            page.add_style_tag(content='.local-items-preview{display:none}')
            def choose(id):
                if page.locator('#inventoryDetail').is_visible():page.locator('#inventoryBack').click()
                grade=page.evaluate('(id)=>WakppuItemData.list.find(d=>d.id===id).rank',id)
                page.locator('[data-filter="'+grade+'"]').click()
                while not page.locator('[data-item="'+id+'"]').count():page.locator('#inventoryNext').click()
                page.locator('[data-item="'+id+'"]').click()
            page.locator('#inventoryBtn').click()
            for id in ['legendary_golden_coating','legendary_destruction_core','hero_haste_wax','transcendent_wax_heart']:
                choose(id)
                if id=='transcendent_wax_heart':
                    expect(page.locator('#inventoryDetailContent')).to_contain_text('Gold ×6')
                    expect(page.locator('#inventoryDetailContent')).to_contain_text('파괴 모션 속도 ×2.5')
                    expect(page.locator('#inventoryDetailContent')).to_contain_text('재등장 대기시간 −75% / 30분')
                page.locator('[data-use="'+id+'"]').click();page.wait_for_function('!WakppuItems.busy')
            before=page.evaluate('WakppuItems.data')
            expiry=before['effects']['transcendent_wax_heart']['expires_at']
            assert 1790000<expiry-page.evaluate('Date.now()')<=1800000
            winners=page.evaluate('WakppuItemData.effective(WakppuItems.data.effects)')
            for channel,value in [('reward',600),('animation',250),('respawn',400)]:
                assert winners[channel]['value']==value and winners[channel]['id']=='transcendent_wax_heart'
            out=ROOT/'tools/test-results';out.mkdir(exist_ok=True)
            page.screenshot(path=str(out/f'heart-balance-{width}.png'))
            gold_before=int(page.evaluate('WakppuItemGame.read().gold'));spent=0
            page.locator('#itemsClose').click();page.locator('#shopBtn').click()
            if page.locator('#honeyBtn').is_enabled():page.locator('#honeyBtn').click();spent+=30000
            if page.locator('#coatingBtn').is_enabled():page.locator('#coatingBtn').click();spent+=5000000
            page.locator('[data-close="shop"]').click()
            for _ in range(9):page.locator('#ballSvg').click(position={'x':150,'y':150});page.wait_for_timeout(220)
            started=time.monotonic();page.locator('#ballSvg').click(position={'x':150,'y':150})
            page.wait_for_function('(expected)=>WakppuItemGame.read().gold===expected',arg=str(gold_before-spent+36))
            page.wait_for_function('document.querySelectorAll(".shard").length>0')
            duration=page.evaluate('Math.max(...[...document.querySelectorAll(".shard")].flatMap(n=>n.getAnimations().map(a=>a.effect.getTiming().duration)))')
            assert 250<=duration<=360,duration
            page.wait_for_function('!WakppuItemGame.read().busy');elapsed=time.monotonic()-started
            assert 0.55<elapsed<2,elapsed
            after=page.evaluate('WakppuItems.data')
            assert after['effects']['legendary_golden_coating']['remaining']==20
            assert after['effects']['transcendent_wax_heart']['expires_at']==expiry
            assert after['inventory']==before['inventory']
            page.reload();page.wait_for_function('(r)=>WakppuItems.data?.revision===r',arg=after['revision'])
            assert page.evaluate('WakppuItems.data.effects.transcendent_wax_heart.expires_at')==expiry
            assert page.evaluate('WakppuItems.data.inventory')==before['inventory']
            assert not errors,errors
            ctx.close();print(f'PASS {width}px: heart 6/2.5/4, shop x36, break {elapsed:.3f}s, 30-minute deadline/reload, weaker charges retained',flush=True)
        browser.close()
finally:
    server.terminate();server.wait(timeout=10)
