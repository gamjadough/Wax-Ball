"""Real local routes, no production writes; touch portrait/landscape, reward, reload and cleanup."""
import os,sys,socket,subprocess,time
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,os.environ['WAKPPU_TEST_PYTHON_PATH'])
from playwright.sync_api import sync_playwright,expect
with sync_playwright() as p:
 browser=p.chromium.launch(channel='msedge',headless=True)
 for width,height,reduced in [(1200,900,False),(320,640,False),(844,390,False),(390,844,True)]:
  with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
  server=subprocess.Popen(['node',str(ROOT/'tools/local-server.mjs')],cwd=ROOT,env=dict(os.environ,WAKPPU_LOCAL_PORT=str(port),WAKPPU_LOCAL_GEM_BALL_PREVIEW='1',WAKPPU_LOCAL_SLEEP_TIME='2026-10-29T03:00:00Z'),stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,encoding='utf8')
  try:
   assert server.stdout.readline().startswith('Local preview:');base=f'http://127.0.0.1:{port}'
   ctx=browser.new_context(viewport={'width':width,'height':height},has_touch=True,is_mobile=width<900,reduced_motion='reduce' if reduced else 'no-preference')
   ctx.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base) else r.fulfill(status=200,body=''))
   page=ctx.new_page();errors=[];bad=[]
   page.add_init_script("window.gemMedia=[];const gemPlay=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(...args){if(this.src.includes('/blue-crystal/'))gemMedia.push({src:this.src,ready:this.readyState});return gemPlay.apply(this,args)}")
   page.on('pageerror',lambda e:errors.append(str(e)))
   page.on('response',lambda r:bad.append(r.url) if r.status>=400 and '/sounds/blue-crystal/' in r.url else None)
   page.goto(base,wait_until='networkidle')
   page.evaluate("async()=>{await WakppuAuth.signIn('guest','');await WakppuItemGame.restore();await WakppuItems.refresh();await WakppuLimited.refresh();await WakppuBlueGems.refresh();await WakppuGemBalls.refresh();}")
   gold=page.evaluate('WakppuItemGame.read().gold');expect(page.locator('#blueGemValue')).to_have_text('5K')
   page.wait_for_function("['tap','crack','split','break'].every(n=>SoundManager.ready('blue-crystal/'+n+'.wav'))")
   page.keyboard.press('Shift')
   page.evaluate("for(const n of ['tap','crack','split','break'])SoundManager.play('blue-crystal/'+n+'.wav',{pitch:1,volume:.6,pitchRandom:0,volumeRandom:0})")
   page.wait_for_function('gemMedia.length===4');assert page.evaluate('gemMedia.every(m=>m.ready>=1)')
   page.locator('#settingsBtn').tap();page.locator('#settingsMuted').check()
   page.evaluate("SoundManager.play('blue-crystal/break.wav',{pitch:1,volume:.6})");assert page.evaluate('gemMedia.length')==4
   page.locator('#settingsMuted').uncheck();page.locator('#settingsClose').tap()
   page.locator('#collectionBtn').tap();page.locator('#gemCollectionTab').tap()
   expect(page.locator('#gemCollection')).to_be_visible()
   assert page.evaluate("getComputedStyle(document.querySelector('#gemCollection .collection-name')).color===getComputedStyle(document.querySelector('#collectionGrid .collection-card')).color")
   page.evaluate("async()=>{const original=WakppuAuth.invoke;WakppuAuth.invoke=async(a,...b)=>{if(a==='gem_balls')throw Error('canceling statement due to statement timeout');return original(a,...b)};try{await WakppuGemBalls.refresh()}finally{WakppuAuth.invoke=original}}")
   expect(page.locator('#gemCollectionStatus')).to_have_text('서버 응답이 늦어지고 있습니다. 잠시 후 다시 시도해주세요.')
   page.evaluate('WakppuGemBalls.refresh()');expect(page.locator('#gemCollectionStatus')).to_have_text('')
   page.locator('[data-gem-detail]').tap()
   assert page.evaluate("getComputedStyle(document.querySelector('#gemCollection .collection-name')).color===getComputedStyle(document.querySelector('#collectionGrid .collection-card')).color")
   expect(page.locator('[data-gem-buy]')).to_be_enabled();assert page.locator('[data-gem-buy]').bounding_box()['height']>=44
   page.locator('[data-gem-buy]').tap();expect(page.locator('[data-gem-select]')).to_be_enabled();expect(page.locator('#blueGemValue')).to_have_text('0')
   assert page.locator('#gemCollection').evaluate('(e)=>e.scrollWidth<=e.clientWidth')
   page.screenshot(path=str(ROOT/f'tools/test-results/gem-ball-collection-{width}x{height}.png'))
   page.locator('[data-gem-select]').tap();expect(page.locator('#collection')).to_be_hidden()
   expect(page.locator('#ballSvg [data-gem-wax]')).to_have_count(1)
   expect(page.locator('#ballRewardText')).to_contain_text('💎 +5')
   page.evaluate("window.gemPhases=[];document.getElementById('ballSvg').parentElement.addEventListener('transcendent-phase',e=>gemPhases.push(e.detail.phase))")
   page.locator('#ballSvg').tap();page.wait_for_function('WakppuItemGame.read().busy')
   # Taps during destruction must not carry into the next ball.
   for _ in range(3):page.locator('#ballSvg').dispatch_event('pointerdown',{'pointerType':'touch','isPrimary':True,'clientX':100,'clientY':200})
   page.wait_for_function('!WakppuItemGame.read().busy',timeout=10000)
   assert page.evaluate('WakppuItemGame.read().gold')==gold
   expect(page.locator('#blueGemValue')).to_have_text('5');assert page.evaluate('WakppuGemBalls.data.clicks')==0
   page.wait_for_timeout(400);page.screenshot(path=str(ROOT/f'tools/test-results/gem-ball-play-{width}x{height}.png'))
   assert page.locator('.transcendent-fx').count()==0
   page.reload(wait_until='networkidle');page.wait_for_function('WakppuItemGame.read().ready')
   expect(page.locator('#ballSvg [data-gem-wax]')).to_have_count(1);expect(page.locator('#blueGemValue')).to_have_text('5')
   page.evaluate("WakppuCustomGame.select('yellow')")
   page.wait_for_function('!WakppuGemBalls.data.selected');expect(page.locator('#ballSvg [data-gem-wax]')).to_have_count(0)
   page.locator('#collectionBtn').tap();page.locator('#gemCollectionTab').tap()
   page.keyboard.press('Home');expect(page.locator('#normalCollectionTab')).to_be_focused()
   page.keyboard.press('End');expect(page.locator('#gemCollectionTab')).to_be_focused()
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
   assert not errors,errors;assert not bad,bad;ctx.close()
   print(f'PASS crystal {width}x{height}: unlock, select, 5 gems/zero Gold, no queued hits, reload, normal switch, tabs, no overflow/errors, reduced={reduced}',flush=True)
  finally:server.terminate();server.wait(timeout=10)
 browser.close()
