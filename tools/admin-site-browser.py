"""Standalone admin UI against the loopback-only real SQL fixture.
Start tools/admin-site-fixture.mjs first. No production accounts or mutations.
"""
import os,sys,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,os.environ['WAKPPU_TEST_PYTHON_PATH'])
from playwright.sync_api import sync_playwright,expect
base='http://127.0.0.1:'+os.environ.get('WAKPPU_ADMIN_TEST_PORT','4198')
def login(page,email):
 page.locator('#adminEmail').fill(email);page.locator('#adminPassword').fill('fixture-only-password');page.locator('#adminLogin').tap()
def rpc(page,action,extra=None):
 return page.evaluate("async b=>WakppuAuth.invoke(b.action,Object.fromEntries(Object.entries(b).filter(([k])=>k!=='action')))",{'action':action,**(extra or {})})
with sync_playwright() as p:
 browser=p.chromium.launch(channel='msedge',headless=True)
 for width,height in [(320,640),(844,390),(1200,900)]:
  ctx=browser.new_context(viewport={'width':width,'height':height},has_touch=True,is_mobile=width<900)
  page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('dialog',lambda d:d.accept())
  try:
   page.goto(base+'/wakppuball-admin/',wait_until='networkidle')
   expect(page.locator('#loginSection')).to_be_visible();expect(page.locator('#admin')).to_be_hidden()
   login(page,'player@fixture.test')
   expect(page.locator('#loginStatus')).to_contain_text('권한이 없는',timeout=10000)
   denied=page.evaluate("async()=>{try{await WakppuAuth.invoke('admin_search',{query:''});return false}catch(e){return e.status===403}}")
   assert denied
   page.locator('#adminLogout').tap()
   login(page,'admin@fixture.test');expect(page.locator('#admin')).to_be_visible(timeout=10000)
   page.locator('#adminQuery').fill('관리대상');page.locator('#adminSearch').tap()
   page.locator('#adminResults button').filter(has_text='관리대상').tap()
   expect(page.locator('#adminPlayerInfo')).to_contain_text('20000200-0000')
   gold='1234567890123456789012345678901234567890'
   page.locator('#adminGold').fill(gold);page.locator('#adminSetGold').tap()
   page.wait_for_function("v=>document.querySelector('#adminPlayerInfo').textContent.replaceAll(',','').includes(v)",arg=gold)
   assert rpc(page,'admin_search',{'query':'관리대상'})[0]['state']['gold']==gold
   page.locator('#adminModerationReason').fill('로컬 UI 테스트')
   page.locator('#adminHideRanking').tap();expect(page.locator('#adminPlayerInfo')).to_contain_text('랭킹: 숨김')
   page.locator('#adminShowRanking').tap();expect(page.locator('#adminPlayerInfo')).to_contain_text('랭킹: 표시')
   page.locator('#adminBan').tap();expect(page.locator('#adminPlayerInfo')).to_contain_text('기간제 밴')
   page.locator('#adminUnban').tap();expect(page.locator('#adminPlayerInfo')).to_contain_text('이용 상태: 정상')
   expect(page.locator('#adminPaidProduct option')).to_have_count(7)
   page.locator('#adminPaidProduct').select_option('starlight_skin')
   page.locator('#adminPaidReason').fill('로컬 지급 검증')
   page.locator('#adminPaidGrant').tap()
   expect(page.locator('#adminPaidOwned')).to_contain_text('관리자 지급으로 보유')
   page.locator('#adminPaidRevoke').tap();expect(page.locator('#adminPaidOwned')).to_contain_text('미보유')
   page.locator('[data-page="events"]').tap()
   page.locator('#adminBallEventDuration').fill('1');page.locator('#adminBallEventDelay').fill('0')
   page.locator('#adminBallEventStart').tap();expect(page.locator('#adminStatus')).to_contain_text('이벤트를 설정')
   assert rpc(page,'status')['manual_ball_event'] is not None
   page.locator('#adminBallEventStop').tap();expect(page.locator('#adminStatus')).to_contain_text('이벤트를 종료')
   page.locator('[data-page="guests"]').tap();page.locator('#guestLifecycleSearch').tap()
   expect(page.locator('#guestLifecycleStatus')).to_contain_text('총 0개')
   page.locator('[data-page="logs"]').tap();page.locator('#adminLoadLogs').tap()
   expect(page.locator('#adminLogs')).to_contain_text('admin')
   assert not page.evaluate('document.documentElement.scrollWidth>innerWidth+1')
   page.locator('[data-page="players"]').tap()
   page.screenshot(path=str(ROOT/f'tools/test-results/admin-site-{width}.png'),full_page=True)
   assert not errors,errors
   print(f'PASS {width}x{height}: login, ordinary-role denial, exact Gold, moderation, grants, events, guests, logs and overflow',flush=True)
   if width==1200:
    page.request.post(base+'/public/fixture/revoke')
    expect(page.locator('#admin')).to_be_hidden(timeout=7000)
    assert page.locator('#adminLogs').inner_text()==''
    assert page.locator('#adminResults button').count()==0
    assert page.evaluate("async()=>{try{await WakppuAuth.invoke('admin_search',{query:''});return false}catch(e){return e.status===403}}")
    page.request.post(base+'/public/fixture/restore');page.reload(wait_until='networkidle')
    expect(page.locator('#admin')).to_be_visible(timeout=10000)
    page.locator('#serverSelect').select_option('friends')
    page.wait_for_url('**/?server=friends');expect(page.locator('#admin')).to_be_hidden()
    expect(page.locator('#friendGate')).to_be_visible()
    page.locator('#friendGatePassword').fill('fixture-entry-only');page.locator('#friendGateSubmit').tap()
    expect(page.locator('#friendGate')).to_be_hidden()
    login(page,'admin@fixture.test');expect(page.locator('#admin')).to_be_visible(timeout=10000)
    assert page.locator('#serverName').inner_text()=='친구 서버'
    friend=rpc(page,'admin_search',{'query':'관리대상'})[0]
    assert friend['state']['gold']=='200'
    print('PASS role revocation and independent server login/data',flush=True)
  except Exception as error:
   print('Failure:',str(error),'Errors:',errors,'URL:',page.url,flush=True)
   try:
    page.wait_for_load_state('domcontentloaded')
    print('State:',page.evaluate("()=>({status:document.querySelector('#adminStatus')?.textContent,login:document.querySelector('#loginStatus')?.textContent,body:document.body.innerText.slice(0,500)})"),flush=True)
    page.screenshot(path=str(ROOT/'tools/test-results/admin-site-failure.png'),full_page=True)
   except Exception:pass
   raise
  finally:ctx.close()
 browser.close()
