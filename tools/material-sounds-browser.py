"""Real WAV decode, selected-ball pointer hits, staged material playback and mobile audio limits."""
import os,sys,socket,subprocess,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,os.environ['WAKPPU_TEST_PYTHON_PATH'])
from playwright.sync_api import sync_playwright
with socket.socket() as s:s.bind(('127.0.0.1',0));port=s.getsockname()[1]
server=subprocess.Popen([sys.argv[1],str(ROOT/'tools/local-server.mjs')],cwd=ROOT,env=dict(os.environ,WAKPPU_LOCAL_PORT=str(port),WAKPPU_LOCAL_SLEEP_TIME='2026-11-22T12:00:00+09:00'),stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,encoding='utf8')
try:
 assert server.stdout.readline().startswith('Local preview:');base=f'http://127.0.0.1:{port}'
 with sync_playwright() as p:
  browser=p.chromium.launch(channel='msedge',headless=True)
  for width,height in [(320,640),(844,390),(1200,900)]:
   ctx=browser.new_context(viewport={'width':width,'height':height},has_touch=True,is_mobile=width<900,reduced_motion='reduce')
   ctx.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base) else r.fulfill(status=200,body=''))
   page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.add_init_script("""window.materialPlayed=[];window.mediaCreated=[];const NativeAudio=Audio;window.Audio=function(...args){const a=new NativeAudio(...args);mediaCreated.push(a);return a};Audio.prototype=NativeAudio.prototype;const play=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(...args){if(this.src.includes('/materials/'))materialPlayed.push({src:this.src.split('?')[0],volume:this.volume,audio:this});return play.apply(this,args)};""")
   page.goto(base,wait_until='networkidle');page.evaluate('WakppuSettings.set({muted:false,sfx:true,sfxVolume:65,reduceEffects:true})')
   assert not page.evaluate("performance.getEntriesByType('resource').some(x=>x.name.includes('/materials/'))")
   ids=page.evaluate('Object.keys(WakppuMaterialSounds)')
   if width==320:
    decoded=page.evaluate("""async()=>{const ac=new AudioContext(),out=[];for(const name of [...new Set(Object.values(WakppuMaterialSounds).flatMap(cfg=>['early','mid','late','final'].flatMap(k=>cfg[k])))]){const r=await fetch('sounds/'+name);if(!r.ok)throw Error(name);const b=await ac.decodeAudioData(await r.arrayBuffer());let peak=0,sum=0;for(const v of b.getChannelData(0)){peak=Math.max(peak,Math.abs(v));sum+=v*v;}out.push({name,channels:b.numberOfChannels,duration:b.duration,peak,rms:Math.sqrt(sum/b.length)});}await ac.close();return out;}""")
    assert len(decoded)==35
    for d in decoded:assert d['channels']==1 and .10<d['duration']<1.06 and .30<d['peak']<.61 and d['rms']>.015,d
   gold=page.evaluate('WakppuItemGame.read().gold')
   for ball in ids:
    page.evaluate("id=>WakppuGameTest.run('cracks',id)",ball)
    page.wait_for_function("id=>['early','mid','late','final'].every(k=>WakppuMaterialSounds[id][k].every(n=>SoundManager.ready(n)))",arg=ball)
    start=page.evaluate('materialPlayed.length');page.locator('#ballSvg').tap()
    page.wait_for_function('n=>materialPlayed.length===n+1',arg=start)
    assert page.evaluate('id=>WakppuMaterialSounds[id].early.some(n=>materialPlayed.at(-1).src.endsWith(n))',ball)
    # Real files in the other stages are playable and use this same material.
    page.evaluate("id=>{const cfg=WakppuMaterialSounds[id];for(const stage of ['mid','late','final'])SoundManager.play(cfg[stage][0],cfg)}",ball)
    assert page.evaluate('materialPlayed.slice(-3).map(x=>x.src.split("/").pop())')==['mid.wav','late.wav','final.wav']
    assert page.evaluate("mediaCreated.filter(a=>a.src.includes('/materials/')).length")<=48
   # Fruit/snack/nature/gem balls really break through their own family; mode preserves gold.
   full_breaks=[('strawberry',11,'fruit-wax'),('apple',14,'fruit-wax'),('chocolate',17,'honey-wax'),('donut',20,'honey-wax'),('rainbow',23,'ice-wax'),('water',26,'ice-wax'),('emerald',29,'keycap'),('diamond',32,'keycap'),('planet',50,'honey-keycap'),('sun',100,'honey-keycap'),('blackhole',180,'honey-wax-butter'),('whitehole',300,'honey-wax-butter')]
   selected_family=os.environ.get('WAKPPU_SOUND_FULL_FAMILY')
   if selected_family:
    full_breaks=[v for v in full_breaks if v[2] in selected_family.split(',')]
    assert full_breaks,selected_family
   full_width=os.environ.get('WAKPPU_SOUND_FULL_WIDTH')
   if full_width and width!=int(full_width):full_breaks=[]
   full_label=','.join([v[0] for v in full_breaks]+['green'])
   for fruit,count,family in full_breaks:
    page.evaluate("id=>WakppuGameTest.run('cracks',id)",fruit)
    page.wait_for_function("id=>Object.values(WakppuMaterialSounds[id]).filter(Array.isArray).flat().every(n=>SoundManager.ready(n))",arg=fruit)
    start=page.evaluate('materialPlayed.length')
    for i in range(count):page.locator('#ballSvg').tap()
    page.wait_for_function('!WakppuItemGame.read().busy')
    played=page.evaluate('n=>materialPlayed.slice(n).map(x=>x.src)',start)
    assert len(played)==count and all('/materials/'+family+'/' in n for n in played),played
    assert played[-1].endswith('/'+family+'/final.wav'),played
    assert page.evaluate('WakppuItemGame.read().gold')==gold
   # Real full green-ball progression uses early/mid/late/final exactly once per accepted input.
   page.evaluate("WakppuGameTest.run('cracks','green')")
   page.wait_for_function("['early','mid','late','final'].every(k=>SoundManager.ready(WakppuMaterialSounds.green[k][0]))")
   start=page.evaluate('materialPlayed.length')
   for i in range(8):page.locator('#ballSvg').tap()
   page.wait_for_function('!WakppuItemGame.read().busy')
   stages=page.evaluate('n=>materialPlayed.slice(n).map(x=>x.src.split("/").pop())',start)
   assert set(stages[:2])=={'early.wav','tap.wav'} and stages[2:]==['mid.wav','mid.wav','mid.wav','late.wav','late.wav','final.wav'],stages
   assert page.evaluate('WakppuItemGame.read().gold')==gold
   # Burst playback remains bounded; final preempts previous hit tails.
   page.evaluate("()=>{const c=WakppuMaterialSounds.green;for(let i=0;i<60;i++)SoundManager.play(c[['early','mid','late'][i%3]][0],c)}")
   assert page.evaluate("mediaCreated.filter(a=>a.src.includes('/materials/')&&!a.paused).length")<=6
   page.evaluate("SoundManager.play(WakppuMaterialSounds.green.final[0],WakppuMaterialSounds.green)")
   assert page.evaluate("mediaCreated.filter(a=>a.src.includes('/materials/')&&!a.paused).length")==1
   assert page.evaluate('materialPlayed.every(x=>x.volume>0&&x.volume<.75)')
   n=page.evaluate('materialPlayed.length');page.evaluate("WakppuSettings.set({muted:true});SoundManager.play(WakppuMaterialSounds.green.early[0],WakppuMaterialSounds.green)")
   assert page.evaluate('materialPlayed.length')==n
   assert page.evaluate("mediaCreated.filter(a=>a.src.includes('/materials/')&&!a.paused).length")==0
   page.evaluate("WakppuSettings.set({muted:false,sfx:false});SoundManager.play(WakppuMaterialSounds.green.early[0],WakppuMaterialSounds.green)")
   assert page.evaluate('materialPlayed.length')==n
   page.evaluate('WakppuGameTest.end()')
   if width==320:
    page.evaluate("()=>{WakppuSettings.set({muted:false,sfx:true});localStorage.setItem('wax-ball:wakppuball:local-test-save',JSON.stringify({version:3,gold:'0',rebirths:0,unlocked:[true,true],discovered:['yellow','green'],selected:1}))}")
    page.reload(wait_until='networkidle')
    page.wait_for_function("['early','mid','late','final'].every(k=>SoundManager.ready(WakppuMaterialSounds.green[k][0]))")
    for i in range(8):page.locator('#ballSvg').tap()
    page.wait_for_function("WakppuItemGame.read().gold==='10'&&!WakppuItemGame.read().busy")
    page.reload(wait_until='networkidle');assert page.evaluate('WakppuItemGame.read().gold')=='10'
   assert not errors,errors
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
   print(f'PASS {width}x{height}: 23 selected-ball touch hits, 35 real WAVs across every stage, full {full_label} breaks, bounded cache/voices, final preemption, mute and reward preservation',flush=True)
   ctx.close()
  browser.close()
finally:server.terminate();server.wait(timeout=10)
