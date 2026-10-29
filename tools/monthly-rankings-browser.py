"""Touch UI regression with loopback-only monthly fixtures; no real player writes."""
import os,socket,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,os.environ['WAKPPU_TEST_PYTHON_PATH'])
from playwright.sync_api import sync_playwright,expect
with sync_playwright() as p:
 browser=p.chromium.launch(channel='msedge',headless=True)
 for width,height,reduced in ([(320,640,False)] if '--smoke' in sys.argv else [(320,640,False),(844,390,False),(390,844,True),(1200,900,False)]):
  with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
  server=subprocess.Popen(['node',str(ROOT/'tools/local-server.mjs')],cwd=ROOT,env=dict(os.environ,WAKPPU_LOCAL_PORT=str(port),WAKPPU_LOCAL_MONTHLY_PREVIEW='1',WAKPPU_LOCAL_SLEEP_TIME='2026-10-29T03:00:00Z'),stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,encoding='utf8')
  try:
   assert server.stdout.readline().startswith('Local preview:');base=f'http://127.0.0.1:{port}'
   ctx=browser.new_context(viewport={'width':width,'height':height},has_touch=True,is_mobile=width<900,reduced_motion='reduce' if reduced else 'no-preference')
   ctx.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base) or r.request.url.startswith('data:') else r.fulfill(status=200,body=''))
   page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(base,wait_until='networkidle')
   page.evaluate("async()=>{await WakppuAuth.signIn('guest','');await WakppuItemGame.restore();}");page.wait_for_function('WakppuItemGame.read().ready')
   for i in range(3):page.locator('#ballSvg').tap();page.wait_for_function('!WakppuItemGame.read().busy')
   page.locator('#rankingBtn').tap();page.locator('#rankingMonthlyTab').tap();expect(page.locator('#monthlyMe')).to_contain_text('3클릭');expect(page.locator('#monthlyTrial')).to_be_visible()
   assert page.locator('#rankingMonthlyTab').bounding_box()['height']>=44
   page.locator('#monthlyList button').first.tap();expect(page.locator('#playerProfileDialog')).to_be_visible();page.locator('#profileClose').tap()
   page.locator('#rankingOverallTab').tap();expect(page.locator('#rankingList')).to_be_visible();expect(page.locator('#monthlyPanel')).to_be_hidden();expect(page.locator('#rankingList li')).not_to_have_count(0)
   def fixture(mode):page.evaluate("async mode=>{const s=JSON.parse(sessionStorage.getItem('wakppu-local-session'));const r=await fetch('/local/monthly-demo',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+s.token},body:JSON.stringify({mode})});if(!r.ok)throw Error(await r.text());}",mode)
   fixture('seed');page.locator('#rankingMonthlyTab').tap();page.locator('#monthlySeason').select_option('2026-11');expect(page.locator('#monthlyMe')).to_contain_text('1,500클릭');expect(page.locator('#monthlyTrial')).to_be_hidden();expect(page.locator('#monthlyList li')).to_have_count(12)
   expect(page.locator('#monthlyList li').first).to_contain_text('테스트플레이어');page.locator('.monthly-rules summary').tap();expect(page.locator('.monthly-rules')).to_contain_text('불씨 자동 공격은 제외')
   page.screenshot(path=str(ROOT/f'tools/test-results/monthly-ranking-{width}x{height}.png'))
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
   fixture('close');page.locator('#monthlyRefresh').tap();expect(page.locator('#monthlyCountdown')).to_contain_text('결과 확정');expect(page.locator('#monthlyMe')).to_contain_text('1,500클릭')
   for index,metal in [(1,'silver'),(2,'bronze')]:
    page.locator('#monthlyList li button').nth(index).tap();expect(page.locator('#profileArt')).to_have_attribute('src','images/profile-cards/monthly-'+metal+'.webp');page.wait_for_function('document.querySelector("#profileArt").complete&&document.querySelector("#profileArt").naturalWidth>0')
    page.locator('#profileArt').evaluate('e=>e.decode()');page.evaluate('()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');page.wait_for_timeout(100)
    page.screenshot(path=str(ROOT/f'tools/test-results/monthly-{metal}-{width}x{height}.png'));page.locator('#profileClose').tap()
   page.locator('[data-close="ranking"]').tap();page.locator('#inventoryBtn').tap();page.locator('#inventoryProfileCardsTab').tap()
   page.locator('#profileCardSelect').select_option('monthly_202611_gold');page.locator('#profileCardEquip').tap();expect(page.locator('#profileCardEquip')).to_have_text('장착 중')
   page.locator('#profileTitleSelect').select_option('monthly_202611_champion');page.locator('#profileTitleSave').tap();expect(page.locator('#profileEquippedTitle')).to_contain_text('2026년 11월 클릭왕')
   page.locator('#profileBadgeSelect').select_option('monthly_202611_participant');page.locator('#profileBadgeSave').tap();expect(page.locator('#profileInventoryStatus')).to_contain_text('배지를 장착')
   page.locator('#profileCardSelf').tap();expect(page.locator('#profileMonthlyBadge')).to_contain_text('2026년 11월 참여 배지');expect(page.locator('#profileCardBadge')).to_contain_text('2026년 11월 클릭왕')
   assert page.locator('#profileArt').evaluate('e=>e.complete&&e.naturalWidth>0')
   page.screenshot(path=str(ROOT/f'tools/test-results/monthly-card-{width}x{height}.png'));page.locator('#profileClose').tap();page.locator('#itemsClose').tap()
   page.locator('#rankingBtn').tap();page.locator('#monthlySeason').select_option('2026-12');expect(page.locator('#monthlyMe')).to_contain_text('0클릭');expect(page.locator('#monthlyState')).to_contain_text('아직 집계된')
   # Failure state is recoverable; no old ranking is presented as current.
   def failure(route):
    if route.request.post_data_json.get('action')=='monthly_rankings':route.fulfill(status=500,content_type='application/json',body='{"error":"local test"}')
    else:route.continue_()
   page.route('**/local/api',failure);page.locator('#monthlyRefresh').tap();expect(page.locator('#monthlyState')).to_contain_text('불러오지 못했습니다');expect(page.locator('#monthlyList li')).to_have_count(0)
   page.unroute('**/local/api',failure);page.locator('#monthlyRefresh').tap();expect(page.locator('#monthlyState')).to_contain_text('아직 집계된')
   assert not errors,errors;print(f'PASS monthly {width}x{height} reduced={reduced}: real taps, tabs, month/history, tie order, settlement/card/title/badge, profile, empty/error/retry, no overflow',flush=True);ctx.close()
  finally:server.terminate();server.wait(timeout=10)
 browser.close()
