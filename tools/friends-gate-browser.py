"""Entry-code UI: loopback SQL fixture only; never uses the real entry code."""
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
   expect(page.locator('#friendGate')).to_be_visible()
   expect(page.locator('#game')).not_to_be_visible()
   assert not page.locator('#friendGatePassword').input_value()
   page.locator('#friendGatePassword').fill('incorrect')
   page.locator('#friendGateSubmit').tap()
   expect(page.locator('#friendGateStatus')).to_contain_text('맞지 않습니다')
   expect(page.locator('#game')).not_to_be_visible()
   page.locator('#friendGatePassword').fill('fixture-entry-only')
   page.locator('#friendGateSubmit').tap()
   expect(page.locator('#friendGate')).to_be_hidden()
   expect(page.locator('#game')).to_be_visible()
   assert not page.evaluate('document.documentElement.scrollWidth>innerWidth+1')
   page.reload(wait_until='networkidle');expect(page.locator('#friendGate')).to_be_hidden()
   page.goto(base+'/wakppuball-admin/?server=friends',wait_until='networkidle')
   expect(page.locator('#friendGate')).to_be_hidden()
   expect(page.locator('#loginSection')).to_be_visible()
   page.request.post(base+'/friends/fixture/expire')
   page.evaluate("async()=>{try{await WakppuAuth.invoke('status')}catch{}}")
   expect(page.locator('#friendGate')).to_be_visible()
   page.screenshot(path=str(ROOT/f'tools/test-results/friends-gate-{width}.png'),full_page=False)
   page.goto(base+'/wakppuball-admin/?server=public',wait_until='networkidle')
   expect(page.locator('#friendGate')).to_have_count(0)
   expect(page.locator('#loginSection')).to_be_visible()
   assert not errors,errors
   print(f'PASS {width}x{height}: wrong/right code, reload persistence, shared admin access, expiration and public isolation',flush=True)
  except Exception:
   print('Errors:',errors,'Gate:',page.locator('#friendGateStatus').text_content() if page.locator('#friendGateStatus').count() else 'none',flush=True)
   page.screenshot(path=str(ROOT/'tools/test-results/friends-gate-failure.png'),full_page=True)
   raise
  finally:ctx.close()
 browser.close()
