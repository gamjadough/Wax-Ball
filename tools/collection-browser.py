"""Local-only pagination, compact layout, detail actions and save checks."""
import json, os, socket, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'tools/.test-deps'))
from playwright.sync_api import sync_playwright, expect

KEY = 'wax-ball:wakppuball:local-test-save'
OUT = ROOT / 'tools/test-results'
OUT.mkdir(exist_ok=True)
with socket.socket() as sock:
    sock.bind(('127.0.0.1', 0))
    port = sock.getsockname()[1]
server = subprocess.Popen(['node', str(ROOT / 'tools/local-server.mjs')], cwd=ROOT,
    env=dict(os.environ, WAKPPU_LOCAL_PORT=str(port)), stdout=subprocess.PIPE,
    stderr=subprocess.STDOUT, text=True, encoding='utf-8')
try:
    assert server.stdout.readline().startswith('Local preview:')
    server.stdout.readline()
    password = server.stdout.readline().split(': ', 1)[1].strip()
    base = f'http://127.0.0.1:{port}'
    with sync_playwright() as p:
        browser = p.chromium.launch(channel='msedge', headless=True)
        for width, height in [(320, 640), (390, 844), (1100, 820), (844, 390)]:
            context = browser.new_context(viewport={'width': width, 'height': height})
            context.route('**/*', lambda r: r.continue_() if r.request.url.startswith(base)
                          else r.fulfill(status=200, body=''))
            # Select diamond so opening the collection must land on page two.
            data = dict(version=3, gold='15000', rebirths=0, unlocked=[True]*10,
                        discovered=[], selected=9, hammerOwned=False, hammerLevel=0,
                        honeyExpiresAt=0, coatingExpiresAt=0)
            context.add_init_script("if(!sessionStorage.getItem('fixture')){localStorage.setItem("
                + json.dumps(KEY) + ',' + json.dumps(json.dumps(data))
                + ");sessionStorage.setItem('fixture','1');}")
            page = context.new_page()
            errors = []
            page.on('pageerror', lambda e: errors.append(str(e)))
            page.goto(base)
            page.wait_for_load_state('networkidle')
            total = page.evaluate('WAKPPU_BALLS.length + 1')
            pages = (total + 8) // 9
            page.locator('#collectionBtn').click()
            expect(page.locator('#collectionPage')).to_have_text(f'2 / {pages}')
            expect(page.locator('[data-detail="9"]')).to_contain_text('사용 중')
            page.locator('#collectionPrev').click()
            expect(page.locator('#collectionPrev')).to_be_disabled()
            seen = []
            for index in range(pages):
                cards = page.locator('#collectionGrid [data-detail]')
                expect(cards).to_have_count(min(9, total - index * 9))
                assert page.locator('#collectionGrid > *').count() == 9
                boxes = cards.evaluate_all('(cards)=>cards.map(c=>({x:c.offsetLeft,y:c.offsetTop,index:c.dataset.detail}))')
                assert len({b['x'] for b in boxes[:3]}) == min(3, len(boxes))
                assert len({b['y'] for b in boxes[:3]}) == 1
                seen.extend(int(b['index']) for b in boxes)
                assert page.evaluate("document.querySelector('#collection .sheet').scrollWidth <= document.querySelector('#collection .sheet').clientWidth")
                if index == 0:
                    page.screenshot(path=str(OUT / f'collection-{width}.png'))
                if index < pages - 1:
                    page.locator('#collectionNext').click()
            assert seen == list(range(total)), seen
            expect(page.locator('#collectionNext')).to_be_disabled()
            page.screenshot(path=str(OUT / f'collection-last-{width}.png'))
            page.locator(f'[data-detail="{total - 1}"]').click()
            expect(page.locator('#collectionGrid')).to_be_hidden()
            expect(page.locator('#collectionDetail')).to_contain_text('일반 해금 불가')
            expect(page.locator('#collectionDetail [data-action="event"]')).to_be_disabled()
            page.locator('[data-collection-back]').click()
            expect(page.locator('#collectionPage')).to_have_text(f'{pages} / {pages}')
            assert page.evaluate('document.activeElement.dataset.detail') == str(total - 1)
            page.locator('#collectionClose').click()
            page.locator('#collectionBtn').click()
            expect(page.locator('#collectionPage')).to_have_text(f'2 / {pages}')
            page.locator('[data-detail="10"]').click()
            expect(page.locator('#collectionDetail [data-action="unlock"]')).to_be_disabled()
            page.locator('[data-collection-back]').click()
            page.locator('#collectionPrev').click()
            page.locator('[data-detail="1"]').click()
            expect(page.locator('#collectionDetail')).to_contain_text('파괴 보상 +10G')
            page.locator('#collectionDetail [data-action="select"]').click()
            expect(page.locator('#ballName')).to_have_text('초록색 왁뿌볼')
            page.reload()
            expect(page.locator('#ballName')).to_have_text('초록색 왁뿌볼')
            assert not errors, errors
            context.close()
            print(f'PASS: {width}x{height} pagination, 3 columns, detail, event, selection, reload')

        # Sequential unlock via detail preserves the original price and selection rules.
        context = browser.new_context()
        context.route('**/*', lambda r: r.continue_() if r.request.url.startswith(base)
                      else r.fulfill(status=200, body=''))
        data.update(gold='10', unlocked=[True], selected=0)
        context.add_init_script('localStorage.setItem(' + json.dumps(KEY) + ',' + json.dumps(json.dumps(data)) + ');')
        page = context.new_page()
        page.goto(base)
        page.wait_for_load_state('networkidle')
        page.locator('#collectionBtn').click()
        page.locator('[data-detail="1"]').click()
        page.locator('#collectionDetail [data-action="unlock"]').click()
        expect(page.locator('#ballName')).to_have_text('초록색 왁뿌볼')
        saved = page.evaluate('(k)=>JSON.parse(localStorage.getItem(k))', KEY)
        assert saved['gold'] == '0' and saved['unlocked'][1] and saved['selected'] == 1
        context.close()
        # A guest can select the event ball from its paged detail and return to yellow.
        context = browser.new_context()
        context.route('**/*', lambda r: r.continue_() if r.request.url.startswith(base)
                      else r.fulfill(status=200, body=''))
        page = context.new_page()
        page.goto(base)
        page.wait_for_load_state('networkidle')
        login = page.request.post(base + '/local/login', data={'email':'dodoonglee@gmail.com', 'password':password}).json()
        headers = {'Authorization':'Bearer ' + login['token']}
        response = page.request.post(base + '/local/api', headers=headers,
            data={'action':'admin_ball_event','mode':'start','duration_seconds':300,'delay_seconds':0})
        assert response.ok, response.text()
        page.evaluate('async()=>{await WakppuAuth.signInAnonymously();await WakppuGameTest.restoreAccount();WakppuAdminBallEvent.update(await WakppuAuth.invoke("status"));}')
        expect(page.locator('#ballName')).to_have_text('관리자 왁뿌볼')
        page.locator('#collectionBtn').click()
        while page.locator('#collectionPrev').is_enabled(): page.locator('#collectionPrev').click()
        page.locator('[data-detail="0"]').click()
        page.locator('#collectionDetail [data-action="select"]').click()
        expect(page.locator('#ballName')).to_have_text('노란색 왁뿌볼')
        page.locator('#collectionBtn').click()
        while page.locator('#collectionNext').is_enabled(): page.locator('#collectionNext').click()
        event_index = page.evaluate('WAKPPU_BALLS.length')
        page.locator(f'[data-detail="{event_index}"]').click()
        page.locator('#collectionDetail [data-action="event"]').click()
        expect(page.locator('#ballName')).to_have_text('관리자 왁뿌볼')
        response = page.request.post(base + '/local/api', headers=headers, data={'action':'admin_ball_event','mode':'stop'})
        assert response.ok, response.text()
        page.evaluate('async()=>WakppuAdminBallEvent.update(await WakppuAuth.invoke("status"))')
        expect(page.locator('#ballName')).to_have_text('노란색 왁뿌볼')
        context.close()
        browser.close()
        print('PASS: detail unlock costs exactly 10G and selects newly unlocked ball')
        print('PASS: guest event selection from detail, ordinary ball selection, event end restore')
finally:
    server.terminate()
    server.wait(timeout=10)
