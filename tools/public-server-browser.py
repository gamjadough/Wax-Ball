"""Public entry integration against its isolated Supabase project.
Uses disposable, freshly created anonymous test accounts only.
Run a static repo server on 4197 first. Removes its own guest through the
normal verified guest-discard API in finally; never deletes existing users.
"""
import os,sys,uuid,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,os.environ['WAKPPU_TEST_PYTHON_PATH'])
from playwright.sync_api import sync_playwright,expect
base=os.environ.get('WAKPPU_PUBLIC_BASE','http://127.0.0.1:4197/wakppuball-public/')
with sync_playwright() as p:
 browser=p.chromium.launch(channel='msedge',headless=True)
 ctx=browser.new_context(viewport={'width':320,'height':640},has_touch=True,is_mobile=True)
 page=ctx.new_page();errors=[];failed=[];created=False
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.on('response',lambda r:failed.append([r.status,r.url]) if r.status>=400 else None)
 # Private save proves public startup does not import the friends server's gold.
 ctx.add_init_script("localStorage.setItem('wax-ball:wakppuball:save',JSON.stringify({version:3,gold:'999999',rebirths:0,unlocked:[true],discovered:['yellow'],selected:0}));")
 try:
  page.goto(base,wait_until='networkidle',timeout=45000)
  assert page.evaluate('WAKPPU_SERVER.url')=='https://uczyjfbcytvzxnlmzyhp.supabase.co'
  assert page.evaluate('WAKPPU_SERVER.saveKey')=='wax-ball:wakppuball-public:save'
  page.locator('#accountBtn').tap()
  page.locator('#guestNicknameInput').fill('공개검증'+uuid.uuid4().hex[:6])
  page.locator('#guestStartBtn').tap()
  page.wait_for_function('WakppuItemGame.read().ready&&WakppuItems.data',timeout=20000)
  page.evaluate("()=>{window.inputTrace=[];document.addEventListener('pointerdown',e=>inputTrace.push({target:e.target.tagName,items:WakppuItems.busy,skins:WakppuSkins.busy,gems:WakppuGemBalls.busy,guest:WakppuGuestExit?.busy,dialog:WakppuGuestDialog?.busy,game:WakppuItemGame.read()}),true)}")
  created=True
  assert page.evaluate('WakppuItemGame.read().gold')=='0'
  assert page.evaluate("JSON.parse(localStorage.getItem('wax-ball:wakppuball:save')).gold")=='999999'
  for width,height in [(320,640),(844,390),(1200,900)]:
   page.set_viewport_size({'width':width,'height':height})
   assert page.evaluate('innerWidth')==width
   page.wait_for_function('WakppuItemGame.read().ready&&!WakppuItemGame.read().busy')
   before=page.evaluate('WakppuItemGame.read().revision')
   page.locator('#ballSvg').tap()
   page.wait_for_function('n=>WakppuItemGame.read().revision>n',arg=before,timeout=12000)
   page.locator('#collectionBtn').tap()
   assert page.locator('[data-collection-tab]').all_text_contents()==['일반 도감','푸른젬 도감']
   page.locator('#gemCollectionTab').tap();expect(page.locator('#gemCollection')).to_be_visible()
   page.locator('#normalCollectionTab').tap();expect(page.locator('#collectionGrid')).to_be_visible()
   page.locator('#collectionClose').tap()
   page.locator('#inventoryBtn').tap()
   assert not any(x in page.locator('#itemsModal').inner_text() for x in ['할로윈','캔디','잭오랜턴','꼬마 유령','꼬마 박쥐'])
   page.locator('#inventorySkinsTab').tap()
   expect(page.locator('#skinCards article')).to_have_count(5)
   page.locator('#itemsClose').tap()
   page.locator('#shopBtn').tap()
   page.locator('#shopPremiumTab').tap()
   expect(page.locator('#shopPremium')).to_be_visible()
   expect(page.locator('#purchaseNotice')).to_contain_text('새 주문을 받고 있지 않습니다')
   assert not page.locator('#purchaseProducts button:enabled').count()
   page.locator('[data-close="shop"]').tap()
   assert not page.evaluate('document.documentElement.scrollWidth>innerWidth+1')
   assert not page.locator('#halloweenCurrency').is_visible()
   resources=page.evaluate("performance.getEntriesByType('resource').map(r=>r.name)")
   assert not any('/js/halloween' in x or '/js/pumpkin' in x or '/images/scares/' in x for x in resources)
   page.screenshot(path=str(ROOT/f'tools/test-results/public-{width}.png'),full_page=True)
   print(f'PASS {width}x{height}: touch, collection, inventory, paid shop disabled, no seasonal resources or overflow',flush=True)
  # Complete a real five-hit break and verify rewards persist after reload.
  while page.evaluate("WakppuItemGame.read().gold")=='0':
   page.wait_for_function('!WakppuItemGame.read().busy')
   before=page.evaluate('WakppuItemGame.read().revision')
   page.locator('#ballSvg').tap()
   page.wait_for_function('n=>WakppuItemGame.read().revision>n',arg=before,timeout=12000)
  page.wait_for_function('!WakppuItemGame.read().busy')
  assert page.evaluate('WakppuItemGame.read().gold')=='1'
  page.reload(wait_until='networkidle')
  page.wait_for_function('WakppuItemGame.read().ready')
  assert page.evaluate('WakppuItemGame.read().gold')=='1'
  page.locator('#rankingBtn').tap()
  page.wait_for_function("document.querySelector('#rankingList').textContent.includes('공개검증')")
  assert not errors,errors
  assert not failed,failed
  print('PASS complete destruction, gold+gem reward, reload persistence and rankings',flush=True)
 except Exception:
  print('Diagnostic:',json.dumps(page.evaluate("()=>({game:WakppuItemGame.read(),hint:document.querySelector('#hint').textContent,items:window.WakppuItems?.busy,skins:window.WakppuSkins?.busy,gems:window.WakppuGemBalls?.busy,accountHidden:document.querySelector('#account').hidden})"),ensure_ascii=False),flush=True)
  print('Browser errors:',errors,'HTTP errors:',failed,'Input:',page.evaluate('inputTrace'),flush=True)
  page.screenshot(path=str(ROOT/'tools/test-results/public-failure.png'),full_page=True)
  raise
 finally:
  if created:
   outcome=page.evaluate("async()=>{const {data:{session}}=await WakppuAuth.session();if(!session?.user?.is_anonymous)throw Error('Disposable guest required');return WakppuAuth.guestDriver.discard(session)}")
   print('Disposable public guest removed:',json.dumps(outcome,ensure_ascii=False),flush=True)
  ctx.close();browser.close()
