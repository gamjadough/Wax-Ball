"""Decode real files, hit the actual admin through every stage, check mute and reward."""
import os,sys,socket,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,os.environ.get('WAKPPU_TEST_PYTHON_PATH',str(ROOT/'tools/.test-deps')))
from playwright.sync_api import sync_playwright,expect
with socket.socket() as s:s.bind(('127.0.0.1',0));port=s.getsockname()[1]
server=subprocess.Popen(['node',str(ROOT/'tools/local-server.mjs')],cwd=ROOT,env=dict(os.environ,WAKPPU_LOCAL_PORT=str(port),WAKPPU_LOCAL_SLEEP_TIME='2026-10-19T03:00:00Z'),stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,encoding='utf8')
try:
 assert server.stdout.readline().startswith('Local preview:');base=f'http://127.0.0.1:{port}'
 with sync_playwright() as p:
  browser=p.chromium.launch(channel='msedge',headless=True)
  for w,h,reduced in [(320,568,False),(844,390,False),(1200,900,False),(390,844,True)]:
   context=browser.new_context(viewport={'width':w,'height':h},has_touch=True,is_mobile=w<900,reduced_motion='reduce' if reduced else 'no-preference')
   context.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base) else r.fulfill(status=200,body=''))
   page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.add_init_script("""window.adminPlayed=[];const original=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){if(this.src.includes('/sounds/admin/'))adminPlayed.push({name:this.src.split('/').pop(),volume:this.volume,rate:this.playbackRate,audio:this});return original.apply(this,arguments);};""")
   page.goto(base+'/?preview=adminball');page.wait_for_load_state('networkidle');page.wait_for_function('WakppuItemGame.read().ready&&document.querySelector("#ballName").textContent==="관리자 왁뿌볼"')
   page.locator('.admin-ball-preview').evaluate('(e)=>e.remove()') # Test-only controls must not cover game buttons.
   decoded=page.evaluate("""async()=>{const c=new AudioContext();const cfg=getSoundConfig(ADMIN_EVENT_BALL);const names=[...new Set(['early','mid','late','final'].flatMap(k=>cfg[k]))];const result=[];for(const n of names){const r=await fetch('sounds/'+n);if(!r.ok)throw Error(n);const b=await c.decodeAudioData(await r.arrayBuffer());const x=b.getChannelData(0);let peak=0,sum=0;for(const v of x){peak=Math.max(peak,Math.abs(v));sum+=v*v;}result.push({n,duration:b.duration,channels:b.numberOfChannels,peak,rms:Math.sqrt(sum/x.length)});}await c.close();return result;}""")
   assert len(decoded)==4
   for d in decoded:assert .15<d['duration']<1.8 and d['channels']==1 and .005<d['rms'] and d['peak']<.75,d
   page.evaluate('WakppuSettings.set({muted:false,sfx:true,sfxVolume:50})')
   gold=int(page.evaluate('WakppuItemGame.read().gold'))
   reward=page.evaluate('String(WAKPPU_BALLS.reduce((best,b)=>BigInt(b.reward)>best?BigInt(b.reward):best,1n)*10n)')
   for i in range(1,6):
    page.locator('#ballSvg').tap()
    if i<5:page.wait_for_function('(v)=>WakppuBeginnerRead().clicks===v&&!WakppuItemGame.read().busy',arg=i*135)
   page.wait_for_function('(g)=>BigInt(WakppuItemGame.read().gold)===BigInt(g[0])+BigInt(g[1])',arg=[str(gold),reward]);page.wait_for_function('!WakppuItemGame.read().busy')
   names=page.evaluate('adminPlayed.map(x=>x.name)')
   assert set(names)=={'pulse.wav','chime.wav','fracture.wav','collapse.wav'},names
   assert names.count('collapse.wav')==1
   assert page.evaluate("adminPlayed.every(x=>x.volume>0&&x.volume<.45&&x.rate>=.97&&x.rate<=1.03)")
   page.wait_for_function('adminPlayed.some(x=>x.audio.currentTime>0)')
   count=len(names);page.evaluate('WakppuSettings.set({muted:true})');page.locator('#ballSvg').tap();page.wait_for_function('WakppuBeginnerRead().clicks===135&&!WakppuItemGame.read().busy');assert page.evaluate('adminPlayed.length')==count
   page.evaluate('WakppuSettings.set({muted:false,sfx:false})');page.locator('#ballSvg').tap();page.wait_for_function('WakppuBeginnerRead().clicks===270&&!WakppuItemGame.read().busy');assert page.evaluate('adminPlayed.length')==count
   assert int(page.evaluate('WakppuItemGame.read().gold'))==gold+int(reward)
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');assert not errors,errors
   print(f'PASS {w}x{h} reduced={reduced}: 4 mono decoded WAVs, actual staged hits/final once, audible media, volume/mute, reward and overflow',flush=True)
   context.close()
   server.terminate();server.wait(timeout=10)
   server=subprocess.Popen(['node',str(ROOT/'tools/local-server.mjs')],cwd=ROOT,env=dict(os.environ,WAKPPU_LOCAL_PORT=str(port),WAKPPU_LOCAL_SLEEP_TIME='2026-10-20T03:00:00Z'),stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,encoding='utf8')
   assert server.stdout.readline().startswith('Local preview:')
  browser.close()
finally:server.terminate();server.wait(timeout=10)
