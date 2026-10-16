"""Local-only sound audition and actual eternity final-hit integration."""
import os,socket,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,os.environ.get('WAKPPU_TEST_PYTHON_PATH',str(ROOT/'tools/.test-deps')))
from playwright.sync_api import sync_playwright,expect
with socket.socket() as sock:
    sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
server=subprocess.Popen(['node',str(ROOT/'tools/local-server.mjs')],cwd=ROOT,env=dict(os.environ,WAKPPU_LOCAL_PORT=str(port)),stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,encoding='utf-8')
try:
    assert server.stdout.readline().startswith('Local preview:')
    base=f'http://127.0.0.1:{port}'
    with sync_playwright() as p:
        browser=p.chromium.launch(channel='msedge',headless=True)
        for width in [390,1200]:
            context=browser.new_context(viewport={'width':width,'height':1000},is_mobile=width<500,has_touch=True)
            context.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base) else r.fulfill(status=200,body=''))
            page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
            page.add_init_script("""window.playedClips=[];const play=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){const promise=play.call(this);promise?.then(()=>{if(this.src.includes('/eternity/'))window.playedClips.push(this.src.split('/').pop());}).catch(()=>{});return promise;}""")
            page.goto(base+'/?preview=skin-sounds')
            try:page.wait_for_load_state('networkidle',timeout=2000)
            except Exception:pass
            expect(page.locator('#skinSoundSelect')).to_be_visible()
            page.wait_for_function('WakppuItemGame.read().test')
            for rank in ['common','rare','hero','legendary','transcendent']:
                page.locator('#skinSoundSelect').select_option(rank)
                for stage in ['early','mid','late','final']:
                    page.locator(f'[data-skin-stage="{stage}"]').click()
                    page.wait_for_function('(file)=>playedClips.includes(file)',arg=f'{rank}-{stage}.mp3')
                page.locator('#skinSoundLast').click()
                before=page.evaluate('WakppuItemGame.read().gold')
                page.evaluate('window.playedClips=[]')
                page.locator('#ballSvg').click(position={'x':150,'y':150})
                page.wait_for_function('(file)=>playedClips.includes(file)',arg=f'{rank}-final.mp3')
                page.wait_for_function('!WakppuItemGame.read().busy',timeout=15000)
                assert page.evaluate('WakppuItemGame.read().gold')==before
                assert page.evaluate('WakppuItemGame.read().test')
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
            assert not errors,errors
            out=ROOT/'tools/test-results';out.mkdir(exist_ok=True)
            page.screenshot(path=str(out/f'skin-sounds-{width}.png'),full_page=True)
            # Plain local URL must not inject preview controls.
            page.goto(base+'/');expect(page.locator('#skinSoundPreview')).to_have_count(0)
            context.close();print(f'PASS {width}px: 20 real clips, 5 final hits, no reward/save, responsive, preview isolation',flush=True)
        browser.close()
finally:
    server.terminate();server.wait(timeout=10)
