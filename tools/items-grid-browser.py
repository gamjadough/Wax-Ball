"""Local integration: paged 3x3 inventory, rarity order, detail use and keyboard focus."""
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
    print('Local sample server ready',flush=True)
    base=f'http://127.0.0.1:{port}'
    with sync_playwright() as p:
        browser=p.chromium.launch(channel='msedge',headless=True)
        for width,height in [(320,740),(390,844),(1200,900)]:
            print(f'Testing {width}px',flush=True)
            context=browser.new_context(viewport={'width':width,'height':height},is_mobile=width<500,has_touch=True)
            context.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base) else r.fulfill(status=200,body=''))
            page=context.new_page();errors=[]
            page.on('pageerror',lambda e:errors.append(str(e)))
            page.goto(base+'/?preview=items');page.wait_for_load_state('domcontentloaded')
            try:page.wait_for_load_state('networkidle',timeout=2000)
            except Exception:pass # Status polling prevents an idle network; wait for game readiness below.
            page.wait_for_function('WakppuItemGame.read().ready&&WakppuItems.data?.pity===98')
            page.locator('#inventoryBtn').click()
            expect(page.locator('#inventoryPageInfo')).to_have_text('1 / 4 페이지 · 30종')
            expect(page.locator('#inventoryPrevious')).to_be_disabled()
            expect(page.locator('.item-card')).to_have_count(9)
            boxes=page.locator('.item-card').evaluate_all('(nodes)=>nodes.map(n=>n.getBoundingClientRect().toJSON())')
            assert len({round(b['x']) for b in boxes})==3,boxes
            assert len({round(b['y']) for b in boxes})==3,boxes
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
            assert page.locator('#inventoryList').evaluate('(n)=>n.scrollWidth<=n.clientWidth')
            # All 30 kinds occur exactly once over four pages, in stable rarity order.
            definitions=page.evaluate('WakppuItemData.list')
            expected=[d['id'] for d in definitions]
            def all_pages():
                found=[]
                while True:
                    found+=page.locator('.item-card').evaluate_all('(nodes)=>nodes.map(n=>n.dataset.item)')
                    if page.locator('#inventoryNext').is_disabled():break
                    page.locator('#inventoryNext').click()
                return found
            assert all_pages()==expected
            expect(page.locator('.item-card')).to_have_count(3)
            expect(page.locator('.item-empty-slot')).to_have_count(6)
            expect(page.locator('#inventoryPageInfo')).to_have_text('4 / 4 페이지 · 30종')
            page.locator('#inventoryOrder').select_option('desc')
            expect(page.locator('#inventoryPageInfo')).to_have_text('1 / 4 페이지 · 30종')
            expect(page.locator('.item-card').first).to_have_attribute('data-rank','transcendent')
            grades=['common','rare','hero','legendary','transcendent']
            descending=sorted(definitions,key=lambda d:-grades.index(d['rank']))
            assert all_pages()==[d['id'] for d in descending]
            page.locator('[data-filter="common"]').click()
            expect(page.locator('#inventoryPageInfo')).to_have_text('1 / 2 페이지 · 10종')
            expect(page.locator('[data-filter="common"]')).to_have_attribute('aria-pressed','true')
            page.locator('#inventoryNext').click()
            expect(page.locator('.item-card')).to_have_count(1)
            expect(page.locator('.item-empty-slot')).to_have_count(8)
            page.locator('[data-filter="transcendent"]').click()
            expect(page.locator('#inventoryPageInfo')).to_have_text('1 / 1 페이지 · 1종')
            expect(page.locator('#inventoryNext')).to_be_disabled()
            # Compact card has no effect prose; detail contains the actual use action.
            page.locator('[data-item="transcendent_wax_heart"]').click()
            expect(page.locator('#inventoryBrowse')).to_be_hidden()
            expect(page.locator('#inventoryDetail')).to_contain_text('30분')
            expect(page.locator('#inventoryDetail')).to_contain_text('보유 수량: 3개')
            page.locator('[data-use="transcendent_wax_heart"]').click()
            page.wait_for_function('!WakppuItems.busy')
            expect(page.locator('#inventoryDetail')).to_contain_text('보유 수량: 2개')
            assert page.evaluate('!!WakppuItems.data.effects.transcendent_wax_heart')
            page.keyboard.press('Escape')
            expect(page.locator('#itemsModal')).to_be_visible()
            expect(page.locator('[data-item="transcendent_wax_heart"]')).to_be_focused()
            page.locator('[data-item="transcendent_wax_heart"]').click()
            for _ in range(2):
                page.locator('[data-use="transcendent_wax_heart"]').click()
                page.wait_for_function('!WakppuItems.busy')
            assert page.evaluate('WakppuItems.data.inventory.transcendent_wax_heart')==0
            assert page.evaluate('!!WakppuItems.data.effects.transcendent_wax_heart')
            expect(page.locator('#inventoryDetail')).to_be_hidden()
            expect(page.locator('#inventoryList')).to_contain_text('이 등급에 보유한 아이템이 없습니다.')
            # Detail on the final page returns to the same card and page.
            page.locator('[data-filter="common"]').click();page.locator('#inventoryNext').click()
            last=page.locator('.item-card').get_attribute('data-item')
            page.locator('.item-card').click();page.locator('#inventoryBack').click()
            expect(page.locator('#inventoryPageInfo')).to_have_text('2 / 2 페이지 · 10종')
            expect(page.locator('[data-item="'+last+'"]').first).to_be_focused()
            # Inventory shrink clamps the old second page to page one.
            page.evaluate('(id)=>WakppuItems.accept({...WakppuItems.data,inventory:{[id]:1}})',last)
            expect(page.locator('#inventoryPageInfo')).to_have_text('1 / 1 페이지 · 1종')
            page.locator('#itemsClose').click()
            expect(page.locator('#inventoryBtn')).to_be_focused()
            # Empty filtered state and the last-page deletion are deterministic snapshots.
            page.locator('#inventoryBtn').click()
            page.wait_for_function('WakppuItems.data.inventory.common_wax_coin>1')
            page.evaluate('WakppuItems.accept({...WakppuItems.data,inventory:{transcendent_wax_heart:1}})')
            expect(page.locator('#inventoryList')).to_contain_text('이 등급에 보유한 아이템이 없습니다.')
            page.locator('[data-filter="all"]').click();page.locator('.item-card').click()
            page.evaluate('WakppuItems.accept({...WakppuItems.data,inventory:{transcendent_wax_heart:0}})')
            expect(page.locator('#inventoryDetail')).to_be_hidden()
            expect(page.locator('#inventoryList')).to_contain_text('보유한 아이템이 없습니다.')
            expect(page.locator('#inventoryPrevious')).to_be_disabled();expect(page.locator('#inventoryNext')).to_be_disabled()
            # Restore actual sample inventory for visual QA and keyboard navigation.
            page.locator('#itemsClose').click();page.locator('.local-items-preview button').first.click()
            page.wait_for_function('Object.keys(WakppuItems.data.inventory).length===30')
            page.locator('#inventoryBtn').click();page.locator('#inventoryOrder').select_option('asc')
            page.locator('#inventoryOrder').focus();page.keyboard.press('Tab')
            expect(page.locator('.item-card').first).to_be_focused()
            page.locator('#itemsClose').focus();page.keyboard.press('Shift+Tab')
            expect(page.locator('#inventoryNext')).to_be_focused()
            page.keyboard.press('Tab');expect(page.locator('#itemsClose')).to_be_focused()
            out=ROOT/'tools/test-results';out.mkdir(exist_ok=True)
            page.locator('#inventoryPanel').scroll_into_view_if_needed()
            page.screenshot(path=str(out/f'items-grid-{width}.png'))
            page.locator('.item-card').first.click()
            page.screenshot(path=str(out/f'items-detail-{width}.png'))
            assert not errors,errors
            print(f'PASS {width}px: 3x3, 30 kinds/4 pages, both orders, filters, blank slots, detail/use, empty state, keyboard focus',flush=True)
            context.close()
        browser.close()
finally:
    server.terminate();server.wait(timeout=10)
