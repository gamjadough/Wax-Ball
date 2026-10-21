"""Paid-shop custom flow against real SQL and the real image handler; isolated fake bank/storage."""
import os,sys,socket,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,os.environ.get('WAKPPU_TEST_PYTHON_PATH',str(ROOT/'tools/.test-deps')))
from playwright.sync_api import sync_playwright,expect
with sync_playwright() as p:
 browser=p.chromium.launch(channel='msedge',headless=True)
 for width,height,reduced in ([(1200,900,False)] if '--desktop' in sys.argv else [(320,640,False),(844,390,False),(1200,900,False),(390,844,True)]):
  with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
  server=subprocess.Popen(['node',str(ROOT/'tools/local-server.mjs')],cwd=ROOT,env=dict(os.environ,WAKPPU_LOCAL_PORT=str(port),WAKPPU_LOCAL_PAYMENTS='1',WAKPPU_LOCAL_BANK_PREVIEW='1',WAKPPU_LOCAL_CUSTOM_LIVE='1',WAKPPU_LOCAL_SLEEP_TIME='2026-10-21T03:00:00Z'),stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,encoding='utf8')
  try:
   line=server.stdout.readline();assert line.startswith('Local preview:'),line;server.stdout.readline();password=server.stdout.readline().strip().split(': ',1)[1];base=f'http://127.0.0.1:{port}'
   ctx=browser.new_context(viewport={'width':width,'height':height},is_mobile=width<900,has_touch=True,reduced_motion='reduce' if reduced else 'no-preference')
   ctx.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base) or r.request.url.startswith('data:') else r.fulfill(status=200,body=''))
   page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('dialog',lambda d:d.accept())
   def rpc(action,**more):return page.evaluate('(b)=>WakppuAuth.invoke(b.action,b)',dict(action=action,**more))
   def login(admin=False):
    if page.locator('#customModal').is_visible():page.locator('#customClose').click()
    page.evaluate("async x=>{const r=await WakppuAuth.signIn(x.admin?'dodoonglee@gmail.com':'guest',x.admin?x.password:'');if(r.error)throw r.error;await WakppuItemGame.restore();await WakppuPurchases.refresh();await WakppuCustomBall.refresh();}",{'admin':admin,'password':password})
    page.wait_for_function('WakppuItemGame.read().ready')
   def shop():
    if page.locator('#admin').is_visible():page.locator('[data-close="admin"]').click()
    if page.locator('#shop').is_hidden():page.locator('#shopBtn').tap()
    page.locator('#shopPremiumTab').tap();page.evaluate('WakppuPurchases.refresh()');page.wait_for_function('document.querySelectorAll("[data-purchase-product]").length===6')
   def approve(order):
    login(True)
    if page.locator('#shop').is_visible():page.locator('[data-close="shop"]').click()
    page.locator('#adminBtn').tap();
    with page.expect_response(lambda r:r.url.endswith('/local/api') and r.request.post_data_json.get('action')=='admin_purchase_orders'):page.locator('#purchaseAdminRefresh').click()
    page.locator('[data-confirm-amount="'+order['id']+'"]').fill(str(order['amount']));page.locator('[data-deposit-reference="'+order['id']+'"]').fill('mock-'+order['id'])
    page.locator('[data-approve-order="'+order['id']+'"]').click();expect(page.locator('#purchaseAdminStatus')).to_contain_text('처리했습니다')
    login();shop()
   page.goto(base+'/?preview=bank');expect(page.locator('#shopPremium')).to_be_visible();page.wait_for_load_state('networkidle');shop()
   page.locator('#purchaseDepositor').fill('로컬 샘플');page.locator('#customOrderTarget').select_option('yellow')
   with page.expect_response(lambda r:r.url.endswith('/local/api') and r.request.post_data_json.get('action')=='purchase_order') as response:page.locator('[data-purchase-product="custom_ball_single"]').tap()
   order=response.value.json()['order'];assert order['amount']==30000 and order['custom_target']=='yellow'
   assert rpc('custom_status')['plan']=='none';approve(order)
   expect(page.locator('[data-purchase-product="custom_ball_all"]')).to_contain_text('20,000원')
   page.locator('[data-purchase-product="custom_ball_single"]').tap();expect(page.locator('#customModal')).to_be_visible();expect(page.locator('#customPlanState')).to_contain_text('단일 볼 이용 중')
   assert page.locator('#customEffect option[value="skin:transcendent"]').get_attribute('disabled') is not None
   page.locator('#customSample').click();page.locator('#customEffect').select_option('whitehole');page.locator('#customSound').select_option('admin-event')
   expect(page.locator('#customApply')).to_be_enabled();page.locator('#customApply').click();expect(page.locator('#customStatus')).to_contain_text('저장했습니다')
   image=page.locator('#ballSvg image').get_attribute('href');assert image.startswith('data:image/png;base64,')
   page.locator('#customPlay').click();expect(page.locator('#customModal')).to_be_hidden();expect(page.locator('#shop')).to_be_hidden()
   before=page.evaluate('WakppuBeginnerRead()');assert before['required']==5 and before['baseReward']=='1'
   for i in range(5):
    page.locator('#ballSvg').tap()
    if i<4:page.wait_for_function('!WakppuItemGame.read().busy')
   page.wait_for_function('(g)=>BigInt(WakppuItemGame.read().gold)===BigInt(g)+1n',arg=before['gold']);page.wait_for_function('!WakppuItemGame.read().busy')
   page.reload();page.wait_for_load_state('networkidle');page.wait_for_function('!!document.querySelector("#ballSvg image")');assert page.locator('#ballSvg image').get_attribute('href')==image
   page.locator('#unlockBtn').tap();expect(page.locator('#ballName')).to_have_text('초록색 왁뿌볼');page.evaluate('WakppuItemGame.flush()');expect(page.locator('#ballSvg image')).to_have_count(0)
   shop();page.locator('#purchaseDepositor').fill('로컬 샘플')
   with page.expect_response(lambda r:r.url.endswith('/local/api') and r.request.post_data_json.get('action')=='purchase_order') as response:page.locator('[data-purchase-product="custom_ball_all"]').tap()
   upgrade=response.value.json()['order'];assert upgrade['amount']==20000 and upgrade['custom_upgrade_order_id']==order['id'];approve(upgrade)
   page.locator('[data-purchase-product="custom_ball_all"]').tap();expect(page.locator('#customModal')).to_be_visible();expect(page.locator('#customPlanState')).to_contain_text('전체 볼 이용 중')
   page.locator('#customTarget').select_option('green');page.locator('#customSample').click();page.locator('#customEffect').select_option('yellow');page.locator('#customApplyAll').click();expect(page.locator('#customStatus')).to_contain_text('모든 볼')
   expect(page.locator('#ballSvg image')).to_have_count(1);now=page.evaluate('WakppuBeginnerRead()');assert now['required']==8 and now['baseReward']=='10'
   page.locator('#customFile').set_input_files({'name':'unsafe.svg','mimeType':'image/svg+xml','buffer':b'<svg/>'});expect(page.locator('#customStatus')).to_contain_text('8MB 이하')
   assert page.locator('#customModal').evaluate('(e)=>e.scrollWidth<=e.clientWidth');assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
   for sel in ['#customClose','#customApply','#customPlay']:assert page.locator(sel).bounding_box()['height']>=44
   out=ROOT/'tools/test-results';out.mkdir(exist_ok=True);page.locator('#customModal').evaluate('(e)=>e.scrollTop=0');page.screenshot(path=str(out/f'custom-paid-{width}x{height}.png'))
   login(True);expect(page.locator('#ballSvg image')).to_have_count(0);assert rpc('custom_status')['plan']=='all'
   rpc('admin_purchase_refund',order_id=upgrade['id'],refund_reference='mock refund upgrade');login();assert rpc('custom_status')['plan']=='single';expect(page.locator('#ballSvg image')).to_have_count(0)
   shop();page.locator('[data-purchase-product="custom_ball_single"]').tap();page.locator('#customRestore').click();expect(page.locator('#customStatus')).to_contain_text('기본 외형')
   assert not errors,errors;print(f'PASS paid {width}x{height} reduced={reduced}: real shop order/approval, PNG storage, play/reward, upgrade, refund, scope, account isolation and layout',flush=True)
   ctx.close()
  finally:server.terminate();server.wait(timeout=10)
 browser.close()
