"""Isolated paid auto-rebirth flow; real migration, fake bank and legacy gameplay adapter."""
import os,sys,socket,subprocess,time
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,os.environ.get('WAKPPU_TEST_PYTHON_PATH',str(ROOT/'tools/.test-deps')))
from playwright.sync_api import sync_playwright,expect
with sync_playwright() as p:
 browser=p.chromium.launch(channel='msedge',headless=True)
 for width,height in [(320,640),(844,390),(1200,900),(390,844)]:
  with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
  server=subprocess.Popen(['node',str(ROOT/'tools/local-server.mjs')],cwd=ROOT,env=dict(os.environ,WAKPPU_LOCAL_PORT=str(port),WAKPPU_LOCAL_PAYMENTS='1',WAKPPU_LOCAL_BANK_PREVIEW='1',WAKPPU_LOCAL_CUSTOM_LIVE='1',WAKPPU_LOCAL_AUTO_REBIRTH='1',WAKPPU_LOCAL_SLEEP_TIME='2026-10-21T03:00:00Z'),stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,encoding='utf8')
  try:
   assert server.stdout.readline().startswith('Local preview:');server.stdout.readline();password=server.stdout.readline().strip().split(': ',1)[1];base=f'http://127.0.0.1:{port}'
   ctx=browser.new_context(viewport={'width':width,'height':height},is_mobile=width<900,has_touch=True,reduced_motion='reduce' if width==390 else 'no-preference')
   ctx.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base) or r.request.url.startswith('data:') else r.fulfill(status=200,body=''))
   page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('dialog',lambda d:d.accept())
   def rpc(action,**more):return page.evaluate('(b)=>WakppuAuth.invoke(b.action,b)',dict(action=action,**more))
   def login(admin=False):
    page.evaluate("async x=>{const r=await WakppuAuth.signIn(x.admin?'dodoonglee@gmail.com':'guest',x.admin?x.password:'');if(r.error)throw r.error;await WakppuItemGame.restore();await WakppuPurchases.refresh();await WakppuAutoRebirth.refresh();}",{'admin':admin,'password':password})
    page.wait_for_function('WakppuItemGame.read().ready')
   def trace_game(route):
    response=route.fetch();body=response.text().replace('function spawnBall(animate) {', 'function spawnBall(animate) { window.__spawns??=[];window.__spawns.push(new Error().stack);')
    route.fulfill(response=response,body=body)
   page.route('**/js/game.js*',trace_game)
   page.goto(base+'/?preview=bank',wait_until='networkidle');page.wait_for_selector('[data-purchase-product="auto_rebirth"]');page.wait_for_function('WakppuItemGame.read().ready')
   buyer=page.evaluate('WakppuItemGame.read().account')
   expect(page.locator('[data-purchase-product="auto_rebirth"]')).to_contain_text('4,000원')
   page.locator('#purchaseDepositor').fill('자동 환생 검증')
   with page.expect_response(lambda r:r.url.endswith('/local/api') and r.request.post_data_json.get('action')=='purchase_order') as response:page.locator('[data-purchase-product="auto_rebirth"]').tap()
   order=response.value.json()['order'];assert order['amount']==4000
   assert not rpc('auto_rebirth_status')['owned']
   login(True);rpc('admin_purchase_approve',order_id=order['id'],confirmed_amount=4000,deposit_reference='auto-smoke-'+order['id'])
   rpc('admin_rebirths',user_id=buyer,mode='set',value='0');rpc('admin_gold',user_id=buyer,mode='set',value='1999999')
   login();assert not rpc('auto_rebirth_status')['enabled'];expect(page.locator('#shopAutoToggle')).to_have_text('자동 환생 OFF')
   page.locator('#shopAutoToggle').tap();expect(page.locator('#shopAutoToggle')).to_have_text('자동 환생 ON')
   assert page.locator('#shopAutoToggle').bounding_box()['height']>=44
   page.locator('[data-close="shop"]').tap()
   page.wait_for_timeout(2200);assert rpc('bootstrap')['state']['rebirths']==0
   page.evaluate('''()=>{
    window.__rewardRun=null;window.__autoStacks=[];window.__autoCompleteAt=null;window.__autoCalls=[];window.__autoReadyAt=null;window.__autoRunAt=null;window.__autoAccountRestores=0;
    const invoke=WakppuAuth.invoke;WakppuAuth.invoke=function(action,...args){__autoCalls.push(action);if(action==='bootstrap')__autoStacks.push(new Error().stack);return invoke.call(this,action,...args);};
    const request=WakppuAutoRebirth.request;WakppuAutoRebirth.request=function(){if(WakppuAutoRebirthGame.ready()&&__autoReadyAt===null){__autoReadyAt=performance.now();__autoCalls=[];}return request();};
    const run=WakppuAutoRebirthGame.run;WakppuAutoRebirthGame.run=async function(){if(__autoRunAt===null){__autoRunAt=performance.now();__rewardRun={busy:WakppuItemGame.read().busy,broken:document.querySelector('#ballWrap').classList.contains('broken'),log:!!document.querySelector('.float-text')};}const result=await run();if(result)__autoCompleteAt=performance.now();return result;};
    addEventListener('wakppu-account-restored',()=>__autoAccountRestores++);
   }''')
   # Model a 300ms network round trip; assert the complete path, including server wait.
   def slow_rpc(route):
    if route.request.post_data_json.get('action') in ['save_progress','auto_rebirth_run']:time.sleep(.3)
    route.continue_()
   page.route('**/local/api',slow_rpc)
   for _ in range(5):page.locator('#ballSvg').tap();page.wait_for_timeout(300)
   page.wait_for_function("document.querySelector('#rebirthBtn').textContent.includes('환생 1회')&&!WakppuItemGame.read().busy",timeout=15000)
   timing=page.evaluate('''()=>({reward:__rewardRun,stacks:__autoStacks,total:__autoCompleteAt-__autoReadyAt,allCalls:__autoCalls,delay:__autoRunAt-__autoReadyAt,ready:__autoReadyAt,calls:__autoCalls.slice(__autoCalls.indexOf('auto_rebirth_run')+1),restores:__autoAccountRestores})''')
   assert timing['reward']['busy'] and timing['reward']['broken'] and timing['reward']['log'],timing
   assert timing['ready'] is not None and 0<=timing['delay']<500,timing
   assert 'save_progress' not in timing['allCalls'][:timing['allCalls'].index('auto_rebirth_run')],timing
   assert 300<=timing['total']<900,timing
   page.unroute('**/local/api',slow_rpc)
   assert not any('at run (' in stack for stack in timing['stacks']),timing
   state=rpc('bootstrap')['state'];assert str(state['gold'])=='0' and state['rebirths']==1
   assert state['unlocked_ball_ids']==['yellow']
   spawn_count=page.evaluate('__spawns.length')
   page.wait_for_timeout(1800)
   late_spawns=page.evaluate('(n)=>__spawns.slice(n)',spawn_count)
   assert all('restoreAccount' in stack or 'refresh' in stack for stack in late_spawns),late_spawns
   state=rpc('bootstrap')['state'];assert str(state['gold'])=='0' and state['rebirths']==1
   # Lose a committed response: recovery must show exactly one additional rebirth.
   lost=[False]
   def drop_once(route):
    if route.request.post_data_json.get('action')=='auto_rebirth_run' and not lost[0]:route.fetch();lost[0]=True;route.abort()
    else:route.continue_()
   page.route('**/local/api',drop_once)
   login(True);rpc('admin_gold',user_id=buyer,mode='set',value='6000000');login()
   page.wait_for_function("document.querySelector('#rebirthBtn').textContent.includes('환생 2회')&&!WakppuItemGame.read().busy",timeout=15000)
   page.wait_for_timeout(1200);assert lost[0];assert rpc('bootstrap')['state']['rebirths']==2
   expect(page.locator('#autoRebirthStatus')).to_contain_text('자동 환생을 완료했습니다.')
   page.locator('#rebirthBtn').tap();expect(page.locator('#rebirthAutoToggle')).to_have_text('자동 환생 ON');page.locator('#rebirthAutoToggle').tap();expect(page.locator('#rebirthAutoToggle')).to_have_text('자동 환생 OFF')
   assert page.locator('#rebirthAutoToggle').bounding_box()['height']>=44
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
   page.screenshot(path=str(ROOT/f'tools/test-results/fast-auto-rebirth-{width}x{height}.png'))
   page.reload(wait_until='networkidle');page.wait_for_function('WakppuItemGame.read().ready');assert not rpc('auto_rebirth_status')['enabled']
   login(True);assert not rpc('auto_rebirth_status')['enabled'];rpc('admin_purchase_refund',order_id=order['id'],refund_reference='auto smoke refund')
   login();assert not rpc('auto_rebirth_status')['owned'];expect(page.locator('#shopAuto')).to_be_hidden()
   assert not errors,errors
   print(f'PASS auto rebirth {width}x{height}: ready-to-complete {timing["total"]:.1f}ms with 300ms network delay; notify-to-run {timing["delay"]:.1f}ms, no bootstrap/items reload, lost-response recovery, reward-log trigger during shatter, no stale respawn, one reset, OFF/refund/account isolation/touch layout',flush=True)
   ctx.close()
  finally:server.terminate();server.wait(timeout=10)
 browser.close()
