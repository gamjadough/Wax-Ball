"""Foreground ember attacks through real game UI and isolated local gameplay services."""
import os,sys,socket,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,os.environ['WAKPPU_TEST_PYTHON_PATH'])
from playwright.sync_api import sync_playwright,expect
with sync_playwright() as p:
 browser=p.chromium.launch(channel='msedge',headless=True)
 for width,height,reduced in [(320,640,False),(844,390,False),(390,844,True),(1200,900,False)]:
  with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
  server=subprocess.Popen(['node',str(ROOT/'tools/local-server.mjs')],cwd=ROOT,env=dict(os.environ,WAKPPU_LOCAL_PORT=str(port),WAKPPU_LOCAL_HALLOWEEN_BOX_PREVIEW='1',WAKPPU_LOCAL_SLEEP_TIME='2026-10-25T03:00:00Z'),stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,encoding='utf8')
  try:
   assert server.stdout.readline().startswith('Local preview:');base=f'http://127.0.0.1:{port}'
   ctx=browser.new_context(viewport={'width':width,'height':height},has_touch=True,is_mobile=width<900,reduced_motion='reduce' if reduced else 'no-preference')
   ctx.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base) or r.request.url.startswith('data:') else r.fulfill(status=200,body=''))
   page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto(base,wait_until='networkidle');page.bring_to_front()
   page.evaluate("async()=>{await WakppuAuth.signIn('guest','');await WakppuItemGame.restore();const s=JSON.parse(sessionStorage.getItem('wakppu-local-session'));await fetch('/local/halloween-decor-demo',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+s.token},body:JSON.stringify({mode:'exchange'})});await WakppuHalloweenDecorUI.refresh();await WakppuLimited.refresh();}")
   page.wait_for_function('WakppuItemGame.read().ready')
   page.evaluate("window.autoIds=[];window.autoAt=[];window.manualHits=0;window.rawInvoke=WakppuAuth.invoke;WakppuAuth.invoke=function(a,b,o){if(a==='ember_auto_hit'){autoIds.push(b.request_id);autoAt.push(performance.now());}if(a==='item_hit')manualHits++;return rawInvoke(a,b,o);};void 0")
   page.locator('#inventoryBtn').tap();page.locator('#inventoryPetsTab').tap();ember=page.locator('#halloweenDecorInventory [data-hdecor-id="pumpkin_ember"]')
   ember.tap();page.wait_for_function('!WakppuHalloweenDecorUI.busy');ember.tap();page.wait_for_function("!WakppuHalloweenDecorUI.busy&&WakppuHalloweenDecor.equipped()==='pumpkin_ember'")
   expect(page.locator('#halloweenDecorInventory')).to_contain_text('1초마다 자동 공격');page.locator('#itemsClose').tap()
   toggle=page.locator('#emberAutoToggle');expect(toggle).to_be_hidden()
   assert page.locator('#stage #emberAutoToggle').count()==0
   def toggle_pet():
    page.locator('#inventoryBtn').tap();page.locator('#inventoryPetsTab').tap()
    expect(toggle).to_be_visible();assert toggle.bounding_box()['height']>=44
    toggle.tap();page.locator('#itemsClose').tap()
   for badge in ['#blueGemCurrency','#halloweenCurrency']:
    assert page.locator(badge+' > span').count()==2
    assert page.locator(badge).get_attribute('aria-label')
   page.locator('#halloweenCurrency').tap();expect(page.locator('#shopHalloween')).to_be_visible();page.locator('[data-close="shop"]').tap()
   page.locator('#blueGemCurrency').tap();expect(page.locator('#blueGemShop')).to_be_visible();page.locator('#blueGemClose').tap()
   page.wait_for_function('autoIds.length>=2&&!WakppuItemGame.read().busy',timeout=10000);toggle_pet();expect(toggle).to_have_attribute('aria-pressed','false')
   count=page.evaluate('autoIds.length');clicks=page.evaluate('WakppuBeginnerRead().clicks');assert clicks>=2
   page.wait_for_timeout(1300);assert page.evaluate('autoIds.length')==count
   assert page.evaluate('autoAt.slice(1).every((t,i)=>t-autoAt[i]>=980)')
   # A real manual touch is still accepted while pet attacks are paused.
   page.locator('#ballSvg').tap();page.wait_for_function('!WakppuItemGame.read().busy');assert page.evaluate('manualHits')==1
   assert page.evaluate('WakppuBeginnerRead().clicks')==clicks+1
   before=int(page.evaluate('WakppuItemGame.read().gold'));toggle_pet()
   page.wait_for_function('(g)=>BigInt(WakppuItemGame.read().gold)>BigInt(g)&&!WakppuItemGame.read().busy',arg=str(before),timeout=15000)
   toggle_pet();assert int(page.evaluate('WakppuItemGame.read().gold'))==before+1
   assert page.evaluate("WakppuAuth.invoke('blue_gems').then(s=>s.balance)")=='1'
   # Menus, hidden tabs and loss of focus stop requests without a catch-up burst.
   page.locator('#inventoryBtn').tap();page.locator('#inventoryPetsTab').tap();page.evaluate('WakppuEmberAuto.toggle()')
   count=page.evaluate('autoIds.length');page.wait_for_timeout(1400);assert page.evaluate('autoIds.length')==count;page.locator('#itemsClose').tap()
   page.wait_for_function('autoIds.length>'+str(count)+'&&!WakppuItemGame.read().busy',timeout=6000)
   # Headless Edge keeps all pages visible/focused. Emulate browser lifecycle flags explicitly.
   page.evaluate("window.emberHidden=true;window.emberFocused=false;Object.defineProperty(document,'hidden',{configurable:true,get:()=>emberHidden});document.hasFocus=()=>emberFocused;document.dispatchEvent(new Event('visibilitychange'));window.dispatchEvent(new Event('blur'));")
   page.wait_for_timeout(1500);count=page.evaluate('autoIds.length');page.wait_for_timeout(1400);assert page.evaluate('autoIds.length')==count
   page.evaluate("emberHidden=false;document.dispatchEvent(new Event('visibilitychange'));");page.wait_for_timeout(1300);assert page.evaluate('autoIds.length')==count
   page.evaluate("emberFocused=true;window.dispatchEvent(new Event('focus'));");page.wait_for_function('autoIds.length>'+str(count),timeout=6000)
   page.wait_for_function('!WakppuItemGame.read().busy');toggle_pet()
   if width==1200:
    # The first request commits, but its response is lost. The retry must reuse its ID.
    lost=[False]
    def drop(route):
     if route.request.post_data_json.get('action')=='ember_auto_hit' and not lost[0]:route.fetch();lost[0]=True;route.abort()
     else:route.continue_()
    page.route('**/local/api',drop);start=page.evaluate('autoIds.length');toggle_pet();page.wait_for_function('autoIds.length>='+str(start+2)+'&&!WakppuItemGame.read().busy',timeout=15000);toggle_pet()
    ids=page.evaluate('autoIds.slice('+str(start)+')');assert lost[0] and ids[0]==ids[1];page.unroute('**/local/api',drop)
   page.screenshot(path=str(ROOT/f'tools/test-results/ember-auto-{width}x{height}.png'))
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
   # Real equip replacement removes the attack control and stops the timer.
   page.locator('#inventoryBtn').tap();page.locator('#inventoryPetsTab').tap();page.locator('#halloweenDecorInventory [data-hdecor-id="little_ghost"]').tap();page.wait_for_function("!WakppuHalloweenDecorUI.busy&&WakppuHalloweenDecor.equipped()==='little_ghost'");page.locator('#itemsClose').tap()
   expect(toggle).to_be_hidden();count=page.evaluate('autoIds.length');page.wait_for_timeout(1300);assert page.evaluate('autoIds.length')==count
   assert not errors,errors;print(f'PASS ember {width}x{height} reduced={reduced}: timed attacks, manual input, pause/resume, break/gold/gem, menus, hidden/focus, no catch-up, equip replacement'+('/lost-response same-ID retry' if width==1200 else ''),flush=True);ctx.close()
  finally:server.terminate();server.wait(timeout=10)
 browser.close()
