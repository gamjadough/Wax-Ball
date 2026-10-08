"""Local server only: admin UI, all-user propagation, reload and permission denial."""
import os,socket,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,os.environ.get('WAKPPU_TEST_PYTHON_PATH',str(ROOT/'tools/.test-deps')))
from playwright.sync_api import sync_playwright,expect
with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
server=subprocess.Popen([sys.argv[1],str(ROOT/'tools/local-server.mjs')],cwd=ROOT,env=dict(os.environ,WAKPPU_LOCAL_PORT=str(port)),stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,encoding='utf8')
try:
    assert server.stdout.readline().startswith('Local preview:');server.stdout.readline()
    password=server.stdout.readline().strip().split(': ',1)[1]
    base=f'http://127.0.0.1:{port}'
    with sync_playwright() as p:
        browser=p.chromium.launch(channel='msedge',headless=True)
        admin=browser.new_page(viewport={'width':1200,'height':844});guest=browser.new_page(viewport={'width':390,'height':844})
        errors=[]
        for page in [admin,guest]:
            page.on('pageerror',lambda e:errors.append(str(e)))
            page.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base) else r.fulfill(status=200,body=''))
            page.goto(base);page.wait_for_load_state('networkidle')
        admin.evaluate("async(password)=>{await WakppuAuth.signIn('dodoonglee@gmail.com',password);await WakppuItemGame.restore();}",password)
        expect(admin.locator('#adminBtn')).to_be_visible();admin.locator('#adminBtn').click()
        expect(guest.locator('#adminBtn')).to_be_hidden()
        for mode in ['halloween','default','auto']:
            admin.locator('#adminBackgroundMode').select_option(mode);admin.locator('#adminBackgroundApply').click()
            expect(admin.locator('#adminBackgroundStatus')).to_contain_text({'halloween':'할로윈 배경','default':'기본 배경','auto':'자동'}[mode])
            guest.wait_for_function('(mode)=>WakppuHalloween.mode===mode',arg=mode,timeout=8000)
            assert guest.evaluate("document.body.classList.contains('halloween-theme')")==(mode=='halloween')
            assert admin.evaluate("document.body.classList.contains('halloween-theme')")==(mode=='halloween')
        admin.locator('#adminBackgroundMode').select_option('halloween');admin.wait_for_timeout(3200)
        assert admin.locator('#adminBackgroundMode').input_value()=='halloween'
        admin.locator('#adminBackgroundApply').click();guest.wait_for_function("WakppuHalloween.mode==='halloween'",timeout=8000)
        guest.reload();guest.wait_for_load_state('networkidle');guest.wait_for_function("WakppuHalloween.mode==='halloween'",timeout=8000)
        assert guest.evaluate('document.documentElement.scrollWidth<=innerWidth')
        out=ROOT/'tools/test-results';out.mkdir(parents=True,exist_ok=True)
        admin.locator('#adminBackgroundMode').scroll_into_view_if_needed();admin.screenshot(path=str(out/'admin-background-panel.png'))
        assert guest.evaluate("async()=>{try{await WakppuAuth.invoke('admin_background',{mode:'default'});return 200;}catch(e){return e.status;}}") ==401
        guest.evaluate("async()=>{await WakppuAuth.signIn('guest','');await WakppuItemGame.restore();}")
        assert guest.evaluate("async()=>{try{await WakppuAuth.invoke('admin_background',{mode:'default'});return 200;}catch(e){return e.status;}}") ==403
        assert guest.evaluate('WakppuItemGame.read().gold')=='10000'
        assert not errors,errors
        browser.close();print('PASS admin auto/default/halloween UI, two-client live updates, reload, unsaved selection, mobile and denied guest requests')
finally:server.terminate();server.wait(timeout=10)
