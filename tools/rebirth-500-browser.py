"""Local-only desktop/mobile rebirth, exact Gold persistence and cap checks."""
import sys
print('Loading Playwright', flush=True)
from pathlib import Path
sys.path.insert(0, sys.argv[1] if len(sys.argv)>1 else str(Path(__file__).resolve().parent / '.test-deps'))
from playwright.sync_api import sync_playwright, expect

with sync_playwright() as p:
    print('Launching browser', flush=True)
    browser = p.chromium.launch(headless=True, executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe')
    for width, height in [(1280, 900), (390, 844)]:
        page = browser.new_page(viewport={'width': width, 'height': height})
        page.set_default_timeout(15000)
        print('Opening local preview', width, flush=True)
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto('http://127.0.0.1:4188/?preview=rebirth500')
        page.wait_for_load_state('networkidle')
        page.wait_for_selector('aside[data-ready="true"]')
        page.wait_for_load_state('networkidle')
        expect(page.locator('#rebirthBtn')).to_contain_text('999회')
        expect(page.locator('#rebirthBtn')).to_be_enabled()
        before = page.evaluate('async()=> (await WakppuAuth.invoke("bootstrap")).state.gold')
        assert len(str(before)) == 1657
        print(width, '1000th cost:', page.locator('#goldValue').inner_text())
        page.locator('#rebirthBtn').click()
        last_cost_text=page.evaluate('WakppuGold.compact(REBIRTH_COSTS[999])')
        expect(page.locator('#rebirthText')).to_contain_text(last_cost_text)
        page.locator('#rebirthConfirm').click()
        print('After confirmation:', page.locator('#rebirthBtn').inner_text(), 'errors:', errors, flush=True)
        expect(page.locator('#rebirthBtn')).to_contain_text('1000회')
        expect(page.locator('#goldValue')).to_have_text('0')
        expect(page.locator('#rebirthBtn')).to_be_disabled()
        with page.expect_response(lambda r: r.url.endswith('/local/api') and r.request.post_data and '"action":"save_progress"' in r.request.post_data and '"rebirths":1000' in r.request.post_data):
            page.wait_for_timeout(700)
        assert page.evaluate('async()=> (await WakppuAuth.invoke("bootstrap")).state.rebirths') == 1000
        page.reload()
        page.wait_for_load_state('networkidle')
        page.wait_for_selector('aside[data-ready="true"]')
        expect(page.locator('#rebirthBtn')).to_contain_text('1000회')
        expect(page.locator('#goldValue')).to_have_text('0')
        result = page.evaluate('''async()=>{
          const user=(await WakppuAuth.session()).data.session.user;
          const gold='9'.repeat(4096);
          await WakppuAuth.invoke('admin_gold',{user_id:user.id,mode:'set',value:gold});
          await WakppuGameTest.restoreAccount();
          return (await WakppuAuth.invoke('bootstrap')).state.gold===gold;
        }''')
        assert result
        expect(page.locator('#goldValue')).to_have_text('1e4096')
        page.reload()
        page.wait_for_load_state('networkidle')
        page.wait_for_selector('aside[data-ready="true"]')
        expect(page.locator('#goldValue')).to_have_text('1e4096')
        assert not errors, errors
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        page.screenshot(path=f'tools/test-results/rebirth-500-{width}.png')
        for count in [499,500,501]:
            page.evaluate("""async count=>{
              const user=(await WakppuAuth.session()).data.session.user;
              await WakppuAuth.invoke('admin_rebirths',{user_id:user.id,mode:'set',value:String(count)});
              await WakppuAuth.invoke('admin_gold',{user_id:user.id,mode:'set',value:String(REBIRTH_COSTS[count]-1n)});
              await WakppuGameTest.restoreAccount();
            }""",count)
            expect(page.locator('#rebirthBtn')).to_be_disabled()
            page.evaluate("""async count=>{
              const user=(await WakppuAuth.session()).data.session.user;
              await WakppuAuth.invoke('admin_gold',{user_id:user.id,mode:'set',value:String(REBIRTH_COSTS[count])});
              await WakppuGameTest.restoreAccount();
            }""",count)
            expect(page.locator('#rebirthBtn')).to_be_enabled()
            if count==500:
                page.screenshot(path=f'tools/test-results/rebirth501-{width}.png')
            page.locator('#rebirthBtn').click()
            page.locator('#rebirthConfirm').click()
            expect(page.locator('#rebirthBtn')).to_contain_text(str(count+1)+'회')
            expect(page.locator('#goldValue')).to_have_text('0')
            page.wait_for_timeout(700)
            assert page.evaluate('async()=> (await WakppuAuth.invoke("bootstrap")).state.rebirths')==count+1
            page.reload()
            page.wait_for_load_state('networkidle')
            page.wait_for_selector('aside[data-ready="true"]')
            expect(page.locator('#rebirthBtn')).to_contain_text(str(count+1)+'회')
        assert not errors,errors
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        print(width,'PASS: cost-1 disabled, exact cost enabled, 499/500/501 transitions and reload')
        print(width, 'PASS: 999→1000, reload, exact 4096-digit Gold, no JS errors/overflow')
        page.close()
    browser.close()
