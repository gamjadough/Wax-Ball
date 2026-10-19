"""Decode real files, hit the actual pumpkin through every stage, check mute and reward."""
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
   page.add_init_script("""window.pumpkinPlayed=[];const original=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){if(this.src.includes('/sounds/pumpkin/'))pumpkinPlayed.push({name:this.src.split('/').pop(),volume:this.volume,rate:this.playbackRate,audio:this});return original.apply(this,arguments);};""")
   page.goto(base+'/?preview=halloween');page.wait_for_function('WakppuLimited.data?.tokens===100&&WakppuItemGame.read().ready')
   page.locator('.halloween-local').evaluate('(e)=>e.remove()') # Test-only controls must not cover game buttons.
   decoded=page.evaluate("""async()=>{const c=new AudioContext();const cfg=getSoundConfig(WakppuLimitedData.ball);const names=[...new Set(['early','mid','late','final'].flatMap(k=>cfg[k]))];const result=[];for(const n of names){const r=await fetch('sounds/'+n+'.mp3');if(!r.ok)throw Error(n);const b=await c.decodeAudioData(await r.arrayBuffer());const x=b.getChannelData(0);let peak=0,sum=0;for(const v of x){peak=Math.max(peak,Math.abs(v));sum+=v*v;}result.push({n,duration:b.duration,channels:b.numberOfChannels,peak,rms:Math.sqrt(sum/x.length)});}await c.close();return result;}""")
   assert len(decoded)==5
   for d in decoded:assert .15<d['duration']<1.2 and d['channels']==1 and .005<d['rms'] and d['peak']<.75,d
   page.locator('#collectionBtn').click();page.locator('#limitedCollectionTab').click();page.locator('[data-limited-detail]').click();page.locator('[data-limited-buy]').click();page.wait_for_function('!WakppuLimited.busy');page.locator('[data-limited-select]').click()
   page.locator('#shopBtn').click();page.locator('#hammerLevelSelect').select_option('1');page.wait_for_function('!WakppuItemGame.read().busy');page.locator('[data-close="shop"]').click()
   page.evaluate("""()=>{WakppuSettings.set({muted:false,sfx:true,sfxVolume:50});const original=WakppuHalloweenEffects.play;WakppuHalloweenEffects.play=o=>original({...o,random:()=>1});}""")
   gold=int(page.evaluate('WakppuItemGame.read().gold'))
   for i in range(1,35):
    page.locator('#ballSvg').tap()
    if i<34:page.wait_for_function('(v)=>WakppuLimited.data.clicks===v&&!WakppuItemGame.read().busy',arg=i*3)
   page.wait_for_function('(g)=>BigInt(WakppuItemGame.read().gold)===BigInt(g)+1500000000n',arg=str(gold));page.wait_for_function('!WakppuItemGame.read().busy')
   names=page.evaluate('pumpkinPlayed.map(x=>x.name)')
   assert set(names)=={'tap-1.mp3','tap-2.mp3','crack-mid.mp3','crack-late.mp3','break.mp3'},names
   assert names.count('break.mp3')==1
   assert page.evaluate("pumpkinPlayed.every(x=>x.volume>0&&x.volume<.45&&x.rate>=.97&&x.rate<=1.03)")
   page.wait_for_function('pumpkinPlayed.some(x=>x.audio.currentTime>0)')
   count=len(names);page.evaluate('WakppuSettings.set({muted:true})');page.locator('#ballSvg').tap();page.wait_for_function('WakppuLimited.data.clicks===3&&!WakppuItemGame.read().busy');assert page.evaluate('pumpkinPlayed.length')==count
   page.evaluate('WakppuSettings.set({muted:false,sfx:false})');page.locator('#ballSvg').tap();page.wait_for_function('WakppuLimited.data.clicks===6&&!WakppuItemGame.read().busy');assert page.evaluate('pumpkinPlayed.length')==count
   assert int(page.evaluate('WakppuItemGame.read().gold'))==gold+1500000000
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');assert not errors,errors
   print(f'PASS {w}x{h} reduced={reduced}: 5 mono decoded MP3s, actual staged hits/final once, audible media, volume/mute, reward and overflow',flush=True)
   context.close()
  browser.close()
finally:server.terminate();server.wait(timeout=10)
