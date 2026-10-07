"""Local-only PC/mobile scheduling, timezone, reconnect and automatic phases."""
import argparse,sys
from pathlib import Path
from datetime import datetime,timedelta,timezone
ROOT=Path(__file__).resolve().parent.parent
for deps in (ROOT/'tools/.test-deps',ROOT.parent.parent/'.test-deps'):
    if deps.exists():sys.path.insert(0,str(deps));break
from playwright.sync_api import sync_playwright,expect
parser=argparse.ArgumentParser();parser.add_argument('--url',default='http://127.0.0.1:4190');parser.add_argument('--password',required=True)
args=parser.parse_args();OUT=ROOT/'tools/test-results';OUT.mkdir(exist_ok=True)
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe')
    for width in (1280,390):
        context=browser.new_context(viewport={'width':width,'height':900},timezone_id='America/Los_Angeles')
        page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('dialog',lambda d:d.accept())
        page.goto(args.url);page.wait_for_load_state('networkidle')
        page.evaluate('async password=>{const r=await WakppuAuth.signIn("dodoonglee@gmail.com",password);if(r.error)throw r.error;await WakppuGameTest.restoreAccount();}',args.password)
        page.locator('#adminBtn').click()
        now=datetime.now(timezone.utc);start=now+timedelta(seconds=9)
        korea=(start+timedelta(hours=9)).strftime('%Y-%m-%dT%H:%M:%S')
        page.locator('#scheduleAt').fill(korea)
        page.locator('#scheduleMinutes').fill('0.05');page.locator('#scheduleMultiplier').fill('7')
        page.locator('#scheduleCreate').click()
        expect(page.locator('#scheduleStatus')).to_contain_text('예약 완료')
        expect(page.locator('#scheduleList')).to_contain_text('한국 시간')
        remote=page.evaluate('async()=> (await WakppuAuth.invoke("status")).gold_event')
        assert remote['starts_at']==start.replace(microsecond=0).isoformat(timespec='milliseconds').replace('+00:00','Z')
        assert remote['multiplier']==7
        page.reload();page.wait_for_load_state('networkidle')
        page.locator('#adminBtn').click();expect(page.locator('#scheduleList')).to_contain_text('예약')
        page.wait_for_function('WakppuGoldEvent.current().phase==="active"',timeout=15000)
        assert page.evaluate('WakppuGoldEvent.multiplier()')==7
        page.wait_for_function('WakppuGoldEvent.current().phase==="idle"',timeout=10000)
        assert page.evaluate('WakppuGoldEvent.multiplier()')==1
        # A week-ahead ball event is persisted and can be cancelled through UI.
        page.locator('#scheduleType').select_option('ball')
        future=datetime.now(timezone.utc)+timedelta(days=7)
        page.locator('#scheduleAt').fill((future+timedelta(hours=9)).strftime('%Y-%m-%dT%H:%M:%S'))
        page.locator('#scheduleMinutes').fill('10');page.locator('#scheduleCreate').click()
        expect(page.locator('#scheduleStatus')).to_contain_text('예약 완료')
        expect(page.locator('#scheduleList')).to_contain_text('관리자 왁뿌볼')
        page.locator('#scheduleList').get_by_role('button',name='예약 취소',exact=True).click()
        expect(page.locator('#scheduleStatus')).to_contain_text('예약 취소/종료 완료')
        assert page.evaluate('async()=> (await WakppuAuth.invoke("status")).admin_ball_event') is None
        page.locator('#scheduleAt').fill('2020-01-01T00:00');page.locator('#scheduleCreate').click()
        expect(page.locator('#scheduleStatus')).to_contain_text('365일 이내')
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        assert page.locator('#adminEventSchedule').evaluate('(e)=>e.scrollWidth<=e.clientWidth')
        page.locator('#adminEventSchedule').scroll_into_view_if_needed()
        page.screenshot(path=str(OUT/f'schedule-panel-{width}.png'))
        assert not errors,errors
        print(width,'PASS: KST in Pacific timezone; reload; scheduled→active×7→idle×1; week-ahead ball cancel; past time rejected',flush=True)
        context.close()
    browser.close()
