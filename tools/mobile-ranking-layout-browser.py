"""Mobile navigation regression using isolated progress, never production accounts.

python tools/mobile-ranking-layout-browser.py --base-url http://127.0.0.1:4189
Also supports the deployed Pages URL for a read-only release check.
"""
import argparse,json,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
DEPS=next((p for p in (ROOT/'tools/.test-deps',ROOT.parent.parent/'.test-deps') if p.exists()),None)
if DEPS:sys.path.insert(0,str(DEPS))
from playwright.sync_api import sync_playwright,expect

parser=argparse.ArgumentParser()
parser.add_argument('--base-url',required=True)
parser.add_argument('--chrome',default=r'C:\Program Files\Google\Chrome\Application\chrome.exe')
args=parser.parse_args()
OUT=ROOT/'tools/test-results';OUT.mkdir(exist_ok=True)
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path=args.chrome)
    for width,height in ((320,640),(360,800),(390,844),(430,932),(520,844)):
        context=browser.new_context(viewport={'width':width,'height':height},is_mobile=True,has_touch=True)
        stub='window.WakppuAuth={local:true,session:async()=>({data:{session:null}}),invoke:async()=>{throw Error("isolated layout test")}};'
        context.route('**/js/account.js*',lambda r:r.fulfill(content_type='text/javascript',body=stub))
        context.route('**/js/local-account.js*',lambda r:r.fulfill(content_type='text/javascript',body=stub))
        fixture=dict(version=3,gold='1'+'0'*200,rebirths=0,unlocked=[True],discovered=['yellow'],selected=0,hammerOwned=False,hammerLevel=0,honeyExpiresAt=0,coatingExpiresAt=0)
        context.add_init_script("localStorage.setItem('wax-ball:wakppuball:local-test-save',"+json.dumps(json.dumps(fixture))+");")
        page=context.new_page();errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(args.base_url);page.wait_for_load_state('networkidle')
        def geometry():
            return page.evaluate('''()=>{const box=s=>{const r=document.querySelector(s).getBoundingClientRect();return [r.x,r.y,r.width,r.height]};return {ranking:box('#rankingBtn'),collection:box('#collectionBtn'),inventory:box('#inventoryBtn'),unlock:box('#unlockBtn'),hidden:document.querySelector('#unlockBtn').hidden,overflow:document.documentElement.scrollWidth>innerWidth}}''')
        reference=geometry()
        def check():
            g=geometry()
            assert all(abs(a-b)<.1 for a,b in zip(g['ranking'],reference['ranking'])),(width,reference,g)
            assert all(abs(a-b)<.1 for a,b in zip(g['collection'],reference['collection'])),(width,reference,g)
            assert abs(g['ranking'][2]-g['collection'][2])<.1
            assert abs(g['ranking'][2]-g['inventory'][2])<.1
            assert abs(g['ranking'][1]-g['collection'][1])<.1
            assert not g['overflow']
            if not g['hidden']:assert g['unlock'][1]+g['unlock'][3]<=g['ranking'][1]
        check()
        page.screenshot(path=str(OUT/f'ranking-fixed-start-{width}.png'))
        count=page.evaluate('WAKPPU_BALLS.length')
        for _ in range(count-1):
            page.locator('#unlockBtn').click();check()
        expect(page.locator('#unlockBtn')).to_be_hidden();check()
        for index in (0,9,12,count-1):
            page.locator('#collectionBtn').click()
            target=index//9
            while int(page.locator('#collectionPage').inner_text().split('/')[0])-1>target:page.locator('#collectionPrev').click()
            while int(page.locator('#collectionPage').inner_text().split('/')[0])-1<target:page.locator('#collectionNext').click()
            page.locator(f'[data-detail="{index}"]').click()
            button=page.locator('[data-action="select"]')
            if button.count():button.click()
            else:page.locator('#collectionClose').click()
            check()
        page.locator('#rankingBtn').click();expect(page.locator('#ranking')).to_be_visible()
        page.locator('[data-close="ranking"]').click();check()
        page.screenshot(path=str(OUT/f'ranking-fixed-end-{width}.png'))
        assert not errors,errors
        print(width,'PASS: all unlocks, selections, hidden unlock button and ranking dialog; stable equal-width navigation',flush=True)
        context.close()
    browser.close()
