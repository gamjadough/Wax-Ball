// Build only the public entry point; share versioned assets with the friends site.
// Run whenever wakppuball/index.html changes. No duplicated game logic or media.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url),read=p=>readFile(new URL(p,root),'utf8');
export async function buildPublicSite(){
 let html=await read('wakppuball/index.html');
 html=html.replace('<title>왁뿌볼</title>','<title>왁뿌볼 · 공개 서버</title>\n  <base href="../wakppuball/">');
 html=html.replace('@supabase/supabase-js@2"','@supabase/supabase-js@2.57.4"');
 const omitted=['limited-data','limited-ui','eclipse-pumpkin','pumpkin-skin-art','pumpkin-skins','halloween-effects','pumpkin-skins-ui','halloween-decor-data','halloween-decor-effects','halloween-decor-ui','halloween-shop-tabs','halloween-theme','halloween-goods','ember-auto-attack','purchase-ui','purchase-effects','admin-purchase-notices','custom-ball','custom-image-loader','auto-rebirth','admin-paid'];
 html=html.replace(/^.*<script src="js\/([^"?]+)\.js[^\n]*\n/gm,(line,id)=>omitted.includes(id)?'':line);
 html=html.replace(/^.*href="(?:halloween[^"]*|pumpkin-skins\.css[^"]*)"[^\n]*\n/gm,'');
 html=html.replace(/src="js\/server-config\.js[^"]*"/,'src="../wakppuball-public/server-config.js?v=20261122-launch2"');
 html=html.replace(/(<script src="js\/gem-ball-data[^\n]*\n)/,'$1  <script src="../wakppuball-public/public-compat.js?v=20261122-launch2"></script>\n');
 html=html.replace(/  <div id="halloweenScenery"[\s\S]*?  <\/div>\r?\n/,'');
 html=html.replace(/<option value="auto">[^<]*<\/option>/,'').replace(/<option value="halloween">[^<]*<\/option>/,'');
 html=html.replace(/모든 사용자에게 적용됩니다\. 2026년 자동 모드는[^<]*\./,'공개 서버는 기본 배경을 사용합니다.');
 // Keep hidden shop/currency anchors used by shared UI event handlers.
 html=html.replace(/<body>/,'<body data-server="public">');
 html=html.replace(/<button id="shopPremiumTab"[^>]*>[\s\S]*?<\/button>/,'').replace(/ *<section id="shopPremium"[^>]*>[\s\S]*?<\/section>\r?\n/,'');
 html=html.replace(/^.*href="(?:purchases|purchase-notices|custom-ball)\.css[^\n]*\n/gm,'');
 html=html.replace('</head>','  <style>#halloweenCurrency,#inventoryPetsTab,[data-filter="limited"]{display:none!important}</style>\n</head>');
 // A public visitor may already have cached the friends site's shared scripts.
 // Content hashes make each generated entry point load the matching revision.
 for(const match of [...html.matchAll(/(?:src|href)="((?:js\/[^"?]+\.js|[^"/?]+\.css))\?[^\"]*"/g)]){
  const hash=createHash('sha256').update(await read('wakppuball/'+match[1])).digest('hex').slice(0,12);
  html=html.replace(match[0],match[0].replace(/\?[^\"]*/, '?v='+hash));
 }
 await mkdir(new URL('wakppuball-public/',root),{recursive:true});
 await writeFile(new URL('wakppuball-public/index.html',root),html);
 return html;
}
if(process.argv[1]&&new URL('file:'+process.argv[1].replaceAll('\\','/')).href===import.meta.url)await buildPublicSite();
