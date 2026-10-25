"""Real payment/profile SQL on a fake local bank; no production users or transfers."""
import os,sys,socket,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,os.environ.get('WAKPPU_TEST_PYTHON_PATH',str(ROOT/'tools/.test-deps')))
from playwright.sync_api import sync_playwright,expect,TimeoutError
with sync_playwright() as p:
 browser=p.chromium.launch(channel='msedge',headless=True)
 for width,height,reduced in [(1200,900,False),(320,640,False),(844,390,False),(390,844,True)]:
  with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
  server=subprocess.Popen(['node',str(ROOT/'tools/local-server.mjs')],cwd=ROOT,env=dict(os.environ,WAKPPU_LOCAL_PORT=str(port),WAKPPU_LOCAL_PAYMENTS='1',WAKPPU_LOCAL_BANK_PREVIEW='1',WAKPPU_LOCAL_SUPPORTER_PROFILES='1',WAKPPU_LOCAL_SLEEP_TIME='2026-10-25T03:00:00Z'),stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,encoding='utf8')
  try:
   assert server.stdout.readline().startswith('Local preview:');server.stdout.readline();password=server.stdout.readline().strip().split(': ',1)[1];base=f'http://127.0.0.1:{port}'
   ctx=browser.new_context(viewport={'width':width,'height':height},is_mobile=width<900,has_touch=True,reduced_motion='reduce' if reduced else 'no-preference')
   ctx.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base) or r.request.url.startswith('data:') else r.fulfill(status=200,body=''))
   page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   def rpc(action,**more):return page.evaluate('(b)=>WakppuAuth.invoke(b.action,b)',dict(action=action,**more))
   def login(admin=False):
    page.evaluate("async x=>{const r=await WakppuAuth.signIn(x.admin?'dodoonglee@gmail.com':'guest',x.admin?x.password:'');if(r.error)throw r.error;if(!x.admin)await WakppuAuth.mockCompleteEmailLink();await WakppuItemGame.restore();await WakppuPurchases.refresh();await WakppuProfiles.refresh();}",{'admin':admin,'password':password})
    page.wait_for_function('WakppuItemGame.read().ready')
   def inventory():
    page.locator('#inventoryBtn').tap();page.locator('#inventoryProfileCardsTab').tap();expect(page.locator('#profileCardSelect')).to_be_enabled()
   def order(product):
    page.locator('#purchaseDepositor').fill('후원 카드 검증')
    with page.expect_response(lambda r:r.url.endswith('/local/api') and r.request.post_data_json.get('action')=='purchase_order') as response:page.locator('[data-purchase-product="'+product+'"]').tap()
    result=response.value.json()['order'];return result
   def approve(o):
    login(True);rpc('admin_purchase_approve',order_id=o['id'],confirmed_amount=o['amount'],deposit_reference='test-'+o['id']);login()
   def showcase(card_id,name,kind):
    page.locator('#profileCardSelect').select_option(card_id);expect(page.locator('#profileInventoryName')).to_have_text(name)
    page.locator('#profileCardEquip').tap();expect(page.locator('#profileCardEquip')).to_have_text('장착 중')
    page.locator('#profileCardSelf').tap();expect(page.locator('#profileCardBadge')).to_contain_text(name)
    page.wait_for_function("document.querySelector('#profileArt').complete&&document.querySelector('#profileArt').naturalWidth===1536")
    dialog=page.locator('#playerProfileDialog');assert dialog.get_attribute('data-card')==card_id
    assert dialog.evaluate('(e)=>e.scrollWidth<=e.clientWidth');assert page.locator('#profileClose').bounding_box()['height']>=44
    page.screenshot(path=str(ROOT/f'tools/test-results/{kind}-profile-{width}x{height}.png'));page.locator('#profileClose').tap()
    for id in ['profileCardSelect','profileCardEquip','profileCardUnequip','profileCardSelf']:assert page.locator('#'+id).bounding_box()['height']>=44,id
    assert page.locator('#inventoryProfileCardsPage').evaluate('(e)=>e.scrollWidth<=e.clientWidth')
   page.goto(base+'/?preview=bank',wait_until='networkidle');login()
   assert not set(rpc('profile_status')['owned'])&{'supporter_glow','premium_celestial'}
   regular_card=page.locator('[data-purchase-product="supporter_pack"]').locator('..');premium_card=page.locator('[data-purchase-product="premium_supporter_pack"]').locator('..')
   expect(regular_card).to_contain_text('따뜻한 응원');expect(premium_card).to_contain_text('찬란한 성좌');expect(premium_card).to_contain_text('기존 구매자도')
   regular=order('supporter_pack');assert regular['amount']==1100;approve(regular)
   assert 'supporter_glow' in rpc('profile_status')['owned'];assert 'premium_celestial' not in rpc('profile_status')['owned']
   page.locator('[data-close="shop"]').tap();inventory();before=rpc('bootstrap')['state'];showcase('supporter_glow','따뜻한 응원','supporter')
   page.locator('#profileCardUnequip').tap();expect(page.locator('#profileCardEquip')).to_have_text('장착');page.locator('#profileCardEquip').tap();expect(page.locator('#profileCardEquip')).to_have_text('장착 중');page.locator('#itemsClose').tap()
   page.evaluate("WakppuItems.showShop('premium')");expect(page.locator('[data-purchase-product="premium_supporter_pack"]')).to_contain_text('8,900원')
   upgrade=order('premium_supporter_pack');assert upgrade['amount']==8900;approve(upgrade)
   assert {'supporter_glow','premium_celestial'}<=set(rpc('profile_status')['owned'])
   page.locator('[data-close="shop"]').tap();inventory();showcase('premium_celestial','찬란한 성좌','premium')
   after=rpc('bootstrap')['state'];assert all(str(before[k])==str(after[k]) for k in ['gold','rebirths','unlocked_ball_ids','discovered_ball_ids','hammer_level'])
   page.locator('#itemsClose').tap();page.reload(wait_until='domcontentloaded')
   try:page.wait_for_load_state('networkidle',timeout=2000)
   except TimeoutError:pass
   page.wait_for_function('WakppuItemGame.read().ready');assert rpc('profile_status')['equipped']=='premium_celestial'
   state=rpc('profile_status');public=rpc('player_profile',nickname=state['nickname']);assert public['card']['id']=='premium_celestial'
   login(True);rpc('admin_purchase_refund',order_id=upgrade['id'],refund_reference='premium-'+upgrade['id']);login()
   state=rpc('profile_status');assert state['equipped']=='wax_beginning' and 'supporter_glow' in state['owned'] and 'premium_celestial' not in state['owned']
   rpc('profile_equip',card_id='supporter_glow');login(True);rpc('admin_purchase_refund',order_id=regular['id'],refund_reference='regular-'+regular['id']);login()
   assert rpc('profile_status')['equipped']=='wax_beginning'
   assert page.evaluate("WakppuAuth.invoke('profile_equip',{card_id:'supporter_glow'}).then(()=>false,()=>true)")
   assert rpc('player_profile',nickname=state['nickname'])['card']['id']=='wax_beginning'
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');assert not errors,errors
   ctx.close();print(f'PASS supporter cards {width}x{height}: paid approval/upgrade, both designs, public profile, reload, refund fallback, unchanged progression, product benefits, touch layout',flush=True)
  finally:server.terminate();server.wait(timeout=10)
 browser.close()
