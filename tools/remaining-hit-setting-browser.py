"""Real touch settings, persistence and unchanged gameplay; isolated local server."""
import os,socket,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,os.environ['WAKPPU_TEST_PYTHON_PATH'])
from playwright.sync_api import sync_playwright,expect
with sync_playwright() as p:
 browser=p.chromium.launch(channel='msedge',headless=True)
 for width,height in [(320,640),(844,390),(1200,900)]:
  with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
  base=f'http://127.0.0.1:{port}'
  server=subprocess.Popen([sys.argv[1],str(ROOT/'tools/local-server.mjs')],cwd=ROOT,env=dict(os.environ,WAKPPU_LOCAL_PORT=str(port),WAKPPU_LOCAL_SLEEP_TIME='2026-10-23T12:00:00+09:00'),stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,encoding='utf8')
  try:
   assert server.stdout.readline().startswith('Local preview:');server.stdout.readline();server.stdout.readline()
   ctx=browser.new_context(viewport={'width':width,'height':height},has_touch=True,is_mobile=width<900);ctx.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base) else r.fulfill(status=200,body=''))
   # An older stored settings object must retain its mute preference and gain the visible default.
   ctx.add_init_script("if(!localStorage.getItem('wakppuball:player-settings:v1'))localStorage.setItem('wakppuball:player-settings:v1',JSON.stringify({muted:true}));")
   page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(base);page.wait_for_load_state('networkidle');page.evaluate("async()=>{await WakppuAuth.signIn('guest','');await WakppuItemGame.restore()}");page.wait_for_function('WakppuItemGame.read().ready');before=page.evaluate('WakppuItemGame.read().gold')
   region=page.locator('#ballProgress');reward=page.locator('#ballRewardText');count=page.locator('#ballProgressText');bar=page.locator('#ballProgressBar');expect(count).to_be_visible();expect(bar).to_be_visible();page.locator('#settingsBtn').tap();toggle=page.locator('#settingsRemainingHits');expect(toggle).to_be_checked();expect(page.locator('#settingsMuted')).to_be_checked();assert toggle.locator('..').evaluate('e=>e.getBoundingClientRect().height')>=44
   toggle.uncheck();page.locator('#settingsClose').tap();expect(count).to_be_hidden();expect(bar).to_be_hidden();expect(reward).to_be_hidden();assert region.evaluate('e=>e.getBoundingClientRect().height')==0;page.locator('#ballSvg').tap();page.wait_for_function('!WakppuItemGame.read().busy');assert page.evaluate('WakppuBeginnerRead().clicks')==1
   page.reload();page.wait_for_function('WakppuItemGame.read().ready');expect(count).to_be_hidden();page.locator('#settingsBtn').tap();expect(toggle).not_to_be_checked();toggle.check();page.locator('#settingsClose').tap();expect(count).to_be_visible();expect(reward).to_be_visible();expect(bar).to_be_visible();expect(count).to_contain_text(str(page.evaluate('WakppuBeginnerRead().required-WakppuBeginnerRead().clicks'))+' 남음')
   other=ctx.new_page();other.goto(base);other.wait_for_function('!!window.WakppuSettings');other.evaluate('WakppuSettings.set({showRemainingHits:false})');expect(count).to_be_hidden();other.close()
   for _ in range(6):
    page.locator('#ballSvg').tap();page.wait_for_function('!WakppuItemGame.read().busy')
    if int(page.evaluate('WakppuItemGame.read().gold'))==int(before)+1:break
   assert int(page.evaluate('WakppuItemGame.read().gold'))==int(before)+1;expect(count).to_be_hidden();expect(bar).to_be_hidden();expect(reward).to_be_hidden();assert region.evaluate('e=>e.getBoundingClientRect().height')==0;page.locator('#settingsBtn').tap();page.locator('#settingsReset').tap();expect(toggle).to_be_checked();assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');assert page.locator('.settings-sheet').evaluate('e=>e.scrollWidth<=e.clientWidth+1');page.locator('#settingsClose').tap();expect(count).to_be_visible()
   assert not errors,errors;print(f'PASS {width}x{height}: touch toggle, legacy default, immediate display, reload/tab sync, reset and whole region hidden without layout space, unchanged click/reward',flush=True);ctx.close()
  finally:server.terminate();server.wait(timeout=10)
 browser.close()
