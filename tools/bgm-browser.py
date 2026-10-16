"""Real MP3 playback after a gesture, continuous playback and loop on phone/desktop."""
import os,socket,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,os.environ.get('WAKPPU_TEST_PYTHON_PATH',str(ROOT/'tools/.test-deps')))
from playwright.sync_api import sync_playwright
with socket.socket() as sock:
    sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
server=subprocess.Popen(['node',str(ROOT/'tools/local-server.mjs')],cwd=ROOT,env=dict(os.environ,WAKPPU_LOCAL_PORT=str(port)),stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,encoding='utf-8')
try:
    assert server.stdout.readline().startswith('Local preview:')
    base=f'http://127.0.0.1:{port}'
    with sync_playwright() as p:
        browser=p.chromium.launch(channel='msedge',headless=True,args=['--autoplay-policy=user-gesture-required'])
        for width in [390,1200]:
            context=browser.new_context(viewport={'width':width,'height':900},is_mobile=width<500,has_touch=True)
            context.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base) else r.fulfill(status=200,body=''))
            # The local preview streams without Content-Length; serve the same MP3
            # with byte ranges like production Pages so seeking/looping is testable.
            def music(route):
                data=(ROOT/'wakppuball/sounds/halloween-waltz.mp3').read_bytes()
                requested=route.request.headers.get('range','')
                headers={'Accept-Ranges':'bytes'}
                if requested.startswith('bytes='):
                    start,end=requested[6:].split('-');start=int(start or 0);end=min(int(end) if end else len(data)-1,len(data)-1)
                    headers['Content-Range']=f'bytes {start}-{end}/{len(data)}'
                    route.fulfill(status=206,content_type='audio/mpeg',headers=headers,body=data[start:end+1])
                else:route.fulfill(status=200,content_type='audio/mpeg',headers=headers,body=data)
            context.route('**/sounds/halloween-waltz.mp3',music)
            page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
            page.goto(base+'/?preview=items')
            try:page.wait_for_load_state('networkidle',timeout=2000)
            except Exception:pass
            page.wait_for_function('WakppuItems.data!==null')
            page.add_style_tag(content='.local-items-preview{display:none}')
            assert page.locator('#backgroundMusic').count()==0
            page.evaluate('WakppuAuth.local=false')
            page.locator('#settingsBtn').click()
            assert page.locator('#backgroundMusic').count()==0
            page.locator('#settingsMusic').check()
            try:
                page.wait_for_function("(()=>{const a=document.querySelector('#backgroundMusic');return a&&!a.paused&&a.currentTime>0&&Number.isFinite(a.duration);})()",timeout=10000)
            except Exception:
                print(page.evaluate("(()=>{const a=document.querySelector('#backgroundMusic');return a?{src:a.currentSrc,paused:a.paused,ready:a.readyState,network:a.networkState,error:a.error?.message,time:a.currentTime,duration:a.duration}:null})()"),flush=True)
                raise
            page.evaluate("document.querySelector('#backgroundMusic').currentTime=5")
            page.locator('#settingsClose').click();page.locator('#shopBtn').click()
            page.locator('#shopDrawTab').click()
            assert page.evaluate("document.querySelector('#backgroundMusic').currentTime>=5")
            assert page.locator('#backgroundMusic').count()==1
            page.evaluate("(()=>{const a=document.querySelector('#backgroundMusic');a.currentTime=a.duration-.3})()")
            page.wait_for_function("(()=>{const a=document.querySelector('#backgroundMusic');return a.currentTime<2&&!a.paused&&a.loop})()",timeout=10000)
            page.locator('[data-close="shop"]').click()
            page.locator('#ballSvg').click(position={'x':150,'y':150})
            assert page.evaluate("!document.querySelector('#backgroundMusic').paused")
            assert not errors,errors
            context.close();print(f'PASS {width}px: no autoplay before gesture, real MP3 playback, no restart, loop, effects coexist',flush=True)
        browser.close()
finally:
    server.terminate();server.wait(timeout=10)
