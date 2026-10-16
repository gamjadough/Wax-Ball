"""Local cutscene: timeline, artwork/audio, skip, focus, equip, cleanup and isolation."""
import os,socket,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,os.environ.get('WAKPPU_TEST_PYTHON_PATH',str(ROOT/'tools/.test-deps')))
from playwright.sync_api import sync_playwright,expect
with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
server=subprocess.Popen(['node',str(ROOT/'tools/local-server.mjs')],cwd=ROOT,env=dict(os.environ,WAKPPU_LOCAL_PORT=str(port)),stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,encoding='utf8')
try:
 assert server.stdout.readline().startswith('Local preview:')
 base=f'http://127.0.0.1:{port}'
 with sync_playwright() as p:
  browser=p.chromium.launch(channel='msedge',headless=True)
  for width,height,reduced in [(390,844,False),(1200,900,False),(844,390,False),(390,844,True)]:
   context=browser.new_context(viewport={'width':width,'height':height},is_mobile=width<500,has_touch=True)
   context.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base) else r.fulfill(status=200,body=''))
   page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.add_init_script("""window.cutsceneSounds=[];const original=AudioBufferSourceNode.prototype.start;AudioBufferSourceNode.prototype.start=function(when){cutsceneSounds.push({when,rate:this.playbackRate.value,state:this.context.state});return original.apply(this,arguments)};""")
   page.emulate_media(reduced_motion='reduce' if reduced else 'no-preference')
   page.goto(base+'/?preview=skin-sounds&skin=common')
   try:page.wait_for_load_state('networkidle',timeout=2000)
   except Exception:pass
   expect(page.locator('#previewSkinCutscene')).to_be_visible()
   page.wait_for_function('WakppuItemGame.read().test')
   out=ROOT/'tools/test-results';out.mkdir(exist_ok=True)
   before=page.evaluate('WakppuItemGame.read().gold')
   page.locator('#previewSkinCutscene').click()
   expect(page.locator('#skinCutscene')).to_have_count(1)
   assert page.evaluate('WakppuSkinCutscene.open()')==False
   assert page.locator('#game').evaluate('(e)=>e.inert')
   expect(page.locator('.cutscene-skip')).to_be_focused()
   if not reduced:
    page.wait_for_function("WakppuSkinCutscene.phase==='verse-two'")
    page.wait_for_timeout(500)
    page.screenshot(path=str(out/f'cutscene-verse-{width}-{height}.png'))
   page.wait_for_function("WakppuSkinCutscene.phase==='arrival'",timeout=6000)
   page.wait_for_timeout(200 if reduced else 450)
   expect(page.locator('.cutscene-ball [data-eternity-skin="transcendent"]')).to_have_count(1)
   assert page.evaluate('cutsceneSounds.some(s=>Math.abs(s.rate-.72)<.001&&s.state===\'running\')'),page.evaluate('cutsceneSounds')
   out=ROOT/'tools/test-results';out.mkdir(exist_ok=True)
   page.screenshot(path=str(out/f'cutscene-arrival-{width}-{height}-{reduced}.png'))
   page.wait_for_function("WakppuSkinCutscene.phase==='result'",timeout=3000)
   page.wait_for_timeout(650) # Capture the fully visible result, not its initial fade frame.
   expect(page.locator('#cutsceneEquip')).to_be_focused()
   expect(page.locator('.cutscene-skip')).to_be_hidden()
   # Controls must fit both portrait and landscape; Tab remains inside the dialog.
   for id in ['cutsceneEquip','cutsceneConfirm']:
    box=page.locator('#'+id).bounding_box();assert box['x']>=0 and box['y']>=0 and box['y']+box['height']<=height+1,box
   page.keyboard.press('Shift+Tab');expect(page.locator('#cutsceneConfirm')).to_be_focused()
   page.keyboard.press('Tab');expect(page.locator('#cutsceneEquip')).to_be_focused()
   page.screenshot(path=str(out/f'cutscene-result-{width}-{height}-{reduced}.png'))
   page.locator('#cutsceneEquip').click()
   expect(page.locator('#skinCutscene')).to_have_count(0)
   expect(page.locator('#previewSkinCutscene')).to_be_focused()
   assert not page.locator('#game').evaluate('(e)=>e.inert')
   expect(page.locator('#ballSvg [data-eternity-skin="transcendent"]')).to_have_count(1)
   assert page.evaluate('WakppuItemGame.read().gold')==before
   # Early skip reveals the result, never skips confirmation or grants rewards.
   page.locator('#previewSkinCutscene').click();page.locator('.cutscene-skip').click()
   expect(page.locator('#skinCutscene')).to_have_attribute('data-phase','result')
   page.locator('#cutsceneConfirm').click()
   page.locator('#previewSkinCutscene').click();page.keyboard.press('Escape')
   expect(page.locator('#skinCutscene')).to_have_attribute('data-phase','result')
   page.keyboard.press('Escape');expect(page.locator('#skinCutscene')).to_have_count(0)
   page.wait_for_timeout(300)
   assert not page.evaluate('WakppuSkinCutscene.active')
   assert page.evaluate('WakppuItemGame.read().gold')==before
   expect(page.locator('#backgroundMusic')).to_have_count(0)
   page.goto(base+'/');expect(page.locator('#previewSkinCutscene')).to_have_count(0)
   assert not errors,errors
   context.close();print(f'PASS {width}x{height} reduced={reduced}: timeline, decoded CC0 audio, skip/replay, focus/inert, equip, no Gold/BGM',flush=True)
  browser.close()
finally:
 server.terminate();server.wait(timeout=10)
