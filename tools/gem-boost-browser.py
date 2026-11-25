"""Isolated shop/inventory/touch tests. No production accounts or requests."""
import os,sys,socket,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,os.environ['WAKPPU_TEST_PYTHON_PATH'])
from playwright.sync_api import sync_playwright,expect
with sync_playwright() as p:
 browser=p.chromium.launch(channel='msedge',headless=True)
 for width,height,reduced in [(1200,900,False),(320,640,False),(844,390,False),(390,844,True)]:
  with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
  server=subprocess.Popen(['node',str(ROOT/'tools/local-server.mjs')],cwd=ROOT,env=dict(os.environ,WAKPPU_LOCAL_PORT=str(port),WAKPPU_LOCAL_GEM_BOOST_PREVIEW='1',WAKPPU_LOCAL_SLEEP_TIME='2026-10-29T03:00:00Z'),stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,encoding='utf8')
  try:
   assert server.stdout.readline().startswith('Local preview:');base=f'http://127.0.0.1:{port}'
   ctx=browser.new_context(viewport={'width':width,'height':height},has_touch=True,is_mobile=width<900,reduced_motion='reduce' if reduced else 'no-preference')
   ctx.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base) else r.fulfill(status=200,body=''))
   page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto(base,wait_until='networkidle');page.evaluate("async()=>{await WakppuAuth.signIn('guest','');await WakppuItemGame.restore();await WakppuItems.refresh();await WakppuBlueGems.refresh();}")
   page.locator('#blueGemCurrency').tap();expect(page.locator('[data-gem-level]')).to_have_count(7)
   page.locator('[data-gem-tab="items"]').tap();expect(page.locator('#blueGemBoostBuy')).to_be_enabled()
   assert page.locator('[data-gem-tab="items"]').bounding_box()['height']>=44
   for balance in ['200','100']:
    page.locator('#blueGemBoostBuy').tap();expect(page.locator('#blueGemValue')).to_have_text(balance);expect(page.locator('#blueGemStatus')).to_contain_text('구매 완료')
   assert page.evaluate('WakppuBlueGems.factor()')==1
   page.screenshot(path=str(ROOT/f'tools/test-results/gem-boost-shop-{width}x{height}.png'))
   assert page.locator('#blueGemShop').evaluate('(e)=>e.scrollWidth<=e.clientWidth')
   page.locator('#blueGemClose').tap();page.locator('#inventoryBtn').tap();page.locator('[data-filter="rare"]').tap();page.locator('[data-item="blue_gem_boost"]').tap()
   page.locator('[data-use="blue_gem_boost"]').tap();page.wait_for_function('WakppuBlueGems.factor()===2 && !WakppuItems.busy')
   expiry=page.evaluate('WakppuBlueGems.data.boost.expires_at');page.locator('[data-use="blue_gem_boost"]').tap();page.wait_for_function('!WakppuItems.busy && WakppuItems.data.inventory.blue_gem_boost===0')
   assert page.evaluate('WakppuBlueGems.data.boost.expires_at')-expiry==600000
   expect(page.locator('#itemEffects')).to_contain_text('푸른젬 증폭 물약');page.locator('#itemsClose').tap()
   page.locator('#ballSvg').tap();page.wait_for_function('!WakppuItemGame.read().busy && WakppuBlueGems.data.balance==="102"')
   page.reload(wait_until='networkidle');page.wait_for_function('WakppuItemGame.read().ready');page.evaluate('WakppuItems.refresh()');page.wait_for_function('WakppuBlueGems.factor()===2')
   assert page.evaluate('WakppuItems.data.inventory.blue_gem_boost')==0
   # Select an owned first gem ball through the same authoritative API used by the UI.
   page.evaluate("async()=>{const r=await WakppuAuth.invoke('gem_ball_select',{ball_id:'blue-crystal-wax',item_revision:WakppuItemGame.read().revision,request_id:crypto.randomUUID()});WakppuItems.accept(r);await WakppuItemGame.restore();}")
   page.wait_for_function('!WakppuItemGame.read().busy');page.locator('#ballSvg').tap();page.wait_for_function('!WakppuItemGame.read().busy && WakppuBlueGems.data.balance==="112"')
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');assert not errors,errors
   ctx.close();print(f'PASS boost {width}x{height}: tabs, paid stock, inventory use, +10min, x2 ordinary/crystal, reload, touch, reduced={reduced}',flush=True)
  finally:server.terminate();server.wait(timeout=10)
 browser.close()
