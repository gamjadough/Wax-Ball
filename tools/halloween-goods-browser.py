"""Seasonal purchases, independent potion effects and permanent cosmetics on touch layouts."""
import os,sys,socket,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,os.environ['WAKPPU_TEST_PYTHON_PATH'])
from playwright.sync_api import sync_playwright,expect
with sync_playwright() as p:
 browser=p.chromium.launch(channel='msedge',headless=True)
 for w,h,reduced in [(320,640,False),(844,390,False),(390,844,True),(1200,900,False)]:
  with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
  server=subprocess.Popen(['node',str(ROOT/'tools/local-server.mjs')],cwd=ROOT,env=dict(os.environ,WAKPPU_LOCAL_PORT=str(port),WAKPPU_LOCAL_HALLOWEEN_GOODS_PREVIEW='1',WAKPPU_LOCAL_SLEEP_TIME='2026-10-29T03:00:00Z'),stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,encoding='utf8')
  try:
   assert server.stdout.readline().startswith('Local preview:');server.stdout.readline();password=server.stdout.readline().strip().split(': ',1)[1]
   base=f'http://127.0.0.1:{port}'
   ctx=browser.new_context(viewport={'width':w,'height':h},has_touch=True,is_mobile=w<900,reduced_motion='reduce' if reduced else 'no-preference')
   ctx.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base) else r.fulfill(status=200,body=''))
   page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('dialog',lambda d:d.accept())
   page.goto(base,wait_until='networkidle');page.evaluate("async()=>{await WakppuAuth.signIn('guest','');await WakppuItemGame.restore();await WakppuHalloweenGoods.refresh()}")
   def state():return page.evaluate("WakppuAuth.invoke('halloween_goods')")
   page.locator('#halloweenCurrency').tap();shop=page.locator('#halloweenGoodsShop');expect(shop.locator('.hgoods-card')).to_have_count(9)
   lost=[False]
   def drop(route):
    if route.request.post_data_json.get('action')=='halloween_goods_buy' and not lost[0]:route.fetch();lost[0]=True;route.abort()
    else:route.continue_()
   page.route('**/local/api',drop)
   for id in ['witch_potion','ghost_potion','pumpkin_potion','witch_potion','halloween_witch','halloween_ghost','halloween_pumpkin','halloween_witch_title','halloween_ghost_title','halloween_pumpkin_title']:
    b=shop.locator('[data-goods-id="'+id+'"]');expect(b).to_be_enabled();b.tap();page.wait_for_function("!document.querySelector('#halloweenGoodsShop [data-goods-id=witch_potion]').disabled")
   assert lost[0];page.unroute('**/local/api',drop);s=state();assert s['tokens']=='3900' and s['stock']['witch_potion']==2,s
   page.locator('[data-close=shop]').tap();page.locator('#inventoryBtn').tap();page.locator('#inventoryItemsTab').tap();page.locator('[data-filter=limited]').tap()
   inv=page.locator('#halloweenGoodsInventory');expect(inv).to_be_visible();expect(page.locator('#inventoryList')).to_be_hidden()
   assert page.locator('[data-filter=transcendent]').evaluate("e=>e.nextElementSibling.dataset.filter==='limited'")
   expect(inv.locator('.hgoods-card')).to_have_count(9)
   for id in ['witch_potion','ghost_potion','pumpkin_potion','witch_potion']:
    b=inv.locator('[data-goods-id="'+id+'"]');expect(b).to_be_enabled();assert b.evaluate('e=>parseFloat(getComputedStyle(e).minHeight)>=44');b.tap();page.wait_for_function("!document.querySelector('#halloweenGoodsInventory [data-goods-id=halloween_witch]').disabled")
   s=state();assert s['stock']['witch_potion']==0 and s['expires']['witch_potion']-s['server_time']>3500000
   assert s['timing']=={'animation':2,'respawn':2}
   assert page.evaluate("WakppuHalloweenGoods.timing({animation:1.5,respawn:2},{timing:{animation:2,respawn:2}})")=={'animation':3,'respawn':4}
   for kind,ids in [('card',['halloween_witch','halloween_ghost','halloween_pumpkin']),('title',['halloween_witch_title','halloween_ghost_title','halloween_pumpkin_title'])]:
    for id in ids:
     b=inv.locator('[data-goods-id="'+id+'"]');b.tap();expect(b).to_have_text('장착 해제');assert page.evaluate("WakppuAuth.invoke('profile_status').then(s=>s."+('equipped' if kind=='card' else 'title_equipped')+")")==id
     b.tap();expect(b).to_have_text('장착')
   # Card loads at native ratio and constrained mobile width; no missing assets.
   imgs=inv.locator('img');assert imgs.count()==3
   for img in imgs.all():img.scroll_into_view_if_needed();img.evaluate('e=>e.decode()');assert img.evaluate('e=>e.naturalWidth===1536&&e.naturalHeight===1024')
   assert page.locator('#itemsModal .sheet').evaluate('e=>e.scrollWidth<=e.clientWidth+1')
   page.screenshot(path=str(ROOT/f'tools/test-results/halloween-goods-{w}x{h}.png'))
   page.locator('[data-filter=transcendent]').tap();expect(inv).to_be_hidden();expect(page.locator('#inventoryList')).to_be_visible();page.locator('[data-filter=limited]').tap();expect(inv).to_be_visible()
   page.locator('#inventorySkinsTab').tap();expect(inv).to_be_hidden();page.locator('#inventoryProfileCardsTab').tap();expect(page.locator('#inventoryProfileCardsPage')).to_be_visible()
   page.locator('#itemsClose').tap()
   page.evaluate("window.goodsBreaks=[];const old=WakppuHalloweenGoods.timing;WakppuHalloweenGoods.timing=(b,s)=>{const r=old(b,s);goodsBreaks.push(r);return r;};void 0")
   before=int(page.evaluate('WakppuItemGame.read().gold'))
   for i in range(10):
    page.locator('#ballSvg').tap();page.wait_for_function('!WakppuItemGame.read().busy');page.wait_for_timeout(60)
   page.wait_for_function('(before)=>BigInt(WakppuItemGame.read().gold)===BigInt(before)+3n',arg=str(before))
   assert page.evaluate('goodsBreaks.some(t=>t.animation===2&&t.respawn===2)')
   page.reload(wait_until='networkidle');page.wait_for_function('WakppuItemGame.read().ready');page.evaluate('WakppuHalloweenGoods.refresh()')
   assert state()['stock']['halloween_witch']==1
   page.locator('#inventoryBtn').tap();page.locator('#inventoryItemsTab').tap();page.locator('[data-filter=limited]').tap();expect(inv.locator('[data-goods-id=halloween_witch]')).to_be_enabled();page.locator('#itemsClose').tap()
   # Signed-in administrators can use all content with no candy and retain real stock.
   page.evaluate("async password=>{await WakppuAuth.signIn('dodoonglee@gmail.com',password);await WakppuItemGame.restore();await WakppuHalloweenGoods.refresh()}",password)
   page.locator('#inventoryBtn').tap();page.locator('#inventoryItemsTab').tap();page.locator('[data-filter=limited]').tap();expect(inv.locator('.hgoods-card')).to_have_count(9)
   inv.locator('[data-goods-id=ghost_potion]').tap();expect(inv.locator('[data-potion=ghost_potion]')).to_contain_text('효과 남음')
   assert not errors,errors;assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
   print(f'PASS goods {w}x{h} reduced={reduced}: purchases/retry, 3 independent stackable potions, permanent cards/titles equip and unequip, expiry/reload, admin access, mobile scrolling',flush=True);ctx.close()
  finally:server.terminate();server.wait(timeout=10)
 browser.close()
