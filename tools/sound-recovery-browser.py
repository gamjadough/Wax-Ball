"""Real media loading/recovery and touch settings; no production accounts."""
import os,socket,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,os.environ['WAKPPU_TEST_PYTHON_PATH'])
from playwright.sync_api import sync_playwright,expect
with sync_playwright() as p:
 browser=p.chromium.launch(channel='msedge',headless=True)
 for w,h in [(320,640),(844,390),(1200,900)]:
  with socket.socket() as s:s.bind(('127.0.0.1',0));port=s.getsockname()[1]
  base=f'http://127.0.0.1:{port}';server=subprocess.Popen([sys.argv[1],str(ROOT/'tools/local-server.mjs')],cwd=ROOT,env=dict(os.environ,WAKPPU_LOCAL_PORT=str(port),WAKPPU_LOCAL_SLEEP_TIME='2026-10-29T12:00:00+09:00'),stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,encoding='utf8')
  try:
   server.stdout.readline();server.stdout.readline();server.stdout.readline();ctx=browser.new_context(viewport={'width':w,'height':h},is_mobile=w<900,has_touch=True);ctx.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base) else r.fulfill(status=200,body=''))
   page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.add_init_script("window.__synth=0;window.__media=[];const AC=window.AudioContext||window.webkitAudioContext;const osc=AC.prototype.createOscillator;AC.prototype.createOscillator=function(...args){__synth++;return osc.apply(this,args)};const play=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(...args){__media.push({src:this.src,ready:this.readyState});return play.apply(this,args)};")
   requests=[0]
   def flaky(route):
    requests[0]+=1
    if requests[0]==1:route.fulfill(status=503,body='temporary media error')
    else:route.fulfill(status=200,content_type='audio/mpeg',body=(ROOT/'wakppuball/sounds/eternity/rare-early.mp3').read_bytes())
   page.route('**/sounds/eternity/rare-early.mp3',flaky);page.goto(base);page.wait_for_load_state('networkidle');page.keyboard.press('Shift')
   page.evaluate("window.opts={pitch:1,pitchRandom:0,volume:.6,volumeRandom:0};window.asset='eternity/rare-early';SoundManager.init([asset]);SoundManager.play(asset,opts)");page.wait_for_timeout(250);assert requests[0]==1;assert page.evaluate('__synth')==0;assert page.evaluate('__media.length')==0
   page.evaluate('for(let i=0;i<40;i++){SoundManager.init([asset]);SoundManager.play(asset,opts)}');assert requests[0]==1;page.wait_for_timeout(1100);page.evaluate('SoundManager.init([asset])');page.wait_for_function('SoundManager.ready(asset)');page.wait_for_timeout(250);assert 2<=requests[0]<=5
   page.evaluate('SoundManager.play(asset,opts)');page.wait_for_function('__media.length===1');assert page.evaluate('__media[0].src.endsWith("/eternity/rare-early.mp3")&&__media[0].ready>=1');assert page.evaluate('__synth')==0
   page.evaluate('for(let i=0;i<30;i++)SoundManager.play(asset,opts)');page.wait_for_timeout(200);assert page.evaluate('SoundManager.ready(asset)&&__synth===0');assert page.evaluate('__media.every(x=>x.ready>=1)');count=page.evaluate('__media.length')
   page.locator('#settingsBtn').tap();page.locator('#settingsMuted').check();page.evaluate('SoundManager.play(asset,opts)');assert page.evaluate('__media.length')==count;page.locator('#settingsMuted').uncheck();page.locator('#settingsClose').tap();page.evaluate('SoundManager.play(asset,opts)');assert page.evaluate('__media.length')==count+1
   page.evaluate("SoundManager.play('tap1',opts)");assert page.evaluate('__synth')>0
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');assert not errors,errors;print(f'PASS {w}x{h}: actual MP3 recovery after 503, retry backoff, no placeholder while loading/error, ready-only rapid voices, touch mute and legacy synth',flush=True);ctx.close()
  finally:server.terminate();server.wait(timeout=10)
 browser.close()
