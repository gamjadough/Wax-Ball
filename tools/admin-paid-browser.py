"""Anonymous buyer receives admin grants through real SQL, on touch layouts."""
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
   ctx=browser.new_context(viewport={'width':width,'height':height},has_touch=True,is_mobile=width<900,reduced_motion='reduce' if reduced else 'no-preference');adminctx=browser.new_context(viewport={'width':width,'height':height},has_touch=True)
   errors=[]
   for c in [ctx,adminctx]:
    c.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base) else r.fulfill(status=200,body=''))
    c.on('page',lambda pg:pg.on('pageerror',lambda e:errors.append(str(e))))
   page=ctx.new_page();adm=adminctx.new_page()
   for pg in [page,adm]:pg.on('dialog',lambda d:d.accept());pg.goto(base+'/');pg.wait_for_load_state('networkidle')
   page.evaluate("async()=>{await WakppuAuth.signIn('guest','');await WakppuItemGame.restore()}");page.wait_for_function('WakppuItemGame.read().ready')
   before=int(page.evaluate('WakppuItemGame.read().gold'))
   assert not page.evaluate("WakppuAuth.invoke('purchase_catalog')")['eligible']
   adm.evaluate("async password=>{await WakppuAuth.signIn('dodoonglee@gmail.com',password);await WakppuItemGame.restore()}",password);adm.wait_for_function("!document.querySelector('#adminBtn').hidden");adm.locator('#adminBtn').tap()
   expect(adm.locator('#adminPaidGrant')).to_be_disabled()
   adm.locator('#adminQuery').fill('테스트플레이어');adm.locator('#adminSearch').tap();adm.locator('#adminResults .admin-player').filter(has_text='테스트플레이어').tap()
   expect(adm.locator('#adminPaidProduct option')).to_have_count(4);expect(adm.locator('#adminPaidTarget')).to_contain_text('테스트플레이어')
   adm.locator('#adminPaidReason').fill('이메일 인증 오류 지원 테스트')
   for item in ['supporter_pack','premium_supporter_pack','starlight_skin','first_steps_pack']:
    adm.locator('#adminPaidProduct').select_option(item);grant=adm.locator('#adminPaidGrant');expect(grant).to_be_enabled();assert grant.bounding_box()['height']>=44;grant.tap();expect(grant).to_be_disabled();expect(adm.locator('#adminPaidOwned')).to_contain_text('관리자 지급으로 보유 중')
   expect(adm.locator('#adminPaidHistory p')).to_have_count(4)
   assert adm.locator('#admin .sheet').evaluate('e=>e.scrollWidth<=e.clientWidth+1')
   assert adm.evaluate('document.documentElement.scrollWidth<=innerWidth')
   out=ROOT/'tools/test-results';out.mkdir(exist_ok=True);adm.locator('#adminPaid').scroll_into_view_if_needed();adm.screenshot(path=str(out/f'admin-paid-{width}.png'))
   page.locator('#shopBtn').tap();page.locator('#shopPremiumTab').tap();page.locator('#purchaseRefresh').tap();page.wait_for_function('(g)=>Number(WakppuItemGame.read().gold)===g',arg=before+3000)
   catalog=page.evaluate("WakppuAuth.invoke('purchase_catalog')");assert not catalog['eligible'] and catalog['supporter_percent']==30 and len(catalog['owned'])==4
   expect(page.locator('#purchaseHistory')).to_contain_text('관리자 직접 지급');assert 'undefined' not in page.locator('#purchaseHistory').inner_text()
   page.locator('#purchaseCardEquip').tap();page.wait_for_function("document.documentElement.classList.contains('purchase-starlight')")
   page.reload();page.wait_for_function('WakppuItemGame.read().ready');page.locator('#shopBtn').tap();page.locator('#shopPremiumTab').tap();expect(page.locator('#purchaseCardEquip')).to_contain_text('해제')
   adm.locator('#adminPaidProduct').select_option('starlight_skin');expect(adm.locator('#adminPaidRevoke')).to_be_enabled();adm.locator('#adminPaidRevoke').tap();expect(adm.locator('#adminPaidGrant')).to_be_enabled()
   page.locator('#purchaseRefresh').tap();page.wait_for_function("!document.documentElement.classList.contains('purchase-starlight')");expect(page.locator('#purchaseHistory')).to_contain_text('관리자 지급 회수 완료')
   adm.locator('#adminQuery').fill('존재하지않는계정');adm.locator('#adminSearch').tap();expect(adm.locator('#adminPaidGrant')).to_be_disabled();expect(adm.locator('#adminPaidTarget')).to_contain_text('먼저 플레이어')
   assert not errors,errors
   print(f'PASS admin gifts {width}x{height}, reduced={reduced}: anonymous recipient, 4 products, inventory, equip/reload/revoke, selection clearing',flush=True)
   ctx.close();adminctx.close()
  finally:server.terminate();server.wait(timeout=10)
 browser.close()
