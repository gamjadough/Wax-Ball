"""Real gameplay: base/skin scares, lunar theme, permanent candy purchase and touch shop."""
import os,socket,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,os.environ['WAKPPU_TEST_PYTHON_PATH'])
from playwright.sync_api import sync_playwright,expect
with sync_playwright() as p:
 browser=p.chromium.launch(channel='msedge',headless=True)
 for w,h,reduced in [(320,640,False),(844,390,False),(390,844,True),(1200,900,False)]:
  if os.environ.get('WAKPPU_TEST_ONLY_WIDTH') and str(w)!=os.environ['WAKPPU_TEST_ONLY_WIDTH']:continue
  with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
  env=dict(os.environ,WAKPPU_LOCAL_PORT=str(port),WAKPPU_LOCAL_PUMPKIN_SKINS_PREVIEW='1',WAKPPU_LOCAL_SLEEP_TIME='2026-10-21T12:00:00+09:00')
  server=subprocess.Popen([sys.argv[1],str(ROOT/'tools/local-server.mjs')],cwd=ROOT,env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,encoding='utf8')
  try:
   assert server.stdout.readline().startswith('Local preview:');base=f'http://127.0.0.1:{port}'
   c=browser.new_context(viewport={'width':w,'height':h},has_touch=True,is_mobile=w<900,reduced_motion='reduce' if reduced else 'no-preference');page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('dialog',lambda d:d.accept())
   page.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base) else r.fulfill(status=200,body=''))
   page.add_init_script("document.addEventListener('DOMContentLoaded',()=>{const s=document.createElement('style');s.textContent='.halloween-local{display:none!important}';document.head.append(s);});window.stings=[];const play=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){if(this.src.includes('jackolantern-sting.wav'))stings.push(this);return play.call(this);};")
   page.goto(base+'/?preview=halloween');page.wait_for_function('WakppuItemGame.read().ready && WakppuLimited.data?.tokens===450');page.evaluate('WakppuPumpkinInventory.refresh()');page.wait_for_function('!!WakppuPumpkinInventory.data')
   page.locator('#shopBtn').tap();page.locator('#shopHalloweenTab').tap();expect(page.locator('#shopHalloween .skin-card')).to_have_count(3);expect(page.locator('#shopPurchase .pumpkin-skin-section')).to_have_count(0)
   expect(page.locator('#shopHalloweenTab')).to_have_attribute('aria-selected','true');expect(page.locator('#shopHalloweenTab')).to_have_css('min-height','44px');page.wait_for_function("document.querySelector('#shopHalloweenTab').getBoundingClientRect().height>=43.5")
   page.locator('[data-pumpkin-exchange="pumpkin_eclipse"]').first.tap();page.wait_for_function('!WakppuPumpkinInventory.busy && WakppuPumpkinInventory.data.owned.pumpkin_eclipse')
   page.locator('[data-close="shop"]').tap();page.locator('#collectionBtn').tap();page.locator('#limitedCollectionTab').tap();page.locator('[data-limited-detail]').tap();page.locator('[data-limited-buy]').tap();page.wait_for_function('!WakppuLimited.busy&&!!WakppuLimited.data.owned[WakppuLimitedData.ball.id]');page.locator('[data-limited-select]').tap()
   # Force the lottery only; retain the production permission gate and scheduler.
   page.evaluate("Math.random=()=>0;const start=WakppuHalloweenEffects.startScare;WakppuHalloweenEffects.startScare=o=>start({...o,random:()=>0});WakppuSettings.set({muted:false,sfx:true});")
   def hit(scare,theme=False):
    page.wait_for_function('!WakppuItemGame.read().busy');gold=int(page.evaluate('WakppuItemGame.read().gold'));page.locator('#ballSvg').tap()
    if scare:
     expect(page.locator('.jackolantern-scare')).to_be_visible();expect(page.locator('.scare-blood-moon')).to_have_count(1 if theme else 0)
     assert page.locator('.jackolantern-scare-close').bounding_box()['height']>=43.5
     if theme:page.screenshot(path=str(ROOT/f'tools/test-results/lunar-scare-{w}.png'))
     else:page.locator('.jackolantern-scare-close').tap()
    page.wait_for_function('(g)=>BigInt(WakppuItemGame.read().gold)===BigInt(g)+1500000000n',arg=str(gold));page.wait_for_function('!WakppuItemGame.read().busy');assert page.locator('.jackolantern-scare').count()==0
    assert int(page.evaluate('WakppuItemGame.read().gold'))==gold+1500000000
   hit(True)
   page.locator('#inventoryBtn').tap();page.locator('#inventorySkinsTab').tap();page.locator('#inventorySkinsPage [data-pumpkin-equip="pumpkin_eclipse"]').tap();page.wait_for_function('!WakppuPumpkinInventory.busy&&WakppuPumpkinInventory.equipped()==="eclipse"');page.locator('#itemsClose').tap();hit(True,True)
   page.evaluate('WakppuSettings.set({muted:true})');muted_count=page.evaluate('stings.length');hit(True,True);assert page.evaluate('stings.length')==muted_count;page.evaluate('WakppuSettings.set({muted:false})')
   page.locator('#shopBtn').tap();page.locator('#shopHalloweenTab').tap();card=page.locator('#shopHalloween [data-pumpkin-equip="pumpkin_eclipse"]');expect(card).to_contain_text('장착 해제');card.tap();page.wait_for_function('!WakppuPumpkinInventory.busy&&!WakppuPumpkinInventory.equipped()');expect(page.locator('#ballSvg [data-pumpkin-skin]')).to_have_count(0);card.tap();page.wait_for_function('!WakppuPumpkinInventory.busy&&WakppuPumpkinInventory.equipped()==="eclipse"');before=int(page.evaluate('WakppuPumpkinInventory.data.tokens'));buy=page.locator('#pumpkinScareDisable');expect(buy).to_be_enabled();buy.scroll_into_view_if_needed();page.screenshot(path=str(ROOT/f'tools/test-results/halloween-shop-{w}.png'));buy.tap();page.wait_for_function('!WakppuPumpkinInventory.busy&&WakppuPumpkinInventory.data.scare_disabled');assert int(page.evaluate('WakppuPumpkinInventory.data.tokens'))==before-100;expect(buy).to_contain_text('장착 해제')
   assert page.locator('#shop .sheet').evaluate('e=>e.scrollWidth<=e.clientWidth+1');page.locator('[data-close="shop"]').tap();n=page.evaluate('stings.length');hit(False);assert page.evaluate('stings.length')==n
   page.locator('#shopBtn').tap();page.locator('#shopHalloweenTab').tap();balance=page.evaluate('WakppuPumpkinInventory.data.tokens');buy.tap();page.wait_for_function('!WakppuPumpkinInventory.busy&&!WakppuPumpkinInventory.data.scare_disabled');assert page.evaluate('WakppuPumpkinInventory.data.tokens')==balance;page.locator('[data-close="shop"]').tap();hit(True,True);page.locator('#shopBtn').tap();page.locator('#shopHalloweenTab').tap();buy.tap();page.wait_for_function('!WakppuPumpkinInventory.busy&&WakppuPumpkinInventory.data.scare_disabled');page.locator('[data-close="shop"]').tap()
   page.reload();page.wait_for_function('WakppuPumpkinInventory.data?.scare_disabled && WakppuLimited.data?.selected');assert not page.evaluate('WakppuPumpkinInventory.scareAllowed()')
   page.locator('#inventoryBtn').tap();page.locator('#inventorySkinsTab').tap();toggle=page.locator('#pumpkinScareDisableInventory');expect(toggle).to_be_enabled();tokens=page.evaluate('WakppuPumpkinInventory.data.tokens');toggle.tap();page.wait_for_function('!WakppuPumpkinInventory.busy&&!WakppuPumpkinInventory.data.scare_disabled');toggle.tap();page.wait_for_function('!WakppuPumpkinInventory.busy&&WakppuPumpkinInventory.data.scare_disabled');assert page.evaluate('WakppuPumpkinInventory.data.tokens')==tokens;page.locator('#pumpkinSkinUnequip').tap();page.wait_for_function('!WakppuPumpkinInventory.busy&&!WakppuPumpkinInventory.equipped()');page.locator('#itemsClose').tap();assert not page.evaluate('WakppuPumpkinInventory.scareAllowed()');expect(page.locator('#ballSvg [data-pumpkin-skin]')).to_have_count(0)
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');assert not errors,errors
   print(f'PASS Halloween shop/base+lunar scare/permanent opt-out {w}x{h} reduced={reduced}',flush=True);c.close()
  finally:server.terminate();server.wait(timeout=10)
 browser.close()
