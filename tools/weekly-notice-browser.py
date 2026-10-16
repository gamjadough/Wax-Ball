"""Local-only manual event controls remain available during weekly reservations."""
import os,socket,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,os.environ.get('WAKPPU_TEST_PYTHON_PATH',str(ROOT/'tools/.test-deps')))
from playwright.sync_api import sync_playwright,expect
with socket.socket() as s:s.bind(('127.0.0.1',0));port=s.getsockname()[1]
server=subprocess.Popen([sys.argv[1],str(ROOT/'tools/local-server.mjs')],cwd=ROOT,env=dict(os.environ,WAKPPU_LOCAL_PORT=str(port)),stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,encoding='utf8')
try:
 assert server.stdout.readline().startswith('Local preview:');server.stdout.readline();password=server.stdout.readline().strip().split(': ',1)[1]
 base=f'http://127.0.0.1:{port}'
 with sync_playwright() as p:
  browser=p.chromium.launch(channel='msedge',headless=True)
  for width,height in [(1280,900),(390,844),(320,568)]:
   page=browser.new_page(viewport={'width':width,'height':height});errors=[]
   page.on('pageerror',lambda e:errors.append(str(e)))
   page.on('dialog',lambda d:d.accept())
   page.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base) else r.fulfill(status=200,body=''))
   page.goto(base);page.wait_for_load_state('networkidle')
   page.evaluate("async(password)=>{await WakppuAuth.signIn('dodoonglee@gmail.com',password);await WakppuItemGame.restore();}",password)
   expect(page.locator('#adminBtn')).to_be_visible();page.locator('#adminBtn').click()
   if page.locator('#weeklyEnable').is_enabled():page.locator('#weeklyEnable').click()
   expect(page.locator('#weeklyList')).to_contain_text('반복 중')
   expect(page.locator('#adminGoldEventStart')).to_be_enabled();expect(page.locator('#adminBallEventStart')).to_be_enabled()
   expect(page.locator('#scheduleList')).to_contain_text('없습니다')
   page.locator('#adminGoldEventStart').click();expect(page.locator('#adminGoldEventStop')).to_be_enabled()
   page.locator('#adminBallEventStart').click();expect(page.locator('#adminBallEventStop')).to_be_enabled()
   state=page.evaluate("async()=>await WakppuAuth.invoke('status')")
   assert state['manual_gold_event'] and state['manual_ball_event']
   assert all(row['enabled'] for row in state['weekly_events'])
   page.locator('#adminGoldEventStop').click();expect(page.locator('#adminGoldEventStart')).to_be_enabled()
   page.locator('#adminBallEventStop').click();expect(page.locator('#adminBallEventStart')).to_be_enabled()
   state=page.evaluate("async()=>await WakppuAuth.invoke('status')")
   assert state['gold_event']['source']=='weekly' and state['manual_gold_event'] is None
   page.locator('#admin [data-close="admin"]').click()
   expect(page.locator('#weeklyEventNotice')).to_have_count(0)
   expect(page.locator('#goldEventBanner')).to_be_hidden();expect(page.locator('#adminBallEventBanner')).to_be_hidden()
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
   out=ROOT/'tools/test-results';out.mkdir(parents=True,exist_ok=True);page.screenshot(path=str(out/f'silent-weekly-{width}.png'))
   page.reload();page.wait_for_load_state('networkidle');page.locator('#adminBtn').click()
   expect(page.locator('#adminGoldEventStart')).to_be_enabled()
   page.locator('#scheduleType').select_option('gold')
   at=page.evaluate("new Date(Date.now()+86400000+9*3600000).toISOString().slice(0,19)")
   page.locator('#scheduleAt').fill(at);page.locator('#scheduleCreate').click()
   expect(page.locator('#scheduleList')).to_contain_text('관리자 특별 이벤트')
   expect(page.locator('#scheduleList')).not_to_contain_text('금요일 정기 이벤트')
   page.locator('#weeklyDisable').click();expect(page.locator('#weeklyList')).to_contain_text('꺼짐')
   expect(page.locator('#scheduleList')).to_contain_text('관리자 특별 이벤트')
   page.locator('#scheduleList button').click();expect(page.locator('#scheduleList')).to_contain_text('없습니다')
   assert not errors,errors;page.close()
  browser.close();print('PASS desktop/mobile/small: hidden regular notices, manual start/stop/reserve/cancel independent of weekly, persistence and no overflow')
finally:server.terminate();server.wait(timeout=10)
