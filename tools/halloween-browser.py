"""Local-only seasonal background, layout and click regression checks."""
import os,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,os.environ.get('WAKPPU_TEST_PYTHON_PATH',str(ROOT/'tools/.test-deps')))
from playwright.sync_api import sync_playwright,expect
base=sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:4197'
out=ROOT/'tools/test-results';out.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
    browser=p.chromium.launch(channel='msedge',headless=True)
    for width,label in [(1366,'desktop'),(390,'mobile')]:
        page=browser.new_page(viewport={'width':width,'height':844})
        page.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base) else r.fulfill(status=200,body=''))
        errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(base+'/?theme=halloween');page.wait_for_load_state('networkidle')
        expect(page.locator('body')).to_have_class('halloween-theme')
        assert page.locator('#halloweenScenery').get_attribute('aria-hidden')=='true'
        assert page.evaluate("getComputedStyle(document.querySelector('#halloweenScenery')).pointerEvents==='none'")
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        moving=['.halloween-bats','.halloween-moon','.halloween-fog','.halloween-face','.halloween-bats use']
        for selector in moving:
            assert page.locator(selector).first.evaluate("e=>e.getAnimations().some(a=>a.playState==='running')"),selector
        before=page.locator('.halloween-bats').evaluate('e=>getComputedStyle(e).transform')
        page.wait_for_timeout(1200)
        assert page.locator('.halloween-bats').evaluate('e=>getComputedStyle(e).transform')!=before
        page.screenshot(path=str(out/f'halloween-{label}.png'),full_page=True)
        page.locator('#ballSvg').click(position={'x':150,'y':150},click_count=5,delay=80)
        expect(page.locator('#goldValue')).to_have_text('1')
        page.locator('#shopBtn').click();expect(page.get_by_role('dialog',name='🛒 상점')).to_be_visible()
        page.emulate_media(reduced_motion='reduce')
        for selector in moving:
            assert page.locator(selector).first.evaluate("e=>getComputedStyle(e).animationName==='none'"),selector
        assert page.evaluate("getComputedStyle(document.querySelector('.halloween-fog'),'::after').animationName==='none'")
        # An ordinary local URL follows the same dates as production.
        clock_time=['2026-10-23T23:59:45+09:00']
        def clock_status(route):
            if route.request.post_data_json.get('action')=='status':
                route.fulfill(json={'maintenance':False,'background_mode':'auto','server_time':clock_time[0],'role':'player','moderation':{'blocked':False}})
            else:route.continue_()
        page.route(base+'/local/api',clock_status)
        page.clock.install(time=__import__('datetime').datetime.fromisoformat('2026-10-23T23:59:45+09:00'))
        page.goto(base);page.wait_for_load_state('networkidle')
        assert not page.evaluate("document.body.classList.contains('halloween-theme')")
        clock_time[0]='2026-10-24T00:00:15+09:00'
        page.clock.fast_forward(30000)
        assert page.evaluate("document.body.classList.contains('halloween-theme')")
        page.clock.set_system_time(__import__('datetime').datetime.fromisoformat('2026-11-14T23:59:45+09:00'))
        page.evaluate("WakppuHalloween.accept({background_mode:'auto',server_time:'2026-11-14T23:59:45+09:00'})")
        clock_time[0]='2026-11-15T00:00:15+09:00'
        page.clock.fast_forward(30000)
        assert not page.evaluate("document.body.classList.contains('halloween-theme')")
        expect(page.locator('#halloweenScenery')).to_be_hidden()
        assert not errors,errors
        page.close()
    browser.close()
    print('PASS desktop/mobile theme, ball reward, shop input, reduced motion and live seasonal start/end')
