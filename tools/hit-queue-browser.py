"""Real pointer bursts under latency, response loss and cosmetic errors; local accounts only."""
import os,sys,socket,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,os.environ['WAKPPU_TEST_PYTHON_PATH'])
from playwright.sync_api import sync_playwright,expect
with sync_playwright() as p:
 browser=p.chromium.launch(channel='msedge',headless=True)
 for w,h in [(320,640),(844,390),(1200,900)]:
  with socket.socket() as s:s.bind(('127.0.0.1',0));port=s.getsockname()[1]
  server=subprocess.Popen([sys.argv[1],str(ROOT/'tools/local-server.mjs')],cwd=ROOT,env=dict(os.environ,WAKPPU_LOCAL_PORT=str(port),WAKPPU_LOCAL_SLEEP_TIME='2026-10-23T12:00:00+09:00'),stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,encoding='utf8')
  try:
   server.stdout.readline();server.stdout.readline();password=server.stdout.readline().strip().split(': ',1)[1];base=f'http://127.0.0.1:{port}'
   ctx=browser.new_context(viewport={'width':w,'height':h},has_touch=True,is_mobile=w<900);ctx.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base) else r.fulfill(status=200,body=''));page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(base);page.wait_for_load_state('networkidle');page.evaluate("async password=>{await WakppuAuth.signIn('dodoonglee@gmail.com',password);await WakppuItemGame.restore();await WakppuCustomGame.select('whitehole');await WakppuItemGame.flush();await WakppuHalloweenDecorUI.refresh();}",password);page.wait_for_function('!WakppuItemGame.read().busy');page.wait_for_timeout(450)
   page.evaluate("window.rawInvoke=WakppuAuth.invoke;window.hitDelay=0;window.targetHits=0;window.serverHits=0;WakppuAuth.invoke=async(a,b,o)=>{if(a==='item_hit'){await new Promise(r=>setTimeout(r,hitDelay));const result=await rawInvoke(a,b,o);serverHits++;return result;}return rawInvoke(a,b,o);};document.addEventListener('pointerdown',e=>{if(e.target.closest('#ballSvg'))targetHits++;},true)")
   def burst(n,gap=10):
    rect=page.locator('#ballSvg').bounding_box();x=rect['x']+rect['width']/2;y=rect['y']+rect['height']/2
    for _ in range(n):
     if w<900:page.touchscreen.tap(x,y)
     else:page.mouse.click(x,y)
     page.wait_for_timeout(gap)
   for pet in [None,'little_ghost','bat_swarm']:
    page.evaluate("async id=>{hitDelay=0;const s=await rawInvoke('halloween_cosmetics');await rawInvoke('halloween_decor_equip',{item_id:id,request_id:crypto.randomUUID(),item_revision:s.revision,decor_revision:s.decor_revision});await WakppuItems.refresh();await WakppuHalloweenDecorUI.refresh();hitDelay=160;targetHits=0;serverHits=0;}",pet);before=page.evaluate('WakppuBeginnerRead().clicks');burst(60)
    try:page.wait_for_function('!WakppuItemGame.read().busy',timeout=40000)
    except Exception:
     print('DIAGNOSTIC',w,h,pet,page.evaluate('({read:WakppuItemGame.read(),serverHits,targetHits,clicks:WakppuBeginnerRead().clicks,hint:document.getElementById("hint")?.textContent})'),errors,flush=True);raise
    assert page.evaluate('targetHits')==60;assert page.evaluate('serverHits')==60;assert page.evaluate('WakppuBeginnerRead().clicks')==before+60
   # Twelve old touches can break only the current five-hit ball. The successor stays untouched.
   page.evaluate("async()=>{hitDelay=0;await WakppuCustomGame.select('yellow');await WakppuItemGame.flush();const s=await rawInvoke('halloween_cosmetics');await rawInvoke('halloween_decor_equip',{item_id:null,request_id:crypto.randomUUID(),item_revision:s.revision,decor_revision:s.decor_revision});await WakppuItems.refresh();await WakppuHalloweenDecorUI.refresh();hitDelay=300;targetHits=0;serverHits=0;}");page.wait_for_timeout(450);gold=page.evaluate('WakppuItemGame.read().gold');burst(12,1);page.wait_for_function('!WakppuItemGame.read().busy',timeout=20000);assert page.evaluate('serverHits')==5;assert int(page.evaluate('WakppuItemGame.read().gold'))==int(gold)+1;assert page.evaluate('WakppuBeginnerRead().clicks')==0
   page.wait_for_timeout(700);assert page.evaluate('serverHits')==5;assert page.evaluate('WakppuBeginnerRead().clicks')==0
   burst(1);page.wait_for_function('!WakppuItemGame.read().busy');assert page.evaluate('WakppuBeginnerRead().clicks')==1
   # The server commits once, but the first response never reaches the caller.
   page.evaluate("window.rawSend=WakppuHitRequests.send;WakppuHitRequests.send=(a,b,o)=>rawSend(a,b,{...o,timeoutMs:100,retryDelayMs:0});window.lostIds=[];WakppuAuth.invoke=async(a,b,o)=>{if(a!=='item_hit')return rawInvoke(a,b,o);lostIds.push(b.request_id);const r=await rawInvoke(a,b,o);if(lostIds.length===1)return new Promise((resolve,reject)=>{if(o.signal.aborted)reject(Error('aborted'));else o.signal.addEventListener('abort',()=>reject(Error('aborted')));});return r;};void 0");burst(1);page.wait_for_function('!WakppuItemGame.read().busy');ids=page.evaluate('lostIds');assert len(ids)==2 and ids[0]==ids[1];assert page.evaluate('WakppuBeginnerRead().clicks')==2;assert int(page.evaluate('WakppuItemGame.read().gold'))==int(gold)+1
   page.evaluate("WakppuAuth.invoke=rawInvoke;WakppuHitRequests.send=rawSend;WakppuHalloweenDecor.hit=()=>{throw Error('isolated pet animation failure')};void 0");burst(1);page.wait_for_function('!WakppuItemGame.read().busy');assert page.evaluate('WakppuBeginnerRead().clicks')==3;assert not errors,errors;assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');print(f'PASS {w}x{h}: 60/60 delayed taps with no pet/ghost/bat, no input carry after break, fresh tap on next ball, same-ID response-loss retry and pet error isolation',flush=True);ctx.close()
  finally:server.terminate();server.wait(timeout=10)
 browser.close()
