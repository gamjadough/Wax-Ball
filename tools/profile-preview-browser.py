"""Five fictional profiles, real game UI and opt-in loopback routes. No production traffic."""
import os,sys,socket,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,os.environ.get('WAKPPU_TEST_PYTHON_PATH',str(ROOT/'tools/.test-deps')))
from playwright.sync_api import sync_playwright,expect
with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
server=subprocess.Popen(['node',str(ROOT/'tools/local-server.mjs')],cwd=ROOT,env=dict(os.environ,WAKPPU_LOCAL_PORT=str(port),WAKPPU_LOCAL_PROFILE_PREVIEW='1',WAKPPU_LOCAL_SLEEP_TIME='2026-10-23T03:00:00Z'),stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,encoding='utf8')
try:
 assert server.stdout.readline().startswith('Local preview:');base=f'http://127.0.0.1:{port}'
 with sync_playwright() as p:
  browser=p.chromium.launch(channel='msedge',headless=True)
  for width,height,reduced in [(1200,900,False),(320,640,False),(844,390,False),(390,844,True)]:
   ctx=browser.new_context(viewport={'width':width,'height':height},has_touch=True,is_mobile=width<900,reduced_motion='reduce' if reduced else 'no-preference')
   ctx.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base) else r.fulfill(status=200,body=''))
   page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto(base+'/?preview=profiles',wait_until='networkidle');page.wait_for_function('WakppuItemGame.read().ready')
   expect(page.locator('#ranking')).to_be_visible();expect(page.locator('#rankingList .profile-rank-button')).to_have_count(5);expect(page.locator('#rankingList .ranking-online')).to_have_count(3)
   rows=page.evaluate('WakppuAuth.invoke("rankings")')
   page.screenshot(path=str(ROOT/f'tools/test-results/profile-ranking-{width}x{height}.png'))
   for i,row in enumerate(rows):
    button=page.locator('#rankingList .profile-rank-button').nth(i)
    # Entire row, including padding, rank and Gold; native keyboard activation too.
    if i==0:button.tap(position={'x':8,'y':8})
    elif i==1:button.locator('b').tap()
    elif i==2:button.locator('strong').tap()
    elif i==3:
     box=button.bounding_box();button.tap(position={'x':box['width']-8,'y':box['height']-8})
    else:button.focus();page.keyboard.press('Enter')
    expect(page.locator('#playerProfileDialog')).to_be_visible();expect(page.locator('#profileNickname')).to_have_text(row['nickname']);expect(page.locator('#profilePresence')).to_have_text('온라인' if row['online'] else '오프라인')
    expect(page.locator('#profileRank')).to_have_text(str(i+1)+'위');expect(page.locator('#profileRebirths')).to_have_text(f"{row['rebirths']:,}회")
    assert page.locator('#profileGold').get_attribute('title')==f"{int(row['gold']):,} G"
    text=page.locator('#playerProfileDialog').inner_text();assert '@' not in text and '마지막 접속' not in text
    assert page.locator('#playerProfileDialog').evaluate('(e)=>e.scrollWidth<=e.clientWidth');assert page.locator('#profileClose').bounding_box()['height']>=44
    if i==0:
     page.wait_for_function('document.querySelector("#profileArt").complete&&document.querySelector("#profileArt").naturalWidth>0')
     page.screenshot(path=str(ROOT/f'tools/test-results/player-profile-{width}x{height}.png'))
    if i==1:
     page.evaluate('document.querySelector("#rankingBtn").click()');expect(page.locator('#rankingList .profile-rank-button')).to_have_count(5)
    page.locator('#profileClose').tap();expect(page.locator('#playerProfileDialog')).to_be_hidden();expect(button).to_be_focused()
   # Late responses and HTML-like names must never paint stale or executable content.
   def delayed(route):
    body=route.request.post_data_json
    if body.get('action')=='player_profile' and body.get('nickname')=='slow':
     import time
     time.sleep(.25);route.fulfill(status=200,content_type='application/json',body='{"nickname":"<img src=x onerror=alert(1)>","gold":"1","rebirths":0,"online":false,"discovered_count":1,"discovery_total":1}')
    else:route.continue_()
   page.route('**/local/api',delayed)
   page.evaluate('WakppuProfiles.open("slow")');expect(page.locator('#profileNickname')).to_have_text('<img src=x onerror=alert(1)>');expect(page.locator('#profileNickname img')).to_have_count(0);page.locator('#profileClose').tap()
   page.evaluate('WakppuProfiles.open("slow")');page.locator('#profileClose').tap();page.wait_for_timeout(350);expect(page.locator('#playerProfileDialog')).to_be_hidden()
   page.locator('[data-close="ranking"]').tap();page.locator('#inventoryBtn').tap();page.locator('#inventoryProfileCardsTab').tap();expect(page.locator('#inventoryProfileCardsPage')).to_be_visible()
   before=page.evaluate('WakppuItemGame.read().gold');page.locator('#profileCardUnequip').tap();expect(page.locator('#profileCardEquip')).to_have_text('장착')
   page.locator('#profileCardSelf').tap();expect(page.locator('#profileCardBadge')).to_contain_text('카드 미장착');expect(page.locator('#profileArt')).to_be_hidden();page.locator('#profileClose').tap()
   page.locator('#profileCardEquip').tap();expect(page.locator('#profileCardEquip')).to_have_text('장착 중');assert page.evaluate('WakppuItemGame.read().gold')==before
   page.locator('#profileCardSelf').tap();expect(page.locator('#profileArt')).to_be_visible();page.locator('#profileClose').tap()
   assert page.locator('#profileCardEquip').bounding_box()['height']>=44;assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
   page.screenshot(path=str(ROOT/f'tools/test-results/profile-inventory-{width}x{height}.png'))
   page.locator('#inventorySkinsTab').tap();expect(page.locator('#inventoryProfileCardsPage')).to_be_hidden();expect(page.locator('#inventorySkinsPage')).to_be_visible()
   page.locator('#inventoryPetsTab').tap();expect(page.locator('#inventoryPetsPage')).to_be_visible();page.locator('#inventoryItemsTab').tap();expect(page.locator('#inventoryItemsPage')).to_be_visible()
   page.locator('#itemsClose').tap();page.reload(wait_until='networkidle');page.wait_for_function('WakppuItemGame.read().ready');assert page.evaluate('WakppuAuth.invoke("profile_status").then(x=>x.equipped)')=='wax_beginning'
   # Escape returns focus, and changing accounts dismisses the old player's dialog.
   page.locator('#rankingList .profile-rank-button').first.focus();page.keyboard.press('Space');expect(page.locator('#playerProfileDialog')).to_be_visible();page.keyboard.press('Escape');expect(page.locator('#playerProfileDialog')).to_be_hidden();expect(page.locator('#ranking')).to_be_visible()
   page.locator('#rankingList .profile-rank-button').first.tap();page.evaluate('window.dispatchEvent(new Event("wakppu-account-restored"))');expect(page.locator('#playerProfileDialog')).to_be_hidden()
   assert not errors,errors;ctx.close();print(f'PASS profiles {width}x{height}: 5 players/3 online, all profiles, free equip/reload, privacy, stale replies, tabs, focus, touch layout',flush=True)
  browser.close()
finally:server.terminate();server.wait(timeout=10)
