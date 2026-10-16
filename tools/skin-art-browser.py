"""Production skin UI: stale renderer URLs, admin ownership, idle motion and original break."""
import os,socket,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,os.environ.get('WAKPPU_TEST_PYTHON_PATH',str(ROOT/'tools/.test-deps')))
from playwright.sync_api import sync_playwright,expect
with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
server=subprocess.Popen(['node',str(ROOT/'tools/local-server.mjs')],cwd=ROOT,env=dict(os.environ,WAKPPU_LOCAL_PORT=str(port)),stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,encoding='utf8')
try:
 assert server.stdout.readline().startswith('Local preview:')
 server.stdout.readline();password=server.stdout.readline().strip().split(': ',1)[1]
 base=f'http://127.0.0.1:{port}'
 with sync_playwright() as p:
  browser=p.chromium.launch(channel='msedge',headless=True)
  for width,height,admin,reduced in [(390,844,True,False),(1200,900,True,False),(844,390,True,False),(390,844,False,True)]:
   context=browser.new_context(viewport={'width':width,'height':height},has_touch=True,is_mobile=width<900,reduced_motion='reduce' if reduced else 'no-preference')
   obsolete=[]
   def route(r):
    url=r.request.url
    if 'ball-art.js?v=20261016-reward1' in url or 'transcendent-effects.js?v=20261016-settings1' in url:
     obsolete.append(url);r.fulfill(body='throw new Error("obsolete cached renderer")')
    elif url.startswith(base):r.continue_()
    else:r.fulfill(status=200,body='')
   context.route('**/*',route)
   page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto(base+'/');page.wait_for_load_state('networkidle')
   page.evaluate("""async cfg=>{await WakppuAuth.signIn(cfg.admin?'dodoonglee@gmail.com':'guest',cfg.admin?cfg.password:'');const s=JSON.parse(sessionStorage.getItem('wakppu-local-session'));await fetch('/local/skins-demo',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+s.token},body:'{}'});await WakppuItemGame.restore();await WakppuSkins.refresh();await WakppuItems.refresh();}""",{'admin':admin,'password':password})
   page.wait_for_function('WakppuSkins.data&&WakppuItemGame.read().ready')
   assert len(page.evaluate('Object.keys(WakppuSkins.data.owned)'))==(5 if admin else 0)
   page.locator('#collectionBtn').click();index=page.evaluate("WAKPPU_BALLS.findIndex(b=>b.id==='eternity')")
   while not page.locator(f'[data-detail="{index}"]').count():page.locator('#collectionNext').click()
   page.locator(f'[data-detail="{index}"]').click();page.locator('[data-action="select"]').click()
   gold=page.evaluate('WakppuItemGame.read().gold');page.on('dialog',lambda d:d.accept())
   for rank in (['common','rare','hero','legendary','transcendent'] if admin else ['common','hero']):
    page.locator('#inventoryBtn').click();page.locator('#inventorySkinsTab').click()
    if not admin:
     page.locator(f'[data-skin-exchange="eternity_{rank}"]').click();page.wait_for_function(f"!WakppuSkins.busy&&WakppuSkins.data.owned.eternity_{rank}")
    expect(page.locator(f'#skinCards [data-eternity-skin="{rank}"]')).to_have_count(1)
    page.locator(f'[data-skin-equip="eternity_{rank}"]').click();page.wait_for_function(f"!WakppuSkins.busy&&WakppuSkins.data.equipped.eternity==='eternity_{rank}'")
    page.locator('#itemsClose').click();expect(page.locator(f'#ballSvg [data-eternity-skin="{rank}"]')).to_have_count(1)
    if rank=='common':
     motion=page.locator('#ballSvg .skin-common').evaluate('(e)=>getComputedStyle(e).animationName')
     assert ('transcendent-orbit' in motion and 'transcendent-glow' in motion) if not reduced else motion=='none'
    if rank=='hero':expect(page.locator('#ballSvg [data-skin-flame="phoenix"]')).to_have_count(1)
    if rank in ['common','hero'] and width==1200:
     page.screenshot(path=str(ROOT/f'tools/test-results/skin-art-{rank}.png'))
   assert page.evaluate('WakppuItemGame.read().gold')==gold
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');assert not obsolete;assert not errors,errors
   # Real game dispatch, not a direct effect-module call: common must keep convergence.
   page.evaluate("""()=>{window.skinPhases=[];document.querySelector('#ballSvg').parentElement.addEventListener('transcendent-phase',e=>skinPhases.push(e.detail));WakppuGameTest.run('last','eternity');WakppuGameTest.localSkinProgress(1);}""")
   # Server skin is still equipped; select silver through its already owned API first outside test.
   page.evaluate('WakppuGameTest.end()')
   page.locator('#inventoryBtn').click();page.locator('#inventorySkinsTab').click();page.locator('[data-skin-equip="eternity_common"]').click();page.wait_for_function("!WakppuSkins.busy&&WakppuSkins.data.equipped.eternity==='eternity_common'");page.locator('#itemsClose').click()
   page.evaluate("WakppuGameTest.run('last','eternity');WakppuGameTest.localSkinProgress(1)")
   page.locator('#ballSvg').click();page.wait_for_function("skinPhases.some(e=>e.kind==='convergence'&&e.phase==='complete')")
   assert page.evaluate("skinPhases.filter(e=>e.phase==='reward').length")==1
   assert not errors,errors
   print(f'PASS {width}x{height} admin={admin} reduced={reduced}: current cached URLs, motifs, phoenix, silver idle/convergence and unchanged Gold',flush=True)
   context.close()
  browser.close()
finally:server.terminate();server.wait(timeout=10)
