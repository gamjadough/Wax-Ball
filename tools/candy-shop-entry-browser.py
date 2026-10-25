"""Currency-only Halloween shop, keyboard/touch navigation and post-season pet exchange."""
import os,socket,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,os.environ['WAKPPU_TEST_PYTHON_PATH'])
from playwright.sync_api import sync_playwright,expect
with sync_playwright() as p:
 browser=p.chromium.launch(channel='msedge',headless=True)
 for width,height in [(320,640),(844,390),(1200,900),(390,844)]:
  with socket.socket() as s:s.bind(('127.0.0.1',0));port=s.getsockname()[1]
  base=f'http://127.0.0.1:{port}';server=subprocess.Popen([sys.argv[1],str(ROOT/'tools/local-server.mjs')],cwd=ROOT,env=dict(os.environ,WAKPPU_LOCAL_PORT=str(port),WAKPPU_LOCAL_HALLOWEEN_BOX_PREVIEW='1',WAKPPU_LOCAL_SLEEP_TIME='2026-10-23T12:00:00+09:00'),stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,encoding='utf8')
  try:
   assert server.stdout.readline().startswith('Local preview:');server.stdout.readline();server.stdout.readline()
   ctx=browser.new_context(viewport={'width':width,'height':height},has_touch=True,is_mobile=width<900,reduced_motion='reduce' if width==390 else 'no-preference');ctx.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base) else r.fulfill(status=200,body=''));page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('dialog',lambda d:d.accept());page.goto(base);page.wait_for_load_state('networkidle');page.evaluate("async()=>{await WakppuAuth.signIn('guest','');await WakppuItemGame.restore()}");page.wait_for_function('WakppuItemGame.read().ready')
   def fixture(mode):page.evaluate("async mode=>{const s=JSON.parse(sessionStorage.getItem('wakppu-local-session'));const r=await fetch('/local/halloween-decor-demo',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+s.token},body:JSON.stringify({mode})});if(!r.ok)throw Error(await r.text());await WakppuHalloweenDecorUI.refresh();await WakppuLimited.refresh();}",mode)
   def state():return page.evaluate("WakppuAuth.invoke('halloween_cosmetics')")
   fixture('exchange');candy=page.locator('#halloweenCurrency');shop=page.locator('#shop');panel=page.locator('#shopHalloween');expect(candy).to_be_visible();assert candy.evaluate('e=>e.tagName')=='BUTTON';assert candy.bounding_box()['height']>=44;expect(page.locator('#halloweenCurrencyValue')).to_have_text('0')
   page.locator('#shopBtn').tap();expect(panel).to_be_hidden();expect(page.locator('#shopHalloweenTab')).to_have_count(0);expect(page.locator('.shop-tabs [role=tab]')).to_have_count(3);page.locator('[data-close="shop"]').tap()
   candy.focus();page.keyboard.press('Enter');expect(panel).to_be_visible();expect(page.locator('.shop-tabs')).to_be_hidden();expect(page.locator('#shopTitle')).to_have_text('🎃 할로윈 상점');expect(page.locator('#halloweenDecorShop .hdecor-open')).to_be_disabled()
   pets=page.locator('#halloweenPetsTab');skins=page.locator('#halloweenSkinsTab');pet_panel=page.locator('#shopHalloweenPets');skin_panel=page.locator('#shopHalloweenSkins')
   expect(pet_panel).to_be_visible();expect(skin_panel).to_be_hidden();expect(pets).to_have_attribute('aria-selected','true')
   for tab in [pets,skins]:assert tab.bounding_box()['height']>=44
   page.locator('#shop .sheet').evaluate('(e)=>Promise.all(e.getAnimations().map(a=>a.finished.catch(()=>{})))')
   page.screenshot(path=str(ROOT/f'tools/test-results/halloween-pets-tab-{width}x{height}.png'))
   skins.tap();expect(skin_panel).to_be_visible();expect(pet_panel).to_be_hidden();expect(skins).to_have_attribute('aria-selected','true')
   assert page.locator('#shopHalloween .hdecor-open').is_hidden()
   page.locator('#shop .sheet').evaluate('(e)=>e.scrollTop=e.scrollHeight');assert skins.is_visible()
   sticky=skins.bounding_box();assert 0<=sticky['y'] and sticky['y']+sticky['height']<=height,sticky
   pets.tap();expect(pet_panel).to_be_visible();assert page.locator('#shop .sheet').evaluate('(e)=>e.scrollTop')<10
   pets.focus();page.keyboard.press('ArrowRight');expect(skins).to_be_focused();expect(skin_panel).to_be_visible()
   page.screenshot(path=str(ROOT/f'tools/test-results/halloween-skins-tab-{width}x{height}.png'))
   page.keyboard.press('Escape');expect(shop).to_be_hidden();candy.tap();expect(skin_panel).to_be_visible()
   skins.focus();page.keyboard.press('Home');expect(pets).to_be_focused();expect(pet_panel).to_be_visible()
   page.keyboard.press('End');expect(skins).to_be_focused();page.keyboard.press('ArrowLeft');expect(pets).to_be_focused();expect(skin_panel).to_be_hidden()
   page.keyboard.press('Escape');expect(shop).to_be_hidden();expect(candy).to_be_focused()
   fixture('reset');candy.tap();button=page.locator('#halloweenDecorShop .hdecor-open');expect(button).to_be_enabled();gold=state()['gold'];button.tap();page.wait_for_function('!WakppuHalloweenDecorUI.busy && document.querySelector("#halloweenCurrencyValue").textContent==="900"');assert state()['tokens']=='900';expect(page.locator('#shopHalloween .pumpkin-skin-cards .skin-card')).to_have_count(3)
   assert page.locator('#shop .sheet').evaluate('e=>e.scrollWidth<=e.clientWidth+1');page.locator('[data-close="shop"]').tap();expect(candy).to_be_focused();page.locator('#shopBtn').tap();expect(panel).to_be_hidden();expect(page.locator('.shop-tabs')).to_be_visible();expect(page.locator('#shopPurchase')).to_be_visible();page.locator('[data-close="shop"]').tap()
   fixture('exchange');candy.tap();page.locator('#halloweenDecorShop [data-hdecor-id="pumpkin_ember"]').tap();expect(shop).to_be_hidden();expect(page.locator('#inventoryPetsPage')).to_be_visible();expect(page.locator('#halloweenDecorInventory [data-hdecor-id="pumpkin_ember"]')).to_contain_text('선택 교환');page.locator('#itemsClose').tap()
   # The season closes an already-open shop; no general-store path can reopen it.
   candy.tap();fixture('ended');expect(candy).to_be_hidden();expect(shop).to_be_hidden();page.locator('#inventoryBtn').tap();page.locator('#inventoryPetsTab').tap();inventory=page.locator('#halloweenDecorInventory');inventory.locator('[data-hdecor-id="pumpkin_ember"]').tap();page.wait_for_function('!WakppuHalloweenDecorUI.busy');assert state()['owned']['pumpkin_ember'] and state()['shards']=='0' and state()['tokens']=='900' and state()['gold']==gold
   inventory.locator('[data-hdecor-id="pumpkin_ember"]').tap();page.wait_for_function('!WakppuHalloweenDecorUI.busy');assert state()['equipped']=='pumpkin_ember';inventory.locator('.hdecor-unequip').tap();page.wait_for_function('!WakppuHalloweenDecorUI.busy');assert state()['equipped'] is None;page.locator('#itemsClose').tap()
   page.locator('#shopBtn').tap();expect(panel).to_be_hidden();page.locator('#shopPurchaseTab').focus();page.keyboard.press('ArrowRight');expect(page.locator('#shopDraw')).to_be_visible();page.keyboard.press('End');expect(page.locator('#shopPremium')).to_be_visible();page.keyboard.press('Escape');expect(page.locator('#shopBtn')).to_be_focused()
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');assert not errors,errors;print(f'PASS {width}x{height}: currency entry at 0 candy, no regular-store entry, touch/keyboard/focus, box price, expiry and permanent inventory exchange/equip',flush=True);ctx.close()
  finally:server.terminate();server.wait(timeout=10)
 browser.close()
