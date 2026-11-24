"""Four real gem-ball transactions and audio on isolated local routes, touch and reload."""
import os,sys,socket,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,os.environ['WAKPPU_TEST_PYTHON_PATH'])
from playwright.sync_api import sync_playwright,expect
catalog=[('blue-crystal-wax',5000,100,5,'blue-crystal'),('deepsea-crystal-wax',25000,150,8,'deepsea'),('aurora-crystal-wax',100000,200,12,'aurora'),('stellar-crystal-core',500000,300,20,'stellar')]
with sync_playwright() as p:
 browser=p.chromium.launch(channel='msedge',headless=True)
 for width,height,reduced in [(1200,900,False),(320,640,False),(844,390,False),(390,844,True)]:
  with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
  server=subprocess.Popen(['node',str(ROOT/'tools/local-server.mjs')],cwd=ROOT,env=dict(os.environ,WAKPPU_LOCAL_PORT=str(port),WAKPPU_LOCAL_GEM_EXPANSION_PREVIEW='1',WAKPPU_LOCAL_SLEEP_TIME='2026-10-29T03:00:00Z'),stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,encoding='utf8')
  try:
   assert server.stdout.readline().startswith('Local preview:');base=f'http://127.0.0.1:{port}'
   ctx=browser.new_context(viewport={'width':width,'height':height},has_touch=True,is_mobile=width<900,reduced_motion='reduce' if reduced else 'no-preference')
   ctx.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base) else r.fulfill(status=200,body=''))
   page=ctx.new_page();errors=[];bad=[]
   page.add_init_script("window.gemMedia=[];const gemPlay=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(...args){if(this.src.includes('/ice-keycap/'))gemMedia.push({src:this.src.split('?')[0],ready:this.readyState});return gemPlay.apply(this,args)}")
   page.on('pageerror',lambda e:errors.append(str(e)))
   page.on('response',lambda r:bad.append(r.url) if r.status>=400 and '/sounds/materials/ice-keycap/' in r.url else None)
   page.goto(base,wait_until='networkidle')
   page.evaluate("async()=>{await WakppuAuth.signIn('guest','');await WakppuItemGame.restore();await WakppuItems.refresh();await WakppuLimited.refresh();await WakppuBlueGems.refresh();await WakppuGemBalls.refresh();WakppuSettings.set({muted:false,sfx:true,sfxVolume:65});}")
   gold=page.evaluate('WakppuItemGame.read().gold');balance=630000
   page.locator('#collectionBtn').tap();page.locator('#gemCollectionTab').tap()
   expect(page.locator('[data-gem-detail]')).to_have_count(4)
   page.locator('[data-gem-detail="stellar-crystal-core"]').tap();expect(page.locator('[data-gem-buy]')).to_be_disabled();page.locator('[data-gem-back]').tap()
   for index,(ball,price,clicks,reward,variant) in enumerate(catalog):
    page.locator('[data-gem-detail="'+ball+'"]').tap()
    expect(page.locator('[data-gem-buy]')).to_be_enabled();assert page.locator('[data-gem-buy]').bounding_box()['height']>=44
    page.locator('[data-gem-buy]').tap();balance-=price
    expect(page.locator('[data-gem-select]')).to_be_enabled()
    assert page.evaluate('WakppuBlueGems.data.balance')==str(balance)
    if width==320:page.screenshot(path=str(ROOT/f'tools/test-results/gem-four-detail-{variant}.png'))
    page.locator('[data-gem-select]').tap();expect(page.locator('#collection')).to_be_hidden()
    expect(page.locator('#ballSvg [data-gem-wax="'+variant+'"]').first).to_be_visible()
    assert page.evaluate('WakppuBeginnerRead().required')==clicks
    expect(page.locator('#ballRewardText')).to_contain_text('💎 +'+str(reward))
    page.wait_for_function("Object.values(WakppuGemBallData.ball.sound).filter(Array.isArray).flat().every(n=>SoundManager.ready(n))")
    if index==0:
     decoded=page.evaluate("async()=>{const ac=new AudioContext(),out=[];for(const n of new Set(Object.values(WakppuGemBallData.ball.sound).filter(Array.isArray).flat())){const b=await ac.decodeAudioData(await(await fetch('sounds/'+n)).arrayBuffer());out.push(b.duration)}await ac.close();return out}")
     assert len(decoded)==5 and all(.1<d<.6 for d in decoded)
     page.locator('#settingsBtn').tap();page.locator('#settingsMuted').check();before=page.evaluate('gemMedia.length')
     page.evaluate("SoundManager.play('materials/ice-keycap/final.wav',{pitch:1,volume:.7})");assert page.evaluate('gemMedia.length')==before
     page.locator('#settingsMuted').uncheck();page.locator('#settingsClose').tap()
    start=page.evaluate('gemMedia.length');page.locator('#ballSvg').tap();page.wait_for_function('WakppuItemGame.read().busy')
    for _ in range(3):page.locator('#ballSvg').dispatch_event('pointerdown',{'pointerType':'touch','isPrimary':True,'clientX':100,'clientY':200})
    page.wait_for_function('!WakppuItemGame.read().busy',timeout=10000);balance+=reward
    assert page.evaluate('WakppuBlueGems.data.balance')==str(balance)
    assert page.evaluate('WakppuItemGame.read().gold')==gold
    assert page.evaluate('WakppuGemBalls.data.clicks')==0
    assert page.evaluate('n=>gemMedia.slice(n).map(m=>m.src)',start)==[base+'/sounds/materials/ice-keycap/final.wav']
    assert page.locator('.transcendent-fx').count()==0
    page.reload(wait_until='networkidle');page.wait_for_function('WakppuItemGame.read().ready')
    page.wait_for_function('id=>WakppuGemBalls.data?.selected===id',arg=ball)
    expect(page.locator('#ballSvg [data-gem-wax="'+variant+'"]').first).to_be_visible()
    assert page.evaluate('WakppuBlueGems.data.balance')==str(balance)
    if width==1200:page.screenshot(path=str(ROOT/f'tools/test-results/gem-four-play-{variant}.png'))
    page.locator('#collectionBtn').tap();page.locator('#gemCollectionTab').tap()
    if page.locator('[data-gem-back]').is_visible():page.locator('[data-gem-back]').tap()
   assert balance==45
   page.locator('#collectionClose').tap();page.evaluate("WakppuCustomGame.select('yellow')")
   page.wait_for_function('!WakppuGemBalls.data.selected');expect(page.locator('#ballSvg [data-gem-wax]')).to_have_count(0)
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
   assert not errors,errors;assert not bad,bad;ctx.close()
   print(f'PASS four gem balls {width}x{height}: prerequisite UI, buy/select, 5/8/12/20 gems once, zero Gold, simultaneous audio/mute, no queued hits, reload and normal switch, reduced={reduced}',flush=True)
  finally:server.terminate();server.wait(timeout=10)
 browser.close()
