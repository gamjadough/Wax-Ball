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
   page.locator('[data-close="shop"]').tap();page.locator('#inventoryBtn').tap();page.locator('#inventoryPetsTab').tap();inventory=page.locator('#halloweenDecorInventory');expect(inventory).to_be_visible();expect(page.locator('#inventorySkinsPage')).to_be_hidden();assert page.locator('#inventorySkinsPage .hdecor-section').count()==0
   expect(inventory).to_contain_text('골드 +10%');expect(inventory).to_contain_text('파괴 모션 시간 10% 단축');expect(inventory).to_contain_text('재생성 대기 시간 10% 단축');assert page.locator('#inventoryPetsTab').evaluate('e=>parseFloat(getComputedStyle(e).minHeight)>=44')
   # Finish the remaining acquisition through three real draws; the RNG fixture cycles equally.
   page.locator('#itemsClose').tap();page.locator('#shopBtn').tap();page.locator('#shopHalloweenTab').tap()
   for i in range(3):
    shop.locator('.hdecor-open').tap();page.wait_for_function('!WakppuHalloweenDecorUI.busy');page.wait_for_timeout(80)
   assert len(rpc()['owned'])==3
   page.locator('[data-close="shop"]').tap()
   out=ROOT/'tools/test-results';out.mkdir(exist_ok=True)
   for item in ['little_ghost','pumpkin_ember','bat_swarm']:
    page.locator('#inventoryBtn').tap();page.locator('#inventoryPetsTab').tap();button=inventory.locator('[data-hdecor-id="'+item+'"]');button.tap();expect(button).to_have_text('장착 해제');page.wait_for_function('!WakppuHalloweenDecorUI.busy');assert rpc()['equipped']==item
    assert page.locator('#itemsModal .sheet').evaluate('e=>e.scrollWidth<=e.clientWidth+1');page.screenshot(path=str(out/f'halloween-pets-inventory-{width}-{item}.png'));page.locator('#itemsClose').tap()
    pet=page.locator('.hdecor-companion');expect(pet).to_have_count(1);assert pet.get_attribute('data-pet')==item;assert pet.evaluate("e=>getComputedStyle(e).pointerEvents==='none'")
    start=pet.evaluate('e=>getComputedStyle(e).transform');page.wait_for_timeout(300);after=pet.evaluate('e=>getComputedStyle(e).transform');assert (start==after) if reduced else (start!=after)
    assert pet.evaluate('e=>{const a=e.getBoundingClientRect(),b=document.querySelector("#stage").getBoundingClientRect();return a.left>=b.left-1&&a.right<=b.right+1&&a.top>=b.top-1&&a.bottom<=b.bottom+1}')
    before=page.evaluate('WakppuItemGame.read().gold')
    for i in range(5):
     page.locator('#ballSvg').tap();page.wait_for_function('!WakppuItemGame.read().busy')
    assert int(page.evaluate('WakppuItemGame.read().gold'))==int(before)+1;expect(pet).to_have_count(1);assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');page.screenshot(path=str(out/f'halloween-pets-play-{width}-{item}.png'))
    page.reload();page.wait_for_function('WakppuItemGame.read().ready');expect(page.locator('.hdecor-companion')).to_have_count(1);assert rpc()['equipped']==item
    page.locator('#inventoryBtn').tap();page.locator('#inventoryPetsTab').tap();inventory.locator('.hdecor-stop').tap();expect(page.locator('.hpet-paused')).to_have_count(1);assert rpc()['equipped']==item;inventory.locator('.hdecor-unequip').tap();page.wait_for_function('!WakppuHalloweenDecorUI.busy');expect(page.locator('.hdecor-companion')).to_have_count(0);assert rpc()['equipped'] is None;page.locator('#itemsClose').tap()
   fixture('ended');page.locator('#shopBtn').tap();page.locator('#shopHalloweenTab').tap();expect(shop.locator('.hdecor-open')).to_be_disabled();expect(shop.locator('[data-hdecor-id="bat_swarm"]')).to_be_enabled();page.locator('[data-close="shop"]').tap()
   page.evaluate("async password=>{await WakppuAuth.signIn('dodoonglee@gmail.com',password);await WakppuItemGame.restore()}",password);page.wait_for_function('WakppuItemGame.read().ready');expect(page.locator('.hdecor-companion')).to_have_count(0);assert len(rpc()['owned'])==3 and rpc()['admin_content_access'];admin_tokens=rpc()['tokens']
   page.locator('#inventoryBtn').tap();page.locator('#inventoryPetsTab').tap();expect(inventory).to_contain_text('개발자 상시 이용');inventory.locator('[data-hdecor-id="bat_swarm"]').tap();page.wait_for_function('!WakppuHalloweenDecorUI.busy');assert rpc()['equipped']=='bat_swarm' and rpc()['tokens']==admin_tokens
   inventory.locator('.hdecor-unequip').tap();page.wait_for_function('!WakppuHalloweenDecorUI.busy');assert rpc()['equipped'] is None
   assert not errors,errors;print(f'PASS {width}x{height} reduced={reduced}: equal box/retry, separate pets tab, 3 permanent pets, wander bounds, equip/reload/unequip, paused motion, touch hits/rewards and developer access',flush=True);ctx.close()
  finally:server.terminate();server.wait(timeout=10)
 browser.close()
