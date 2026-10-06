"""Local-only gem coating shop, difficulty, reward, expiry and rebirth checks."""
import json,os,socket,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,str(ROOT/'tools/.test-deps'))
from playwright.sync_api import sync_playwright,expect
KEY='wax-ball:wakppuball:local-test-save'
with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
server=subprocess.Popen([sys.argv[1] if len(sys.argv)>1 else 'node',str(ROOT/'tools/local-server.mjs')],cwd=ROOT,env=dict(os.environ,WAKPPU_LOCAL_PORT=str(port)),stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,encoding='utf-8')
try:
    assert server.stdout.readline().startswith('Local preview:')
    server.stdout.readline();server.stdout.readline()
    base=f'http://127.0.0.1:{port}'
    with sync_playwright() as p:
        browser=p.chromium.launch(channel='msedge',headless=True)
        for case,gold,rebirths,honey in [('insufficient',4999999,0,False),('combined',10000000,2,True),('expiry',5000000,0,False),('rebirth',7000000,0,True),('hammer',5000000,0,False)]:
            context=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
            context.route('**/*',lambda route:route.continue_() if route.request.url.startswith(base) else route.fulfill(status=200,body=''))
            fixture=dict(version=3,gold=str(gold),rebirths=rebirths,unlocked=[True]+[False]*13,discovered=['yellow'],selected=0,hammerOwned=case=='hammer',hammerLevel=1 if case=='hammer' else 0,honeyExpiresAt=0,coatingExpiresAt=0)
            context.add_init_script("if(!sessionStorage.getItem('fixture')){const data="+json.dumps(fixture)+";data.honeyExpiresAt="+('Date.now()+600000' if honey else '0')+";localStorage.setItem("+json.dumps(KEY)+",JSON.stringify(data));sessionStorage.setItem('fixture','1');}")
            page=context.new_page();errors=[]
            page.on('pageerror',lambda e:errors.append(str(e)))
            if case=='expiry':page.clock.install()
            page.goto(base);page.wait_for_load_state('networkidle')
            saved=lambda:page.evaluate('(key)=>JSON.parse(localStorage.getItem(key))',KEY)
            page.locator('#shopBtn').click()
            expect(page.locator('#coatingBtn')).to_have_text('구매 · 5M G')
            expect(page.locator('#coatingInfo')).to_contain_text('필요 타격량 +100% (2배)')
            if case=='insufficient':
                expect(page.locator('#coatingBtn')).to_be_disabled()
                assert saved()['coatingExpiresAt']==0
            else:
                start=page.evaluate('Date.now()');page.locator('#coatingBtn').click()
                snapshot=saved();assert snapshot['gold']==str(gold-5000000),snapshot
                assert start+900000<=snapshot['coatingExpiresAt']<=start+902000
                expect(page.locator('#coatingBtn')).to_be_disabled()
                page.locator('#coatingBtn').dispatch_event('click')
                assert saved()['gold']==snapshot['gold'] and saved()['coatingExpiresAt']==snapshot['coatingExpiresAt']
                page.reload();page.locator('#shopBtn').click()
                expect(page.locator('#coatingInfo')).to_contain_text('활성화')
                if case=='combined':
                    page.wait_for_timeout(600)
                    out=ROOT/'tools/test-results';out.mkdir(exist_ok=True)
                    page.screenshot(path=str(out/'gem-coating-mobile.png'))
                    page.evaluate('()=>{WakppuGoldEvent.multiplier=()=>10;}')
                    page.locator('[data-close="shop"]').click()
                    for _ in range(9):page.locator('#ballSvg').click(position={'x':160,'y':160})
                    assert saved()['gold']=='5000000','Coated yellow ball must require ten hits'
                    page.locator('#ballSvg').click(position={'x':160,'y':160})
                    expect(page.locator('#goldValue')).to_have_text('5M')
                    page.wait_for_function('(key)=>JSON.parse(localStorage.getItem(key)).gold==="5000240"',arg=KEY)
                    assert saved()['gold']=='5000240',saved()
                elif case=='expiry':
                    page.clock.fast_forward(901000)
                    expect(page.locator('#coatingBtn')).to_have_text('구매 · 5M G')
                    assert saved()['coatingExpiresAt']==0
                    page.locator('[data-close="shop"]').click()
                    for _ in range(5):page.locator('#ballSvg').click(position={'x':160,'y':160})
                    page.wait_for_function('(key)=>JSON.parse(localStorage.getItem(key)).gold==="1"',arg=KEY)
                    assert saved()['gold']=='1',saved()
                elif case=='rebirth':
                    page.locator('[data-close="shop"]').click()
                    page.locator('#rebirthBtn').click();page.locator('#rebirthConfirm').click()
                    assert saved()['rebirths']==1 and saved()['coatingExpiresAt']==0 and saved()['honeyExpiresAt']==0,saved()
                elif case=='hammer':
                    page.locator('[data-close="shop"]').click()
                    for _ in range(3):page.locator('#ballSvg').click(position={'x':160,'y':160})
                    assert saved()['gold']=='0','Hammer damage stays three; nine damage is below ten'
                    page.locator('#ballSvg').click(position={'x':160,'y':160})
                    page.wait_for_function('(key)=>JSON.parse(localStorage.getItem(key)).gold==="3"',arg=KEY)
                    assert saved()['gold']=='3',saved()
            assert not errors,errors
            context.close();print('PASS '+case)
        browser.close()
finally:
    server.terminate();server.wait(timeout=10)
