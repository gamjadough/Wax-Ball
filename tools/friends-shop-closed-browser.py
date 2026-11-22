"""Friends shop UI on the loopback admin-site fixture; no production mutations."""
import os,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,os.environ['WAKPPU_TEST_PYTHON_PATH'])
from playwright.sync_api import sync_playwright,expect
base='http://127.0.0.1:'+os.environ.get('WAKPPU_ADMIN_TEST_PORT','4198')
with sync_playwright() as p:
 browser=p.chromium.launch(channel='msedge',headless=True)
 for width,height in [(320,640),(844,390),(1200,900)]:
  ctx=browser.new_context(viewport={'width':width,'height':height},has_touch=True,is_mobile=width<900)
  page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  try:
   page.goto(base+'/wakppuball/',wait_until='networkidle')
   page.locator('#friendGatePassword').fill('fixture-entry-only');page.locator('#friendGateSubmit').tap()
   expect(page.locator('#friendGate')).to_be_hidden()
   page.locator('#shopBtn').tap();page.locator('#shopPremiumTab').tap()
   expect(page.locator('#purchaseNotice')).to_contain_text('친구 서버에서는 유료 상점을 이용할 수 없습니다')
   expect(page.locator('#purchaseProducts button')).to_have_count(0)
   expect(page.locator('#purchaseDepositor')).to_be_hidden()
   page.locator('[data-close="shop"]').tap();page.locator('#accountBtn').tap()
   page.locator('#accountEmail').fill('player@fixture.test');page.locator('#accountPassword').fill('fixture-only-password');page.locator('#signInBtn').tap()
   page.wait_for_function('WakppuItemGame.read().ready')
   page.locator('#shopBtn').tap();page.locator('#shopPremiumTab').tap()
   expect(page.locator('#purchaseNotice')).to_contain_text('친구 서버에서는 유료 상점을 이용할 수 없습니다')
   expect(page.locator('#purchaseProducts button')).to_have_count(0)
   expect(page.locator('[data-purchase-claim]')).to_have_count(0)
   assert page.evaluate("async()=>{try{await WakppuAuth.invoke('purchase_order',{product_id:'supporter_pack'});return false}catch(e){return e.status===403}}")
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
   page.screenshot(path=str(ROOT/f'tools/test-results/friends-shop-closed-{width}.png'),full_page=True)
   assert not errors,errors
   print(f'PASS {width}x{height}: closed notice before/after login, no order/deposit controls, direct API denied, no overflow',flush=True)
  finally:ctx.close()
 browser.close()
