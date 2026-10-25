"""Current champion title with real local profile/admin routes; no production writes."""
import os,sys,socket,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,os.environ['WAKPPU_TEST_PYTHON_PATH'])
from playwright.sync_api import sync_playwright,expect
with sync_playwright() as p:
 browser=p.chromium.launch(channel='msedge',headless=True)
 for width,height,reduced in [(1200,900,False),(320,640,False),(844,390,False),(390,844,True)]:
  with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
  server=subprocess.Popen(['node',str(ROOT/'tools/local-server.mjs')],cwd=ROOT,env=dict(os.environ,WAKPPU_LOCAL_PORT=str(port),WAKPPU_LOCAL_SLEEP_TIME='2026-10-25T03:00:00Z'),stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,encoding='utf8')
  try:
   server.stdout.readline();server.stdout.readline();password=server.stdout.readline().strip().split(': ',1)[1];base=f'http://127.0.0.1:{port}'
   ctx=browser.new_context(viewport={'width':width,'height':height},has_touch=True,is_mobile=width<900,reduced_motion='reduce' if reduced else 'no-preference')
   ctx.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base) else r.fulfill(status=200,body=''))
   page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(base,wait_until='networkidle')
   page.evaluate("async password=>{await WakppuAuth.signIn('guest','');await WakppuItemGame.restore();window.titleAdminToken=(await(await fetch('/local/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'dodoonglee@gmail.com',password})})).json()).token;}",password)
   def admin_change(user,value):
    return page.evaluate("async b=>{const r=await fetch('/local/api',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+titleAdminToken},body:JSON.stringify({action:'admin_rebirths',user_id:b.user,mode:'set',value:String(b.value)})});if(!r.ok)throw Error('Local rank update failed');}",{'user':user,'value':value})
   owner=page.evaluate('WakppuItemGame.read().account')
   assert not page.evaluate('WakppuAuth.invoke("profile_status").then(s=>s.title_catalog.some(t=>t.id==="champion"))')
   admin_change(owner,7);page.evaluate('WakppuItemGame.restore()');page.locator('#inventoryBtn').tap();page.locator('#inventoryProfileCardsTab').tap()
   select=page.locator('#profileTitleSelect');expect(select.locator('option[value="champion"]')).to_have_count(1)
   before=page.evaluate('WakppuItemGame.read().gold')
   select.select_option('champion');page.locator('#profileTitleSave').tap();expect(page.locator('#profileEquippedTitle')).to_have_text('현재 칭호: 👑 왁뿌볼의 정점')
   assert page.evaluate('WakppuItemGame.read().gold')==before
   select.select_option('none');page.locator('#profileTitleSave').tap();expect(page.locator('#profileEquippedTitle')).to_have_text('현재 칭호: 없음')
   select.select_option('champion');page.locator('#profileTitleSave').tap();expect(page.locator('#profileEquippedTitle')).to_contain_text('왁뿌볼의 정점')
   page.locator('#profileCardSelf').tap();expect(page.locator('#profileTitle')).to_have_text('👑 왁뿌볼의 정점');expect(page.locator('#profileTitle')).to_have_class('profile-player-title champion-title')
   if reduced:assert page.locator('#profileTitle').evaluate('(e)=>getComputedStyle(e).animationName')=='none'
   assert page.locator('#playerProfileDialog').evaluate('(e)=>e.scrollWidth<=e.clientWidth')
   page.screenshot(path=str(ROOT/f'tools/test-results/champion-title-{width}x{height}.png'))
   page.locator('#profileClose').tap();page.locator('#itemsClose').tap();page.locator('#rankingBtn').tap()
   expect(page.locator('#rankingList .champion-title')).to_have_text('👑 왁뿌볼의 정점')
   page.locator('[data-close="ranking"]').tap();page.reload(wait_until='networkidle');page.wait_for_function('WakppuItemGame.read().ready')
   page.evaluate("async password=>{window.titleAdminToken=(await(await fetch('/local/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'dodoonglee@gmail.com',password})})).json()).token;}",password)
   page.locator('#inventoryBtn').tap();page.locator('#inventoryProfileCardsTab').tap();expect(select).to_have_value('champion')
   page.locator('#profileCardSelf').tap();admin_change('local-admin',8)
   # Existing 15s profile/inventory polling must remove the now-ineligible title.
   expect(page.locator('#profileTitle')).to_be_hidden(timeout=22000);page.locator('#profileClose').tap();expect(select.locator('option[value="champion"]')).to_have_count(0)
   assert page.evaluate("WakppuAuth.invoke('profile_title',{title_id:'champion'}).then(()=>false,()=>true)")
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');assert page.locator('#profileTitleSave').bounding_box()['height']>=44;assert not errors,errors
   ctx.close();print(f'PASS champion title {width}x{height}: rank-only, equip/none, ranking/profile gold style, reload, automatic revocation, no overflow, reduced={reduced}',flush=True)
  finally:server.terminate();server.wait(timeout=10)
 browser.close()
