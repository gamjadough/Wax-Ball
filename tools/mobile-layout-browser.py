"""Local-only touch navigation, viewport bounds and scrolling on phone layouts."""
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
  for width,height in [(320,568),(390,844),(844,390)]:
   page=browser.new_page(viewport={'width':width,'height':height},is_mobile=True,has_touch=True);errors=[]
   page.on('pageerror',lambda e:errors.append(str(e)))
   page.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base) else r.fulfill(status=200,body=''))
   page.goto(base+'/?preview=halloween');page.wait_for_function('WakppuItemGame.read().ready&&WakppuLimited.data?.tokens===100')
   for button,modal,close in [('#settingsBtn','#playerSettings','#settingsClose'),('#shopBtn','#shop','[data-close="shop"]'),('#inventoryBtn','#itemsModal','#itemsClose'),('#collectionBtn','#collection','#collectionClose'),('#rankingBtn','#ranking','[data-close="ranking"]'),('#accountBtn','#account','[data-close="account"]')]:
    page.locator(button).tap();expect(page.locator(modal)).to_be_visible()
    sheet=page.locator(modal+' .sheet');box=sheet.bounding_box()
    assert box['x']>=0 and box['y']>=0 and box['x']+box['width']<=width+1 and box['y']+box['height']<=height+1,(modal,box)
    assert sheet.evaluate('e=>e.scrollWidth<=e.clientWidth+1'),modal
    if modal=='#shop':
     page.locator('#shopDrawTab').tap();expect(page.locator('#shopDraw')).to_be_visible()
     assert sheet.evaluate('e=>e.scrollWidth<=e.clientWidth+1')
    sheet.evaluate('e=>e.scrollTop=e.scrollHeight')
    sheet.evaluate('e=>e.scrollTop=0')
    page.locator(close).tap();expect(page.locator(modal)).to_be_hidden()
   assert not errors,errors
   out=ROOT/'tools/test-results';out.mkdir(parents=True,exist_ok=True);page.screenshot(path=str(out/f'mobile-layout-{width}x{height}.png'))
   page.close();print(f'PASS touch panels {width}x{height}: settings, shop/draw, inventory, collection, ranking, account; no overflow',flush=True)
  browser.close()
finally:server.terminate();server.wait(timeout=10)
