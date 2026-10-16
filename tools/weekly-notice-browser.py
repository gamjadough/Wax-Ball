"""Local events only: weekly corner notices and manual banners never change server events."""
import os,socket,subprocess,sys,time
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,os.environ.get('WAKPPU_TEST_PYTHON_PATH',str(ROOT/'tools/.test-deps')))
from playwright.sync_api import sync_playwright,expect
with socket.socket() as s:s.bind(('127.0.0.1',0));port=s.getsockname()[1]
server=subprocess.Popen([sys.argv[1],str(ROOT/'tools/local-server.mjs')],cwd=ROOT,env=dict(os.environ,WAKPPU_LOCAL_PORT=str(port)),stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,encoding='utf8')
try:
    assert server.stdout.readline().startswith('Local preview:')
    base=f'http://127.0.0.1:{port}'
    with sync_playwright() as p:
        browser=p.chromium.launch(channel='msedge',headless=True)
        for width,height in [(1280,900),(390,844),(320,568),(844,390)]:
            page=browser.new_page(viewport={'width':width,'height':height})
            page.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base) else r.fulfill(status=200,body=''))
            # Keep synthetic browser-only events independent of local status polling.
            page.route('**/local/api',lambda r:r.fulfill(json={'role':'player','maintenance':False,'moderation':{'blocked':False}}) if r.request.post_data_json.get('action')=='status' else r.continue_())
            errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
            page.goto(base);page.wait_for_load_state('networkidle')
            def events(gold='weekly',ball='weekly',delay=0,ended=False):
                page.evaluate('''args=>{
                  const now=Date.now(),make=(source,kind)=>source?{id:'test-'+source+kind,source,multiplier:10,starts_at:new Date(now+args.delay*1000-1000).toISOString(),ends_at:new Date(now+(args.ended?-1000:args.delay*1000+600000)).toISOString()}:null;
                  const data={server_time:new Date(now).toISOString(),gold_event:make(args.gold,'gold'),admin_ball_event:make(args.ball,'ball')};
                  WakppuGoldEvent.update(data);WakppuAdminBallEvent.update(data);
                }''',dict(gold=gold,ball=ball,delay=delay,ended=ended))
            events(delay=604800)
            notice=page.locator('#weeklyEventNotice');expect(notice).to_be_visible();expect(notice).to_contain_text('시작')
            expect(page.locator('#goldEventBanner')).to_be_hidden();expect(page.locator('#adminBallEventBanner')).to_be_hidden()
            events();expect(notice).to_contain_text('Gold ×10');expect(notice).to_contain_text('관리자 볼');expect(notice).to_contain_text('남음')
            assert page.evaluate('WakppuGoldEvent.multiplier()')==10
            box=notice.bounding_box();namebox=page.locator('#ballName').bounding_box()
            assert box['x']>=0 and box['x']+box['width']<=width+1
            assert box['x']+box['width']<=namebox['x']+1,(width,height,box,namebox)
            assert box['y']<namebox['y']+namebox['height'] and box['y']+box['height']>namebox['y'],(width,height,box,namebox)
            for selector in ['#shopBtn','#collectionBtn','#rankingBtn']:
                rect=page.locator(selector).bounding_box()
                assert not (box['x']<rect['x']+rect['width'] and box['x']+box['width']>rect['x'] and box['y']<rect['y']+rect['height'] and box['y']+box['height']>rect['y']),(selector,width,height)
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
            out=ROOT/'tools/test-results';out.mkdir(parents=True,exist_ok=True)
            page.screenshot(path=str(out/f'weekly-corner-{width}.png'))
            for name in ['화이트홀','끝없는 유니버스 왁뿌볼']:
                page.locator('#ballName').evaluate('(e,name)=>e.textContent=name',name)
                namebox=page.locator('#ballName').bounding_box();box=notice.bounding_box()
                assert box['x']+box['width']<=namebox['x']+1
                assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
            events(ball='manual');expect(notice).to_contain_text('Gold ×10');assert '관리자 볼' not in notice.inner_text()
            expect(page.locator('#adminBallEventBanner')).to_be_visible();expect(page.locator('#adminBallEventBanner')).to_contain_text('관리자 특별 이벤트')
            events(gold='manual');expect(notice).to_contain_text('관리자 볼');assert 'Gold' not in notice.inner_text()
            expect(page.locator('#goldEventBanner')).to_be_visible();expect(page.locator('#goldEventBanner')).to_contain_text('관리자 특별 이벤트')
            events(gold='manual',ball='manual');expect(notice).to_be_hidden()
            events(ended=True);expect(notice).to_be_hidden();assert page.evaluate('WakppuGoldEvent.multiplier()')==1
            assert not errors,errors;page.close()
        browser.close();print('PASS desktop/mobile/short/landscape: compact weekly notices, no overlap, mixed/manual events, countdown, expiry and unchanged multipliers')
finally:server.terminate();server.wait(timeout=10)
