"""Silver tester badge through actual local ownership, equip and public profile flows."""
import os,sys,socket,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,os.environ['WAKPPU_TEST_PYTHON_PATH'])
from playwright.sync_api import sync_playwright,expect
with sync_playwright() as p:
 browser=p.chromium.launch(channel='msedge',headless=True)
 for w,h in [(320,640),(844,390),(1200,900)]:
  with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
  server=subprocess.Popen(['node',str(ROOT/'tools/local-server.mjs')],cwd=ROOT,env=dict(os.environ,WAKPPU_LOCAL_PORT=str(port),WAKPPU_LOCAL_MONTHLY_PREVIEW='1',WAKPPU_LOCAL_SLEEP_TIME='2026-11-04T03:00:00Z'),stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,encoding='utf8')
  try:
   assert server.stdout.readline().startswith('Local preview:');base=f'http://127.0.0.1:{port}'
   ctx=browser.new_context(viewport={'width':w,'height':h},has_touch=True,is_mobile=w<900)
   ctx.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base) or r.request.url.startswith('data:') else r.fulfill(status=200,body=''))
   page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto(base,wait_until='networkidle');page.evaluate("async()=>{await WakppuAuth.signIn('guest','');await WakppuItemGame.restore();const s=JSON.parse(sessionStorage.getItem('wakppu-local-session'));const r=await fetch('/local/monthly-demo',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+s.token},body:JSON.stringify({mode:'october_tester'})});if(!r.ok)throw Error(await r.text())}")
   page.locator('#inventoryBtn').tap();page.locator('#inventoryProfileCardsTab').tap();select=page.locator('#profileBadgeSelect')
   expect(select.locator('option[value=monthly_202610_participant]')).to_have_text('2026년 10월 테스터 배지')
   select.select_option('monthly_202610_participant');page.locator('#profileBadgeSave').tap();expect(page.locator('#profileInventoryStatus')).to_contain_text('배지를 장착')
   page.locator('#profileCardSelf').tap();badge=page.locator('#profileMonthlyBadge');expect(badge).to_have_class('monthly-badge tester-badge');expect(badge).to_have_text('2026년 10월 테스터 배지')
   assert badge.evaluate("e=>getComputedStyle(e).color==='rgb(224, 227, 233)'")
   expect(page.locator('#profileTitle')).to_contain_text('2026년 11월 클릭 TOP 10')
   assert badge.evaluate("e=>{const a=e.getBoundingClientRect(),b=document.querySelector('#profileTitle').getBoundingClientRect();return a.top>=b.bottom-1||a.bottom<=b.top+1||a.left>=b.right-1||a.right<=b.left+1}")
   assert '🏅' not in badge.text_content();assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
   page.screenshot(path=str(ROOT/f'tools/test-results/tester-badge-{w}x{h}.png'));page.locator('#profileClose').tap()
   select.select_option('');page.locator('#profileBadgeSave').tap();expect(page.locator('#profileInventoryStatus')).to_contain_text('해제')
   page.locator('#profileCardSelf').tap();expect(badge).to_be_hidden();page.locator('#profileClose').tap()
   select.select_option('monthly_202610_participant');page.locator('#profileBadgeSave').tap();expect(page.locator('#profileInventoryStatus')).to_contain_text('장착');page.locator('#itemsClose').tap()
   page.locator('#rankingBtn').tap();expect(page.locator('#rankingList .tester-badge')).to_have_count(1)
   page.locator('#rankingMonthlyTab').tap();page.locator('#monthlySeason').select_option('2026-10');expect(page.locator('#monthlyCountdown')).to_contain_text('테스터 배지 지급');expect(page.locator('#monthlyList .tester-badge')).to_have_count(1)
   page.locator('[data-close=ranking]').tap();page.reload(wait_until='networkidle');page.wait_for_function('WakppuItemGame.read().ready')
   assert page.evaluate("WakppuAuth.invoke('profile_status').then(p=>p.badge_equipped)")=='monthly_202610_participant'
   assert not errors,errors;print(f'PASS tester {w}x{h}: silver presentation, equip/unequip/reload, profile, overall/monthly ranks, no overflow',flush=True);ctx.close()
  finally:server.terminate();server.wait(timeout=10)
 browser.close()
