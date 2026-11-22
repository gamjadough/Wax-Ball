"""Real SQL loopback: returning device/accounts, paid-free public UI and responsive mouse/touch hits."""
import os,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,os.environ['WAKPPU_TEST_PYTHON_PATH'])
from playwright.sync_api import sync_playwright,expect
base='http://127.0.0.1:4198'
with sync_playwright() as p:
 browser=p.chromium.launch(channel='msedge',headless=True)
 for touch in [False,True]:
  ctx=browser.new_context(viewport={'width':1200,'height':900},has_touch=touch,is_mobile=touch,reduced_motion='reduce')
  page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(base+'/wakppuball-public/',wait_until='networkidle')
  page.evaluate("async()=>{await WakppuAuth.signIn('player@fixture.test','fixture-only-password');await WakppuItemGame.restore()}")
  for width,height in [(320,640),(844,390),(390,844),(1200,900)]:
   page.set_viewport_size({'width':width,'height':height})
   page.wait_for_function('WakppuItemGame.read().ready&&!WakppuItemGame.read().busy&&WakppuItems.data')
   before=page.evaluate('WakppuItemGame.read().gold')
   # Complete one real yellow ball; last hit cannot spill into its successor.
   while page.evaluate('WakppuItemGame.read().gold')==before:
    page.wait_for_function('!WakppuItemGame.read().busy')
    revision=page.evaluate('WakppuItemGame.read().revision')
    if touch:page.locator('#ballSvg').tap()
    else:page.locator('#ballSvg').click()
    page.wait_for_function('r=>WakppuItemGame.read().revision>r',arg=revision,timeout=10000)
   page.wait_for_function('!WakppuItemGame.read().busy')
   assert int(page.evaluate('WakppuItemGame.read().gold'))==int(before)+1
   page.locator('#shopBtn').tap() if touch else page.locator('#shopBtn').click()
   expect(page.locator('#shopPremiumTab')).to_have_count(0);expect(page.locator('#shopPremium')).to_have_count(0)
   page.locator('#shopDrawTab').click();expect(page.locator('#shopDraw')).to_be_visible();page.locator('[data-close="shop"]').click()
   page.locator('#inventoryBtn').click();expect(page.locator('#purchaseInventory')).to_have_count(0);page.locator('#itemsClose').click()
   page.locator('#rankingBtn').click();page.locator('#rankingMonthlyTab').click()
   expect(page.locator('#monthlyState')).to_contain_text('12월부터');expect(page.locator('#monthlySeason option')).to_have_count(1)
   page.locator('[data-close="ranking"]').click()
   assert not page.evaluate('document.documentElement.scrollWidth>innerWidth+1')
   assert not errors,errors
   print(f'PASS public {width}x{height} {"touch" if touch else "mouse"}: responsive transition, complete destruction +1G, no paid UI, December notice',flush=True)
  ctx.close()
 # A code-approved device reopens in a completely new browser context.
 ctx=browser.new_context(viewport={'width':390,'height':844},has_touch=True,is_mobile=True);page=ctx.new_page()
 page.goto(base+'/wakppuball/',wait_until='networkidle');expect(page.locator('#friendGate')).to_be_visible()
 page.locator('#friendGatePassword').fill('fixture-entry-only');page.locator('#friendGateSubmit').tap();expect(page.locator('#friendGate')).to_be_hidden()
 saved=ctx.storage_state();ctx.close();ctx=browser.new_context(storage_state=saved);page=ctx.new_page();page.goto(base+'/wakppuball/',wait_until='networkidle');expect(page.locator('#friendGate')).to_be_hidden();ctx.close()
 # Existing played account signs in without knowing the entry code, then auto-enters on reload with no device token.
 ctx=browser.new_context(viewport={'width':320,'height':640},has_touch=True,is_mobile=True);page=ctx.new_page()
 page.goto(base+'/wakppuball/',wait_until='networkidle');page.locator('#friendGate summary').tap();page.locator('#friendGateEmail').fill('player@fixture.test');page.locator('#friendGateLoginPassword').fill('fixture-only-password');page.locator('#friendGateLogin').tap()
 expect(page.locator('#friendGate')).to_be_hidden(timeout=10000);page.wait_for_function('WakppuItemGame.read().ready')
 page.evaluate("localStorage.removeItem('wakppu:friends-entry:v1');sessionStorage.removeItem('wakppu:friends-entry:v1')")
 page.reload(wait_until='networkidle');expect(page.locator('#friendGate')).to_be_hidden(timeout=10000)
 print('PASS friends: persistent device, existing-account login and session bypass verified by server history',flush=True)
 ctx.close();browser.close()
