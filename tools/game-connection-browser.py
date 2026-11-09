"""Verify the silent restore failure and redundant save regressions on local accounts."""
import os,re,socket,subprocess,sys
from pathlib import Path

ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,os.environ['WAKPPU_TEST_PYTHON_PATH'])
from playwright.sync_api import sync_playwright,expect

with socket.socket() as sock:
    sock.bind(('127.0.0.1',0))
    port=sock.getsockname()[1]
base=f'http://127.0.0.1:{port}'
server=subprocess.Popen(
    ['node',str(ROOT/'tools/local-server.mjs')],cwd=ROOT,
    env=dict(os.environ,WAKPPU_LOCAL_PORT=str(port),WAKPPU_LOCAL_SLEEP_TIME='2026-11-09T03:00:00Z'),
    stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,encoding='utf8')
try:
    assert server.stdout.readline().startswith('Local preview:')
    with sync_playwright() as p:
        browser=p.chromium.launch(channel='msedge',headless=True)
        for width,height in [(320,640),(844,390),(1200,900)]:
            ctx=browser.new_context(viewport={'width':width,'height':height},has_touch=True,is_mobile=width<900)
            ctx.route(re.compile(r'^https?://(?!127\.0\.0\.1:'+str(port)+r'(?:/|$))'),lambda r:r.fulfill(status=200,body=''))
            page=ctx.new_page()
            errors=[]
            page.on('pageerror',lambda e:errors.append(str(e)))
            page.goto(base,wait_until='networkidle')
            sounds=page.evaluate(r"""()=>performance.getEntriesByType('resource').filter(r=>/\/sounds\/.+\.(mp3|wav)$/.test(r.name)).map(r=>new URL(r.name).pathname)""")
            assert sounds and all('yellow-crack-' in sound for sound in sounds),sounds
            page.evaluate("async()=>{await WakppuAuth.signIn('guest','');await WakppuItemGame.restore()}")
            page.wait_for_function('WakppuItemGame.read().ready')
            page.evaluate("""()=>{
              window.calls=[];window.failedBootstrap=false;
              const invoke=WakppuAuth.invoke;
              WakppuAuth.invoke=async(action,body,options)=>{
                if(action==='bootstrap'&&failedBootstrap)throw Error('test connection failed');
                if(action==='save_progress'||action==='item_hit')calls.push({action,body});
                return invoke(action,body,options);
              };
            }""")
            initial=page.evaluate('WakppuBeginnerRead().clicks')
            page.locator('#ballSvg').tap()
            page.wait_for_function('(n)=>WakppuBeginnerRead().clicks===n+1&&!WakppuItemGame.read().busy',arg=initial)
            assert page.evaluate('calls.map(r=>r.action)')==['item_hit']
            page.evaluate('async()=>{failedBootstrap=true;await WakppuItemGame.restore()}')
            expect(page.locator('#reconnectGame')).to_be_visible()
            assert not page.evaluate('WakppuItemGame.read().ready')
            assert page.locator('#reconnectGame').bounding_box()['height']>=44
            page.evaluate('failedBootstrap=false')
            page.locator('#reconnectGame').tap()
            page.wait_for_function('WakppuItemGame.read().ready')
            expect(page.locator('#reconnectGame')).to_be_hidden()
            assert page.evaluate('WakppuBeginnerRead().clicks')==initial+1
            old_ball=page.evaluate('WakppuCustomGame.current()')
            page.locator('#unlockBtn').tap()
            selected=page.evaluate('WakppuCustomGame.current()')
            assert selected!=old_ball
            page.locator('#ballSvg').tap()
            page.wait_for_function("calls.filter(r=>r.action==='item_hit').length===2&&!WakppuItemGame.read().busy")
            assert page.evaluate('calls.map(r=>r.action)')==['item_hit','save_progress','item_hit']
            assert page.evaluate("calls.find(r=>r.action==='save_progress').body.selected_ball_id")==selected
            if width==1200:
                page.evaluate("()=>{window.normalSession=WakppuAuth.session;WakppuAuth.session=()=>new Promise(()=>{});void WakppuItemGame.restore()}")
                expect(page.locator('#reconnectGame')).to_be_visible(timeout=11000)
                page.evaluate("()=>{WakppuAuth.session=normalSession}")
                page.locator('#reconnectGame').tap()
                page.wait_for_function('WakppuItemGame.read().ready')
            assert not errors,errors
            print(f'PASS {width}x{height}: selected-ball audio, single hit request, reconnect and restored clicks, changed selection saved before hit',flush=True)
            ctx.close()
        browser.close()
finally:
    server.terminate()
    server.wait(timeout=10)
