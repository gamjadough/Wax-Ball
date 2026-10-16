"""Local-only actual pumpkin destruction, deterministic chance edges, images and audio."""
import os,socket,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,os.environ.get('WAKPPU_TEST_PYTHON_PATH',str(ROOT/'tools/.test-deps')))
from playwright.sync_api import sync_playwright,expect
with socket.socket() as s:s.bind(('127.0.0.1',0));port=s.getsockname()[1]
server=subprocess.Popen([sys.argv[1],str(ROOT/'tools/local-server.mjs')],cwd=ROOT,env=dict(os.environ,WAKPPU_LOCAL_PORT=str(port)),stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,encoding='utf8')
try:
 assert server.stdout.readline().startswith('Local preview:');base=f'http://127.0.0.1:{port}'
 with sync_playwright() as p:
  browser=p.chromium.launch(channel='msedge',headless=True)
  for width,height,reduced in [(1280,844,False),(320,568,False),(390,844,False),(844,390,False),(390,844,True)]:
   page=browser.new_page(viewport={'width':width,'height':height},is_mobile=width<900,has_touch=width<900,reduced_motion='reduce' if reduced else 'no-preference');errors=[]
   page.on('pageerror',lambda e:errors.append(str(e)))
   page.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base) else r.fulfill(status=200,body=''))
   page.add_init_script("window.scareAudio=[];const play=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){if(this.src.includes('jackolantern-sting.wav'))scareAudio.push(this);return play.call(this);};")
   page.goto(base+'/?preview=halloween');page.wait_for_function('WakppuLimited.data?.tokens===100&&WakppuItemGame.read().ready',timeout=10000)
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
   for selector in ['#collectionBtn','#inventoryBtn','#rankingBtn']:
    box=page.locator(selector).bounding_box();assert box and box['y']>=0 and box['y']+box['height']<=height,(selector,box,height)
    if width<900:assert box['height']>=44
   page.locator('#collectionBtn').click();page.locator('#limitedCollectionTab').click();page.locator('[data-limited-detail]').click()
   expect(page.locator('.limited-detail')).to_contain_text('잭오랜턴 왁뿌볼')
   page.locator('[data-limited-buy]').click();page.wait_for_function('!WakppuLimited.busy');page.locator('[data-limited-select]').click()
   expect(page.locator('#ballName')).to_have_text('잭오랜턴 왁뿌볼')
   decoded=page.evaluate("async()=>{const c=new AudioContext();const a=await c.decodeAudioData(await(await fetch('sounds/jackolantern-sting.wav')).arrayBuffer());await c.close();return a.duration;}")
   assert .5<decoded<1
   page.evaluate("()=>{window.scareRolls=[];const original=WakppuHalloweenEffects.play;WakppuHalloweenEffects.play=options=>{const values=scareRolls.shift()||[1];return original({...options,random:()=>values.shift()??1});};}")
   page.evaluate('scareRolls.push([.3])')
   gold=int(page.evaluate('WakppuItemGame.read().gold'));(page.locator('#ballSvg').tap() if width<900 else page.locator('#ballSvg').click())
   expect(page.locator('.jackolantern-scare')).to_have_count(0)
   page.wait_for_function('(g)=>BigInt(WakppuItemGame.read().gold)===BigInt(g)+1500000000n',arg=str(gold),timeout=5000)
   page.wait_for_function('!WakppuItemGame.read().busy',timeout=5000)
   for index,name in enumerate(['jackolantern','ghost','witch']):
    page.evaluate('(i)=>{scareRolls.push([.29999,(i+.1)/3]);WakppuSettings.set({muted:i===0,sfx:i!==1});}',index)
    gold=int(page.evaluate('WakppuItemGame.read().gold'));(page.locator('#ballSvg').tap() if width<900 else page.locator('#ballSvg').click())
    overlay=page.locator('.jackolantern-scare');expect(overlay).to_be_visible()
    image=overlay.locator('img');page.wait_for_function("document.querySelector('.jackolantern-scare img')?.naturalWidth>0",timeout=5000)
    assert image.get_attribute('src').endswith(name+'.png')
    box=overlay.bounding_box();assert box['x']==0 and box['y']==0 and box['width']==width and box['height']==height
    button=overlay.locator('button').bounding_box();assert button['width']>=44 and button['height']>=44
    if width<600 and height>width:assert image.evaluate('e=>getComputedStyle(e).objectFit')=='contain'
    if reduced:assert page.locator('.halloween-fx').count()==0
    elif width<600 or height<=500:assert page.locator('.halloween-fx').count()<=6
    if reduced:assert image.evaluate('e=>getComputedStyle(e).animationName')=='none'
    if index<2:assert page.evaluate('scareAudio.length')==0
    else:
     page.wait_for_function('scareAudio.length===1&&scareAudio[0].currentTime>0',timeout=1000)
     out=ROOT/'tools/test-results';out.mkdir(parents=True,exist_ok=True);page.screenshot(path=str(out/f'jackolantern-scare-{width}x{height}-{reduced}.png'))
    if index==0:page.keyboard.press('Escape')
    elif index==1:overlay.locator('button').click()
    expect(overlay).to_have_count(0,timeout=2000)
    page.wait_for_function('!WakppuItemGame.read().busy',timeout=5000)
    assert int(page.evaluate('WakppuItemGame.read().gold'))==gold+1500000000
   page.reload();page.wait_for_function('WakppuLimited.data?.selected===WakppuLimitedData.ball.id',timeout=10000)
   expect(page.locator('#ballName')).to_have_text('잭오랜턴 왁뿌볼');expect(page.locator('.jackolantern-scare')).to_have_count(0)
   assert not errors,errors;page.close();print(f'PASS {width}px reduced={reduced}: 30% boundary, all three full-screen images, audio/mute, close/Escape/expiry, reward once and reload')
  browser.close()
finally:server.terminate();server.wait(timeout=10)
