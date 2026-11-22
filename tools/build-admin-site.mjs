import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url),read=p=>readFile(new URL(p,root),'utf8');
export async function buildAdminSite(){
 const game=await read('wakppuball/index.html');
 let panel=game.slice(game.indexOf('  <div id="admin"'),game.indexOf('  <div id="adminBallEventBanner"'));
 panel=panel.replace('class="modal"','class="admin-page"').replace('role="dialog" aria-modal="true"','role="region"').replace('관리자 패널','서버 관리').replace('<button data-close="admin" class="btn small">닫기</button>','<a class="btn small" data-game-link>게임으로</a>');
 const scripts=['gold-format','balls-data','sleep-hours','admin-panel','event-schedule','weekly-events','admin-keepsake','admin-paid','guest-lifecycle','input-guard-admin','admin-purchase-notices'];
 const tag=async(p,src)=>'<script src="'+src+'?v='+createHash('sha256').update(await read(p)).digest('hex').slice(0,12)+'"></script>';
 const purchase=await read('wakppuball/js/purchase-ui.js');
 const helpers=purchase.slice(purchase.indexOf(' const states='),purchase.indexOf(' function cosmetics()'));
 const methods=purchase.slice(purchase.indexOf(' async function adminLoad('),purchase.indexOf(" document.addEventListener('DOMContentLoaded',()=>{"));
 const setup=purchase.slice(purchase.indexOf("  const admin=node('section')"),purchase.indexOf("  new MutationObserver"));
 const adminPurchases=`// Generated from purchase-ui.js by build-admin-site.mjs. No player shop or game effects.
(() => {
 const $=id=>document.getElementById(id),game=()=>window.WakppuItemGame?.read();
 let config=null,adminOffset=0,adminBusy=false,adminOwner=null,adminRead=0,adminNoticeId=new URLSearchParams(location.search).get('order');
 const refresh=async()=>{};
${helpers}
${methods}
 document.addEventListener('DOMContentLoaded',()=>{
${setup}
 window.addEventListener('wakppu-account-restored',()=>{config=null;++adminRead;adminOffset=0;});
 window.addEventListener('wakppu-auth-changed',()=>{config=null;++adminRead;adminOffset=0;$('purchaseAdminOrders').replaceChildren();$('purchaseConfigForm').reset();delete $('purchaseConfigForm').dataset.dirty;});
 window.addEventListener('wakppu-admin-locked',()=>{config=null;++adminRead;adminOffset=0;adminNoticeId=null;$('purchaseAdminOrders').replaceChildren();$('purchaseConfigForm').reset();delete $('purchaseConfigForm').dataset.dirty;});
 new MutationObserver(()=>{if(!$('admin').hidden)adminLoad();}).observe($('admin'),{attributes:true,attributeFilter:['hidden']});
 });
 window.WakppuPurchases={refresh:()=>adminLoad(),openNotice:async id=>{adminNoticeId=id;document.querySelector('[data-page="payments"]').click();await adminLoad();}};
})();`;
 await mkdir(new URL('wakppuball-admin/',root),{recursive:true});
 await writeFile(new URL('wakppuball-admin/admin-purchases.js',root),adminPurchases);
 let html=`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="robots" content="noindex,nofollow"><title>왁뿌볼 관리</title>
 <link rel="stylesheet" href="../wakppuball/style.css"><link rel="stylesheet" href="../wakppuball/admin-selection.css"><link rel="stylesheet" href="../wakppuball/purchases.css"><link rel="stylesheet" href="../wakppuball/input-guard.css"><link rel="stylesheet" href="../wakppuball/guest-lifecycle.css"><link rel="stylesheet" href="admin.css">
 </head><body><div class="admin-shell">
 <header class="admin-header"><div><h1>왁뿌볼 관리</h1><p><span id="serverName"></span> · <span id="serverHealth">연결 확인 중</span></p><p id="adminIdentity"></p></div><div class="admin-header-actions"><label>관리 대상 <select id="serverSelect"><option value="public">공개 서버</option><option value="friends">친구 서버</option></select></label><a class="btn" data-game-link>게임 열기</a><button id="adminLogout" class="btn" hidden>로그아웃</button></div></header>
 <section id="loginSection" class="admin-login"><h2>관리자 로그인</h2><p>선택한 서버의 관리자 계정으로 로그인하세요.</p><form id="adminLoginForm"><label>이메일<input id="adminEmail" type="email" autocomplete="username" required></label><label>비밀번호<input id="adminPassword" type="password" autocomplete="current-password" required></label><button id="adminLogin" type="submit" class="btn primary">로그인</button></form><p id="loginStatus" role="status"></p></section>
 <div class="admin-layout"><nav id="adminNav" aria-label="관리 메뉴" hidden>${[['players','플레이어'],['events','이벤트'],['server','점검·공지·배경'],['payments','결제·입금'],['guests','미플레이 계정'],['logs','작업·감지 기록'],['preview','게임 테스트']].map(([p,t])=>'<button class="btn" data-page="'+p+'">'+t+'</button>').join('')}<button id="adminBtn" class="btn" hidden>플레이어 목록 새로고침</button></nav>${panel}</div>
 <div id="serverAnnouncement" hidden><span id="serverAnnouncementText"></span><button id="serverAnnouncementClose">닫기</button></div></div>
 <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4"></script>
 <script src="../wakppuball-public/server-config.js"></script><script>window.WAKPPU_PUBLIC_CONFIG=window.WAKPPU_SERVER;</script><script src="../wakppuball/js/server-config.js"></script><script>window.WAKPPU_FRIENDS_CONFIG=window.WAKPPU_SERVER;window.WAKPPU_SERVER=window.WAKPPU_PUBLIC_CONFIG;</script>
 ${await tag('wakppuball-admin/config.js','config.js')}
 ${await tag('wakppuball/js/friend-gate.js','../wakppuball/js/friend-gate.js')}
 ${await tag('wakppuball/js/account.js','../wakppuball/js/account.js')}
 ${await tag('wakppuball-admin/admin-site.js','admin-site.js')}
 ${(await Promise.all(scripts.map(p=>tag('wakppuball/js/'+p+'.js','../wakppuball/js/'+p+'.js')))).join('\n')}
 ${await tag('wakppuball-admin/admin-purchases.js','admin-purchases.js')}
 </body></html>`;
 html=html.replace('href="admin.css"','href="admin.css?v='+createHash('sha256').update(await read('wakppuball-admin/admin.css')).digest('hex').slice(0,12)+'"');
 await writeFile(new URL('wakppuball-admin/index.html',root),html);
 return html;
}
if(process.argv[1]&&new URL('file:'+process.argv[1].replaceAll('\\','/')).href===import.meta.url)await buildAdminSite();
