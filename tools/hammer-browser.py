"""Local-only hammer purchase, exact large cost, persistence and level cap checks."""
import json,os,socket,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,str(ROOT/'tools/.test-deps'))
from playwright.sync_api import sync_playwright,expect

with socket.socket() as sock:
    sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
server=subprocess.Popen([sys.argv[1] if len(sys.argv)>1 else 'node',str(ROOT/'tools/local-server.mjs')],cwd=ROOT,env=dict(os.environ,WAKPPU_LOCAL_PORT=str(port)),stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,encoding='utf-8')
try:
    assert server.stdout.readline().startswith('Local preview:')
    server.stdout.readline();server.stdout.readline()
    base=f'http://127.0.0.1:{port}'
    with sync_playwright() as p:
        browser=p.chromium.launch(channel='msedge',headless=True)
        for level,gold in [(10,400000000),(29,100000000*4**20-1),(29,100000000*4**20),(30,0)]:
            context=browser.new_context(viewport={'width':390,'height':844})
            context.route('**/*',lambda route:route.continue_() if route.request.url.startswith(base) else route.fulfill(status=200,body=''))
            data=dict(version=3,gold=str(gold),rebirths=0,unlocked=[True]+[False]*13,discovered=['yellow'],selected=0,hammerOwned=True,hammerLevel=level,honeyExpiresAt=0)
            context.add_init_script("if(!sessionStorage.getItem('fixture')){localStorage.setItem('wax-ball:wakppuball:local-test-save',"+json.dumps(json.dumps(data))+");sessionStorage.setItem('fixture','1');}")
            page=context.new_page();errors=[]
            page.on('pageerror',lambda error:errors.append(str(error)))
            page.goto(base);page.wait_for_load_state('networkidle');page.locator('#shopBtn').click()
            expect(page.locator('#hammerInfo')).to_contain_text(f'Lv.{level}')
            if (level==29 and gold==100000000*4**20-1) or level==30:
                expect(page.locator('#hammerBtn')).to_be_disabled()
            else:
                page.locator('#hammerBtn').click()
                expect(page.locator('#hammerInfo')).to_contain_text(f'Lv.{level+1}')
                saved=page.evaluate("()=>JSON.parse(localStorage.getItem('wax-ball:wakppuball:local-test-save'))")
                assert saved['hammerLevel']==level+1 and saved['gold']=='0',saved
                page.reload();page.locator('#shopBtn').click()
                expect(page.locator('#hammerInfo')).to_contain_text(f'Lv.{level+1}')
                if level==29:
                    expect(page.locator('#hammerBtn')).to_be_disabled()
                    assert '최대 레벨' in page.locator('#hammerInfo').inner_text()
                    out=ROOT/'tools/test-results';out.mkdir(exist_ok=True)
                    page.screenshot(path=str(out/'hammer-lv30-mobile.png'))
            assert not errors,errors
            context.close()
        browser.close()
    print('PASS: Lv10→11, Lv29→30, exact Gold boundary and deduction, reload, Lv30 cap')
finally:
    server.terminate();server.wait(timeout=10)
