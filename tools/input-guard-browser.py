"""Opted-in local fixtures plus real touch input; never uses production accounts."""
import os,socket,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,os.environ.get('WAKPPU_TEST_PYTHON_PATH',str(ROOT/'tools/.test-deps')))
from playwright.sync_api import sync_playwright,expect
with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
server=subprocess.Popen(['node',str(ROOT/'tools/local-server.mjs')],cwd=ROOT,env=dict(os.environ,WAKPPU_LOCAL_PORT=str(port),WAKPPU_LOCAL_SLEEP_TIME='2026-10-20T03:00:00Z',WAKPPU_LOCAL_INPUT_GUARD_PREVIEW='1'),stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,encoding='utf8')
try:
 assert server.stdout.readline().startswith('Local preview:');server.stdout.readline();password=server.stdout.readline().strip().split(': ',1)[1];base=f'http://127.0.0.1:{port}'
 with sync_playwright() as p:
  browser=p.chromium.launch(channel='msedge',headless=True)
  for width,height in [(320,640),(390,844),(844,390),(1200,900)]:
   ctx=browser.new_context(viewport={'width':width,'height':height},is_mobile=width<900,has_touch=True,reduced_motion='reduce')
   ctx.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base) else r.fulfill(status=200,body=''))
   page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto(base+'/');page.wait_for_function('!!window.WakppuAuth');page.evaluate('WakppuAuth.signIn("guest","")');page.evaluate("""async()=>{const s=JSON.parse(sessionStorage.getItem('wakppu-local-session'));await fetch('/local/input-guard-demo',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+s.token},body:JSON.stringify({mode:'reset'})});}""");page.reload();page.wait_for_function('WakppuItemGame.read().ready&&WakppuItems.data')
   def scenario(mode):return page.evaluate('''async mode=>{const s=JSON.parse(sessionStorage.getItem('wakppu-local-session'));const r=await fetch('/local/input-guard-demo',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+s.token},body:JSON.stringify({mode})});if(!r.ok)throw new Error(await r.text());return r.json();}''',mode)
   scenario('reset');page.evaluate('WakppuItemGame.restore()');page.wait_for_function('WakppuItemGame.read().ready')
   lost=[False]
   def delayed(route):
    import time
    body=route.request.post_data_json
    if body.get('action')=='item_hit' and not lost[0]:
     lost[0]=True;route.fetch();route.abort();return
    if body.get('action')=='item_hit':time.sleep(.2)
    route.continue_()
   page.route('**/local/api',delayed)
   for _ in range(3):
    with page.expect_response(lambda r:'/local/api' in r.url and r.request.post_data_json.get('action')=='item_hit') as response:
     page.locator('#ballSvg').tap()
    assert response.value.ok
    page.wait_for_function('!WakppuItemGame.read().busy')
   with page.expect_response(lambda r:'/local/api' in r.url and r.request.post_data_json.get('action')=='input_report') as report:
    page.evaluate('WakppuInputGuard.flush()')
   assert report.value.ok;assert lost[0]
   captured=report.value.request.post_data_json['samples'];assert len(captured)>=3;assert all(len(s)==3 and 0<=s[1]<=1000 and 0<=s[2]<=1000 for s in captured)
   assert report.value.json()['input_guard']['score']==0
   for mode in ['normal','fixed','rate','human','fast']:
    data=scenario(mode);assert data['moderation']['status']=='active',data
    if mode=='rate':assert data['result']['throttled']
    if mode=='fast':assert data['result']['input_guard']['score']==0 and data['result']['input_guard']['speed_limited_until']
   page.evaluate('WakppuItemGame.restore()');page.wait_for_function('WakppuItemGame.read().ready')
   for fraction in [.35,.5,.65]:
    r=page.locator('#ballSvg').bounding_box();page.touchscreen.tap(r['x']+r['width']*fraction,r['y']+r['height']*.5);page.wait_for_function('!WakppuItemGame.read().busy')
   with page.expect_response(lambda r:'/local/api' in r.url and r.request.post_data_json.get('action')=='input_report') as speed_report:page.evaluate('WakppuInputGuard.flush()')
   assert speed_report.value.ok;assert speed_report.value.json()['input_guard']['speed_limited_until'];expect(page.locator('#inputGuardNotice')).to_be_visible()
   assert page.locator('#inputGuardNotice').bounding_box()['height']<120
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
   page.screenshot(path=str(ROOT/f'tools/test-results/input-guard-speed-{width}x{height}.png'))
   data=scenario('macro');assert data['moderation']['status']=='suspended';assert data['result']['input_guard']['score']==100
   data=scenario('paused');assert data['moderation']['status']=='suspended';assert data['records']['rows'][0]['metrics']['loop_period']==7
   page.reload();page.wait_for_function('window.wakppuServerBlocked===true')
   # Protected endpoint remains inaccessible to ordinary users, even with a forged target.
   assert page.evaluate('WakppuAuth.invoke("admin_input_guard").then(()=>false,e=>e.status===403)')
   page.evaluate('(password)=>WakppuAuth.signIn("dodoonglee@gmail.com",password)',password);page.reload();page.wait_for_function('WakppuItemGame.read().ready&&!document.querySelector("#adminBtn").hidden')
   page.locator('#adminBtn').click()
   page.locator('#adminQuery').fill('local-admin');page.locator('#adminSearch').click();page.locator('#adminResults button').first.click()
   expect(page.locator('#adminPlayerInfo')).to_contain_text('자동 제재 횟수: 0회')
   page.locator('#adminQuery').fill('local-player');page.locator('#adminSearch').click();page.locator('#adminResults button').first.click()
   import re
   expect(page.locator('#adminPlayerInfo')).to_contain_text(re.compile(r'자동 제재 횟수: [1-9]\d*회'))
   expect(page.locator('#adminPlayerInfo')).to_contain_text('감지 기록 건수가 아닌')
   assert '경고 횟수' not in page.locator('#adminPlayerInfo').inner_text()
   page.locator('#inputGuardRefresh').scroll_into_view_if_needed();page.locator('#inputGuardRefresh').click();expect(page.locator('#inputGuardRows')).to_contain_text('의심 점수 100')
   expect(page.locator('#inputGuardRows')).to_contain_text('다중 위치 순환 반복');expect(page.locator('#inputGuardRows')).to_contain_text('순환 7지점');expect(page.locator('#inputGuardRows')).to_contain_text('자동 제한 종료')
   for selector in ['#inputGuardRefresh','#inputGuardPrev','#inputGuardNext']:
    assert page.locator(selector).bounding_box()['height']>=44
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
   out=ROOT/'tools/test-results';out.mkdir(exist_ok=True);page.screenshot(path=str(out/f'input-guard-admin-{width}x{height}.png'))
   page.evaluate('''async()=>{await WakppuAuth.signIn("guest","");await WakppuItemGame.restore();}''');expect(page.locator('#inputGuardRows')).to_be_empty()
   assert not errors,errors;ctx.close();print(f'PASS touch {width}x{height}: real taps/report, normal patterns, rate cap, simulated restriction, admin records, scrolling and no JS errors',flush=True)
  browser.close()
finally:server.terminate();server.wait(timeout=10)
