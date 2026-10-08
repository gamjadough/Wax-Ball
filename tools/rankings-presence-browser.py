"""Local-only public maintenance ranking UI, presence and blocked-game checks."""
import os,socket,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,str(ROOT/'tools/.test-deps'))
from playwright.sync_api import sync_playwright,expect
OUT=ROOT/'tools/test-results';OUT.mkdir(exist_ok=True)
with socket.socket() as s:s.bind(('127.0.0.1',0));port=s.getsockname()[1]
server=subprocess.Popen(['node',str(ROOT/'tools/local-server.mjs')],cwd=ROOT,env=dict(os.environ,WAKPPU_LOCAL_PORT=str(port)),stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,encoding='utf-8')
try:
 assert server.stdout.readline().startswith('Local preview:')
 server.stdout.readline();password=server.stdout.readline().split(': ',1)[1].strip()
 base=f'http://127.0.0.1:{port}'
 with sync_playwright() as p:
  browser=p.chromium.launch(channel='msedge',headless=True)
  for width in [320,390,1100]:
   ctx=browser.new_context(viewport={'width':width,'height':844})
   ctx.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base) else r.fulfill(status=200,body=''))
   page=ctx.new_page();page.clock.install();errors=[];pings=[]
   page.on('pageerror',lambda e:errors.append(str(e)))
   page.on('request',lambda r:pings.append(r) if r.url.endswith('/local/api') and r.post_data_json.get('action')=='presence_ping' else None)
   login=page.request.post(base+'/local/login',data={'email':'dodoonglee@gmail.com','password':password}).json()
   headers={'Authorization':'Bearer '+login['token']}
   assert page.request.post(base+'/local/api',headers=headers,data={'action':'admin_maintenance','enabled':True}).ok
   page.goto(base);page.wait_for_load_state('networkidle')
   expect(page.locator('#maintenance')).to_be_visible()
   expect(page.locator('#game')).to_be_hidden()
   page.locator('#maintenanceRanking').click()
   expect(page.locator('#rankingList li')).not_to_have_count(0)
   assert page.evaluate('(async()=> (await WakppuAuth.session()).data.session===null)()')
   assert len(pings)==0
   assert page.locator('#rankingList .ranking-online').count()==0 if width==320 else True
   page.locator('[data-close="ranking"]').click()
   page.evaluate("async()=>{await WakppuAuth.signInAnonymously();dispatchEvent(new Event('focus'));}")
   page.wait_for_function("async()=> (await WakppuAuth.invoke('rankings')).some(r=>r.online===true)")
   page.locator('#maintenanceRanking').click()
   expect(page.locator('#rankingList .ranking-online')).to_have_count(1)
   icon=page.locator('.ranking-online')
   assert icon.inner_text()==''
   assert icon.get_attribute('aria-label')=='온라인'
   assert icon.evaluate('(e)=>getComputedStyle(e).backgroundColor')=='rgb(69, 219, 120)'
   assert '온라인' not in page.locator('#rankingList').inner_text()
   assert page.evaluate("document.querySelector('#ranking .sheet').scrollWidth<=document.querySelector('#ranking .sheet').clientWidth")
   before=page.evaluate("async()=> (await WakppuAuth.invoke('rankings')).map(r=>r.gold)")
   denied=page.evaluate("async()=>{try{await WakppuAuth.invoke('save_progress',{gold:'0'});return 0;}catch(e){return e.status;}}")
   assert denied==503
   assert page.evaluate("async()=> (await WakppuAuth.invoke('rankings')).map(r=>r.gold)")==before
   page.clock.run_for(300)
   page.screenshot(path=str(OUT/f'rankings-maintenance-{width}.png'))
   count=len(pings)
   page.evaluate("dispatchEvent(new Event('focus'));dispatchEvent(new Event('online'));")
   page.wait_for_timeout(150)
   assert len(pings)==count
   page.clock.fast_forward(31000)
   page.wait_for_timeout(200)
   assert len(pings)==count+1,(len(pings),count)
   page.evaluate("Object.defineProperty(document,'hidden',{configurable:true,get:()=>true})")
   count=len(pings);page.clock.fast_forward(31000);page.wait_for_timeout(200)
   assert len(pings)==count
   page.evaluate("Object.defineProperty(document,'hidden',{configurable:true,get:()=>false})")
   # Deterministic offline transition in the ranking response verifies dot removal on refresh.
   async_rows=page.evaluate("async()=>WakppuAuth.invoke('rankings')")
   for r in async_rows:r['online']=False
   import json
   def offline(route):
    if route.request.post_data_json.get('action')=='rankings':route.fulfill(status=200,content_type='application/json',body=json.dumps(async_rows))
    else:route.continue_()
   page.route('**/local/api',offline)
   page.clock.fast_forward(11000)
   expect(page.locator('#rankingList .ranking-online')).to_have_count(0)
   assert not errors,errors
   ctx.close();print(f'PASS {width}px: public maintenance ranking, green dot only, no play/save, refresh, 30s heartbeat, hidden-tab pause')
  browser.close()
finally:
 server.terminate();server.wait(timeout=10)
