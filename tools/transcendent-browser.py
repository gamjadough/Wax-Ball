"""Isolated local unlock, reward, persistence and SVG checks for all ten tiers."""
import os, socket, subprocess, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,str(ROOT/'tools/.test-deps'))
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
        page.goto(base+'/?preview=transcendent');page.wait_for_load_state('networkidle')
        balls=page.evaluate("WAKPPU_BALLS.filter(b=>b.grade==='초월').map(b=>({id:b.id,name:b.name,reward:b.reward,price:String(b.price),clicks:b.clicks}))")
        assert len(balls)==10
        for i,b in enumerate(balls):
            assert b['clicks']==360*2**i
            page.locator('#transcendentPreview').select_option(b['id'])
            page.get_by_role('button',name='해금 테스트',exact=True).click()
            page.locator('#unlockBtn').click()
            expect(page.locator('#ballName')).to_contain_text(b['name'])
            assert page.evaluate("JSON.parse(localStorage.getItem('wax-ball:wakppuball:local-test-save')).gold")=='0'
            page.get_by_role('button',name='마지막 1회 준비',exact=True).click()
            page.locator('#ballSvg').click(position={'x':160,'y':160})
            page.wait_for_function("(reward)=>JSON.parse(localStorage.getItem('wax-ball:wakppuball:local-test-save')).gold===String(reward)",arg=b['reward'])
            # Inspect persistence on the ordinary URL without resetting the preview fixture.
            page.goto(base);page.wait_for_load_state('networkidle')
            expect(page.locator('#ballName')).to_contain_text(b['name'])
            assert page.evaluate("JSON.parse(localStorage.getItem('wax-ball:wakppuball:local-test-save')).gold")==str(b['reward'])
            page.goto(base+'/?preview=transcendent');page.wait_for_load_state('networkidle')
            print('PASS '+b['name'])
        page.evaluate("""() => {
          document.body.innerHTML='<main style="padding:24px;background:#161923;color:#eee;font-family:sans-serif"><h1>초월 왁뿌볼 · 로컬 미리보기</h1><div id="gallery" style="display:grid;grid-template-columns:repeat(5,1fr);gap:20px"></div></main>';
          document.querySelector('#gallery').innerHTML=WAKPPU_BALLS.filter(b=>b.grade==='초월').map(b=>'<article>'+buildBallThumb(b)+'<h2 style="font-size:16px">'+b.name+'</h2><p>'+b.clicks.toLocaleString()+'회 · '+b.reward.toLocaleString()+' G</p></article>').join('');
        }""")
        page.set_viewport_size({'width':1200,'height':760})
        out=ROOT/'tools/test-results';out.mkdir(exist_ok=True)
        page.screenshot(path=str(out/'transcendent-gallery.png'),full_page=True)
        assert not errors,errors
        browser.close()
finally:
    server.terminate();server.wait(timeout=10)
