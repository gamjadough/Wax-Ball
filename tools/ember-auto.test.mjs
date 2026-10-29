import {test} from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';
import {readFile} from 'node:fs/promises';import {createRequire} from 'node:module';
import {createStore} from './admin-service.mjs';import {execute} from './ember-auto-service.mjs';
import {decorState} from './halloween-decor-service.mjs';import {itemState} from './items-service.mjs';import {guardState} from './input-guard-service.mjs';
const require=createRequire(process.env.WAKPPU_TEST_NODE_PACKAGE||new URL('./test-results/sql-check/package.json',import.meta.url));const {PGlite}=require('@electric-sql/pglite');
const admin='00000000-0000-0000-0000-000000000001',player='00000000-0000-0000-0000-000000000002';
const sql=n=>readFile(new URL('../supabase/migrations/'+n,import.meta.url),'utf8');

test('local auto attacks: real damage/rewards, cooldown, replay, ownership, no synthetic evidence or source spoof',()=>{
 const store=createStore(),p=store.players[1];store.sleep_now_ms=Date.parse('2026-10-25T03:00:00Z');store.input_now_ms=10000;
 const pet=decorState(p);pet.owned.pumpkin_ember=true;pet.equipped='pumpkin_ember';p.state.hammer_owned=true;p.state.hammer_level=30;
 const req={action:'ember_auto_hit',hit_action:'item_hit',request_id:crypto.randomUUID(),item_revision:0};
 const r=execute(store,p,req),gold=p.state.gold;assert.equal(r.reward,'1');assert.deepEqual(execute(store,p,req),r);assert.equal(p.state.gold,gold);assert.equal(guardState(p,10000).hits.length,0);
 assert.throws(()=>execute(store,p,{...req,request_id:crypto.randomUUID(),item_revision:1}),{status:429});
 store.input_now_ms+=1000;const manual=execute(store,p,{action:'item_hit',hit_source:'ember_auto',request_id:crypto.randomUUID(),item_revision:itemState(p).revision});assert.equal(manual.reward,'1');assert.equal(guardState(p,11000).hits.length,1);
 pet.equipped=null;assert.throws(()=>execute(store,p,{...req,request_id:crypto.randomUUID()}),{status:403});
});

test('real SQL: one-second server cap, exact same-ID recovery, shared cooldown, gem reward, guards and private journal',async()=>{
 const db=new PGlite();try{
  const fixture=await readFile(new URL('./items-sql.test.mjs',import.meta.url),'utf8');await db.exec(fixture.match(/await db\.exec\(`([\s\S]*?)`\);/)[1].replaceAll('${admin}',admin).replaceAll('${player}',player));
  for(const n of ['20261004_accounts_and_rankings.sql','20261004_admin_exact_gold.sql','20261005_ranking_visibility_bans.sql','20261005_z_gold_event.sql','20261006_rebirth_100_big_gold.sql','20261007_hammer_level_30.sql'])await db.exec(await sql(n));
  await db.exec("create or replace function public.wakppu_api(b jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$begin if b->>'action'='mark_first_play' then return '{}'::jsonb;end if;return public.wakppu_api_before_events(b);end$$;");
  for(const n of ['20261007_admin_ball_event.sql','20261006_z_whitehole.sql','20261009_transcendent_balls.sql','20261008_gem_coating.sql','20261012_items_inventory.sql','20261015_items_30.sql','20261016_halloween_reward.sql','20261017_halloween_admin_access.sql','20261019_items_remake.sql','20261016083414_admin_content_access.sql','20261016090507_hammer_level_selection.sql','20261016091945_hammer_level_zero.sql'])await db.exec(await sql(n));
  await db.exec(`create table auth.users(id uuid primary key,is_anonymous boolean default false,email text,email_confirmed_at timestamptz,created_at timestamptz default now(),raw_user_meta_data jsonb default '{}');`);
  for(const n of ['20261019084353_manual_bank_orders.sql','20261020010000_supporter_gold_bonus.sql','20261020010100_supporter_gold_paths.sql','20261020085313_input_guard.sql','20261022081610_multi_position_input_guard.sql','20261022093644_halloween_decoration_box.sql','20261022095516_halloween_decor_admin_access.sql','20261022102841_halloween_pet_traits.sql','20261025054917_blue_gems.sql','20261025061053_ember_auto_attack.sql'])await db.exec(await sql(n));
  async function rpc(action,more={},user=player,anonymous=false){await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify(user?{sub:user,is_anonymous:anonymous}:{})]);return (await db.query('select wakppu_api($1::jsonb) r',[JSON.stringify({action,...more})])).rows[0].r;}
  const get=()=>rpc('items');const send=async(more={})=>rpc('ember_auto_hit',{hit_action:'item_hit',request_id:crypto.randomUUID(),item_revision:(await get()).revision,...more});
  await rpc('halloween_cosmetics');await assert.rejects(send(),{code:'PT403'});
  await db.query("update wakppu_halloween_cosmetics set owned='{"+'"pumpkin_ember":true}'+"',equipped='pumpkin_ember' where user_id=$1",[player]);
  await db.query("update game_states set hammer_owned=true,hammer_level=30,hammer_selected_level=30 where user_id=$1",[player]);
  assert.equal((await get()).pet_timing.animation,1);assert.equal((await rpc('halloween_cosmetics')).pet_version,2);
  const request={hit_action:'item_hit',request_id:crypto.randomUUID(),item_revision:(await get()).revision};
  const first=await rpc('ember_auto_hit',request);assert.equal(first.reward,'1');assert.equal(first.blue_gems.balance,'1');
  assert.deepEqual(await rpc('ember_auto_hit',request),first);assert.equal((await get()).gold,first.gold);
  await assert.rejects(send(),{code:'PT429'});await assert.rejects(rpc('ember_auto_hit',{...request,hit_action:'limited_hit'}),{code:'PT409'});
  assert.equal((await db.query('select cardinality(hits) n from wakppu_input_guard where user_id=$1',[player])).rows[0].n,0);
  await rpc('item_hit',{request_id:crypto.randomUUID(),item_revision:(await get()).revision,hit_source:'ember_auto'});
  assert.equal((await db.query('select cardinality(hits) n from wakppu_input_guard where user_id=$1',[player])).rows[0].n,1);
  await db.query("update wakppu_halloween_cosmetics set ember_last_hit_at=clock_timestamp()-interval '2 seconds' where user_id=$1",[player]);
  await send();assert.equal((await rpc('blue_gems')).balance,'3');
  await db.query("update wakppu_halloween_cosmetics set equipped=null where user_id=$1",[player]);await assert.rejects(send(),{code:'PT403'});
  await db.query("update wakppu_halloween_cosmetics set equipped='pumpkin_ember' where user_id=$1",[player]);
  await db.exec('update server_settings set maintenance=true');await assert.rejects(send(),{code:'PT503'});await db.exec('update server_settings set maintenance=false');
  await db.query("insert into moderation_cases(user_id,status) values($1,'banned') on conflict(user_id) do update set status='banned'",[player]);await assert.rejects(send(),{code:'PT403'});
  await assert.rejects(rpc('ember_auto_hit',{hit_action:'item_hit',request_id:crypto.randomUUID()},null),{code:'PT401'});
  await db.exec('set role authenticated');await assert.rejects(db.exec('select * from wakppu_ember_hit_requests'),{code:'42501'});await assert.rejects(db.exec("select wakppu_api_before_ember_auto('{}')"),{code:'42501'});
 }finally{await db.close();}
});

test('foreground scheduler: one in flight, pause/hidden/menu/focus/page lifecycle never queue catch-up hits',async()=>{
 const source=await readFile(new URL('../wakppuball/js/ember-auto-attack.js',import.meta.url),'utf8');
 const events={},timers=new Map();let id=0,focused=true,modal=false,pet=true,calls=0,run=async()=>true;
 const button={setAttribute(){},hidden:true,textContent:''};const document={hidden:false,hasFocus:()=>focused,querySelector:(selector)=>selector.includes('hdecor-actions')?{append:()=>{}}:modal?{}:null,createElement:()=>button,getElementById:()=>({append(){}}),addEventListener:(n,f)=>events[n]=f};
 const window={WakppuItemGame:{read:()=>({account:'a'})},addEventListener:(n,f)=>events[n]=f,WakppuHalloweenDecor:{equipped:()=>pet?'pumpkin_ember':null},WakppuEmberGame:{ready:()=>true,hit:()=>{calls++;return run();}}};
 vm.runInNewContext(source,{window,document,setTimeout:(f,ms)=>{timers.set(++id,{f,ms});return id;},clearTimeout:id=>timers.delete(id)});events.DOMContentLoaded();
 const settle=()=>new Promise(r=>setImmediate(r));const tick=async()=>{const pending=[...timers.values()];timers.clear();for(const {f,ms}of pending){assert.equal(ms,1000);f();}await settle();};
 modal=true;await tick();assert.equal(calls,0);modal=false;let release;run=()=>new Promise(r=>release=r);await tick();assert.equal(calls,1);events['wakppu-pet-synced']();assert.equal(timers.size,0);release();await settle();
 window.WakppuEmberAuto.toggle();assert.equal(timers.size,0);
 events['wakppu-auth-changed']({detail:{user:{id:'a'}}});assert.equal(window.WakppuEmberAuto.read().paused,true);assert.equal(timers.size,0);
 window.WakppuEmberAuto.toggle();assert.equal(timers.size,1);
 document.hidden=true;events.visibilitychange();assert.equal(timers.size,0);document.hidden=false;events.visibilitychange();assert.equal(timers.size,1);
 focused=false;events.blur();assert.equal(timers.size,0);focused=true;events.focus();assert.equal(timers.size,1);
 events.pagehide();assert.equal(timers.size,0);events.pageshow();assert.equal(timers.size,1);
 pet=false;events['wakppu-pet-synced']();assert.equal(timers.size,0);assert.equal(calls,1);
});
