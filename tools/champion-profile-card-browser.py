"""Local champion flow and touch layouts. No production account changes."""
import os,sys,socket,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,os.environ.get('WAKPPU_TEST_PYTHON_PATH',str(ROOT/'tools/.test-deps')))
from playwright.sync_api import sync_playwright,expect
with sync_playwright() as p:
 browser=p.chromium.launch(channel='msedge',headless=True)
 for width,height,reduced in [(1200,900,False),(320,640,False),(844,390,False),(390,844,True)]:
  with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
  server=subprocess.Popen(['node',str(ROOT/'tools/local-server.mjs')],cwd=ROOT,env=dict(os.environ,WAKPPU_LOCAL_PORT=str(port),WAKPPU_LOCAL_SLEEP_TIME='2026-10-24T03:00:00Z'),stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,encoding='utf8')
  try:
   assert server.stdout.readline().startswith('Local preview:');server.stdout.readline();password=server.stdout.readline().strip().split(': ',1)[1];base=f'http://127.0.0.1:{port}'
   ctx=browser.new_context(viewport={'width':width,'height':height},is_mobile=width<900,has_touch=True,reduced_motion='reduce' if reduced else 'no-preference')
   ctx.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base) or r.request.url.startswith('data:') else r.fulfill(status=200,body=''))
   page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   def rpc(action,**more):return page.evaluate('(b)=>WakppuAuth.invoke(b.action,b)',dict(action=action,**more))
   def login(admin=False):
    page.evaluate("async x=>{const r=await WakppuAuth.signIn(x.admin?'dodoonglee@gmail.com':'guest',x.admin?x.password:'');if(r.error)throw r.error;await WakppuItemGame.restore();await WakppuProfiles.refresh();}",{'admin':admin,'password':password})
    page.wait_for_function('WakppuItemGame.read().ready')
   def inventory():
    page.locator('#inventoryBtn').tap();page.locator('#inventoryProfileCardsTab').tap();expect(page.locator('#profileCardSelect')).to_be_enabled()
   page.goto(base+'/',wait_until='networkidle');login()
   owner=page.evaluate('WakppuItemGame.read().account');assert 'golden_champion' not in rpc('profile_status')['owned']
   rejected=page.evaluate("WakppuAuth.invoke('profile_equip',{card_id:'golden_champion'}).then(()=>false,()=>true)");assert rejected
   login(True);rpc('admin_rebirths',user_id=owner,mode='set',value='7');login()
   status=rpc('profile_status');assert 'golden_champion' in status['owned'] and status['equipped']=='wax_beginning'
   before=rpc('bootstrap')['state'];inventory()
   page.locator('#profileCardSelect').select_option('golden_champion')
   expect(page.locator('#profileInventoryName')).to_have_text('황금의 정점');expect(page.locator('#profileInventoryRarity')).to_contain_text('영구 보관')
   expect(page.locator('#profileInventoryDescription')).to_contain_text('순위가 내려가도')
   page.locator('#profileCardEquip').tap();expect(page.locator('#profileCardEquip')).to_have_text('장착 중')
   page.locator('#profileCardSelf').tap();expect(page.locator('#profileCardBadge')).to_contain_text('황금의 정점');expect(page.locator('#profileRank')).to_have_text('1위')
   page.wait_for_function("document.querySelector('#profileArt').complete&&document.querySelector('#profileArt').naturalWidth===1536")
   dialog=page.locator('#playerProfileDialog');assert dialog.get_attribute('data-card')=='golden_champion'
   assert dialog.evaluate('(e)=>e.scrollWidth<=e.clientWidth');assert page.locator('#profileClose').bounding_box()['height']>=44
   page.screenshot(path=str(ROOT/f'tools/test-results/champion-profile-{width}x{height}.png'))
   page.locator('#profileClose').tap()
   for control in ['profileCardSelect','profileCardEquip','profileCardUnequip','profileCardSelf']:
    assert page.locator('#'+control).bounding_box()['height']>=44,control
   assert page.locator('#inventoryProfileCardsPage').evaluate('(e)=>e.scrollWidth<=e.clientWidth')
   page.locator('#profileInventoryArt').scroll_into_view_if_needed();page.screenshot(path=str(ROOT/f'tools/test-results/champion-inventory-{width}x{height}.png'))
   page.locator('#profileCardUnequip').tap();expect(page.locator('#profileCardEquip')).to_have_text('장착')
   page.locator('#profileCardSelf').tap();expect(page.locator('#profileArt')).to_be_hidden();assert dialog.get_attribute('data-card')=='';page.locator('#profileClose').tap()
   page.locator('#profileCardEquip').tap();expect(page.locator('#profileCardEquip')).to_have_text('장착 중')
   after=rpc('bootstrap')['state'];before['gold']=str(before['gold']);after['gold']=str(after['gold']);assert all(before[k]==after[k] for k in ['gold','rebirths','unlocked_ball_ids','discovered_ball_ids','hammer_level']),{k:[before[k],after[k]] for k in ['gold','rebirths','unlocked_ball_ids','discovered_ball_ids','hammer_level'] if before[k]!=after[k]}
   page.locator('#itemsClose').tap();login(True);rpc('admin_rebirths',user_id=owner,mode='set',value='0');login()
   assert rpc('profile_status')['equipped']=='golden_champion';inventory()
   page.locator('#profileCardSelect').select_option('golden_champion');page.locator('#profileCardSelf').tap();expect(page.locator('#profileCardBadge')).to_contain_text('황금의 정점');expect(page.locator('#profileRank')).to_have_text('2위');page.locator('#profileClose').tap()
   page.locator('#inventoryItemsTab').tap();expect(page.locator('#inventoryProfileCardsPage')).to_be_hidden();expect(page.locator('#inventoryItemsPage')).to_be_visible();page.locator('#itemsClose').tap()
   page.reload(wait_until='networkidle');page.wait_for_function('WakppuItemGame.read().ready');assert rpc('profile_status')['equipped']=='golden_champion'
   page.locator('#rankingBtn').tap();page.locator('#rankingList .profile-rank-button').filter(has_text='테스트플레이어').tap();expect(page.locator('#profileCardBadge')).to_contain_text('황금의 정점')
   page.keyboard.press('Escape');expect(dialog).to_be_hidden();assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
   assert not errors,errors;ctx.close();print(f'PASS champion {width}x{height}: first-place grant, equip/unequip, persistence after rank drop/reload, public ranking profile, no progress changes, touch layout',flush=True)
  finally:server.terminate();server.wait(timeout=10)
 browser.close()
