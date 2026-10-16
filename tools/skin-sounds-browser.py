"""Local-only sound audition and actual eternity final-hit integration."""
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
    base=f'http://127.0.0.1:{port}'
    with sync_playwright() as p:
        browser=p.chromium.launch(channel='msedge',headless=True)
        for width,reduced in [(390,False),(1200,False),(390,True)]:
            context=browser.new_context(viewport={'width':width,'height':1000},is_mobile=width<500,has_touch=True)
            context.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base) else r.fulfill(status=200,body=''))
            page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
            page.emulate_media(reduced_motion='reduce' if reduced else 'no-preference')
            page.add_init_script("""window.playedClips=[];const play=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){const promise=play.call(this);promise?.then(()=>{if(this.src.includes('/eternity/'))window.playedClips.push(this.src.split('/').pop());}).catch(()=>{});return promise;}""")
            page.goto(base+'/?preview=skin-sounds')
            try:page.wait_for_load_state('networkidle',timeout=2000)
            except Exception:pass
            expect(page.locator('#previewOpenSkins')).to_be_visible()
            page.wait_for_function('WakppuItemGame.read().test')
            page.evaluate("window.skinPhases=[];document.querySelector('#ballWrap').addEventListener('transcendent-phase',e=>skinPhases.push(e.detail))")
            out=ROOT/'tools/test-results';out.mkdir(exist_ok=True)
            for rank in ['common','rare','hero','legendary','transcendent']:
                page.locator('#previewOpenSkins').click()
                expect(page.locator('#inventorySkinsPage')).to_be_visible()
                button=page.locator(f'[data-equip-skin="{rank}"]')
                if button.is_enabled():button.click()
                expect(button).to_have_text('장착 중')
                page.locator('#itemsClose').click()
                expect(page.locator(f'#ballSvg [data-eternity-skin="{rank}"]')).to_have_count(1)
                for progress in ['0.25','0.6','0.9']:
                    page.locator(f'[data-skin-progress="{progress}"]').click()
                    if rank=='common':expect(page.locator('[data-skin-impact]')).to_have_count(0)
                    else:expect(page.locator(f'[data-skin-impact="{rank}"]')).to_have_count(1)
                    if rank=='transcendent':
                        expect(page.locator('[data-skin-seams] path')).to_have_count(20)
                        expect(page.locator('[data-skin-impact]')).to_have_attribute('data-glow-phase','faint' if progress=='0.25' else 'pulse')
                        expect(page.locator('.skin-seam-light')).to_have_count(5)
                        assert page.locator('.skin-light-particle').count()<=(6 if progress!='0.25' else 0)
                        animation=page.locator('.skin-seam-light').first.evaluate('(e)=>getComputedStyle(e).animationName')
                        assert animation==('skin-seam-pulse' if not reduced and progress!='0.25' else 'none')
                        page.screenshot(path=str(out/f'skin-light-{progress}-{width}-reduced{reduced}.png'))
                    else:expect(page.locator('.skin-seam-light')).to_have_count(0)
                if not reduced:page.screenshot(path=str(out/f'skin-hit-{rank}-{width}.png'))
                for stage in ([] if reduced else ['early','mid','late','final']):
                    page.locator(f'[data-skin-stage="{stage}"]').click()
                    page.wait_for_function('(file)=>playedClips.includes(file)',arg=f'{rank}-{stage}.mp3')
                page.locator('#skinSoundLast').click()
                if rank=='transcendent':
                    expect(page.locator('[data-skin-impact]')).to_have_attribute('data-glow-phase','inward')
                    particle=page.locator('.skin-light-particle').first.evaluate('(e)=>getComputedStyle(e).animationName')
                    assert particle==('none' if reduced else 'skin-seam-inward')
                before=page.evaluate('WakppuItemGame.read().gold')
                page.evaluate('window.playedClips=[];window.skinPhases=[]')
                page.locator('#ballSvg').click(position={'x':150,'y':150})
                page.wait_for_function('(file)=>playedClips.includes(file)',arg=f'{rank}-final.mp3')
                page.wait_for_function("skinPhases.some(e=>e.phase==='release')")
                expected={'common':'convergence','rare':'ice','hero':'flames','legendary':'time','transcendent':'void'}[rank]
                assert page.evaluate('skinPhases[0].kind')==expected
                if rank!='common':assert page.locator('.transcendent-fx').count()<=(5 if reduced else 26)
                if not reduced:
                    page.wait_for_timeout(220)
                    page.screenshot(path=str(out/f'skin-break-{rank}-{width}.png'))
                page.wait_for_function('!WakppuItemGame.read().busy',timeout=15000)
                assert page.evaluate('WakppuItemGame.read().gold')==before
                assert page.evaluate('WakppuItemGame.read().test')
                expect(page.locator('.transcendent-fx')).to_have_count(0)
                expect(page.locator('[data-skin-impact]')).to_have_count(0)
                if rank=='legendary' and not reduced:
                    assert page.evaluate("skinPhases.some(e=>e.phase==='freeze')&&skinPhases.some(e=>e.phase==='rewind')")
                if rank=='transcendent' and not reduced:assert page.evaluate("skinPhases.some(e=>e.phase==='fold')")
                expect(page.locator('#backgroundMusic')).to_have_count(0)
            page.reload();page.wait_for_function('WakppuItemGame.read().test')
            expect(page.locator('#ballSvg [data-eternity-skin="transcendent"]')).to_have_count(1)
            page.locator('#inventoryBtn').click();page.locator('#inventorySkinsTab').click()
            expect(page.locator('#skinCards article')).to_have_count(5)
            page.locator('#inventoryItemsTab').click()
            expect(page.locator('#inventoryItemsPage')).to_be_visible()
            expect(page.locator('#inventorySkinsPage')).to_be_hidden()
            page.locator('#inventorySkinsTab').click()
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
            assert not errors,errors
            out=ROOT/'tools/test-results';out.mkdir(exist_ok=True)
            page.screenshot(path=str(out/f'skin-sounds-{width}.png'),full_page=True)
            page.locator('#skinUnequip').click();page.locator('#itemsClose').click()
            expect(page.locator('#ballSvg [data-eternity-skin]')).to_have_count(0)
            expect(page.locator('#backgroundMusic')).to_have_count(0)
            # Plain local URL must not inject preview controls.
            page.goto(base+'/');expect(page.locator('#skinSoundPreview')).to_have_count(0)
            context.close();print(f'PASS {width}px reduced={reduced}: 5 tier hit/break motions, freeze/rewind/fold, cleanup, equip/reload, no BGM/reward',flush=True)
        browser.close()
finally:
    server.terminate();server.wait(timeout=10)
