"""Equal cosmetic box and touch gameplay, isolated local fixtures only."""
import os,socket,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,os.environ['WAKPPU_TEST_PYTHON_PATH'])
from playwright.sync_api import sync_playwright,expect
with sync_playwright() as p:
 browser=p.chromium.launch(channel='msedge',headless=True)
 for width,height,reduced in ([(1200,900,False)] if '--desktop' in sys.argv else [(320,640,False),(844,390,False),(390,844,True),(1200,900,False)]):
  with socket.socket() as s:s.bind(('127.0.0.1',0));port=s.getsockname()[1]
  server=subprocess.Popen([sys.argv[1],str(ROOT/'tools/local-server.mjs')],cwd=ROOT,env=dict(os.environ,WAKPPU_LOCAL_PORT=str(port),WAKPPU_LOCAL_HALLOWEEN_BOX_PREVIEW='1',WAKPPU_LOCAL_SLEEP_TIME='2026-10-22T12:00:00+09:00'),stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,encoding='utf8')
  try:
   assert server.stdout.readline().startswith('Local preview:');server.stdout.readline();password=server.stdout.readline().strip().split(': ',1)[1];base=f'http://127.0.0.1:{port}'
   ctx=browser.new_context(viewport={'width':width,'height':height},has_touch=True,is_mobile=width<900,reduced_motion='reduce' if reduced else 'no-preference');ctx.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base) else r.fulfill(status=200,body=''))
   page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('dialog',lambda d:d.accept());page.goto(base);page.wait_for_load_state('networkidle')
   page.evaluate("async()=>{await WakppuAuth.signIn('guest','');await WakppuItemGame.restore()}");page.wait_for_function('WakppuItemGame.read().ready')
   def fixture(mode):page.evaluate("async mode=>{const s=JSON.parse(sessionStorage.getItem('wakppu-local-session'));const r=await fetch('/local/halloween-decor-demo',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+s.token},body:JSON.stringify({mode})});if(!r.ok)throw Error(await r.text());await WakppuHalloweenDecorUI.refresh();await WakppuLimited.refresh();}",mode)
   def rpc():return page.evaluate("WakppuAuth.invoke('halloween_cosmetics')")
   fixture('reset');gold=page.evaluate('WakppuItemGame.read().gold');page.locator('#shopBtn').tap();page.locator('#shopHalloweenTab').tap();shop=page.locator('#halloweenDecorShop');expect(shop).to_be_visible();expect(shop.locator('.hdecor-card')).to_have_count(3);expect(shop).to_contain_text('각각 1/3')
   lost=[False]
   def retry(route):
    if route.request.post_data_json.get('action')=='halloween_decor_open' and not lost[0]:lost[0]=True;route.fetch();route.abort()
    else:route.continue_()
   page.route('**/local/api',retry)
   for i in range(6):
    button=shop.locator('.hdecor-open');expect(button).to_be_enabled();assert button.bounding_box()['height']>=44;button.tap();page.wait_for_function('(n)=>!WakppuHalloweenDecorUI.busy&&document.querySelector("#halloweenDecorShop .hdecor-balance").textContent.includes(n+"캔디")',arg=1000-(i+1)*100)
   state=rpc();assert state['tokens']=='400' and state['shards']=='3' and len(state['owned'])==3 and state['opened']=='6';assert state['gold']==gold;expect(shop.locator('.hdecor-result')).to_contain_text('중복 획득')
   fixture('exchange');shop.locator('[data-hdecor-id="pumpkin_ember"]').tap();page.wait_for_function('!WakppuHalloweenDecorUI.busy');expect(shop.locator('.hdecor-result')).to_contain_text('조각 교환');assert rpc()['shards']=='0'
   ghost=shop.locator('[data-hdecor-id="little_ghost"]');ghost.tap();expect(ghost).to_have_text('장착 해제');page.locator('[data-close="shop"]').tap();expect(page.locator('.hdecor-companion')).to_have_count(1)
   box=page.locator('.hdecor-companion');assert box.evaluate("e=>getComputedStyle(e).pointerEvents==='none'");clicks=page.evaluate('WakppuBeginnerRead().clicks');page.locator('#ballSvg').tap();page.wait_for_function('(v)=>WakppuBeginnerRead().clicks!==v',arg=clicks);page.wait_for_function('!WakppuItemGame.read().busy')
   page.reload();page.wait_for_function('WakppuItemGame.read().ready');expect(page.locator('.hdecor-companion')).to_have_count(1)
   page.locator('#inventoryBtn').tap();page.locator('#inventorySkinsTab').tap();inventory=page.locator('#halloweenDecorInventory');expect(inventory).to_be_visible();inventory.locator('[data-hdecor-id="pumpkin_ember"]').tap();expect(inventory.locator('[data-hdecor-id="pumpkin_ember"]')).to_have_text('장착 해제');page.locator('#itemsClose').tap();expect(page.locator('.hdecor-companion')).to_have_count(0)
   clicks=page.evaluate('WakppuBeginnerRead().clicks');page.locator('#ballSvg').tap();page.wait_for_function('(v)=>WakppuBeginnerRead().clicks!==v',arg=clicks);expect(page.locator('.hdecor-embers')).to_have_count(1);page.wait_for_function('!WakppuItemGame.read().busy')
   # Refill only the missing bat in this explicit disposable fixture, via a real shard exchange.
   fixture('exchange');page.locator('#inventoryBtn').tap();page.locator('#inventorySkinsTab').tap();inventory.locator('[data-hdecor-id="bat_swarm"]').tap();page.wait_for_function('!WakppuHalloweenDecorUI.busy');expect(inventory.locator('[data-hdecor-id="bat_swarm"]')).to_have_text('사용')
   inventory.locator('[data-hdecor-id="bat_swarm"]').tap();page.wait_for_function('!WakppuHalloweenDecorUI.busy');page.locator('#itemsClose').tap();expect(page.locator('.hdecor-bats')).to_have_count(1);assert page.locator('.hdecor-bat').count()==(1 if reduced else 2 if width<600 else 3)
   clicks=page.evaluate('WakppuBeginnerRead().clicks');page.locator('#ballSvg').tap();page.wait_for_function('(v)=>WakppuBeginnerRead().clicks!==v',arg=clicks);assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
   out=ROOT/'tools/test-results';out.mkdir(exist_ok=True);page.screenshot(path=str(out/f'halloween-decor-play-{width}.png'));expect(page.locator('.hdecor-bats')).to_have_count(0,timeout=6500)
   page.locator('#inventoryBtn').tap();page.locator('#inventorySkinsTab').tap();inventory.locator('[data-hdecor-id="little_ghost"]').tap();expect(inventory.locator('[data-hdecor-id="little_ghost"]')).to_have_text('장착 해제');page.locator('#itemsClose').tap()
   before_break=page.evaluate('WakppuItemGame.read().gold')
   while page.evaluate('WakppuBeginnerRead().clicks')<4:
    page.locator('#ballSvg').tap();page.wait_for_function('!WakppuItemGame.read().busy')
   page.locator('#ballSvg').tap();page.wait_for_function('WakppuBeginnerRead().busy');expect(page.locator('.hdecor-companion')).to_have_count(0)
   page.wait_for_function('!WakppuItemGame.read().busy');expect(page.locator('.hdecor-companion')).to_have_count(1);assert int(page.evaluate('WakppuItemGame.read().gold'))==int(before_break)+1
   fixture('ended');page.locator('#shopBtn').tap();page.locator('#shopHalloweenTab').tap();expect(shop.locator('.hdecor-open')).to_be_disabled();expect(shop.locator('[data-hdecor-id="little_ghost"]')).to_be_enabled();assert page.locator('#shop .sheet').evaluate('e=>e.scrollWidth<=e.clientWidth+1');shop.scroll_into_view_if_needed();page.screenshot(path=str(out/f'halloween-decor-shop-{width}.png'))
   page.locator('[data-close="shop"]').tap();page.evaluate("async password=>{await WakppuAuth.signIn('dodoonglee@gmail.com',password);await WakppuItemGame.restore()}",password);page.wait_for_function('WakppuItemGame.read().ready');expect(page.locator('.hdecor-companion')).to_have_count(0);assert len(rpc()['owned'])==0
   assert not errors,errors;print(f'PASS {width}x{height} reduced={reduced}: 100 candy, lost response retry, 3 equal rewards, duplicates/exchange, equip/use, reload, expiry, touch and account isolation',flush=True);ctx.close()
  finally:server.terminate();server.wait(timeout=10)
 browser.close()
