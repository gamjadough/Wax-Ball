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
        out=ROOT/'tools/test-results';out.mkdir(exist_ok=True)
        captures=[]
        for reduced in [False,True]:
            page.emulate_media(reduced_motion='reduce' if reduced else 'no-preference')
            for b in balls:
                page.locator('#transcendentPreview').select_option(b['id'])
                idle=page.locator('#ballSvg .transcendent-idle')
                animation=idle.evaluate('(el)=>getComputedStyle(el).animationName')
                assert (animation=='none')==reduced,(b,animation)
                page.locator('#ballSvg').click(position={'x':160,'y':160})
                page.wait_for_function("document.querySelector('[data-transcendent-phase]').dataset.transcendentPhase==='release'")
                assert page.locator('.transcendent-fx').count()>=5
                assert page.locator('#ballSvg').evaluate('(el)=>getComputedStyle(el).opacity')=='0'
                if not reduced:
                    page.wait_for_timeout(170)
                    path=out/('transcendent-break-'+b['id']+'.png')
                    page.screenshot(path=str(path));captures.append((b['name'],path))
                page.wait_for_function("(reward)=>JSON.parse(localStorage.getItem('wax-ball:wakppuball:local-test-save')).gold===String(reward)",arg=b['reward'])
                page.wait_for_function("!document.querySelector('[data-transcendent-phase]')")
                assert page.locator('.transcendent-fx').count()==0
                assert page.locator('#ballSvg').evaluate('(el)=>getComputedStyle(el).opacity')=='1'
                page.wait_for_timeout(120)
                assert page.evaluate("JSON.parse(localStorage.getItem('wax-ball:wakppuball:local-test-save')).gold")==str(b['reward'])
                print('PASS effect '+b['id']+(' reduced' if reduced else ''))
        page.emulate_media(reduced_motion='no-preference')
        page.locator('#transcendentPreview').select_option('eternity')
        page.locator('#ballSvg').click(position={'x':160,'y':160})
        page.locator('#transcendentPreview').select_option('starlight')
        page.wait_for_timeout(2200)
        assert page.locator('.transcendent-fx').count()==0
        assert page.evaluate("JSON.parse(localStorage.getItem('wax-ball:wakppuball:local-test-save')).gold")=='0'
        assert not errors,errors
        from PIL import Image,ImageDraw
        sheet=Image.new('RGB',(390*5,880*2),'#171923');draw=ImageDraw.Draw(sheet)
        for i,(name,path) in enumerate(captures):
            sheet.paste(Image.open(path).convert('RGB'),((i%5)*390,(i//5)*880))
            draw.text(((i%5)*390+12,(i//5)*880+850),path.stem,fill='white')
        sheet.save(out/'transcendent-effects-contact.png')
        browser.close()
finally:
    server.terminate();server.wait(timeout=10)
