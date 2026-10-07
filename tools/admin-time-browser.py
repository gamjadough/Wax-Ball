"""Verify event time units against the isolated local API on desktop and mobile."""
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
    server.stdout.readline();password=server.stdout.readline().split(': ',1)[1].strip()
    base=f'http://127.0.0.1:{port}'
    with sync_playwright() as p:
        browser=p.chromium.launch(channel='msedge',headless=True)
        for mobile in [False,True]:
            ctx=browser.new_context(viewport={'width':390 if mobile else 1100,'height':844},is_mobile=mobile,has_touch=mobile)
            ctx.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base) else r.fulfill(status=200,body=''))
            page=ctx.new_page();errors=[];requests=[]
            page.on('pageerror',lambda e:errors.append(str(e)))
            page.on('dialog',lambda d:d.accept())
            page.on('request',lambda r:requests.append(r.post_data_json) if r.url.endswith('/local/api') and r.post_data_json.get('action') in ['admin_gold_event','admin_ball_event'] else None)
            page.goto(base);page.wait_for_load_state('domcontentloaded')
            page.locator('#accountBtn').click();page.locator('#accountEmail').fill('dodoonglee@gmail.com');page.locator('#accountPassword').fill(password);page.locator('#signInBtn').click()
            expect(page.locator('#adminBtn')).to_be_visible();page.locator('#adminBtn').click()
            expect(page.locator('#admin')).to_be_visible()
            for id,value in [('adminBallEventDuration','5'),('adminEventDuration','1'),('adminEventDelay','0.5')]:
                expect(page.locator('#'+id)).to_have_value(value)
                expect(page.locator('#'+id+'Unit')).to_have_value('minutes')
            expect(page.locator('#adminEventDurationPreview')).to_contain_text('예상 종료')
            for duration,delay,start,stop,action in [('adminEventDuration','adminEventDelay','adminGoldEventStart','adminGoldEventStop','admin_gold_event'),('adminBallEventDuration','adminBallEventDelay','adminBallEventStart','adminBallEventStop','admin_ball_event')]:
                page.locator('#'+duration).fill('30');page.locator('#'+delay).fill('0.5')
                expect(page.locator('#'+duration+'Preview')).to_contain_text('30분 = 1,800초')
                for _ in range(3):
                    page.locator('#'+delay+'Unit').select_option('seconds');expect(page.locator('#'+delay)).to_have_value('30')
                    page.locator('#'+delay+'Unit').select_option('minutes');expect(page.locator('#'+delay)).to_have_value('0.5')
                with page.expect_response(lambda r:r.url.endswith('/local/api') and r.request.post_data_json.get('action')==action) as response:
                    page.locator('#'+start).click()
                assert response.value.ok,response.value.text()
                assert requests[-1]['duration_seconds']==1800 and requests[-1]['delay_seconds']==30,requests[-1]
                expect(page.locator('#adminStatus')).to_contain_text('설정했습니다')
                page.locator('#'+stop).click();expect(page.locator('#adminStatus')).to_contain_text('종료했습니다')
                # Invalid/blank/out-of-range/sub-second inputs never reach the API.
                for id,value in [(duration,''),(duration,'0'),(duration,'1441'),(delay,'-1'),(duration,'0.001')]:
                    page.locator('#'+duration).fill('30');page.locator('#'+delay).fill('0');page.locator('#'+id).fill(value)
                    before=len(requests);page.locator('#'+start).click()
                    expect(page.locator('#adminStatus')).to_contain_text('1초~24시간')
                    assert len(requests)==before
                page.locator('#'+duration+'Unit').select_option('seconds');page.locator('#'+delay+'Unit').select_option('seconds')
                page.locator('#'+duration).fill('1.5');before=len(requests);page.locator('#'+start).click();assert len(requests)==before
                page.locator('#'+duration).fill('86400');page.locator('#'+delay).fill('0')
                with page.expect_response(lambda r:r.url.endswith('/local/api') and r.request.post_data_json.get('action')==action) as response:
                    page.locator('#'+start).click()
                assert response.value.ok
                assert requests[-1]['duration_seconds']==86400 and requests[-1]['delay_seconds']==0
                expect(page.locator('#adminStatus')).to_contain_text('설정했습니다')
                page.locator('#'+stop).click();expect(page.locator('#adminStatus')).to_contain_text('종료했습니다')
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
            assert not errors,errors
            out=ROOT/'tools/test-results';out.mkdir(exist_ok=True)
            page.screenshot(path=str(out/('admin-time-mobile.png' if mobile else 'admin-time-desktop.png')))
            ctx.close()
        browser.close();print('PASS desktop/mobile: minute defaults, conversion, unit switching, exact API seconds, invalid inputs, 24h limit, zero delay and layout')
finally:
    server.terminate();server.wait(timeout=10)
