"""Exercise slow, failed and cancelled image loads without production state."""
import os,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,os.environ['WAKPPU_TEST_PYTHON_PATH'])
from playwright.sync_api import sync_playwright,expect
with sync_playwright() as p:
 browser=p.chromium.launch(channel='msedge',headless=True)
 for mode in ['slow','failure','cancel','timeout']:
  page=browser.new_page(viewport={'width':320,'height':568},is_mobile=True,has_touch=True)
  pending=[];errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.route('https://fixture.test/**',lambda r:pending.append(r) if '/images/' in r.request.url else r.fulfill(content_type='text/html',body='<meta name="viewport" content="width=device-width, initial-scale=1"><div id="wrap"><svg></svg></div><div id="effects"></div>'))
  page.goto('https://fixture.test/')
  page.add_style_tag(path=str(ROOT/'wakppuball/limited.css'))
  page.add_script_tag(path=str(ROOT/'wakppuball/js/halloween-effects.js'))
  page.evaluate("""()=>{window.audio=0;window.paid=0;window.spawned=0;window.SoundManager={play(){audio++},stop(){}};window.WakppuSettings={reduced:()=>false};window.run=WakppuHalloweenEffects.play({wrap:document.querySelector('#wrap'),svg:document.querySelector('svg'),effects:document.querySelector('#effects'),center:{x:160,y:200},valid:()=>true,reward(){paid++},respawn(){spawned++},random:()=>0,speed:10,respawnSpeed:10});}""")
  page.wait_for_function('paid===1');assert pending
  assert page.evaluate('audio')==0
  expect(page.locator('.jackolantern-scare')).to_have_count(0)
  if mode=='slow':
   pending[0].fulfill(content_type='image/png',body=(ROOT/'wakppuball/images/scares/jackolantern.png').read_bytes())
   expect(page.locator('.jackolantern-scare')).to_be_visible()
   assert page.evaluate('audio')==1
   assert page.evaluate('spawned')==0
   page.set_viewport_size({'width':568,'height':320})
   page.wait_for_function("document.querySelector('.jackolantern-scare')?.getBoundingClientRect().width===568&&document.querySelector('.jackolantern-scare')?.getBoundingClientRect().height===320")
  elif mode=='failure':pending[0].abort()
  elif mode=='cancel':
   page.evaluate('run.cancel()')
   pending[0].fulfill(content_type='image/png',body=(ROOT/'wakppuball/images/scares/jackolantern.png').read_bytes())
   page.wait_for_timeout(100)
   assert page.evaluate('spawned===0&&audio===0')
  if mode!='cancel':page.wait_for_function('spawned===1',timeout=4000)
  if mode=='timeout':
   pending[0].fulfill(content_type='image/png',body=(ROOT/'wakppuball/images/scares/jackolantern.png').read_bytes())
   page.wait_for_timeout(100)
   assert page.evaluate('audio')==0
  expect(page.locator('.jackolantern-scare')).to_have_count(0)
  assert page.evaluate('paid')==1
  assert not errors,errors
  page.close();print('PASS image loading:',mode,flush=True)
 browser.close()
