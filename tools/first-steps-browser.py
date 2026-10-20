"""Isolated real purchase SQL: starter delivery refresh, inventory and mobile UI."""
import os,socket,subprocess,sys
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
   ctx=browser.new_context(viewport={'width':width,'height':height},has_touch=True,is_mobile=width<900,reduced_motion='reduce' if reduced else 'no-preference')
   adminctx=browser.new_context(viewport={'width':width,'height':height},has_touch=True)
   errors=[]
   for c in [ctx,adminctx]:
    c.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base) else r.fulfill(status=200,body=''))
    c.on('page',lambda pg:pg.on('pageerror',lambda e:errors.append(str(e))))
   page=ctx.new_page();adm=adminctx.new_page()
   page.on('dialog',lambda d:d.accept());adm.on('dialog',lambda d:d.accept())
   def rpc(pg,action,**payload):return pg.evaluate('async b=>WakppuAuth.invoke(b.action,b)',dict(action=action,**payload))
   page.goto(base+'/?preview=bank');expect(page.locator('#shopPremium')).to_be_visible()
   page.wait_for_function("document.querySelectorAll('[data-purchase-product]').length===3 && WakppuItemGame.read().ready")
   before=rpc(page,'items');gold=int(before['gold'])
   product=page.locator('[data-purchase-product="first_steps_pack"]')
   expect(product).to_be_enabled();assert product.bounding_box()['height']>=44
   page.locator('#purchaseDepositor').fill('성장팩테스트');product.tap()
   page.wait_for_function("document.querySelector('#purchaseHistory .purchase-order')")
   order=rpc(page,'purchase_catalog')['orders'][0]
   assert order['product_id']=='first_steps_pack' and order['amount']==1100
   page.locator('[data-purchase-claim="'+order['id']+'"]').tap()
   expect(page.locator('[data-purchase-order="'+order['id']+'"]')).to_contain_text('관리자 확인 대기')
   assert rpc(page,'items')['gold']==before['gold']
   assert page.evaluate('WakppuPurchases.serverHits()')
   adm.goto(base+'/')
   adm.wait_for_function('window.WakppuAuth && window.WakppuItemGame')
   adm.evaluate("async password=>{const r=await WakppuAuth.signIn('dodoonglee@gmail.com',password);if(r.error)throw r.error;await WakppuItemGame.restore()}",password)
   adm.wait_for_function("!document.querySelector('#adminBtn').hidden && WakppuItemGame.read().ready")
   adm.locator('#adminBtn').tap();row=adm.locator('[data-admin-order="'+order['id']+'"]');expect(row).to_be_visible()
   row.locator('[data-confirm-amount]').fill('1100');row.locator('[data-deposit-reference]').fill('local-'+order['id'])
   row.locator('[data-approve-order]').tap();expect(adm.locator('#purchaseAdminStatus')).to_contain_text('처리했습니다')
   # Buyer stays signed in: catalog revision restores granted Gold and inventory.
   page.locator('#purchaseRefresh').tap();page.wait_for_function('(g)=>Number(WakppuItemGame.read().gold)===g',arg=gold+3000)
   expect(product).to_be_disabled();expect(product).to_contain_text('재구매 불가')
   after=rpc(page,'items')
   assert after['effects']==before['effects']
   for item,n in {'rare_honey':2,'rare_crack_booster':3,'common_wax_feather':2}.items():assert after['inventory'].get(item,0)==before['inventory'].get(item,0)+n
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
   out=ROOT/'tools/test-results';out.mkdir(exist_ok=True)
   product.locator('..').scroll_into_view_if_needed();page.screenshot(path=str(out/f'first-steps-shop-{width}.png'))
   page.locator('[data-close="shop"]').tap();page.locator('#inventoryBtn').tap()
   page.locator('[data-item="rare_honey"]').tap();use=page.locator('[data-use="rare_honey"]');expect(use).to_be_enabled();assert use.bounding_box()['height']>=44
   use.tap();page.wait_for_function("document.querySelector('#inventoryDetailContent').textContent.includes('보유 수량: 1')")
   used=rpc(page,'items');assert used['inventory']['rare_honey']==1 and used['effects']['rare_honey']['expires_at']
   assert int(used['gold'])==gold+3000
   page.screenshot(path=str(out/f'first-steps-items-{width}.png'))
   page.locator('#itemsClose').tap();page.reload();page.wait_for_function('WakppuItemGame.read().ready')
   assert int(page.evaluate('WakppuItemGame.read().gold'))==gold+3000
   page.locator('#shopBtn').tap();page.locator('#shopPremiumTab').tap();expect(product).to_be_disabled()
   assert rpc(page,'items')['inventory']['rare_honey']==1
   orders=rpc(adm,'admin_purchase_orders')['orders'];assert next(o for o in orders if o['id']==order['id'])['starter_refundable'] is False
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
   assert not errors,errors
   print(f'PASS starter order/delivery/manual item use/reload: {width}x{height}, reduced={reduced}',flush=True)
   ctx.close();adminctx.close()
  finally:
   server.terminate();server.wait(timeout=10)
 browser.close()
