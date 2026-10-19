"""Loopback-only mock checkout: real redirects, recovery, refunds, cosmetics and touch."""
import os,socket,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,os.environ['WAKPPU_TEST_PYTHON_PATH'])
from playwright.sync_api import sync_playwright,expect
with socket.socket() as s:s.bind(('127.0.0.1',0));port=s.getsockname()[1]
server=subprocess.Popen([sys.argv[1],str(ROOT/'tools/local-server.mjs')],cwd=ROOT,env=dict(os.environ,WAKPPU_LOCAL_PORT=str(port),WAKPPU_LOCAL_PAYMENTS='1'),stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,encoding='utf8')
try:
 assert server.stdout.readline().startswith('Local preview:');base=f'http://127.0.0.1:{port}'
 with sync_playwright() as p:
  browser=p.chromium.launch(channel='msedge',headless=True)
  for width,height,reduced in [(320,640,False),(844,390,False),(390,844,True),(1200,900,False)]:
   context=browser.new_context(viewport={'width':width,'height':height},has_touch=True,is_mobile=width<900,reduced_motion='reduce' if reduced else 'no-preference');page=context.new_page();errors=[];external=[]
   page.on('pageerror',lambda e:errors.append(str(e)))
   def route(r):
    if r.request.url.startswith(base):r.continue_()
    else:
     external.append(r.request.url);r.fulfill(status=200,body='')
   page.route('**/*',route);page.on('dialog',lambda d:d.accept())
   def catalog():return page.evaluate("async()=>{const m=await import('/local-payments/client.js');return m.payment({action:'catalog'});}")
   def store():
    page.wait_for_url('**/?preview=payments**');expect(page.locator('#mockStore')).to_be_visible();page.wait_for_function("document.querySelectorAll('[data-mock-buy]').length===2")
   def buy(product):
    page.locator('[data-mock-buy="'+product+'"]').tap();page.wait_for_url('**/local-payments/checkout.html?order=*');expect(page.locator('#mockPay')).to_be_enabled()
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    assert page.locator('#mockPay').bounding_box()['height']>=44
   page.goto(base+'/?preview=payments');store()
   # One local actor is shared across viewports; restore a clean demo state via refunds.
   for o in catalog()['orders']:
    if o['status'] in ['paid','fulfilled']:
     page.evaluate("async id=>{const m=await import('/local-payments/client.js');return m.payment({action:'refund',order_id:id});}",o['id'])
   page.reload();store()
   if not catalog()['eligible']:
    expect(page.locator('[data-mock-buy="supporter_pack"]')).to_be_disabled()
    page.get_by_role('button',name='로컬에서 이메일 연결 완료 가정').tap()
   expect(page.locator('[data-mock-buy="supporter_pack"]')).to_be_enabled()
   initial=page.evaluate('WakppuItemGame.read().gold')
   buy('supporter_pack');page.locator('#mockCancel').tap();store();assert not catalog()['owned']
   buy('supporter_pack');page.locator('#mockFail').tap();store();assert not catalog()['owned']
   buy('supporter_pack');page.locator('#mockPay').tap();store()
   expect(page.locator('[data-mock-buy="supporter_pack"]')).to_be_disabled()
   expect(page.locator('.mock-supporter-badge')).to_be_visible()
   assert catalog()['owned']['supporter_pack']
   assert page.evaluate('WakppuItemGame.read().gold')==initial
   buy('starlight_skin');page.locator('#mockDefer').tap();store()
   assert not catalog()['owned'].get('starlight_skin')
   page.reload();store();page.locator('[data-recover]').tap();expect(page.locator('#mockEquip')).to_be_visible()
   page.locator('#mockEquip').tap();page.wait_for_function("document.documentElement.classList.contains('mock-starlight')")
   if reduced:assert page.locator('#ballWrap').evaluate("e=>getComputedStyle(e,'::before').animationName")=='none'
   page.reload();store();page.wait_for_function("document.documentElement.classList.contains('mock-starlight')")
   assert page.evaluate('WakppuItemGame.read().gold')==initial
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
   sheet=page.locator('#mockStore .sheet');assert sheet.evaluate('e=>e.scrollWidth<=e.clientWidth+1')
   out=ROOT/'tools/test-results';out.mkdir(parents=True,exist_ok=True);page.screenshot(path=str(out/f'payment-store-{width}.png'))
   page.locator('#mockClose').tap();page.locator('#mockShopBtn').tap();expect(page.locator('#mockStore')).to_be_visible()
   paidSkin=next(o for o in catalog()['orders'] if o['product_id']=='starlight_skin' and o['status']=='fulfilled')
   page.locator('[data-refund="'+paidSkin['id']+'"]').tap()
   expect(page.locator('#mockEquip')).to_have_count(0);assert 'mock-starlight' not in (page.locator('html').get_attribute('class') or '')
   assert page.evaluate('WakppuItemGame.read().gold')==initial
   assert not any('tosspayments' in url for url in external)
   assert not errors,errors
   context.close();print(f'PASS {width}x{height} reduced={reduced}: cancel/fail, purchase, recovery/reload, equip/refund, no Gold change',flush=True)
  # Default local server page must not inject the mock storefront.
  page=browser.new_page();page.route('**/*',route);page.goto(base+'/');expect(page.locator('#mockShopBtn')).to_have_count(0);page.close()
  browser.close()
finally:server.terminate();server.wait(timeout=10)
