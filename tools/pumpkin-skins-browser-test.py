"""Isolated local cosmetic workshop. Run against a local-server.mjs instance."""
import json, os, sys
from pathlib import Path
sys.path.insert(0, os.environ.get('WAKPPU_TEST_PYTHON_PATH', str(Path(__file__).parent / '.test-deps')))
from playwright.sync_api import sync_playwright

base = os.environ.get('WAKPPU_PREVIEW_URL', 'http://127.0.0.1:4182')
out = Path(__file__).parent / 'test-results' / 'pumpkin-skins'
out.mkdir(parents=True, exist_ok=True)
results = []
with sync_playwright() as p:
    browser = p.chromium.launch(channel='msedge', headless=True)
    for width, height, reduced in [(1200,900,False),(320,568,False),(390,844,False),(844,390,False),(390,844,True)]:
        context = browser.new_context(viewport={'width':width,'height':height}, has_touch=width<1000, reduced_motion='reduce' if reduced else 'no-preference')
        context.route('**/*', lambda route: route.continue_() if route.request.url.startswith(base) else route.fulfill(status=200,body=''))
        page = context.new_page()
        page.add_init_script('''window.__audioPlays=[]; const originalPlay=HTMLMediaElement.prototype.play; HTMLMediaElement.prototype.play=function(){window.__audioPlays.push({src:this.src,volume:this.volume});return originalPlay.call(this);};''')
        errors, writes = [], []
        page.on('pageerror',lambda error:errors.append(str(error)))
        page.on('request',lambda request:writes.append(request.url) if request.method!='GET' else None)
        page.goto(base+'/local-pumpkin-skins/',wait_until='networkidle')
        assert page.locator('link[href="/style.css"]').count()==1
        assert page.locator('link[href="/skins.css"]').count()==1
        assert page.locator('.skin-card .skin-thumb svg').count()==3
        assert page.locator('.skin-choice').count()==3
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'), (width,height,'overflow')
        for skin in ['wisp','ghost','eclipse']:
            page.locator('.skin-choice[data-skin="'+skin+'"]').click()
            page.evaluate('''async skin => {for(const name of WakppuPumpkinSkins.profile(skin).sounds){const a=new Audio();a.preload='auto';await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Audio timeout: '+name)),6000);a.oncanplay=()=>{clearTimeout(timer);resolve();};a.onerror=()=>{clearTimeout(timer);reject(new Error('Audio error: '+name));};a.src='/sounds/'+name;a.load();});}}''',skin)
            assert page.locator('#ballSvg [data-pumpkin-skin="'+skin+'"]').count()==1
            assert page.locator('#ballSvg [data-wax-material="polished"]').count()==1
            assert page.evaluate('''() => [...document.querySelectorAll('button')].every(b=>b.getBoundingClientRect().height>=44)''')
            if width==1200:
                page.screenshot(path=str(out/f'{skin}-refined-clean.png'),full_page=True)
            original_paths=page.evaluate('''() => [...document.querySelectorAll('#ballSvg [id$="-cracks"] > path.crack')].map(p=>p.getAttribute('d'))''')
            assert 60<=len(original_paths)<=90
            page.locator('#ballSvg').tap() if width<1000 else page.locator('#ballSvg').click()
            assert page.evaluate('WakppuPumpkinSkinPreview.read().clicks')==10
            page.locator('[data-progress=".5"]').click()
            mid_width=page.locator('#ballSvg [id$="-cracks"] > path.crack').first.evaluate('(p)=>parseFloat(p.style.strokeWidth)')
            page.locator('[data-progress=".9"]').click()
            assert page.locator('#ballSvg [id$="-cracks"] > path.crack').first.evaluate('(p)=>parseFloat(p.style.strokeWidth)')>mid_width
            assert page.evaluate('''() => [...document.querySelectorAll('#ballSvg [id$="-cracks"] > path.crack')].map(p=>p.getAttribute('d'))''')==original_paths
            assert page.evaluate('''() => {const paths=[...document.querySelectorAll('#ballSvg [id$="-cracks"] > path.crack')];return paths.every((p,i)=>p.getAttribute('d')===paths[i-i%3].getAttribute('d'));}''')
            transition=page.locator('#ballSvg [id$="-cracks"] > path.crack').first.evaluate('(p)=>getComputedStyle(p).transitionDuration')
            assert transition==('0s' if reduced else '0.16s, 0.2s'),transition
            seams=page.locator('#ballSvg [data-pumpkin-seam]').count()
            assert seams=={'wisp':0,'ghost':10,'eclipse':20}[skin],seams
            assert page.evaluate('''() => [...document.querySelectorAll('#ballSvg [data-pumpkin-seam]')].every(p=>[...document.querySelectorAll('#ballSvg [id$="-cracks"] > path.crack')].some(b=>b.getAttribute('d')===p.getAttribute('d')&&b.style.strokeDashoffset===p.style.strokeDashoffset))''')
            page.locator('#stage').scroll_into_view_if_needed()
            page.screenshot(path=str(out/f'{skin}-{width}x{height}-{reduced}.png'),full_page=True)
            page.locator('#destroy').click()
            page.wait_for_timeout(120)
            count=page.locator('.pumpkin-skin-fx').count()
            compact=width<=600 or height<=500
            assert count==(0 if reduced else {'wisp':6 if compact else 10,'ghost':9 if compact else 15,'eclipse':9 if compact else 13}[skin]),count
            if not reduced and skin=='ghost':assert page.locator('.escaping-spirit').count()==1
            if not reduced and skin=='eclipse':
                assert page.locator('.eclipse-umbra').count()==1
                assert page.locator('.eclipse-corona').count()==1
                assert page.locator('.eclipse-shell-sector').count()==(6 if compact else 10)
                assert page.evaluate('''() => {const ids=[...document.querySelectorAll('[id]')].map(n=>n.id);return new Set(ids).size===ids.length;}''')
                if width==1200:
                    page.wait_for_timeout(180)
                    page.screenshot(path=str(out/'eclipse-umbra-phase.png'),full_page=True)
                    page.wait_for_timeout(220)
                    page.screenshot(path=str(out/'eclipse-shell-release.png'),full_page=True)
            page.wait_for_function('!WakppuPumpkinSkinPreview.read().busy')
            assert page.locator('.pumpkin-skin-fx').count()==0
            assert page.evaluate('WakppuPumpkinSkinPreview.read().clicks')==0
        page.locator('#destroy').click()
        page.wait_for_timeout(150)
        page.locator('#reset').click()
        page.wait_for_timeout(2400)
        assert page.locator('.pumpkin-skin-fx').count()==0
        assert page.evaluate('WakppuPumpkinSkinPreview.read().clicks')==0
        page.locator('#ballSvg').focus()
        page.keyboard.press('Enter')
        assert page.evaluate('WakppuPumpkinSkinPreview.read().clicks')==10
        page.locator('#baseSkin').click()
        assert page.locator('#ballSvg [data-pumpkin-skin]').count()==0
        page.locator('.skin-choice[data-skin="ghost"]').click()
        page.locator('.preview-settings summary').click()
        page.locator('#muted').check()
        page.evaluate('window.__audioPlays=[]')
        page.locator('#hear').click()
        assert page.evaluate('window.__audioPlays.length')==0
        page.locator('#muted').uncheck()
        page.locator('#hear').click()
        page.wait_for_function('window.__audioPlays.some(a=>a.src.includes("/sounds/pumpkin-skins/ghost-early.wav")&&a.volume>0)')
        assert page.locator('#backgroundMusic').count()==0
        page.reload(wait_until='networkidle')
        assert page.evaluate('WakppuPumpkinSkinPreview.read().selected')=='ghost'
        state=page.evaluate('WakppuPumpkinSkinPreview.read()')
        assert state['baseReward']==1500000000 and state['required']==100
        assert not writes,writes
        assert not errors,errors
        results.append({'viewport':[width,height],'reduced':reduced,'errors':errors,'writes':len(writes),'passed':True})
        print(json.dumps(results[-1]),flush=True)
        context.close()
    browser.close()
print(json.dumps(results,ensure_ascii=False))
