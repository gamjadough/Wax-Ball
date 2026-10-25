"""Real local account/shop/hit routes; test-only 999 gem seed, no production traffic."""
import os,sys,socket,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,os.environ['WAKPPU_TEST_PYTHON_PATH'])
from playwright.sync_api import sync_playwright,expect
with sync_playwright() as p:
 browser=p.chromium.launch(channel='msedge',headless=True)
 for width,height,reduced in [(1200,900,False),(320,640,False),(844,390,False),(390,844,True)]:
  with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
  server=subprocess.Popen(['node',str(ROOT/'tools/local-server.mjs')],cwd=ROOT,env=dict(os.environ,WAKPPU_LOCAL_PORT=str(port),WAKPPU_LOCAL_BLUE_GEM_PREVIEW='1',WAKPPU_LOCAL_SLEEP_TIME='2026-10-25T03:00:00Z'),stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,encoding='utf8')
  try:
   assert server.stdout.readline().startswith('Local preview:');base=f'http://127.0.0.1:{port}'
   ctx=browser.new_context(viewport={'width':width,'height':height},has_touch=True,is_mobile=width<900,reduced_motion='reduce' if reduced else 'no-preference')
   ctx.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base) else r.fulfill(status=200,body=''))
   page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto(base,wait_until='networkidle')
   page.evaluate("async()=>{await WakppuAuth.signIn('guest','');await WakppuItemGame.restore();await WakppuItems.refresh();await WakppuLimited.refresh();await WakppuBlueGems.refresh();}")
   expect(page.locator('#blueGemCurrency')).to_be_visible();expect(page.locator('#blueGemValue')).to_have_text('999')
   assert page.evaluate('document.getElementById("halloweenCurrency").nextElementSibling.id')=='blueGemCurrency'
   assert page.locator('#blueGemCurrency').bounding_box()['height']>=44
   def hit_ball():
    for i in range(5):
     page.locator('#ballSvg').tap();page.wait_for_function('!WakppuItemGame.read().busy')
   gold=int(page.evaluate('WakppuItemGame.read().gold'));hit_ball()
   expect(page.locator('#blueGemValue')).to_have_text('1K');assert int(page.evaluate('WakppuItemGame.read().gold'))==gold+1
   page.locator('#blueGemCurrency').tap();expect(page.locator('#blueGemShop')).to_be_visible();expect(page.locator('[data-gem-level]')).to_have_count(7)
   expect(page.locator('[data-gem-level="2"]')).to_be_disabled()
   page.locator('[data-gem-level="1"]').tap();expect(page.locator('#blueGemStatus')).to_have_text('영구 Gold ×2 적용 완료');expect(page.locator('#blueGemValue')).to_have_text('0')
   expect(page.locator('[data-gem-level="1"]')).to_have_text('보유 중')
   page.screenshot(path=str(ROOT/f'tools/test-results/blue-gem-shop-{width}x{height}.png'))
   assert page.locator('#blueGemShop').evaluate('(e)=>e.scrollWidth<=e.clientWidth')
   page.locator('#blueGemClose').tap();expect(page.locator('#blueGemCurrency')).to_be_focused()
   gold=int(page.evaluate('WakppuItemGame.read().gold'));hit_ball();assert int(page.evaluate('WakppuItemGame.read().gold'))==gold+2;expect(page.locator('#blueGemValue')).to_have_text('1')
   page.reload(wait_until='networkidle');page.wait_for_function('WakppuItemGame.read().ready');page.evaluate('WakppuBlueGems.refresh()')
   expect(page.locator('#blueGemValue')).to_have_text('1');page.locator('#blueGemCurrency').tap();expect(page.locator('#blueGemBalance')).to_contain_text('×2')
   page.keyboard.press('Escape');expect(page.locator('#blueGemShop')).to_be_hidden();assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
   assert not errors,errors;ctx.close();print(f'PASS gems {width}x{height}: adjacent currency, guaranteed drop, actual purchase, x2 reward, reload, touch, no overflow, reduced={reduced}',flush=True)
  finally:server.terminate();server.wait(timeout=10)
 browser.close()
