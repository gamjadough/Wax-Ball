"""Challenge and fixed dock regression. Isolated browser accounts only."""
import os,sys,socket,subprocess,json
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,os.environ['WAKPPU_TEST_PYTHON_PATH'])
from playwright.sync_api import sync_playwright,expect
with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
server=subprocess.Popen(['node',str(ROOT/'tools/local-server.mjs')],cwd=ROOT,env=dict(os.environ,WAKPPU_LOCAL_PORT=str(port)),stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,encoding='utf8')
try:
 assert server.stdout.readline().startswith('Local preview:');base=f'http://127.0.0.1:{port}'
 with sync_playwright() as p:
  browser=p.chromium.launch(channel='msedge',headless=True)
  for width,height,reduced in [(1200,900,False),(320,640,False),(844,390,False),(390,844,True)]:
   ctx=browser.new_context(viewport={'width':width,'height':height},has_touch=True,is_mobile=width<900,reduced_motion='reduce' if reduced else 'no-preference')
   ctx.add_init_script("HTMLElement.prototype.requestFullscreen=function(){window.fullscreenAttempts=(window.fullscreenAttempts||0)+1;return Promise.reject(new Error('test denial'))}")
   ctx.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base) else r.fulfill(status=200,body=''))
   page=ctx.new_page();errors=[];actions=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.on('request',lambda r:actions.append(json.loads(r.post_data or '{}').get('action')) if r.url.endswith('/local/api') else None)
   page.goto(base,wait_until='networkidle');page.evaluate("async()=>{await WakppuAuth.signIn('guest','');await WakppuItemGame.restore();}")
   dock=page.locator('.crack-lab-menu').bounding_box();assert abs(dock['x'])<1 and abs(dock['width']-width)<1 and abs(dock['y']+dock['height']-height)<1,dock
   assert page.locator('.crack-lab-menu').evaluate('(e)=>getComputedStyle(e).borderRadius')=='0px'
   page.evaluate('window.scrollTo(0,document.documentElement.scrollHeight)')
   for id in ['inventoryBtn','collectionBtn','rankingBtn']:
    box=page.locator('#'+id).bounding_box();assert box['y']+box['height']<=dock['y'],(id,box,dock)
   assert page.locator('#crackLabBtn').bounding_box()['height']>=44
   page.screenshot(path=str(ROOT/f'tools/test-results/crack-lab-dock-{width}x{height}.png'))
   # Establish a partially cracked ordinary ball, then preserve it through a challenge.
   page.locator('#ballSvg').tap();page.wait_for_function('!WakppuItemGame.read().busy');page.evaluate('WakppuItemGame.flush()')
   before=page.evaluate('({gold:WakppuItemGame.read().gold,clicks:WakppuBeginnerRead().clicks,required:WakppuBeginnerRead().required})')
   page.evaluate("()=>{window.labSoundCalls=0;const original=SoundManager.play;SoundManager.play=function(...args){window.labSoundCalls++;return original.apply(this,args)}}")
   await_marker=len(actions);page.locator('#crackLabBtn').tap();expect(page.locator('#crackLab')).to_be_visible();assert page.evaluate('window.fullscreenAttempts')>=1
   assert page.locator('#crackLab').evaluate('(e)=>e.clientWidth===innerWidth && e.clientHeight===innerHeight && e.scrollWidth<=e.clientWidth')
   page.clock.install();page.locator('.lab-start').tap()
   for i in range(5):page.locator('.lab-target').tap()
   expect(page.locator('[data-lab-combo]')).to_have_text('5');expect(page.locator('[data-lab-score]')).to_have_text('70')
   assert page.evaluate('window.labSoundCalls')==5
   if reduced:assert page.locator('.lab-effects').evaluate('(e)=>e.childElementCount')==0
   page.screenshot(path=str(ROOT/f'tools/test-results/crack-lab-play-{width}x{height}.png'))
   page.locator('.lab-board').tap(position={'x':2,'y':2});expect(page.locator('[data-lab-combo]')).to_have_text('0')
   page.locator('.lab-target').tap();expect(page.locator('[data-lab-score]')).to_have_text('80')
   page.clock.run_for(30100);expect(page.locator('.lab-target')).to_be_hidden();expect(page.locator('.lab-start')).to_have_text('다시 하기');expect(page.locator('[data-lab-best]')).to_have_text('80점')
   assert page.evaluate("localStorage.getItem('wakppu-crack-lab:v1:best')")=='80'
   page.locator('[data-lab-close]').tap();expect(page.locator('#crackLabBtn')).to_be_focused()
   after=page.evaluate('({gold:WakppuItemGame.read().gold,clicks:WakppuBeginnerRead().clicks,required:WakppuBeginnerRead().required})');assert before==after,(before,after)
   assert not any(a in ['item_hit','save_progress','limited_hit','custom_hit','event_hit','gem_ball_select'] for a in actions[await_marker:]),actions[await_marker:]
   page.locator('#crackLabBtn').tap();page.locator('.lab-start').tap();page.clock.run_for(300);page.keyboard.press('Space');expect(page.locator('[data-lab-score]')).to_have_text('10')
   page.locator('.lab-target').dispatch_event('keydown',{'key':'Enter','repeat':True});expect(page.locator('[data-lab-score]')).to_have_text('10')
   page.keyboard.press('Escape');expect(page.locator('#crackLab')).to_be_hidden();assert page.locator('.lab-effects').evaluate('(e)=>e.childElementCount')==0
   page.reload(wait_until='networkidle');page.locator('#crackLabBtn').tap();expect(page.locator('[data-lab-best]')).to_have_text('80점');assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');assert not errors,errors
   print(f'PASS lab {width}x{height}: bottom rectangle, nav clear, fallback, hits/sound/combo, 30s deadline, best, progress isolation, escape, reduced={reduced}',flush=True);ctx.close()
  # Use the actual fullscreen API once, independently from the denied fallback cases.
  ctx=browser.new_context(viewport={'width':1200,'height':900});page=ctx.new_page()
  ctx.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base) else r.fulfill(status=200,body=''))
  page.goto(base,wait_until='networkidle');page.evaluate("async()=>{await WakppuAuth.signIn('guest','');await WakppuItemGame.restore();}")
  page.locator('#crackLabBtn').click();expect(page.locator('#crackLab')).to_be_visible();native=page.evaluate('document.fullscreenElement===document.documentElement')
  page.wait_for_load_state('networkidle')
  page.evaluate("()=>{window.labMediaPlays=0;const original=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(...args){window.labMediaPlays++;return original.apply(this,args)};WakppuSettings.set({muted:true})}")
  page.locator('.lab-start').click();page.locator('.lab-target').click();assert page.evaluate('window.labMediaPlays')==0
  page.evaluate('WakppuSettings.set({muted:false})');page.locator('.lab-target').click();assert page.evaluate('window.labMediaPlays')>0
  page.locator('[data-lab-close]').click();page.wait_for_function('!document.fullscreenElement')
  print(f'PASS actual fullscreen API (accepted={native}), close cleanup, real audio play call and mute',flush=True);ctx.close();browser.close()
finally:server.terminate();server.wait(timeout=10)
