"""Local preview only: separate collection, purchase, themed break and retained ownership."""
import os,socket,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,os.environ.get('WAKPPU_TEST_PYTHON_PATH',str(ROOT/'tools/.test-deps')))
from playwright.sync_api import sync_playwright,expect
with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
server=subprocess.Popen(['node',str(ROOT/'tools/local-server.mjs')],cwd=ROOT,env=dict(os.environ,WAKPPU_LOCAL_PORT=str(port)),stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,encoding='utf-8')
try:
    assert server.stdout.readline().startswith('Local preview:');server.stdout.readline();server.stdout.readline()
    base=f'http://127.0.0.1:{port}'
    with sync_playwright() as p:
        browser=p.chromium.launch(channel='msedge',headless=True)
        for mobile,reduced in [(False,False),(True,False),(True,True)]:
            ctx=browser.new_context(viewport={'width':390 if mobile else 1100,'height':844},is_mobile=mobile,has_touch=mobile,reduced_motion='reduce' if reduced else 'no-preference')
            ctx.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base) else r.fulfill(status=200,body=''))
            page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
            page.goto(base+'/?preview=halloween');page.wait_for_load_state('domcontentloaded')
            page.wait_for_function('WakppuLimited.data?.tokens===100&&WakppuItemGame.read().ready')
            page.locator('#collectionBtn').click();expect(page.locator('#normalCollectionTab')).to_have_attribute('aria-selected','true')
            assert page.locator('#collectionGrid [data-detail]').count()==9
            page.locator('#limitedCollectionTab').click();expect(page.locator('#limitedCollection')).to_be_visible();expect(page.locator('#collectionGrid')).to_be_hidden()
            expect(page.locator('#limitedBalance')).to_contain_text('100개');expect(page.locator('#limitedBalance')).to_contain_text('10%')
            page.locator('[data-limited-detail]').click();expect(page.locator('[data-limited-buy]')).to_be_enabled()
            page.locator('[data-limited-buy]').click();page.wait_for_function('!WakppuLimited.busy')
            assert page.evaluate('WakppuLimited.data.tokens')==0
            assert page.evaluate('WakppuLimited.data.owned[WakppuLimitedData.ball.id].reward')=='1500000000'
            expect(page.locator('[data-limited-select]')).to_be_enabled();page.locator('[data-limited-select]').click()
            expect(page.locator('#collection')).to_be_hidden();expect(page.locator('#ballName')).to_have_text('할로윈 호박 왁뿌볼')
            expect(page.locator('#ballSvg .pumpkin-flame')).to_have_count(1)
            gold=int(page.evaluate('WakppuItemGame.read().gold'))
            page.locator('#ballSvg').click(position={'x':150,'y':150})
            expect(page.locator('#ballWrap')).to_have_attribute('data-halloween-phase','shatter')
            page.wait_for_function('(gold)=>BigInt(WakppuItemGame.read().gold)===BigInt(gold)+1500000000n',arg=str(gold))
            page.wait_for_timeout(1500)
            assert int(page.evaluate('WakppuItemGame.read().gold'))==gold+1500000000
            expect(page.locator('#ballName')).to_have_text('할로윈 호박 왁뿌볼')
            page.reload();page.wait_for_function('WakppuLimited.data?.selected===WakppuLimitedData.ball.id')
            expect(page.locator('#ballName')).to_have_text('할로윈 호박 왁뿌볼')
            page.locator('[data-demo="ended"]').click();page.wait_for_function('WakppuLimited.data?.season.active===false')
            page.locator('#collectionBtn').click();expect(page.locator('#limitedCollection')).to_be_visible();page.locator('[data-limited-detail]').click()
            expect(page.locator('#limitedPeriod')).to_contain_text('기간 종료');expect(page.locator('.limited-detail')).to_contain_text('보유 중' if not page.evaluate('WakppuLimited.data.selected') else '사용 중')
            page.locator('#normalCollectionTab').click();page.locator('[data-detail="0"]').click();page.locator('[data-action="select"]').click()
            expect(page.locator('#ballName')).to_have_text('노란색 왁뿌볼')
            page.locator('#collectionBtn').click();page.locator('#limitedCollectionTab').click();page.locator('[data-limited-detail]').click();page.locator('[data-limited-select]').click()
            expect(page.locator('#ballName')).to_have_text('할로윈 호박 왁뿌볼')
            page.locator('#rebirthBtn').click();page.locator('#rebirthConfirm').click();page.wait_for_timeout(1000);page.evaluate('WakppuLimited.refresh()')
            assert page.evaluate('!!WakppuLimited.data.owned[WakppuLimitedData.ball.id]')
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
            out=ROOT/'tools/test-results';out.mkdir(exist_ok=True)
            page.locator('#collectionBtn').click();page.locator('#limitedCollectionTab').click()
            page.screenshot(path=str(out/('halloween-mobile.png' if mobile else 'halloween-desktop.png')))
            assert not errors,errors;ctx.close()
        browser.close();print('PASS desktop/mobile/reduced motion: collection tabs, purchase, exact reward once, custom effects, reload, event end, normal switching and rebirth ownership')
finally:
    server.terminate();server.wait(timeout=10)
