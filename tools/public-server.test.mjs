import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {test} from 'node:test';
import {buildPublicSite} from './build-public-site.mjs';
const require=createRequire(process.env.WAKPPU_TEST_NODE_PACKAGE||new URL('./test-results/tester-runtime/package.json',import.meta.url));
const {PGlite}=require('@electric-sql/pglite');
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
export async function publicFixture(){
 const db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;create schema extensions;create schema cron;
 create table auth.users(id uuid primary key,aud text,role text,is_anonymous boolean default false,email text,email_change text default '',email_confirmed_at timestamptz,created_at timestamptz default now(),updated_at timestamptz default now(),raw_user_meta_data jsonb default '{}');
 create table auth.sessions(id uuid primary key,user_id uuid references auth.users);
 create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
 create function auth.uid() returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;
 create table cron.job(jobname text,active boolean default true);
 create function cron.schedule(text,text,text) returns bigint language sql as $$select 1::bigint$$;`);
 await db.exec(await read('supabase/public-server/migrations/20261118121025_public_server_baseline.sql'));
 await db.exec(await read('supabase/public-server/public-policy.sql'));
 async function rpc(u,b,anonymous=false){await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify(u?{sub:u,role:'authenticated',is_anonymous:anonymous}:{})]);return(await db.query('select public.wakppu_api($1::jsonb) r',[JSON.stringify(b)])).rows[0].r;}
 return {db,rpc};
}
test('public entry excludes seasonal code and isolates browser saves',async()=>{
 const html=await buildPublicSite();
 assert.match(html,/<base href="..\/wakppuball\/">/);
 assert.match(html,/wakppuball-public\/server-config/);
 for(const script of [...html.matchAll(/<script src="([^"]+)"/g)].map(m=>m[1]))assert.doesNotMatch(script,/halloween|pumpkin|limited-ui|limited-data|ember-auto/);
 assert.doesNotMatch(html,/id="halloweenScenery"/);
 assert.match(await read('wakppuball/js/game.js'),/WAKPPU_SERVER\?\.saveKey/);
 assert.match(await read('wakppuball/js/account.js'),/config.redirectUrl/);
});
test('fresh schema, gameplay, catalogs and authority boundaries',async()=>{
 const {db,rpc}=await publicFixture();
 try{
 assert.equal((await db.query('select count(*) n from players')).rows[0].n,0);
 assert.equal((await db.query('select count(*) n from wakppu_purchase_orders')).rows[0].n,0);
 assert.equal((await db.query('select enabled from wakppu_purchase_config')).rows[0].enabled,false);
 assert.equal((await db.query("select count(*) n from wakppu_profile_card_defs where card_id like 'halloween_%'")).rows[0].n,0);
 const player=crypto.randomUUID(),admin=crypto.randomUUID(),guest=crypto.randomUUID();
 await db.query("insert into auth.users(id,email,email_confirmed_at,is_anonymous) values($1,'test@example.invalid',now(),false),($2,'admin@example.invalid',now(),false),($3,null,null,true)",[player,admin,guest]);
 await db.query("update players set role='admin' where user_id=$1",[admin]);
 const boot=await rpc(player,{action:'bootstrap'});assert.equal(boot.state.gold,'0');
 const items=await rpc(player,{action:'items'});assert.ok(items.inventory);
 const hit=await rpc(player,{action:'item_hit',ball_id:'yellow',item_revision:items.revision,request_id:crypto.randomUUID()});assert.ok(hit.revision>items.revision);
 const skins=await rpc(player,{action:'skins'});assert.ok(skins.owned);assert.ok(skins.equipped);
 const gems=await rpc(player,{action:'gem_balls'});assert.equal(gems.selected,null);
 const profile=await rpc(admin,{action:'profile_status'});assert.ok(profile);
 const custom=await rpc(admin,{action:'custom_status'});assert.equal(custom.plan,'all');assert.ok(custom.balls.includes('admin-event'));
 assert.ok(custom.presets.every(x=>!x.includes('pumpkin')));assert.ok(!custom.balls.includes('halloween-pumpkin-2026'));
 for(const who of [player,admin,guest])for(const action of ['limited','limited_buy','limited_select','limited_hit','pumpkin_skins','pumpkin_skin_equip','pumpkin_scare_disable_buy','halloween_cosmetics','halloween_decor_equip','halloween_goods_use','ember_auto_hit'])
  await assert.rejects(rpc(who,{action},who===guest),e=>e.code==='PT403');
 await assert.rejects(rpc(player,{action:'admin_background',mode:'halloween'}),e=>e.code==='PT403');
 await assert.rejects(rpc(player,{action:'purchase_order',product_id:'starlight_skin',depositor:'테스트',request_id:crypto.randomUUID()}),e=>e.code==='PT409');
 const exposed=(await db.query("select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and has_function_privilege('authenticated',p.oid,'execute')")).rows.map(r=>r.proname);
 assert.deepEqual(exposed,['wakppu_api']);
 assert.equal((await db.query("select count(*) n from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity")).rows[0].n,0);
 console.log('public bootstrap keys',Object.keys(boot));console.log('public catalogs verified');
 }finally{await db.close();}
});
