"""Local sample accounts: automatic balls and administrator consumables on desktop/mobile."""
import os,socket,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,os.environ.get('WAKPPU_TEST_PYTHON_PATH',str(ROOT/'tools/.test-deps')))
from playwright.sync_api import sync_playwright,expect
with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
server=subprocess.Popen(['node',str(ROOT/'tools/local-server.mjs')],cwd=ROOT,env=dict(os.environ,WAKPPU_LOCAL_PORT=str(port),WAKPPU_LOCAL_SLEEP_TIME='2026-10-16T03:00:00Z'),stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,encoding='utf-8')
try:
    assert server.stdout.readline().startswith('Local preview:');server.stdout.readline();password=server.stdout.readline().strip().split(': ',1)[1]
    base=f'http://127.0.0.1:{port}'
    with sync_playwright() as p:
        browser=p.chromium.launch(channel='msedge',headless=True)
        for mobile in [False,True]:
            ctx=browser.new_context(viewport={'width':390 if mobile else 1100,'height':844},is_mobile=mobile,has_touch=mobile)
            ctx.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base) else r.fulfill(status=200,body=''))
            page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
            page.goto(base+'/');page.wait_for_function('!!window.WakppuAuth')
            assert page.evaluate('(password)=>WakppuAuth.signIn("dodoonglee@gmail.com",password).then(r=>!r.error)',password)
            page.reload();page.wait_for_function('WakppuItems.data?.admin_content_access&&WakppuItemGame.read().ready')
            assert page.evaluate('Object.keys(WakppuItems.data.inventory).length===WakppuItemData.list.length')
            page.locator('#inventoryBtn').click();expect(page.locator('#inventoryPageInfo')).to_contain_text('30종')
            expect(page.locator('.item-count').first).to_have_text('×∞')
            page.locator('[data-item]').first.click();expect(page.locator('#inventoryDetailContent')).to_contain_text('관리자 · 무제한')
            for _ in range(2):
                page.locator('[data-use]').click();page.wait_for_function('!WakppuItems.busy');expect(page.locator('[data-use]')).to_be_enabled()
            assert page.evaluate('WakppuItems.data.inventory[WakppuItemData.list[0].id]')>=1
            page.screenshot(path=str(ROOT/'tools/test-results'/('admin-content-mobile.png' if mobile else 'admin-content-desktop.png')))
            page.locator('#itemsClose').click();page.locator('#collectionBtn').click();page.locator('#normalCollectionTab').click()
            page.locator('#collectionNext').click();page.locator('#collectionNext').click();page.locator('[data-detail="23"]').click()
            expect(page.locator('[data-action="select"]')).to_be_enabled();page.locator('[data-action="select"]').click()
            expect(page.locator('#ballName')).to_have_text('영겁의 왁스볼')
            page.evaluate('WakppuAuth.invoke("admin_gold",{user_id:"local-admin",mode:"set",value:"1000000000000000000000000000000"})')
            page.reload();page.wait_for_function('WakppuItems.data?.admin_content_access&&WakppuItemGame.read().ready')
            page.locator('#rebirthBtn').click();page.locator('#rebirthConfirm').click()
            page.locator('#collectionBtn').click();page.locator('#normalCollectionTab').click();page.locator('#collectionNext').click();page.locator('#collectionNext').click();page.locator('[data-detail="23"]').click()
            expect(page.locator('[data-action="select"]')).to_be_enabled()
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
            assert not errors,errors;ctx.close()
        ctx=browser.new_context();ctx.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base) else r.fulfill(status=200,body=''))
        page=ctx.new_page();page.goto(base+'/');page.wait_for_function('!!window.WakppuAuth');page.evaluate('WakppuAuth.signIn("guest","")');page.reload();page.wait_for_function('WakppuItems.data&&WakppuItemGame.read().ready')
        assert not page.evaluate('WakppuItems.data.admin_content_access');page.locator('#inventoryBtn').click();expect(page.locator('#inventoryList')).to_contain_text('보유한 아이템이 없습니다.')
        browser.close();print('PASS desktop/mobile: all 30 admin items, repeated use, all normal balls, rebirth access, ordinary empty inventory, no errors or overflow')
finally:
    server.terminate();server.wait(timeout=10)
