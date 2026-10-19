"""Fresh browser onboarding; real clicks, no seeded Gold or production connections."""
import os,sys,socket,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,os.environ.get('WAKPPU_TEST_PYTHON_PATH',str(ROOT/'tools/.test-deps')))
from playwright.sync_api import sync_playwright,expect
with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
server=subprocess.Popen(['node',str(ROOT/'tools/local-server.mjs')],cwd=ROOT,env=dict(os.environ,WAKPPU_LOCAL_PORT=str(port),WAKPPU_LOCAL_BEGINNER_PREVIEW='1',WAKPPU_LOCAL_SLEEP_TIME='2026-10-19T03:00:00Z'),stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,encoding='utf8')
try:
 assert server.stdout.readline().startswith('Local preview:');base=f'http://127.0.0.1:{port}'
 with sync_playwright() as p:
  browser=p.chromium.launch(channel='msedge',headless=True)
  for w,h in [(390,844),(320,568),(844,390),(1200,900)]:
   ctx=browser.new_context(viewport={'width':w,'height':h},has_touch=True,is_mobile=w<900)
   ctx.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base) else r.fulfill(status=200,body=''))
   page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto(base);page.wait_for_load_state('networkidle')
   expect(page.locator('#beginnerGoal')).to_contain_text('첫 목표');expect(page.locator('#ballProgressText')).to_contain_text('0 / 5')
   page.locator('#rebirthBtn').click();expect(page.locator('#rebirthText')).to_contain_text('2M');expect(page.locator('#rebirthConfirm')).to_be_disabled();page.locator('[data-close="rebirth"]').click()
   page.locator('#beginnerGoalAction').click();expect(page.locator('#beginnerHelpClose')).to_be_focused();page.locator('#beginnerStart').click();expect(page.locator('#account')).to_be_visible();page.locator('[data-close="account"]').click()
   page.locator('#shopBtn').click();assert page.locator('#shopPurchase article').first.locator('#hammerBtn').count()==1
   page.locator('#shopDrawTab').click();expect(page.locator('#beginnerDrawNote')).to_be_visible();expect(page.locator('#drawPanel')).to_be_hidden();page.locator('#beginnerAdvanced').click();expect(page.locator('#drawPanel')).to_be_visible();page.locator('[data-close="shop"]').click()
   page.locator('#ballSvg').click();expect(page.locator('#ballProgressText')).to_contain_text('1 / 5')
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
   page.locator('#rankingBtn').scroll_into_view_if_needed();assert page.locator('#rankingBtn').evaluate('(e)=>e.getBoundingClientRect().bottom<=innerHeight')
   page.locator('#beginnerGoalAction').scroll_into_view_if_needed()
   page.screenshot(path=str(ROOT/f'tools/test-results/beginner-{w}.png'),full_page=True)
   if w==390 and not os.environ.get('WAKPPU_BEGINNER_LAYOUT_ONLY'):
    def finish_ball(count):
     page.wait_for_function('!WakppuItemGame.read().busy')
     for _ in range(count):page.locator('#ballSvg').click();page.wait_for_timeout(70)
     page.wait_for_function('!WakppuItemGame.read().busy')
    finish_ball(4)
    for _ in range(9):finish_ball(5)
    assert page.evaluate('WakppuItemGame.read().gold')=='10'
    expect(page.locator('#beginnerGoalAction')).to_have_text('해금하기');page.locator('#beginnerGoalAction').click();expect(page.locator('#ballName')).to_contain_text('초록색')
    expect(page.locator('#beginnerGoal')).to_contain_text('나무 망치')
    for _ in range(10):finish_ball(8)
    assert page.evaluate('WakppuItemGame.read().gold')=='100'
    page.locator('#beginnerGoalAction').click();expect(page.locator('#hammerBtn')).to_be_enabled();page.locator('#hammerBtn').click();page.locator('[data-close="shop"]').click()
    assert page.evaluate('WakppuItemGame.read().gold')=='0'
    page.reload();page.wait_for_load_state('networkidle');assert page.evaluate('WakppuBeginnerRead().hammer')
    page.locator('#ballSvg').click();expect(page.locator('#ballProgressText')).to_contain_text('3 / 8')
    page.locator('#shopBtn').click();page.locator('#shopDrawTab').click();expect(page.locator('#beginnerDrawNote')).to_be_visible()
   assert not errors,errors;print(f'PASS {w}x{h}: fresh goals, progress, affordable explanations, hammer-first shop, draw disclosure, help/account and overflow',flush=True)
   ctx.close()
  browser.close()
finally:server.terminate();server.wait(timeout=10)
