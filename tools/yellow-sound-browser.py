"""Decode the real supplied MP3 and exercise actual sound playback on local game hits."""
import os,socket,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,os.environ.get('WAKPPU_TEST_PYTHON_PATH',str(ROOT/'tools/.test-deps')))
from playwright.sync_api import sync_playwright,expect
with socket.socket() as s:s.bind(('127.0.0.1',0));port=s.getsockname()[1]
server=subprocess.Popen([sys.argv[1],str(ROOT/'tools/local-server.mjs')],cwd=ROOT,env=dict(os.environ,WAKPPU_LOCAL_PORT=str(port)),stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,encoding='utf8')
try:
 assert server.stdout.readline().startswith('Local preview:')
 base=f'http://127.0.0.1:{port}'
 with sync_playwright() as p:
  browser=p.chromium.launch(channel='msedge',headless=True)
  for width,height in [(1280,900),(390,844)]:
   page=browser.new_page(viewport={'width':width,'height':height});errors=[]
   page.on('pageerror',lambda e:errors.append(str(e)))
   page.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base) else r.fulfill(status=200,body=''))
   page.add_init_script('''window.soundPlays=[];const original=HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play=function(){if(this.src.includes('yellow-crack-482875'))window.soundPlays.push(this);return original.call(this);};''')
   page.goto(base);page.wait_for_load_state('networkidle')
   decoded=page.evaluate('''async()=>{const response=await fetch('sounds/yellow-crack-482875.mp3');if(!response.ok)throw Error('Missing MP3');const ctx=new AudioContext();const data=await ctx.decodeAudioData(await response.arrayBuffer());const result={duration:data.duration,channels:data.numberOfChannels,samples:data.length};await ctx.close();return result;}''')
   assert decoded['duration']>0 and decoded['samples']>0,decoded
   assert page.evaluate("WAKPPU_BALLS.filter(b=>['early','mid','late','final'].some(k=>getSoundConfig(b)[k].includes('yellow-crack-482875'))).map(b=>b.id)")==['yellow']
   for n in range(1,6):
    page.locator('#ballSvg').click(position={'x':150,'y':150})
    page.wait_for_function('(n)=>soundPlays.length===n',arg=n,timeout=5000)
   expect(page.locator('#goldValue')).to_have_text('1')
   page.wait_for_function('soundPlays.some(a=>!a.paused&&a.currentTime>0&&a.readyState>=2)',timeout=5000)
   assert page.evaluate('soundPlays.every(a=>a.error===null&&a.playbackRate===1)')
   page.wait_for_timeout(1100)
   page.evaluate('WakppuSettings.set({muted:true})')
   page.locator('#ballSvg').click(position={'x':150,'y':150});assert page.evaluate('soundPlays.length')==5
   page.evaluate('WakppuSettings.set({muted:false,sfx:false})')
   page.locator('#ballSvg').click(position={'x':150,'y':150});assert page.evaluate('soundPlays.length')==5
   page.evaluate('WakppuSettings.set({sfx:true,sfxVolume:25})')
   page.locator('#ballSvg').click(position={'x':150,'y':150})
   page.wait_for_function('soundPlays.length===6',timeout=5000)
   assert abs(page.evaluate('soundPlays.at(-1).volume')-.225)<.0001
   assert not errors,errors
   page.close();print(f'PASS {width}px: real MP3 decoded ({decoded["duration"]:.2f}s), all five hits/final playback, yellow only, mute/SFX toggle and volume')
  browser.close()
finally:server.terminate();server.wait(timeout=10)
