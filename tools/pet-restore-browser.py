"""Restore the authoritative equipped pet without entering a shop or inventory."""
import os,sys,socket,subprocess,json
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,os.environ['WAKPPU_TEST_PYTHON_PATH'])
from playwright.sync_api import sync_playwright,expect
with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
server=subprocess.Popen(['node',str(ROOT/'tools/local-server.mjs')],cwd=ROOT,env=dict(os.environ,WAKPPU_LOCAL_PORT=str(port),WAKPPU_LOCAL_HALLOWEEN_BOX_PREVIEW='1',WAKPPU_LOCAL_SLEEP_TIME='2026-10-22T12:00:00+09:00'),stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,encoding='utf8')
try:
 assert server.stdout.readline().startswith('Local preview:');server.stdout.readline();password=server.stdout.readline().strip().split(': ',1)[1];base=f'http://127.0.0.1:{port}'
 with sync_playwright() as p:
  for name,engine,width,height,reduced in [('Edge',p.chromium,320,640,False),('Edge',p.chromium,844,390,True),('WebKit',p.webkit,390,844,False)]:
   browser=engine.launch(**({'channel':'msedge'} if name=='Edge' else {}),headless=True);ctx=browser.new_context(viewport={'width':width,'height':height},has_touch=True,is_mobile=True,reduced_motion='reduce' if reduced else 'no-preference')
   ctx.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base) else r.fulfill(status=200,body=''))
   page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(base,wait_until='networkidle')
   page.evaluate("async()=>{await WakppuAuth.signIn('guest','');await WakppuItemGame.restore();const s=JSON.parse(sessionStorage.getItem('wakppu-local-session'));await fetch('/local/halloween-decor-demo',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+s.token},body:JSON.stringify({mode:'exchange'})});const d=await WakppuAuth.invoke('halloween_cosmetics');await WakppuAuth.invoke('halloween_decor_equip',{item_id:'little_ghost',request_id:crypto.randomUUID(),item_revision:d.revision,decor_revision:d.decor_revision});await WakppuHalloweenDecorUI.refresh();}")
   expect(page.locator('.hdecor-companion[data-pet="little_ghost"]')).to_have_count(1)
   page.evaluate("async()=>{const {data:{session}}=await WakppuAuth.session();window.dispatchEvent(new CustomEvent('wakppu-auth-changed',{detail:{event:'TOKEN_REFRESHED',user:session.user}}));}")
   page.wait_for_timeout(250);expect(page.locator('.hdecor-companion[data-pet="little_ghost"]')).to_have_count(1)
   page.goto('about:blank');page.go_back(wait_until='networkidle');page.wait_for_function('WakppuItemGame.read().ready');expect(page.locator('.hdecor-companion')).to_have_count(1)
   page.evaluate("()=>{window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));}");expect(page.locator('.hdecor-companion')).to_have_count(1)
   page.evaluate('WakppuHalloweenDecorUI.refresh()');failed=[False]
   def flaky(route):
    if route.request.post_data_json.get('action')=='halloween_cosmetics' and not failed[0]:failed[0]=True;route.abort()
    else:route.continue_()
   page.route('**/local/api',flaky)
   page.evaluate("()=>{WakppuHalloweenDecor.sync(WakppuItemGame.read().account,null);window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));}")
   expect(page.locator('.hdecor-companion')).to_have_count(1,timeout=6000);assert failed[0]
   page.unroute('**/local/api',flaky)
   session=page.evaluate("sessionStorage.getItem('wakppu-local-session')");page.close();page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
   page.add_init_script('sessionStorage.setItem("wakppu-local-session",'+json.dumps(session)+')');page.goto(base,wait_until='networkidle');page.wait_for_function('WakppuItemGame.read().ready');expect(page.locator('.hdecor-companion')).to_have_count(1)
   page.evaluate("async password=>{await WakppuAuth.signIn('dodoonglee@gmail.com',password);await WakppuItemGame.restore();}",password);expect(page.locator('.hdecor-companion')).to_have_count(0)
   page.evaluate("async()=>{await WakppuAuth.signIn('guest','');await WakppuItemGame.restore();}");expect(page.locator('.hdecor-companion')).to_have_count(1)
   assert page.locator('#shop').is_hidden() and page.locator('#itemsModal').is_hidden();assert not errors,errors
   print(f'PASS {name} {width}x{height} reduced={reduced}: token refresh, navigation/back, BFCache events, transient read recovery, closed-tab session restore and account isolation without shop entry',flush=True)
   browser.close()
finally:server.terminate();server.wait(timeout=10)
