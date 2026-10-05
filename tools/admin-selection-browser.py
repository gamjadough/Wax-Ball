"""Selection safety and responsive admin list regression; local fixtures only."""
import json
import os
from pathlib import Path
import socket
import subprocess
import sys

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT/'tools/.test-deps'))
from playwright.sync_api import sync_playwright, expect


def main():
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        port = sock.getsockname()[1]
    server = subprocess.Popen([sys.argv[1] if len(sys.argv)>1 else 'node', str(ROOT/'tools/local-server.mjs')],
        cwd=ROOT, env=dict(os.environ, WAKPPU_LOCAL_PORT=str(port)), stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT, text=True, encoding='utf-8')
    out=ROOT/'tools/test-results'
    out.mkdir(exist_ok=True)
    try:
        assert server.stdout.readline().startswith('Local preview:')
        server.stdout.readline()
        password=server.stdout.readline().split(': ',1)[1].strip()
        base=f'http://127.0.0.1:{port}'
        with sync_playwright() as pw:
            browser=pw.chromium.launch(channel='msedge',headless=True)
            context=browser.new_context(viewport={'width':1100,'height':820})
            context.route('**/*',lambda route: route.continue_() if route.request.url.startswith(base) else route.fulfill(status=200,body=''))
            page=context.new_page()
            errors=[]
            page.on('pageerror',lambda error:errors.append(str(error)))
            page.goto(base)
            page.wait_for_load_state('networkidle')
            page.locator('#accountBtn').click()
            page.locator('#accountEmail').fill('dodoonglee@gmail.com')
            page.locator('#accountPassword').fill(password)
            page.locator('#signInBtn').click()
            expect(page.locator('#adminBtn')).to_be_visible()
            players=page.evaluate("()=>WakppuAuth.invoke('admin_search',{query:''})")
            target=players[1]
            samples=players+[dict(target,id=f'fixture-{i}',nickname='긴닉네임가나다라마바사아자차카타파하' if i==0 else f'플레이어{i:02}') for i in range(10)]
            held=[]
            delay={'action':None}
            calls=[]
            def api(route):
                body=route.request.post_data_json
                calls.append(body)
                if body['action']==delay['action']:
                    held.append(route)
                elif body['action']=='admin_search':
                    q=body.get('query','')
                    route.fulfill(status=200,content_type='application/json',body=json.dumps([p for p in samples if q in p['nickname'] or q in p['id']]))
                else:
                    route.continue_()
            page.route('**/local/api',api)
            page.locator('#adminBtn').click()
            expect(page.locator('#adminResults button')).to_have_count(12)
            action_ids=['adminSetGold','adminSetRebirths','adminBan','adminUnban','adminHideRanking','adminShowRanking','adminUnlock','adminUnlockAll','adminDiscover','adminDiscoverAll','adminResetOne','adminResetAll']
            for name in action_ids: expect(page.locator('#'+name)).to_be_disabled()
            assert page.locator('#adminResults button').all_text_contents()==[p['nickname'] for p in samples]
            chosen=page.locator(f'#adminResults button[data-player-id="{target["id"]}"]')
            chosen.click()
            expect(chosen).to_have_attribute('aria-pressed','true')
            expect(page.locator('#adminSelectionStatus')).to_contain_text(target['nickname'])
            expect(page.locator('#adminSetGold')).to_be_enabled()
            page.locator('#adminModerationReason').fill('old reason')
            page.locator('#adminQuery').fill('no matches')
            expect(page.locator('#adminSelectionStatus')).to_contain_text('선택 대상 없음')
            expect(page.locator('#adminModerationReason')).to_have_value('')
            for name in action_ids: expect(page.locator('#'+name)).to_be_disabled()
            page.locator('#adminSearch').click()
            expect(page.locator('#adminResults')).to_contain_text('검색 결과가 없습니다.')
            # Delayed search results must not repopulate an edited query.
            delay['action']='admin_search'
            page.locator('#adminQuery').fill('')
            page.locator('#adminSearch').click()
            page.wait_for_function('()=>document.querySelector("#adminSetGold").disabled')
            assert held
            page.locator('#adminQuery').fill('new query')
            held.pop().fulfill(status=200,content_type='application/json',body=json.dumps(samples))
            delay['action']=None
            page.wait_for_timeout(150)
            expect(page.locator('#adminResults button')).to_have_count(0)
            page.locator('#adminQuery').fill('')
            page.locator('#adminQuery').press('Enter')
            expect(page.locator('#adminResults button')).to_have_count(12)
            chosen.click()
            dialogs=[]
            accept={'value':False}
            page.on('dialog',lambda dialog:(dialogs.append(dialog.message),dialog.accept() if accept['value'] else dialog.dismiss()))
            before=len(calls)
            page.locator('#adminSetGold').click()
            assert len(calls)==before,'Cancelled confirmation sent a mutation'
            accept['value']=True
            delay['action']='admin_gold'
            page.locator('#adminSetGold').click()
            assert target['nickname'] in dialogs[-1] and target['id'] in dialogs[-1]
            assert calls[-1]['user_id']==target['id']
            assert held
            page.locator('#adminQuery').fill('changed while saving')
            held.pop().fulfill(status=200,content_type='application/json',body=json.dumps({'target':target}))
            delay['action']=None
            page.wait_for_timeout(150)
            expect(page.locator('#adminSelectionStatus')).to_contain_text('선택 대상 없음')
            expect(page.locator('#adminSetGold')).to_be_disabled()
            page.locator('#adminQuery').fill('')
            page.locator('#adminSearch').click()
            expect(page.locator('#adminResults button')).to_have_count(12)
            chosen.click()
            page.locator('#adminModerationReason').fill('selection test')
            page.locator('#adminBan').click()
            assert target['nickname'] in dialogs[-1] and '1일 밴' in dialogs[-1] and 'selection test' in dialogs[-1]
            expect(page.locator('#adminPlayerInfo')).to_contain_text('기간제 밴')
            chosen.click()
            expect(page.locator('#adminPlayerInfo')).to_contain_text('기간제 밴')
            page.locator('#adminUnban').click()
            expect(page.locator('#adminPlayerInfo')).to_contain_text('이용 상태: 정상')
            page.locator('[data-close="admin"]').click()
            page.locator('#adminBtn').click()
            expect(page.locator('#adminSelectionStatus')).to_contain_text('선택 대상 없음')
            for width,columns in [(1100,5),(700,4),(550,3),(390,2)]:
                page.set_viewport_size({'width':width,'height':844})
                page.locator('#adminResults').scroll_into_view_if_needed()
                geometry=page.locator('#adminResults').evaluate("e=>({columns:getComputedStyle(e).gridTemplateColumns.split(' ').length,overflow:e.scrollWidth>e.clientWidth})")
                assert geometry=={'columns':columns,'overflow':False},geometry
                assert page.locator('#adminResults button').evaluate_all('els=>els.every(e=>e.getBoundingClientRect().height>=44)')
                if width in (1100,390): page.screenshot(path=str(out/f'admin-selection-{width}.png'))
            assert not errors,errors
            browser.close()
            print('PASS: selection reset, disabled actions, target confirmations, stale responses, reopen, 5/4/3/2-column layout')
    finally:
        server.terminate()
        server.wait(timeout=10)


if __name__=='__main__': main()
