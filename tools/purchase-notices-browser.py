"""Two isolated browser sessions, local real SQL, fake bank; no real payment."""
import os,sys,socket,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,os.environ.get('WAKPPU_TEST_PYTHON_PATH',str(ROOT/'tools/.test-deps')))
from playwright.sync_api import sync_playwright,expect
with sync_playwright() as p:
 browser=p.chromium.launch(channel='msedge',headless=True)
 for width,height in [(320,640),(844,390)]:
  with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
  server=subprocess.Popen(['node',str(ROOT/'tools/local-server.mjs')],cwd=ROOT,env=dict(os.environ,WAKPPU_LOCAL_PORT=str(port),WAKPPU_LOCAL_PAYMENTS='1',WAKPPU_LOCAL_BANK_PREVIEW='1',WAKPPU_LOCAL_PURCHASE_NOTICES='1',WAKPPU_LOCAL_SLEEP_TIME='2026-10-21T03:00:00Z'),stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,encoding='utf8')
  try:
   assert server.stdout.readline().startswith('Local preview:');server.stdout.readline();password=server.stdout.readline().strip().split(': ',1)[1];base=f'http://127.0.0.1:{port}'
   contexts=[];pages=[];errors=[]
   for _ in range(2):
    ctx=browser.new_context(viewport={'width':width,'height':height},is_mobile=True,has_touch=True);contexts.append(ctx)
    ctx.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base) or r.request.url.startswith('data:') else r.fulfill(status=200,body=''))
    page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.on('dialog',lambda d:d.accept());page.goto(base+'/?preview=bank',wait_until='networkidle');page.wait_for_function('WakppuItemGame.read().ready');pages.append(page)
   admin,buyer=pages
   def rpc(page,action,**more):return page.evaluate('(b)=>WakppuAuth.invoke(b.action,b)',dict(action=action,**more))
   admin.evaluate("async password=>{await WakppuAuth.signIn('dodoonglee@gmail.com',password);await WakppuItemGame.restore();}",password)
   expect(admin.locator('#adminBtn')).to_be_visible();admin.evaluate('WakppuPurchaseNotices.refresh()');expect(admin.locator('#purchaseNoticeToast')).to_be_hidden()
   order=rpc(buyer,'purchase_order',product_id='starlight_skin',depositor='알림 테스트',request_id=buyer.evaluate('crypto.randomUUID()'))['order']
   admin.evaluate('WakppuPurchaseNotices.refresh()');expect(admin.locator('#purchaseNoticeToast')).to_be_visible();expect(admin.locator('#purchaseNoticeTitle')).to_have_text('새 구매 주문')
   expect(admin.locator('#purchaseNoticeBody')).to_contain_text('500원');expect(buyer.locator('#purchaseNoticeToast')).to_be_hidden()
   box=admin.locator('#purchaseNoticeToast').bounding_box();assert box['x']>=0 and box['x']+box['width']<=width
   for id in ['purchaseNoticeOpen','purchaseNoticeDismiss']:assert admin.locator('#'+id).bounding_box()['height']>=44
   admin.locator('#purchaseNoticeDismiss').tap();admin.evaluate('WakppuPurchaseNotices.refresh()');expect(admin.locator('#purchaseNoticeToast')).to_be_hidden()
   admin.reload(wait_until='networkidle');expect(admin.locator('#adminBtn')).to_be_visible();admin.evaluate('WakppuPurchaseNotices.refresh()');expect(admin.locator('#purchaseNoticeToast')).to_be_hidden()
   rpc(buyer,'purchase_claim',order_id=order['id']);admin.evaluate('WakppuPurchaseNotices.refresh()');expect(admin.locator('#purchaseNoticeTitle')).to_have_text('구매자 입금 알림 접수');expect(admin.locator('#purchaseNoticeToast')).to_be_visible()
   admin.locator('#purchaseNoticeOpen').tap();expect(admin.locator('#admin')).to_be_visible();expect(admin.locator('[data-admin-order]')).to_have_count(1)
   amount=admin.locator('[data-confirm-amount="'+order['id']+'"]');amount.fill(str(order['amount']));admin.locator('[data-deposit-reference="'+order['id']+'"]').fill('mock-inbox-receipt')
   admin.evaluate('WakppuPurchaseNotices.refresh()');expect(amount).to_have_value(str(order['amount']))
   admin.locator('[data-approve-order="'+order['id']+'"]').tap();expect(admin.locator('#purchaseAdminStatus')).to_contain_text('처리했습니다');expect(admin.locator('#purchaseNoticeToast')).to_be_hidden()
   expect(admin.locator('#purchaseAdminOrders')).to_contain_text('이미 처리');admin.locator('#purchaseAdminNoticeClear').tap();expect(admin.locator('#purchaseAdminNoticeClear')).to_be_hidden()
   rpc(buyer,'purchase_order',product_id='supporter_pack',depositor='두번째 주문',request_id=buyer.evaluate('crypto.randomUUID()'));admin.evaluate('WakppuPurchaseNotices.refresh()');expect(admin.locator('#purchaseNoticeToast')).to_be_visible()
   admin.evaluate("async()=>{await WakppuAuth.signIn('guest','');await WakppuItemGame.restore();}");expect(admin.locator('#purchaseNoticeToast')).to_be_hidden()
   assert not errors,errors;print(f'PASS purchase notices {width}x{height}: two accounts, new/claimed, dedupe/reload, exact order, drafts, approval cleanup, role switch and touch layout',flush=True)
   for ctx in contexts:ctx.close()
  finally:server.terminate();server.wait(timeout=10)
 browser.close()
