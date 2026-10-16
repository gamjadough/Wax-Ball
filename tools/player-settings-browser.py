"""Local settings UI, real Web Audio output, persistence, effects and sleep integration."""
import os,socket,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,os.environ.get('WAKPPU_TEST_PYTHON_PATH',str(ROOT/'tools/.test-deps')))
from playwright.sync_api import sync_playwright,expect
KEY='wakppuball:player-settings:v1'
PROBE='''(() => {
 const Native=window.AudioContext||window.webkitAudioContext;
 if(!Native)return;
 window.__settingsContexts=[];
 window.AudioContext=class extends Native {
  constructor(...args){super(...args);this.testGains=[];this.analysers=[];window.__settingsContexts.push(this);}
  createGain(){const node=super.createGain();this.testGains.push(node);return node;}
 };
 window.__settingsPeak=(channel)=>{
  const ctx=window.__settingsContexts[0];if(!ctx||!ctx.testGains[channel])return 0;
  if(!ctx.analysers[channel]){const analyser=ctx.createAnalyser();analyser.fftSize=1024;ctx.testGains[channel].connect(analyser);ctx.analysers[channel]=analyser;}
  const values=new Float32Array(1024);ctx.analysers[channel].getFloatTimeDomainData(values);
  return Math.max(...values.map(Math.abs));
 };
})();'''
with socket.socket() as sock:
    sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
server=subprocess.Popen(['node',str(ROOT/'tools/local-server.mjs')],cwd=ROOT,env=dict(os.environ,WAKPPU_LOCAL_PORT=str(port),WAKPPU_LOCAL_SLEEP_TIME='2026-10-16T12:00:00+09:00'),stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,encoding='utf-8')
try:
    assert server.stdout.readline().startswith('Local preview:')
    server.stdout.readline();password=server.stdout.readline().split(': ',1)[1].strip()
    base=f'http://127.0.0.1:{port}'
    with sync_playwright() as p:
        browser=p.chromium.launch(channel='msedge',headless=True)
        def prepare(page):
            page.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base) else r.fulfill(status=200,body=''))
            page.goto(base);page.wait_for_load_state('domcontentloaded')
            try:page.wait_for_load_state('networkidle',timeout=1500)
            except Exception:pass
            page.wait_for_function('!!window.WakppuSettings&&!!window.WakppuItemGame')
        admin=browser.new_page();prepare(admin)
        admin.evaluate('(password)=>WakppuAuth.signIn("dodoonglee@gmail.com",password)',password)
        admin.evaluate('WakppuGameTest.restoreAccount()')
        def clock(time):
            assert admin.evaluate("async time=>{const s=JSON.parse(sessionStorage.getItem('wakppu-local-session'));return (await fetch('/local/sleep-clock',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+s.token},body:JSON.stringify({time})})).status;}",time)==200
        for width in [320,390,1200]:
            clock('2026-10-16T12:00:00+09:00')
            context=browser.new_context(viewport={'width':width,'height':900},is_mobile=width<500,has_touch=width<500)
            context.add_init_script(PROBE)
            page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
            prepare(page)
            page.evaluate('async()=>{await WakppuAuth.signInAnonymously();await WakppuGameTest.restoreAccount();}')
            page.wait_for_function('WakppuItemGame.read().ready')
            before=page.evaluate('WakppuItemGame.read().gold')
            boxes=page.locator('.account-tools button').evaluate_all('(nodes)=>nodes.map(n=>n.getBoundingClientRect().toJSON())')
            assert len(boxes)==2 and boxes[0]['y']==boxes[1]['y'] and boxes[0]['right']<boxes[1]['x']
            assert page.evaluate('__settingsContexts.length')==0
            page.locator('#settingsBtn').click();expect(page.locator('#playerSettings')).to_be_visible()
            expect(page.locator('#settingsClose')).to_be_focused()
            expect(page.locator('#settingsMusic')).not_to_be_checked()
            expect(page.locator('#settingsSfx')).to_be_checked()
            page.wait_for_function('__settingsContexts[0]?.state==="running"')
            def slider(id,value):
                page.locator(id).evaluate('(el,value)=>{el.value=value;el.dispatchEvent(new Event("input",{bubbles:true}));}',value)
            page.locator('#settingsSfxVolume').focus();page.keyboard.press('End')
            expect(page.locator('[data-setting-output="sfxVolume"]')).to_have_text('100%')
            slider('#settingsSfxVolume',35)
            page.locator('#settingsSoundPreview').click()
            page.wait_for_function('__settingsPeak(0)>.001')
            assert abs(page.evaluate('__settingsContexts[0].testGains[0].gain.value')-.35)<.00001
            page.locator('#settingsMusic').check()
            page.wait_for_function('__settingsPeak(1)>.0001')
            slider('#settingsMusicVolume',30)
            assert abs(page.evaluate('__settingsContexts[0].testGains[1].gain.value')-.3)<.00001
            page.locator('#settingsMuted').check()
            page.wait_for_function('__settingsPeak(1)<.000001')
            expect(page.locator('#settingsSoundPreview')).to_be_disabled()
            expect(page.locator('#settingsMusic')).to_be_checked()
            page.locator('#settingsMuted').uncheck();page.wait_for_function('__settingsPeak(1)>.0001')
            slider('#settingsMusicVolume',0);page.wait_for_function('__settingsPeak(1)<.000001')
            slider('#settingsMusicVolume',30);page.wait_for_function('__settingsPeak(1)>.0001')
            # Browser-local visibility simulation exercises the actual audio graph, no server state changes.
            page.evaluate("Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'))")
            page.wait_for_function('__settingsPeak(1)<.000001')
            page.evaluate("delete document.hidden;document.dispatchEvent(new Event('visibilitychange'))")
            page.wait_for_function('__settingsPeak(1)>.0001')
            page.locator('#settingsReduce').check();page.locator('#settingsFlashes').uncheck()
            assert page.evaluate('document.documentElement.classList.contains("reduced-effects")')
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
            page.locator('#settingsClose').focus();page.keyboard.press('Shift+Tab')
            expect(page.locator('#settingsReset')).to_be_focused()
            page.keyboard.press('Tab');expect(page.locator('#settingsClose')).to_be_focused()
            out=ROOT/'tools/test-results';out.mkdir(exist_ok=True)
            page.locator('.settings-sheet').evaluate('(n)=>n.scrollTop=0')
            page.screenshot(path=str(out/f'player-settings-{width}.png'))
            page.keyboard.press('Escape');expect(page.locator('#settingsBtn')).to_be_focused()
            # Reduced effects and no flash retain the game's reward/respawn path.
            page.evaluate("WakppuGameTest.run('last','yellow')");page.locator('#ballSvg').click()
            page.wait_for_selector('.shard',state='attached')
            assert page.locator('.shard').count()==9
            assert page.locator('#flash').evaluate('(n)=>n.getAnimations().length')==0
            page.wait_for_function('!WakppuItemGame.read().busy');page.evaluate('WakppuGameTest.end()')
            assert page.evaluate('WakppuItemGame.read().gold')==before
            if width==390:
                for ball in ['whitehole','starlight']:
                    page.evaluate('(id)=>WakppuGameTest.run("last",id)',ball)
                    if ball=='starlight':assert page.locator('.transcendent-idle').evaluate('(n)=>getComputedStyle(n).animationName')=='none'
                    page.locator('#ballSvg').click()
                    selector='.whitehole-particle' if ball=='whitehole' else '.transcendent-fx'
                    page.wait_for_selector(selector,state='attached')
                    assert page.locator(selector).first.evaluate('(n)=>getComputedStyle(n).display')=='none'
                    page.wait_for_function('!WakppuItemGame.read().busy');page.evaluate('WakppuGameTest.end()')
                    assert page.evaluate('WakppuItemGame.read().gold')==before
            page.reload();page.wait_for_function('!!window.WakppuSettings&&!!window.WakppuItemGame')
            assert page.evaluate('WakppuSettings.read().music') is True
            assert page.evaluate('WakppuSettings.read().sfxVolume')==35
            assert page.evaluate('__settingsContexts.length')==0 # Stored music never autoplays before a gesture.
            page.locator('#settingsBtn').click();page.wait_for_function('__settingsPeak(1)>.0001')
            expect(page.locator('#settingsReduce')).to_be_checked();expect(page.locator('#settingsFlashes')).not_to_be_checked()
            # Real storage event synchronizes settings between tabs.
            other=context.new_page();prepare(other)
            other.evaluate('WakppuSettings.set({muted:true})')
            expect(page.locator('#settingsMuted')).to_be_checked()
            page.wait_for_function('__settingsPeak(1)<.000001');other.close()
            page.locator('#settingsMuted').uncheck();page.wait_for_function('__settingsPeak(1)>.0001')
            # Real server sleep/maintenance signals must close settings and stop music.
            clock('2026-10-16T23:00:00+09:00')
            expect(page.locator('#maintenanceTitle')).to_have_text('수면 시간',timeout=7000)
            expect(page.locator('#playerSettings')).to_be_hidden()
            page.wait_for_function('__settingsPeak(1)<.000001')
            clock('2026-10-17T06:00:00+09:00')
            expect(page.locator('#game')).to_be_visible(timeout=7000)
            page.wait_for_function('__settingsPeak(1)>.0001')
            page.locator('#settingsBtn').click();page.locator('#settingsReset').click()
            expect(page.locator('#settingsMusic')).not_to_be_checked()
            expect(page.locator('#settingsSfxVolume')).to_have_value('70')
            page.wait_for_function('__settingsPeak(1)<.000001')
            assert not errors,errors
            print(f'PASS {width}px: adjacent controls, real SFX/BGM output and separate volume/mute, visibility/sleep pause, reload/tab sync, reduced shards/no flash, keyboard focus, reset',flush=True)
            context.close()
        # Corrupt/unwritable preferences fall back safely without breaking gameplay.
        context=browser.new_context()
        context.add_init_script('''localStorage.setItem('wakppuball:player-settings:v1','broken');
          const save=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='wakppuball:player-settings:v1')throw new DOMException('blocked','QuotaExceededError');return save.call(this,key,value);};''')
        page=context.new_page();failure_errors=[];page.on('pageerror',lambda e:failure_errors.append(str(e)));prepare(page)
        page.locator('#settingsBtn').click();expect(page.locator('#settingsSfxVolume')).to_have_value('70')
        page.locator('#settingsMuted').check();expect(page.locator('#settingsStorageStatus')).to_contain_text('이번 접속')
        assert page.evaluate('WakppuSettings.read().muted') is True
        assert not failure_errors,failure_errors
        context.close()
        context=browser.new_context()
        context.add_init_script('window.AudioContext=undefined;window.webkitAudioContext=undefined;')
        page=context.new_page();page.on('pageerror',lambda e:failure_errors.append(str(e)));prepare(page)
        page.locator('#settingsBtn').click();expect(page.locator('#settingsMusic')).to_be_enabled()
        page.locator('#settingsMusic').check()
        page.wait_for_function('document.querySelector("#backgroundMusic")?.paused===false')
        assert not failure_errors,failure_errors
        context.close();print('PASS corrupt/blocked storage and native music fallback without Web Audio',flush=True)
        browser.close()
finally:
    server.terminate();server.wait(timeout=10)
