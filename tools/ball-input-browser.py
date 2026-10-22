"""Input telemetry failures must never prevent real touch hits; local fixtures only."""
import os,socket,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,os.environ['WAKPPU_TEST_PYTHON_PATH'])
from playwright.sync_api import sync_playwright
with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
server=subprocess.Popen([sys.argv[1],str(ROOT/'tools/local-server.mjs')],cwd=ROOT,env=dict(os.environ,WAKPPU_LOCAL_PORT=str(port),WAKPPU_LOCAL_SLEEP_TIME='2026-10-22T12:00:00+09:00'),stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,encoding='utf8')
try:
 assert server.stdout.readline().startswith('Local preview:');base=f'http://127.0.0.1:{port}'
 with sync_playwright() as p:
  browser=p.chromium.launch(channel='msedge',headless=True)
  layouts=[(390,844)] if '--repro' in sys.argv else [(320,640),(844,390),(390,844),(1200,900)]
  for width,height in layouts:
   for mode in (['missing_rules'] if '--repro' in sys.argv else ['normal','missing_rules','collector_error']):
    ctx=browser.new_context(viewport={'width':width,'height':height},has_touch=True,is_mobile=width<900,reduced_motion='reduce')
    def route(r):
     if mode=='missing_rules' and '/js/input-guard-rules.js' in r.request.url:r.abort()
     elif r.request.url.startswith(base):r.continue_()
     else:r.fulfill(status=200,body='')
    ctx.route('**/*',route);page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(base);page.wait_for_load_state('networkidle');page.evaluate("async()=>{await WakppuAuth.signIn('guest','');await WakppuItemGame.restore()}");page.wait_for_function('WakppuItemGame.read().ready&&WakppuItems.data')
    if mode=='collector_error':page.evaluate("()=>{WakppuInputGuard.record=()=>{throw Error('telemetry fixture failure')}}")
    before=page.evaluate('WakppuBeginnerRead().clicks');page.locator('#ballSvg').tap()
    try:page.wait_for_function('(old)=>WakppuBeginnerRead().clicks!==old',arg=before,timeout=4000)
    except Exception:
     print(f'BLOCKED {mode}: {errors}',flush=True)
     raise
    page.wait_for_function('!WakppuItemGame.read().busy')
    page.locator('#shopBtn').tap();assert page.locator('#shop').is_visible();page.locator('[data-close="shop"]').tap()
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');assert not errors,errors
    print(f'PASS {width}x{height} {mode}: real hit, server progress, shop and no JS errors',flush=True);ctx.close()
  browser.close()
finally:server.terminate();server.wait(timeout=10)
