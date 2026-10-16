"""Production UI backed by the local server: no preview grants in shipped JS."""
import os,socket,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,os.environ.get('WAKPPU_TEST_PYTHON_PATH',str(ROOT/'tools/.test-deps')))
from playwright.sync_api import sync_playwright,expect
with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
server=subprocess.Popen(['node',str(ROOT/'tools/local-server.mjs')],cwd=ROOT,env=dict(os.environ,WAKPPU_LOCAL_PORT=str(port)),stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,encoding='utf8')
try:
 assert server.stdout.readline().startswith('Local preview:')
 base=f'http://127.0.0.1:{port}'
 with sync_playwright() as p:
  browser=p.chromium.launch(channel='msedge',headless=True)
  for width in [390,1200]:
   context=browser.new_context(viewport={'width':width,'height':960},is_mobile=width<500,has_touch=True)
   context.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base) else r.fulfill(status=200,body=''))
   page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto(base+'/')
   try:page.wait_for_load_state('networkidle',timeout=2000)
   except Exception:pass
   page.evaluate("""async()=>{await WakppuAuth.signIn('guest','');const s=JSON.parse(sessionStorage.getItem('wakppu-local-session'));await fetch('/local/skins-demo',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+s.token},body:'{}'});await WakppuItemGame.restore();await WakppuSkins.refresh();await WakppuItems.refresh();}""")
   page.wait_for_function('WakppuSkins.data&&WakppuItemGame.read().ready')
   expect(page.locator('#skinSoundPreview')).to_have_count(0)
   before=page.evaluate('WakppuItemGame.read().gold')
   page.locator('#shopBtn').click();page.locator('#shopDrawTab').click();page.locator('#drawSkinsTab').click()
   expect(page.locator('#skinDrawPanel')).to_be_visible();expect(page.locator('#drawPanel')).to_be_hidden()
   assert page.locator('#skinDrawPanel [data-pulls]').count()==0
   page.locator('#skinDrawOne').click()
   page.wait_for_function('WakppuSkinCutscene.active')
   assert int(before)-int(page.evaluate('WakppuItemGame.read().gold'))==220000000000000000000
   expect(page.locator('.cutscene-footer small')).to_contain_text('서버에 지급 완료')
   page.locator('.cutscene-skip').click();page.locator('#cutsceneEquip').click()
   page.wait_for_function("!WakppuSkins.busy&&!WakppuSkinCutscene.active&&WakppuSkins.data.equipped.eternity==='eternity_transcendent'")
   page.locator('[data-close="shop"]').click()
   page.locator('#collectionBtn').click()
   index=page.evaluate("WAKPPU_BALLS.findIndex(b=>b.id==='eternity')")
   while page.locator(f'[data-detail="{index}"]').count()==0:page.locator('#collectionNext').click()
   page.locator(f'[data-detail="{index}"]').click()
   if page.locator('[data-action="select"]').count():page.locator('[data-action="select"]').click()
   else:page.locator('#collectionClose').click()
   expect(page.locator('#ballSvg [data-eternity-skin="transcendent"]')).to_have_count(1)
   page.locator('#inventoryBtn').click();page.locator('#inventorySkinsTab').click()
   expect(page.locator('[data-skin-equip="eternity_transcendent"]')).to_have_text('장착 중')
   page.on('dialog',lambda dialog:dialog.accept())
   page.locator('[data-skin-exchange="eternity_hero"]').click();page.wait_for_function('!WakppuSkins.busy&&WakppuSkins.data.owned.eternity_hero')
   page.locator('[data-skin-equip="eternity_hero"]').click();page.wait_for_function("!WakppuSkins.busy&&WakppuSkins.data.equipped.eternity==='eternity_hero'")
   page.locator('#itemsClose').click();expect(page.locator('#ballSvg [data-eternity-skin="hero"]')).to_have_count(1)
   owned=page.evaluate('WakppuSkins.data.owned');shards=page.evaluate('WakppuSkins.data.shards');gold=page.evaluate('WakppuItemGame.read().gold')
   page.reload();page.wait_for_function("WakppuSkins.data?.equipped.eternity==='eternity_hero'&&WakppuItemGame.read().ready")
   assert page.evaluate('WakppuSkins.data.owned')==owned;assert page.evaluate('WakppuSkins.data.shards')==shards;assert page.evaluate('WakppuItemGame.read().gold')==gold
   expect(page.locator('#ballSvg [data-eternity-skin="hero"]')).to_have_count(1)
   page.locator('#inventoryBtn').click();page.locator('#inventorySkinsTab').click();page.locator('#skinUnequip').click();page.wait_for_function('!WakppuSkins.busy&&!WakppuSkins.data.equipped.eternity')
   out=ROOT/'tools/test-results';out.mkdir(exist_ok=True);page.screenshot(path=str(out/f'skins-release-{width}.png'))
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');assert not errors,errors
   context.close();print(f'PASS {width}px: single expensive pull, server grant before cutscene, equip/exchange/unequip, reload and Gold preservation',flush=True)
  browser.close()
finally:server.terminate();server.wait(timeout=10)
