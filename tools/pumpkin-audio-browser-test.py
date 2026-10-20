"""Focused real-media checks for the local-only pumpkin audio revision."""
import hashlib, json, os, sys
from pathlib import Path
sys.path.insert(0, os.environ.get('WAKPPU_TEST_PYTHON_PATH', str(Path(__file__).parent / '.test-deps')))
from playwright.sync_api import sync_playwright
BASE=os.environ.get('WAKPPU_PREVIEW_URL','http://127.0.0.1:4182')
ROOT=Path(__file__).resolve().parent.parent
with sync_playwright() as p:
    browser=p.chromium.launch(channel='msedge',headless=True)
    for width,height in [(1200,900),(390,844),(844,390)]:
        c=browser.new_context(viewport={'width':width,'height':height},has_touch=width<1000)
        c.route('**/*',lambda r:r.continue_() if r.request.url.startswith(BASE) else r.fulfill(status=200,body=''))
        page=c.new_page();errors=[];writes=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.on('request',lambda r:writes.append(r.url) if r.method!='GET' else None)
        page.add_init_script('''window.audioPlays=[];window.audioRefs=new Set();const realPlay=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){audioRefs.add(this);audioPlays.push({src:this.src,volume:this.volume});return realPlay.call(this);};''')
        page.goto(BASE+'/local-pumpkin-skins/?v=audio-character5',wait_until='networkidle')
        for skin in ['wisp','ghost','eclipse']:
            page.locator('.skin-choice[data-skin="'+skin+'"]').click()
            page.wait_for_load_state('networkidle')
            for stage in ['early','mid','late','final']:
                name=f'{skin}-{stage}.wav'
                # The browser really decodes each newly served asset; compare bytes to disk too.
                digest=page.evaluate('''async name=>{const b=await (await fetch('/sounds/pumpkin-skins/'+name)).arrayBuffer();const ac=new AudioContext();const decoded=await ac.decodeAudioData(b.slice(0));if(!decoded.length)throw Error('empty audio');await ac.close();return [...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(x=>x.toString(16).padStart(2,'0')).join('');}''',name)
                assert digest==hashlib.sha256((ROOT/'wakppuball/sounds/pumpkin-skins'/name).read_bytes()).hexdigest()
                if stage=='mid':page.locator('[data-progress=".5"]').click()
                if stage=='late':page.locator('[data-progress=".9"]').click()
                page.evaluate('window.audioPlays=[]')
                page.locator('#destroy' if stage=='final' else '#hear').click()
                page.wait_for_function('name=>audioPlays.some(x=>x.src.endsWith(name)&&x.volume>0)',arg=name)
                if stage=='final':
                    page.locator('#reset').click()
                    page.wait_for_timeout(100)
                    assert page.evaluate('''() => [...audioRefs].every(a=>a.paused)''')
        page.locator('.preview-settings summary').click();page.locator('#muted').check()
        page.evaluate('window.audioPlays=[]');page.locator('#hear').click()
        assert page.evaluate('audioPlays.length')==0
        assert page.locator('#backgroundMusic').count()==0
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        assert not errors,errors
        assert not writes,writes
        print(json.dumps({'viewport':[width,height],'decoded':12,'staged_playback':12,'mute':True,'errors':errors}),flush=True)
        c.close()
    browser.close()
