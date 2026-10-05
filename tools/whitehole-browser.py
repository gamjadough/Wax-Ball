"""Whitehole local integration, phase order, exact money and interruption checks."""
import json,os,socket,subprocess,sys,time
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,str(ROOT/'tools/.lifecycle-test-deps'))
from playwright.sync_api import sync_playwright,expect
OUT=ROOT/'tools/test-results';OUT.mkdir(exist_ok=True)
KEY='wax-ball:wakppuball:local-test-save'
with socket.socket() as sock:
    sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
server=subprocess.Popen([sys.argv[1],str(ROOT/'tools/local-server.mjs')],cwd=ROOT,env=dict(os.environ,WAKPPU_LOCAL_PORT=str(port)),stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,encoding='utf-8')
try:
    server.stdout.readline();server.stdout.readline();server.stdout.readline()
    base=f'http://127.0.0.1:{port}'
    with sync_playwright() as p:
        browser=p.chromium.launch(channel='msedge',headless=True);errors=[]
        def page_for(mobile=False,reduced=False,fixture=None):
            context=browser.new_context(viewport={'width':390 if mobile else 1100,'height':844},is_mobile=mobile,has_touch=mobile,reduced_motion='reduce' if reduced else 'no-preference')
            context.route('**/*',lambda route:route.continue_() if route.request.url.startswith(base) else route.fulfill(status=200,body='',content_type='text/javascript'))
            if fixture:context.add_init_script(f"localStorage.setItem({json.dumps(KEY)},{json.dumps(json.dumps(fixture))});")
            page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
            page.goto(base+('/?preview=whitehole' if not fixture else '/'));page.wait_for_load_state('networkidle')
            return context,page
        def gold(page):return page.evaluate('(key)=>JSON.parse(localStorage.getItem(key)).gold',KEY)
        def trace(page):page.evaluate("""()=>{window.whiteholeTrace=[];document.getElementById('ballWrap').addEventListener('whitehole-phase',e=>whiteholeTrace.push({phase:e.detail,gold:JSON.parse(localStorage.getItem('wax-ball:wakppuball:local-test-save')).gold}));}""")
        for mobile,reduced in [(False,False),(True,False),(True,True)]:
            ctx,page=page_for(mobile,reduced);trace(page)
            expect(page.locator('#ballName')).to_have_text('화이트홀 왁뿌볼')
            page.screenshot(path=str(OUT/('whitehole-mobile-ready.png' if mobile else 'whitehole-ready.png')))
            page.locator('#ballSvg').click()
            # Repeated clicks during the animation cannot start another payout.
            page.locator('#ballSvg').click(force=True)
            assert gold(page)=='0'
            page.wait_for_function("document.getElementById('ballWrap').dataset.whiteholePhase==='charge'")
            if not mobile:page.screenshot(path=str(OUT/'whitehole-charge.png'))
            page.wait_for_function("document.getElementById('ballWrap').dataset.whiteholePhase==='energy'")
            if not mobile:page.screenshot(path=str(OUT/'whitehole-energy.png'))
            assert gold(page)=='0'
            page.wait_for_function("JSON.parse(localStorage.getItem('wax-ball:wakppuball:local-test-save')).gold==='15000000'")
            page.wait_for_function("!document.getElementById('ballWrap').dataset.whiteholePhase")
            phases=page.evaluate('whiteholeTrace')
            assert [r['phase'] for r in phases]==['crack','charge','shatter','energy','complete','reward','respawn'],phases
            assert all(r['gold']=='0' for r in phases[:-1]),phases
            assert phases[-1]['gold']=='15000000'
            assert page.locator('.whitehole-particle,.whitehole-wave,.whitehole-glow').count()==0
            expect(page.locator('#ballName')).to_have_text('화이트홀 왁뿌볼')
            # Exact price deduction, discovery and persistence.
            page.get_by_role('button',name='1경 G로 해금 테스트',exact=True).click()
            assert gold(page)=='10000000000000000'
            expect(page.locator('#unlockBtn')).to_contain_text('화이트홀')
            page.locator('#unlockBtn').click();assert gold(page)=='0'
            expect(page.locator('#ballName')).to_have_text('화이트홀 왁뿌볼')
            page.goto(base+'/');expect(page.locator('#ballName')).to_have_text('화이트홀 왁뿌볼')
            assert page.evaluate('(key)=>JSON.parse(localStorage.getItem(key)).unlocked',KEY)==[True]*14
            ctx.close()
        ctx,page=page_for();page.locator('#ballSvg').click()
        page.wait_for_function("document.getElementById('ballWrap').dataset.whiteholePhase==='energy'")
        page.evaluate("WakppuGameTest.run('ball','blackhole',0);WakppuGameTest.end()")
        page.wait_for_timeout(1900);assert gold(page)=='0'
        assert page.locator('.whitehole-particle,.whitehole-wave,.whitehole-glow').count()==0
        ctx.close()
        fixture=dict(version=3,gold='0',rebirths=2,unlocked=[True]*14,discovered=['whitehole'],selected=13,hammerOwned=True,hammerLevel=10,honeyExpiresAt=int(time.time()*1000)+60000)
        ctx,page=page_for(fixture=fixture)
        assert page.evaluate("WAKPPU_BALLS.find(ball=>ball.id==='whitehole').clicks")==300
        trace(page)
        page.evaluate("""()=>{let now=Date.now();WakppuGoldEvent.update({gold_event:{id:'local',multiplier:10,starts_at:new Date(now-1000).toISOString(),ends_at:new Date(now+59000).toISOString()},server_time:new Date(now).toISOString()});}""")
        page.locator('#ballSvg').click();page.locator('#ballSvg').click()
        assert gold(page)=='0'
        assert page.evaluate('whiteholeTrace.length')==0
        page.locator('#ballSvg').click()
        page.wait_for_function("JSON.parse(localStorage.getItem('wax-ball:wakppuball:local-test-save')).gold==='1200000000'")
        ctx.close();browser.close()
        assert not errors,errors
    print('PASS whitehole: 300 clicks, max hammer destroys on third hit, desktop/mobile/reduced motion, ordered effects and payout, no duplicate reward, exact 1경 unlock, save reload, interruption cleanup, rebirth/honey/event multipliers')
finally:
    server.terminate();server.wait(timeout=10)
