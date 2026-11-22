"""Reproducible idle/mobile performance checks against the loopback game server."""
import os,sys,json
from pathlib import Path
sys.path.insert(0,os.environ['WAKPPU_TEST_PYTHON_PATH'])
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1];base='http://127.0.0.1:4199'
with sync_playwright() as p:
 b=p.chromium.launch(channel='msedge',headless=True)
 for w,h in [(390,844),(844,390),(1200,900)]:
  c=b.new_context(viewport={'width':w,'height':h},has_touch=True,is_mobile=w<900)
  c.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base) else r.fulfill(status=200,body=''))
  page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.add_init_script("window.media=[];const A=Audio;window.Audio=function(...x){const a=new A(...x);media.push(a);return a};Audio.prototype=A.prototype;")
  page.goto(base,wait_until='networkidle')
  page.evaluate("window.thumbCalls=0;const old=buildBallThumb;window.buildBallThumb=(...args)=>{thumbCalls++;return old(...args)};window.mutations=0;const mo=new MutationObserver(r=>mutations+=r.length);mo.observe(document.body,{subtree:true,childList:true,attributes:true,characterData:true})")
  page.wait_for_timeout(4200)
  metrics=page.evaluate("({thumbCalls,mutations,audioNodes:media.filter(a=>a.src).length,resourceBytes:performance.getEntriesByType('resource').reduce((n,r)=>n+r.encodedBodySize,0),heap:performance.memory.usedJSHeapSize,dom:document.querySelectorAll('*').length})")
  assert metrics['thumbCalls']==0,metrics;assert metrics['audioNodes']==5,metrics
  assert metrics['mutations']<100,metrics
  # Opening inventory generates its content once, then no unchanged SVG rebuilds.
  page.locator('#inventoryBtn').tap();page.locator('#inventorySkinsTab').tap();expect(page.locator('#skinCards article')).to_have_count(5)
  initial=page.evaluate('thumbCalls');page.wait_for_timeout(2100);assert page.evaluate('thumbCalls')==initial
  page.locator('#itemsClose').tap()
  for ball in ['green','chocolate','water','planet','hell-core','diamond']:
   page.evaluate("id=>WakppuGameTest.run('cracks',id)",ball);page.wait_for_timeout(150)
  metrics['afterSixBallsAudio']=page.evaluate('media.filter(a=>a.src).length');assert metrics['afterSixBallsAudio']<=20,metrics
  page.evaluate('WakppuGameTest.end()')
  assert not errors,errors
  if w==390:(ROOT/'tools/test-results/performance-after.json').write_text(json.dumps(metrics,indent=2),encoding='utf8')
  print(f'PASS {w}x{h} '+json.dumps(metrics),flush=True)
  c.close()
 b.close()
