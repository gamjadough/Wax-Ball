"""Isolated custom-studio concept: no production or payment calls."""
import os,sys,socket,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,os.environ.get('WAKPPU_TEST_PYTHON_PATH',str(ROOT/'tools/.test-deps')))
from playwright.sync_api import sync_playwright,expect
with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
server=subprocess.Popen(['node',str(ROOT/'tools/local-server.mjs')],cwd=ROOT,env=dict(os.environ,WAKPPU_LOCAL_PORT=str(port),WAKPPU_LOCAL_CUSTOM_PREVIEW='1',WAKPPU_LOCAL_SLEEP_TIME='2026-10-21T03:00:00Z'),stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,encoding='utf8')
try:
 assert server.stdout.readline().startswith('Local preview:');base=f'http://127.0.0.1:{port}'
 with sync_playwright() as p:
  browser=p.chromium.launch(channel='msedge',headless=True)
  for width,height,reduced in ([(1200,900,False)] if '--effects' in sys.argv or '--special' in sys.argv else [(320,640,False),(844,390,False),(1200,900,False),(390,844,True)]):
   ctx=browser.new_context(viewport={'width':width,'height':height},is_mobile=width<900,has_touch=True,reduced_motion='reduce' if reduced else 'no-preference')
   ctx.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base) else r.fulfill(status=200,body=''))
   page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.add_init_script("window.customPlayed=[];const originalPlay=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){customPlayed.push(this.src);return originalPlay.apply(this,arguments)}")
   page.goto(base+'/?preview=custom');page.wait_for_load_state('networkidle');expect(page.locator('#customModal')).to_be_visible();expect(page.locator('#customPlanState')).to_contain_text('이용권 없음')
   expect(page.locator('#customApply')).to_be_disabled();assert page.locator('#customEffect option[value="skin:transcendent"]').get_attribute('disabled') is not None
   page.locator('#customSample').click();page.wait_for_function('document.querySelector("#customStatus").textContent.includes("불러왔습니다")')
   page.locator('#customBuySingle').click();expect(page.locator('#customPlanState')).to_contain_text('단일 볼 이용 중');expect(page.locator('#customApply')).to_be_enabled()
   page.locator('#customEffect').select_option('whitehole');page.locator('#customSound').select_option('admin-event')
   page.locator('#customZoom').fill('1.5');page.locator('#customX').fill('20');page.locator('#customY').fill('70')
   before=page.evaluate('WakppuBeginnerRead()');page.locator('#customApply').click();expect(page.locator('#customStatus')).to_contain_text('저장했습니다')
   image=page.locator('#ballSvg image').get_attribute('href');assert image.startswith('data:image/webp;')
   after=page.evaluate('WakppuBeginnerRead()');assert before['required']==after['required'] and before['baseReward']==after['baseReward'] and before['gold']==after['gold']
   page.locator('#customTarget').select_option('green');expect(page.locator('#customApply')).to_be_disabled();page.locator('#customUpgrade').click();expect(page.locator('#customPlanState')).to_contain_text('전체 볼 이용 중')
   page.locator('#customTarget').select_option('yellow');page.locator('#customOwnSkins').check();page.wait_for_function("Array.from(document.getElementById('customEffect').options).find(o=>o.value==='skin:transcendent').disabled===false")
   page.locator('#customEffect').select_option('skin:transcendent');page.locator('#customApplyAll').click();expect(page.locator('#customStatus')).to_contain_text('모든 볼')
   page.locator('#customFile').set_input_files({'name':'unsafe.svg','mimeType':'image/svg+xml','buffer':b'<svg xmlns="http://www.w3.org/2000/svg"/>'});expect(page.locator('#customStatus')).to_contain_text('8MB 이하')
   assert page.locator('#ballSvg image').get_attribute('href')==image
   # Real server gameplay: selection fixture only resets the local sample's ball choice.
   page.locator('#customPlay').click();expect(page.locator('#customModal')).to_be_hidden();page.wait_for_function('WakppuItemGame.read().ready&&!WakppuItemGame.read().busy')
   gold=page.evaluate('WakppuItemGame.read().gold');page.evaluate('window.customPhases=[];document.querySelector("#ballWrap").addEventListener("transcendent-phase",e=>customPhases.push(e.detail.kind))')
   needed=page.evaluate('WakppuBeginnerRead().required');damage=page.evaluate('WakppuBeginnerRead().damage')
   for i in range((needed+damage-1)//damage):
    page.locator('#ballSvg').tap()
    if i<(needed+damage-1)//damage-1:page.wait_for_function('!WakppuItemGame.read().busy')
   page.wait_for_function('(g)=>BigInt(WakppuItemGame.read().gold)===BigInt(g)+1n',arg=gold)
   page.wait_for_function('!WakppuItemGame.read().busy');assert page.evaluate('customPhases.includes("void")');assert page.evaluate('customPlayed.some(s=>s.includes("/admin/collapse.wav"))')
   assert page.locator('#ballSvg image').get_attribute('href')==image
   page.reload();page.wait_for_load_state('networkidle');expect(page.locator('#customPlanState')).to_contain_text('전체 볼 이용 중');assert page.locator('#ballSvg image').get_attribute('href')==image
   expect(page.locator('#customZoom')).to_be_enabled();page.locator('#customZoom').fill('1.15');page.locator('#customApplyAll').click();expect(page.locator('#customStatus')).to_contain_text('모든 볼');recropped=page.locator('#ballSvg image').get_attribute('href');assert recropped!=image;image=recropped
   page.locator('#customOwnSkins').uncheck();expect(page.locator('#customEffect option[value="skin:transcendent"]')).to_have_attribute('disabled','');expect(page.locator('#ballSvg image')).to_have_count(0)
   page.locator('#customOwnSkins').check();page.locator('#customTarget').select_option('green');page.locator('#customRestore').click();expect(page.locator('#customStatus')).to_contain_text('기본 외형')
   assert page.evaluate('!WakppuCustomBall.config("green")&&!!WakppuCustomBall.config("yellow")')
   page.locator('#customTarget').select_option('yellow');page.locator('#customEffect').select_option('yellow');page.locator('#customApply').click();expect(page.locator('#customStatus')).to_contain_text('저장했습니다')
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');assert page.locator('#customModal').evaluate('(e)=>e.scrollWidth<=e.clientWidth')
   for selector in ['#customClose','#customApply','#customPlay','#customBuySingle']:
    assert page.locator(selector).bounding_box()['height']>=44
   out=ROOT/'tools/test-results';out.mkdir(exist_ok=True);page.screenshot(path=str(out/f'custom-studio-{width}x{height}.png'))
   page.locator('#customClose').click();page.locator('#customOpen').click();expect(page.locator('#customModal')).to_be_visible()
   if '--effects' in sys.argv:
    effect_ids=page.locator('#customEffect option').evaluate_all('(options)=>options.filter(o=>!o.disabled).map(o=>o.value)')
    for effect_id in effect_ids:
     page.locator('#customEffect').select_option(effect_id);page.locator('#customApply').click();expect(page.locator('#customStatus')).to_contain_text('저장했습니다')
     page.locator('#customLast').click();page.locator('#ballSvg').tap();page.wait_for_function('!WakppuItemGame.read().busy')
     assert page.locator('#ballSvg image').get_attribute('href')==image
     assert page.evaluate('WakppuItemGame.read().gold')==str(int(gold)+1)
     page.locator('#customOpen').click()
     print('PASS preset '+effect_id,flush=True)
    # First-click audition waits for its real media pool, and mute prevents a new play.
    page.locator('#customSound').select_option('pumpkin:ghost');page.locator('#customListen').click();expect(page.locator('#customStatus')).to_contain_text('재생했습니다')
    count=page.evaluate('customPlayed.length');page.evaluate('WakppuSettings.set({muted:true})');page.locator('#customListen').click();expect(page.locator('#customStatus')).to_contain_text('재생했습니다');assert page.evaluate('customPlayed.length')==count
   if '--special' in sys.argv:
    page.evaluate("async()=>{const {state}=await WakppuAuth.invoke('bootstrap');await WakppuAuth.invoke('save_progress',{...state,item_revision:WakppuItemGame.read().revision,hammer_owned:true,hammer_level:10});await WakppuItemGame.restore();await WakppuAuth.invoke('hammer_select',{level:10,item_revision:WakppuItemGame.read().revision,request_id:crypto.randomUUID()});await WakppuItemGame.restore();}")
    for ball_id,title in [('halloween-pumpkin-2026','잭오랜턴 왁뿌볼'),('admin-event','관리자 왁뿌볼')]:
     page.locator('#customTarget').select_option(ball_id);page.locator('#customEffect').select_option('yellow');page.locator('#customApply').click();expect(page.locator('#customStatus')).to_contain_text('저장했습니다')
     page.locator('#customPlay').click();expect(page.locator('#ballName')).to_have_text(title);page.wait_for_function('!WakppuItemGame.read().busy')
     current=page.evaluate('WakppuBeginnerRead()');needed=current['required'];damage=current['damage'];before_gold=int(current['gold']);expected_reward=int(current['baseReward']);print('SPECIAL input',ball_id,needed,damage,flush=True);assert damage==135
     for j in range((needed+damage-1)//damage):
      page.locator('#ballSvg').tap()
      if j<(needed+damage-1)//damage-1:page.wait_for_function('!WakppuItemGame.read().busy')
     page.wait_for_function('(v)=>BigInt(WakppuItemGame.read().gold)===BigInt(v)',arg=str(before_gold+expected_reward));page.wait_for_function('!WakppuItemGame.read().busy')
     assert page.locator('#ballSvg image').get_attribute('href')==image
     page.locator('#customOpen').click();print('PASS live special reward '+ball_id,flush=True)
   assert not errors,errors;print(f'PASS custom {width}x{height} reduced={reduced}: plans, crop, skin gate, live hit/reward/audio/effects, persistence, restore and layout',flush=True)
   ctx.close()
  browser.close()
finally:server.terminate();server.wait(timeout=10)
