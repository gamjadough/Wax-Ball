"""Real isolated SQL: new/upgrade premium orders, 500-won aura and mobile cosmetics."""
import os,socket,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,os.environ['WAKPPU_TEST_PYTHON_PATH'])
from playwright.sync_api import sync_playwright,expect
with sync_playwright() as p:
 browser=p.chromium.launch(channel='msedge',headless=True)
 for width,height,reduced,upgrade in [(320,640,False,True),(844,390,False,False),(390,844,True,True),(1200,900,False,False)]:
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
   page.on('dialog',lambda d:d.accept());adm.on('dialog',lambda d:d.accept())
   def rpc(pg,action,**payload):return pg.evaluate('async b=>WakppuAuth.invoke(b.action,b)',dict(action=action,**payload))
   def shop():
    if page.locator('#shop').is_hidden():page.locator('#shopBtn').tap()
    page.locator('#shopPremiumTab').tap();page.wait_for_function("document.querySelectorAll('[data-purchase-product]').length===4")
   page.goto(base+'/?preview=bank');expect(page.locator('#shopPremium')).to_be_visible();page.wait_for_function('WakppuItemGame.read().ready');shop()
   gold=page.evaluate('WakppuItemGame.read().gold')
   adm.goto(base+'/');adm.wait_for_function('window.WakppuAuth && window.WakppuItemGame')
   adm.evaluate("async password=>{const r=await WakppuAuth.signIn('dodoonglee@gmail.com',password);if(r.error)throw r.error;await WakppuItemGame.restore()}",password)
   adm.wait_for_function("!document.querySelector('#adminBtn').hidden && WakppuItemGame.read().ready");adm.locator('#adminBtn').tap()
   page.locator('#purchaseDepositor').fill('프리미엄테스트')
   def buy(product,amount):
    control=page.locator('[data-purchase-product="'+product+'"]');expect(control).to_be_enabled();assert control.bounding_box()['height']>=44;control.tap()
    page.wait_for_function('(id)=>[...document.querySelectorAll("#purchaseHistory h4")].some(e=>e.textContent.includes(id))',arg='프리미엄' if product=='premium_supporter_pack' else '응원팩' if product=='supporter_pack' else '별빛')
    o=next(o for o in rpc(page,'purchase_catalog')['orders'] if o['product_id']==product)
    assert o['amount']==amount
    page.locator('[data-purchase-claim="'+o['id']+'"]').tap();expect(page.locator('[data-purchase-order="'+o['id']+'"]')).to_contain_text('관리자 확인 대기')
    assert product not in rpc(page,'purchase_catalog')['owned']
    adm.locator('#purchaseAdminRefresh').tap();row=adm.locator('[data-admin-order="'+o['id']+'"]');expect(row).to_be_visible()
    row.locator('[data-confirm-amount]').fill(str(amount));row.locator('[data-deposit-reference]').fill('local-'+o['id']);row.locator('[data-approve-order]').tap()
    expect(row.locator('[data-approve-order]')).to_have_count(0)
    page.locator('#purchaseRefresh').tap();page.wait_for_function('(id)=>!!document.querySelector(`[data-purchase-product="${id}"]:disabled`) || !!document.querySelector("#purchaseCardEquip")',arg=product)
    return o
   if upgrade:baseorder=buy('supporter_pack',1100)
   premium=page.locator('[data-purchase-product="premium_supporter_pack"]');expect(premium).to_contain_text('8,900' if upgrade else '10,000')
   premiumorder=buy('premium_supporter_pack',8900 if upgrade else 10000)
   expect(page.locator('#purchaseOwned')).to_contain_text('+30%');expect(page.locator('#supporterBadge')).to_contain_text('프리미엄')
   assert page.evaluate('WakppuPurchases.serverHits()') and page.evaluate('WakppuItemGame.read().gold')==gold
   assert rpc(page,'purchase_catalog')['supporter_percent']==30
   if upgrade:expect(adm.locator('[data-admin-order="'+baseorder['id']+'"] [data-refund-order]')).to_have_count(0)
   premium.locator('..').scroll_into_view_if_needed();out=ROOT/'tools/test-results';out.mkdir(exist_ok=True);page.screenshot(path=str(out/f'premium-shop-{width}.png'))
   # 500-won skin equips independently of the permanent premium tier.
   expect(page.locator('[data-purchase-product="starlight_skin"]')).to_contain_text('500원');skinorder=buy('starlight_skin',500)
   page.locator('#purchaseCardEquip').tap();page.wait_for_function("document.documentElement.classList.contains('purchase-starlight')")
   page.locator('[data-close="shop"]').tap();page.locator('#accountBtn').tap();expect(page.locator('#premiumProfileBadge')).to_be_visible();page.screenshot(path=str(out/f'premium-profile-{width}.png'));page.locator('[data-close="account"]').tap()
   def ranking(show_title):
    page.locator('#rankingBtn').tap();row=page.locator('#rankingList .ranking-premium');expect(row).to_have_count(1);expect(row).to_have_css('border-left-style','solid');expect(row.locator('.ranking-premium-title')).to_have_count(1 if show_title else 0)
    assert page.locator('#ranking .sheet').evaluate('e=>e.scrollWidth<=e.clientWidth+1')
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    expect(page.locator('#ranking .sheet')).to_have_css('opacity','1');page.screenshot(path=str(out/f'premium-ranking-{width}-{show_title}.png'));page.locator('[data-close="ranking"]').tap()
   ranking(True);shop();page.locator('#purchaseTitleToggle').tap();expect(page.locator('#purchaseTitleToggle')).to_contain_text('표시');expect(page.locator('#supporterBadge')).to_be_hidden();page.locator('[data-close="shop"]').tap();ranking(False)
   page.reload();page.wait_for_function('WakppuItemGame.read().ready');shop();expect(page.locator('#purchaseTitleToggle')).to_contain_text('표시');assert page.evaluate("document.documentElement.classList.contains('purchase-starlight')")
   assert page.locator('#shop .sheet').evaluate('e=>e.scrollWidth<=e.clientWidth+1')
   # Premium refund restores the old tier without removing the independent skin.
   rpc(adm,'admin_purchase_refund',order_id=premiumorder['id'],refund_reference='local-refund-'+premiumorder['id']);page.locator('#purchaseRefresh').tap();expect(page.locator('#purchaseTitleToggle')).to_have_count(0)
   expect(page.locator('#supporterBadge')).to_be_visible() if upgrade else expect(page.locator('#supporterBadge')).to_be_hidden()
   assert rpc(page,'purchase_catalog')['supporter_percent']==(5 if upgrade else 0)
   assert page.evaluate("document.documentElement.classList.contains('purchase-starlight')")
   assert page.evaluate('WakppuItemGame.read().gold')==gold
   assert not errors,errors
   print(f'PASS premium {width}x{height}, upgrade={upgrade}, reduced={reduced}: price/grant/title/ranking/skin/refund',flush=True)
   ctx.close();adminctx.close()
  finally:server.terminate();server.wait(timeout=10)
 browser.close()
