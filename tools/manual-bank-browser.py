"""Real purchase SQL in the isolated local server; mobile shop tabs and admin grants."""
import os,socket,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,os.environ['WAKPPU_TEST_PYTHON_PATH'])
from playwright.sync_api import sync_playwright,expect
with socket.socket() as s:s.bind(('127.0.0.1',0));port=s.getsockname()[1]
server=subprocess.Popen([sys.argv[1],str(ROOT/'tools/local-server.mjs')],cwd=ROOT,env=dict(os.environ,WAKPPU_LOCAL_PORT=str(port),WAKPPU_LOCAL_PAYMENTS='1',WAKPPU_LOCAL_BANK_PREVIEW='1',WAKPPU_LOCAL_SLEEP_TIME='2026-10-19T12:00:00+09:00'),stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,encoding='utf8')
try:
 assert server.stdout.readline().startswith('Local preview:');server.stdout.readline();password=server.stdout.readline().strip().split(': ',1)[1];base=f'http://127.0.0.1:{port}'
 with sync_playwright() as p:
  browser=p.chromium.launch(channel='msedge',headless=True)
  for width,height,reduced in [(320,640,False),(844,390,False),(390,844,True),(1200,900,False)]:
   ctx=browser.new_context(viewport={'width':width,'height':height},has_touch=True,is_mobile=width<900,reduced_motion='reduce' if reduced else 'no-preference');page=ctx.new_page();errors=[]
   page.on('pageerror',lambda e:errors.append(str(e)))
   page.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base) else r.fulfill(status=200,body=''));page.on('dialog',lambda d:d.accept())
   def rpc(action,**payload):return page.evaluate('async b=>WakppuAuth.invoke(b.action,b)',dict(action=action,**payload))
   def login(admin=False):
    page.evaluate("async p=>{const r=await WakppuAuth.signIn(p.admin?'dodoonglee@gmail.com':'guest',p.admin?p.password:'');if(r.error)throw r.error;await WakppuItemGame.restore();}",{'admin':admin,'password':password})
    page.wait_for_function('WakppuItemGame.read().ready')
   def shop():
    if page.locator('#admin').is_visible():page.locator('[data-close="admin"]').click()
    if page.locator('#shop').is_hidden():page.locator('#shopBtn').tap()
    page.locator('#shopPremiumTab').tap();expect(page.locator('#shopPremium')).to_be_visible();page.wait_for_function("document.querySelectorAll('[data-purchase-product]').length===2")
   page.goto(base+'/?preview=bank');expect(page.locator('#shopPremium')).to_be_visible();page.wait_for_function("document.querySelectorAll('[data-purchase-product]').length===2")
   # Reset only the shared isolated SQL fixture's previous viewport purchases.
   login(True)
   for o in rpc('admin_purchase_orders')['orders']:
    if o['status']=='approved':rpc('admin_purchase_refund',order_id=o['id'],refund_reference='local test cleanup')
   login();shop()
   gold=page.evaluate('WakppuItemGame.read().gold')
   page.locator('#purchaseDepositor').fill('입금테스트')
   page.locator('[data-purchase-product="supporter_pack"]').tap()
   page.wait_for_function("document.querySelector('#purchaseHistory .purchase-order')")
   order=rpc('purchase_catalog')['orders'][0]
   expect(page.locator('[data-purchase-order="'+order['id']+'"]')).to_contain_text('000-0000-0000')
   page.locator('[data-purchase-claim="'+order['id']+'"]').tap()
   expect(page.locator('[data-purchase-order="'+order['id']+'"]')).to_contain_text('관리자 확인 대기')
   assert not rpc('purchase_catalog')['owned']
   login(True);page.locator('[data-close="shop"]').tap();page.wait_for_function("!document.querySelector('#adminBtn').hidden");page.locator('#adminBtn').tap()
   adminrow=page.locator('[data-admin-order="'+order['id']+'"]');expect(adminrow).to_be_visible()
   adminrow.locator('[data-confirm-amount]').fill('1100');adminrow.locator('[data-deposit-reference]').fill('local-'+order['id'])
   adminrow.locator('[data-approve-order]').tap();expect(page.locator('#purchaseAdminStatus')).to_contain_text('처리했습니다')
   login();shop();page.locator('#purchaseRefresh').tap();expect(page.locator('#supporterBadge')).to_be_visible()
   assert page.evaluate('WakppuItemGame.read().gold')==gold
   # Paid skin: admin authority, equip persistence and actual refund state.
   page.locator('[data-purchase-product="starlight_skin"]').tap();skin=rpc('purchase_catalog')['orders'][0]
   login(True);rpc('admin_purchase_approve',order_id=skin['id'],confirmed_amount=3300,deposit_reference='local-'+skin['id'])
   login();shop();expect(page.locator('#purchaseEquip')).to_be_visible();page.locator('#purchaseEquip').tap()
   page.wait_for_function("document.documentElement.classList.contains('purchase-starlight')")
   if reduced:assert page.locator('#ballWrap').evaluate("e=>getComputedStyle(e,'::before').animationName")=='none'
   page.reload();page.wait_for_function('WakppuItemGame.read().ready');shop();page.wait_for_function("document.documentElement.classList.contains('purchase-starlight')")
   page.locator('#shopDrawTab').tap();expect(page.locator('#shopPremium')).to_be_hidden();expect(page.locator('#shopDraw')).to_be_visible()
   page.locator('#shopPurchaseTab').tap();expect(page.locator('#shopPurchase')).to_be_visible();expect(page.locator('#shopPremium')).to_be_hidden()
   page.locator('#shopDrawTab').focus();page.keyboard.press('ArrowRight');expect(page.locator('#shopPremiumTab')).to_be_focused();expect(page.locator('#shopPremium')).to_be_visible()
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
   assert page.locator('#shop .sheet').evaluate('e=>e.scrollWidth<=e.clientWidth+1')
   out=ROOT/'tools/test-results';out.mkdir(parents=True,exist_ok=True);page.screenshot(path=str(out/f'manual-bank-{width}.png'))
   login(True);rpc('admin_purchase_refund',order_id=skin['id'],refund_reference='local-refund-'+skin['id']);login();shop();expect(page.locator('#purchaseEquip')).to_have_count(0)
   assert not page.evaluate("document.documentElement.classList.contains('purchase-starlight')")
   assert not errors,errors;ctx.close();print(f'PASS {width}x{height} reduced={reduced}: shop tabs, claim without grant, admin receipt/grant, equip/reload/refund, Gold unchanged',flush=True)
  browser.close()
finally:server.terminate();server.wait(timeout=10)
