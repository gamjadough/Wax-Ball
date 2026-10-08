"""Local mocked events only: never starts or edits a production event."""
import sys
from pathlib import Path
sys.path.insert(0, sys.argv[1] if len(sys.argv)>1 else str(Path(__file__).resolve().parent / '.test-deps'))
from playwright.sync_api import sync_playwright, expect

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe')
    for width,height in [(1280,900),(390,844)]:
        page=browser.new_page(viewport={'width':width,'height':height})
        errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto('http://127.0.0.1:4191/')
        page.wait_for_load_state('networkidle')
        # This local-only diagnostic footer overlaps the real bottom event banner.
        page.evaluate("document.querySelector('.local-banner')?.remove()")
        page.evaluate("""async()=>{
          await WakppuAuth.signIn('guest','');
          await WakppuGameTest.restoreAccount();
        }""")
        # Prevent ordinary local status polling from clearing synthetic test events.
        page.route('**/local/api',lambda route: route.fulfill(json={'role':'player','maintenance':False,'moderation':{'blocked':False},'server_time':'2026-10-08T00:00:00Z'}) if '"action":"status"' in (route.request.post_data or '') else route.continue_())
        for seconds,text in [(45,'45초'),(125,'2분 5초'),(7230,'2시간 30초'),(183845,'2일 3시간 4분 5초')]:
            page.evaluate("""seconds=>{
              const now=Date.now(),start=now+seconds*1000;
              const event={id:'synthetic-test',multiplier:10,starts_at:new Date(start).toISOString(),ends_at:new Date(start+125000).toISOString()};
              const data={gold_event:event,admin_ball_event:event,server_time:new Date(now).toISOString()};
              WakppuGoldEvent.update(data);WakppuAdminBallEvent.update(data);
            }""",seconds)
            for selector in ['#goldEventBanner','#adminBallEventBanner']:
                expect(page.locator(selector)).to_be_visible()
                expect(page.locator(selector)).to_contain_text(text+' 후 시작')
            assert not page.evaluate('document.documentElement.scrollWidth>innerWidth')
        page.screenshot(path=f'tools/test-results/event-time-{width}.png',full_page=True)
        page.evaluate("""()=>{
          const now=Date.now()+1000,event={id:'synthetic-active',multiplier:10,starts_at:new Date(now-1000).toISOString(),ends_at:new Date(now+125000).toISOString()};
          const data={gold_event:event,admin_ball_event:event,server_time:new Date(now).toISOString()};
          WakppuGoldEvent.update(data);WakppuAdminBallEvent.update(data);
        }""")
        for selector in ['#goldEventBanner','#adminBallEventBanner']:
            expect(page.locator(selector)).to_contain_text('남은 시간 2분 5초')
        assert not errors,errors
        print(width,'PASS: seconds/minutes/hours/days, both scheduled and active banners, no overflow or JS errors')
        page.close()
    browser.close()
