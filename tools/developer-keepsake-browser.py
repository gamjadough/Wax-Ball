"""Anonymous buyer receives admin grants through real SQL, on touch layouts."""
import os,socket,subprocess,sys
from datetime import datetime,timezone,timedelta
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,os.environ['WAKPPU_TEST_PYTHON_PATH'])
from playwright.sync_api import sync_playwright,expect
with sync_playwright() as p:
 browser=p.chromium.launch(channel='msedge',headless=True)
 for width,height,reduced in [(320,640,False),(844,390,False),(390,844,True),(1200,900,False)]:
  with socket.socket() as s:s.bind(('127.0.0.1',0));port=s.getsockname()[1]
  server=subprocess.Popen([sys.argv[1],str(ROOT/'tools/local-server.mjs')],cwd=ROOT,env=dict(os.environ,WAKPPU_LOCAL_PORT=str(port),WAKPPU_LOCAL_PAYMENTS='1',WAKPPU_LOCAL_BANK_PREVIEW='1',WAKPPU_LOCAL_SLEEP_TIME='2026-10-20T12:00:00+09:00'),stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,encoding='utf8')
  try:
   assert server.stdout.readline().startswith('Local preview:');server.stdout.readline();password=server.stdout.readline().strip().split(': ',1)[1];base=f'http://127.0.0.1:{port}'
   ctx=browser.new_context(viewport={'width':width,'height':height},has_touch=True,is_mobile=width<900,reduced_motion='reduce' if reduced else 'no-preference');adminctx=browser.new_context(viewport={'width':width,'height':height},has_touch=True)
   errors=[]
   for c in [ctx,adminctx]:
    c.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base) else r.fulfill(status=200,body=''))
    c.on('page',lambda pg:pg.on('pageerror',lambda e:errors.append(str(e))))
   page=ctx.new_page();adm=adminctx.new_page()
   for pg in [page,adm]:pg.on('dialog',lambda d:d.accept());pg.goto(base+'/');pg.wait_for_load_state('networkidle')
   page.evaluate("async()=>{await WakppuAuth.signIn('guest','');await WakppuItemGame.restore()}");page.wait_for_function('WakppuItemGame.read().ready')
   before=page.evaluate("WakppuAuth.invoke('items')")
   adm.evaluate("async password=>{await WakppuAuth.signIn('dodoonglee@gmail.com',password);await WakppuItemGame.restore()}",password);adm.wait_for_function("!document.querySelector('#adminBtn').hidden");adm.locator('#adminBtn').tap()
   shortcut=adm.locator('#adminKeepsakeOpen');expect(shortcut).to_be_visible();expect(shortcut).to_be_in_viewport();assert shortcut.bounding_box()['height']>=44
   shortcut.tap();expect(adm.locator('#adminQuery')).to_be_focused();expect(adm.locator('#adminQuery')).to_be_in_viewport()
   expect(adm.locator('#adminKeepsakeGrant')).to_be_disabled()
   adm.locator('#adminQuery').fill('테스트플레이어');adm.locator('#adminSearch').tap();adm.locator('#adminResults .admin-player').filter(has_text='테스트플레이어').tap()
   expect(adm.locator('#adminKeepsakeTarget')).to_contain_text('테스트플레이어');expect(adm.locator('#adminKeepsakeReason')).to_be_focused();expect(adm.locator('#adminKeepsakeReason')).to_be_in_viewport()
   adm.locator('#admin .sheet').evaluate('e=>e.scrollTop=0');shortcut.tap();expect(adm.locator('#adminKeepsakeReason')).to_be_focused()
   expect(adm.locator('#adminKeepsakeGrant')).to_be_enabled();adm.locator('#adminKeepsakeReason').fill('영구 소장품 테스트')
   grant=adm.locator('#adminKeepsakeGrant');assert grant.bounding_box()['height']>=44;grant.tap();expect(adm.locator('#adminKeepsakeOwned')).to_have_text('영구 보유 중');expect(grant).to_be_disabled()
   assert adm.locator('#admin .sheet').evaluate('e=>e.scrollWidth<=e.clientWidth+1')
   assert adm.evaluate('document.documentElement.scrollWidth<=innerWidth')
   page.locator('#inventoryBtn').tap();card=page.locator('[data-item="developer_piercing_fragment"]');expect(card).to_be_visible();card.tap()
   expect(page.locator('#itemDetailName')).to_have_text('누군가의 엉덩이 피어싱 조각')
   expect(page.locator('#inventoryDetailContent')).to_contain_text('더럽다');expect(page.locator('#inventoryDetailContent')).to_contain_text('영구 보유')
   image=page.locator('#inventoryDetailContent img');expect(image).to_be_visible();assert image.evaluate('e=>e.complete&&e.naturalWidth===320')
   use=page.locator('[data-use="developer_piercing_fragment"]');assert use.bounding_box()['height']>=44
   clock_time=datetime(2026,10,21,3,tzinfo=timezone.utc);page.clock.install(time=clock_time);page.clock.pause_at(clock_time+timedelta(seconds=1))
   for i in range(3):
    if i:page.clock.fast_forward(5000)
    use.tap();expect(page.locator('#itemsStatus')).to_have_text('더럽다');expect(use).to_be_enabled()
   after=page.evaluate("WakppuAuth.invoke('items')");assert after['gold']==before['gold'] and after['effects']==before['effects'] and after['revision']==before['revision'] and after['pity']==before['pity'] and after['total']==before['total']
   assert after['inventory']['developer_piercing_fragment']==1
   overlay=page.locator('#keepsakeDisplay');expect(overlay).to_be_visible()
   display_key=page.evaluate("'wakppuball:keepsake-display:'+WakppuItemGame.read().account")
   deadline=page.evaluate('(key)=>Number(localStorage.getItem(key))',display_key);assert deadline-page.evaluate('Date.now()')==600000
   assert overlay.evaluate("e=>getComputedStyle(e).pointerEvents==='none'&&getComputedStyle(e.querySelector('img')).pointerEvents==='none'")
   assert overlay.locator('img').evaluate('e=>e.complete&&e.naturalWidth===320')

   assert page.locator('#itemsModal .sheet').evaluate('e=>e.scrollWidth<=e.clientWidth+1');assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
   out=ROOT/'tools/test-results';out.mkdir(exist_ok=True);page.screenshot(path=str(out/f'developer-keepsake-{width}.png'))
   page.locator('#itemsClose').tap();expect(overlay).to_be_in_viewport()
   box=overlay.bounding_box();assert box['x']>=0 and box['y']>=0 and box['x']+box['width']<=width and box['y']+box['height']<=height
   assert overlay.evaluate("e=>{const r=e.getBoundingClientRect();return !e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}")
   clicks=page.evaluate('WakppuBeginnerRead().clicks')
   page.locator('#ballWrap .hit').first.tap()
   page.wait_for_function('(old)=>WakppuBeginnerRead().clicks!==old',arg=clicks)
   page.screenshot(path=str(out/f'keepsake-display-{width}.png'))
   page.reload();page.wait_for_function('WakppuItemGame.read().ready');expect(overlay).to_be_visible()
   assert page.evaluate('(key)=>Number(localStorage.getItem(key))',display_key)==deadline
   page.clock.fast_forward(540000);expect(overlay).to_be_visible();page.clock.fast_forward(61000);expect(overlay).to_have_count(0)
   assert page.evaluate('(key)=>localStorage.getItem(key)',display_key) is None
   page.locator('#inventoryBtn').tap();expect(page.locator('[data-item="developer_piercing_fragment"]')).to_be_visible()

   adm.locator('#adminQuery').fill('존재하지않는계정');adm.locator('#adminSearch').tap();expect(adm.locator('#adminKeepsakeGrant')).to_be_disabled()
   assert not errors,errors
   print(f'PASS developer keepsake {width}x{height}, reduced={reduced}: top shortcut, search/selection navigation, anonymous grant, permanent repeated use, no effects/gold changes, 10-minute display/reuse/reload/expiry, click-through, image and selection clearing',flush=True)
   ctx.close();adminctx.close()
  finally:server.terminate();server.wait(timeout=10)
 browser.close()
