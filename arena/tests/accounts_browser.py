"""UI integration checks with a simulated Firebase service; no real credentials."""
import json
import os
from pathlib import Path
from urllib.parse import urlparse, parse_qs
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
URL = os.environ.get('TEST_URL', 'http://127.0.0.1:5173')
ARTIFACTS = ROOT / 'artifacts'
ARTIFACTS.mkdir(exist_ok=True)
CONFIG = {'apiKey': 'test-public-key', 'projectId': 'arena-test', 'databaseURL': 'https://arena-test-default-rtdb.firebaseio.com'}

with sync_playwright() as p:
    browser = p.chromium.launch(channel='msedge', headless=True)
    checks = []
    errors = []
    users = {'alice@example.test': {'id': 'alice', 'nickname': '민트 공', 'verified': True}, 'bob@example.test': {'id': 'bob', 'nickname': '주황 공', 'verified': True}}
    records = {}
    offline = [False]
    mail = []
    def mock(route):
        request = route.request
        uri = urlparse(request.url)
        body = request.post_data_json if request.post_data and 'json' in request.headers.get('content-type', '') else {}
        status, result = 200, {}
        action = uri.path.split(':')[-1]
        if 'identitytoolkit' in uri.netloc:
            email = body.get('email')
            if action in ('signInWithPassword', 'signUp'):
                if action == 'signUp':
                    users[email] = {'id': 'new', 'nickname': '', 'verified': False}
                user = users.get(email)
                if not user or body.get('password') != 'password123':
                    status, result = 400, {'error': {'message': 'INVALID_LOGIN_CREDENTIALS'}}
                else:
                    result = {'idToken': 'token-' + user['id'], 'refreshToken': 'refresh-' + user['id'], 'localId': user['id'], 'email': email, 'expiresIn': '3600'}
            elif action == 'lookup':
                uid = body.get('idToken', '').replace('token-', '')
                user = next(u for u in users.values() if u['id'] == uid)
                result = {'users': [{'localId': uid, 'emailVerified': user['verified'], 'displayName': user['nickname']}]}
            elif action == 'update':
                users['new@example.test']['nickname'] = body['displayName']
            elif action == 'sendOobCode':
                mail.append(body['requestType'])
        elif 'firebaseio' in uri.netloc:
            uid = parse_qs(uri.query)['auth'][0].replace('token-', '')
            parts = uri.path.removesuffix('.json').split('/')
            assert parts[3] == uid, 'cross-account request'
            owned = records.setdefault(uid, {})
            if offline[0]:
                status, result = 503, {'error': 'unavailable'}
            elif request.method == 'PUT':
                mid = parts[-1]
                if mid in owned:
                    status, result = 412, owned[mid]
                else:
                    body['completedAt'] = 1791850000000 + len(owned)
                    owned[mid] = body
                    result = body
            else:
                result = owned.get(parts[-1]) if parts[-1] != 'matches' else owned
        route.fulfill(status=status, content_type='application/json', body=json.dumps(result))
    def setup(context):
        context.route('**/js/account-config.js*', lambda route: route.fulfill(content_type='text/javascript', body='window.WaxArena.ACCOUNT_CONFIG = ' + json.dumps(CONFIG) + ';'))
        def fixture(route):
            response = route.fetch()
            route.fulfill(response=response, body=response.text().replace('maxHealth: 1000', 'maxHealth: 10'))
        context.route('**/js/config.js', fixture)
        context.route('https://identitytoolkit.googleapis.com/**', mock)
        context.route('https://arena-test-default-rtdb.firebaseio.com/**', mock)
    def load(page):
        page.on('pageerror', lambda error: errors.append(str(error)))
        assert page.goto(URL).status == 200
        page.wait_for_load_state('networkidle')
        page.locator('#account-open').wait_for()
    def login(page, email):
        page.locator('#account-open').click()
        page.locator('[data-account-mode=login]').click()
        page.locator('#account-email').fill(email)
        page.locator('#account-password').fill('password123')
        page.locator('#account-submit').click()
        page.wait_for_function("document.getElementById('account-message').textContent === '로그인했습니다.'")
        page.locator('#account-close').click()
    def win(page):
        page.locator('#fight-button').click()
        page.locator('#ai-difficulty').select_option('entry')
        page.locator('#confirm-battle').click()
        for _ in range(5):
            page.locator('#player-ball').click()
        page.locator('#result').wait_for(state='visible')
    try:
        context = browser.new_context(viewport={'width': 1440, 'height': 960})
        setup(context)
        page = context.new_page()
        load(page)
        assert page.locator('#account-entry').inner_text() == '로그인 / 회원가입'
        page.locator('#account-entry').focus()
        page.locator('#account-entry').press('Enter')
        assert page.locator('#account-dialog').is_visible()
        page.keyboard.press('Escape')
        assert page.locator('#account-entry').evaluate('(el)=>el===document.activeElement')
        checks.append('explicit desktop login/signup button opens by keyboard and restores focus')
        win(page)
        assert page.locator('#gold-amount').inner_text() == '50 G'
        page.locator('#lobby-button').click()
        login(page, 'alice@example.test')
        assert page.locator('#profile-name').inner_text() == '민트 공'
        assert page.locator('#account-entry').inner_text() == '계정 관리'
        assert page.locator('#gold-amount').inner_text() == '0 G'
        win(page)
        page.wait_for_function("WaxArena.getProgress().gold === 50")
        assert '온라인 계정에 저장' in page.locator('#result-save-note').inner_text()
        page.locator('#lobby-button').click()
        checks.append('guest progress stays separate; account victory reaches server once')
        page.reload()
        page.wait_for_function("document.getElementById('profile-name').textContent === '민트 공'")
        page.wait_for_function("WaxArena.getProgress().gold === 50")
        other = browser.new_context(viewport={'width': 844, 'height': 390})
        setup(other)
        second = other.new_page()
        load(second)
        login(second, 'alice@example.test')
        assert second.locator('#gold-amount').inner_text() == '50 G'
        checks.append('reload and independent browser login restore the same online record')
        offline[0] = True
        win(second)
        second.wait_for_function("WaxArena.getProgress().issue === 'pending'")
        assert second.locator('#gold-amount').inner_text() == '50 G'
        assert '저장 대기' in second.locator('#result-reward').inner_text()
        offline[0] = False
        second.locator('#lobby-button').click()
        second.locator('#account-open').click()
        second.locator('#account-sync').click()
        second.wait_for_function("WaxArena.getProgress().gold === 100 && WaxArena.getProgress().pending === 0")
        assert len(records['alice']) == 2
        checks.append('offline win queues safely and retries without awarding twice')
        second.locator('#account-logout').click()
        second.wait_for_function("document.getElementById('profile-name').textContent === '게스트 공'")
        second.locator('#account-close').click()
        login(second, 'bob@example.test')
        assert second.locator('#gold-amount').inner_text() == '0 G'
        second.locator('#account-open').click()
        second.locator('#account-logout').click()
        second.locator('#account-close').click()
        checks.append('different accounts cannot see each other records')
        second.locator('#account-open').click()
        second.locator('[data-account-mode=signup]').click()
        second.locator('#account-nickname').fill('새 공')
        second.locator('#account-email').fill('new@example.test')
        second.locator('#account-password').fill('password123')
        second.locator('#account-submit').click()
        second.wait_for_function("document.getElementById('account-message').textContent.includes('가입을 완료')")
        assert 'VERIFY_EMAIL' in mail
        assert second.locator('#profile-name').inner_text() == '게스트 공'
        second.locator('[data-account-mode=reset]').click()
        second.locator('#account-submit').click()
        second.wait_for_function("document.getElementById('account-message').textContent.includes('재설정 링크')")
        assert 'PASSWORD_RESET' in mail
        checks.append('signup requires email verification; password reset is requested')
        second.locator('[data-account-mode=login]').click()
        for width, height in [(568,240),(568,320),(844,390)]:
            second.set_viewport_size({'width':width, 'height':height})
            entry = second.locator('#account-entry').bounding_box()
            assert entry['x'] >= 0 and entry['y'] >= 0 and entry['x']+entry['width'] <= width and entry['height'] >= 44
            assert second.locator('#account-entry').inner_text() == '로그인'
            profile = second.locator('#account-open').bounding_box()
            assert profile['y'] >= 0 and profile['height'] >= 44
            dialog = second.locator('#account-dialog').bounding_box()
            assert dialog['x'] >= -1 and dialog['y'] >= -1 and dialog['x']+dialog['width'] <= width+1 and dialog['y']+dialog['height'] <= height+1
            for selector in ['#account-submit','#account-verify','#account-close']:
                second.locator(selector).scroll_into_view_if_needed()
                rect = second.locator(selector).bounding_box()
                assert rect['height'] >= 44
            second.screenshot(path=str(ARTIFACTS / f'accounts-{width}x{height}.png'))
        second.set_viewport_size({'width':390,'height':844})
        assert not second.locator('#account-dialog').evaluate('(el) => el.open')
        second.set_viewport_size({'width':568,'height':240})
        second.locator('#account-entry').click()
        assert second.locator('#account-dialog').is_visible()
        second.locator('#account-close').click()
        checks.append('account modal fits landscape phones and closes under portrait gate')
        page.locator('#account-open').click()
        page.locator('#account-logout').click()
        assert page.locator('#gold-amount').inner_text() == '50 G'
        assert page.locator('#account-entry').inner_text() == '로그인 / 회원가입'
        page.locator('#account-close').click()
        checks.append('logout restores original guest progress')
        assert errors == [], errors
        checks.append('zero JavaScript exceptions')
        (ARTIFACTS / 'accounts-results.json').write_text(json.dumps({'passed': checks, 'errors':errors, 'backend':'simulated'}, ensure_ascii=False, indent=2), encoding='utf-8')
        for check in checks:
            print('PASS ' + check)
    finally:
        browser.close()
