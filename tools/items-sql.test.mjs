import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(process.env.WAKPPU_TEST_NODE_PACKAGE||new URL('./test-results/sql-check/package.json',import.meta.url));
const {PGlite}=require('@electric-sql/pglite');
const admin='00000000-0000-0000-0000-000000000001',player='00000000-0000-0000-0000-000000000002';
test('items SQL: atomic draw, pity, inventory, effects, stale-save rejection and repeated requests',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon;create role authenticated;create schema auth;
   create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
   create function auth.uid() returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;
   create table players(user_id uuid primary key,nickname text,role text,updated_at timestamptz default now());
   create table game_states(user_id uuid primary key references players,gold bigint default 0,rebirths smallint default 0,unlocked_ball_ids jsonb default '["yellow"]',discovered_ball_ids jsonb default '["yellow"]',selected_ball_id text default 'yellow',honey_expires_at timestamptz,updated_at timestamptz default now());
   create table moderation_cases(user_id uuid primary key,status text default 'active',suspicion_score integer default 0,strikes integer default 0,suspended_until timestamptz,last_reason text,updated_at timestamptz default now());
   create table admin_audit_logs(id bigint generated always as identity primary key,admin_user_id uuid,target_user_id uuid,action text,reason text,details jsonb,created_at timestamptz default now());
   insert into players values('${admin}','관리자','admin',now()),('${player}','플레이어','player',now());
   insert into game_states(user_id) values('${admin}'),('${player}');`);
  for(const name of ['20261004_accounts_and_rankings.sql','20261004_admin_exact_gold.sql','20261005_ranking_visibility_bans.sql','20261005_z_gold_event.sql','20261006_rebirth_100_big_gold.sql','20261007_hammer_level_30.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));
  // Isolate the base save and event wrappers from the unrelated guest cleanup fixture.
  await db.exec("create or replace function public.wakppu_api(b jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$begin if b->>'action'='mark_first_play' then return '{}'::jsonb; end if; return public.wakppu_api_before_events(b); end$$;");
  await db.exec(await readFile(new URL('../supabase/migrations/20261007_admin_ball_event.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../supabase/migrations/20261006_z_whitehole.sql',import.meta.url),'utf8'));
  const tierSql=await readFile(new URL('../supabase/migrations/20261009_transcendent_balls.sql',import.meta.url),'utf8');
  await db.exec(tierSql);await db.exec(tierSql);
  const sql=await readFile(new URL('../supabase/migrations/20261008_gem_coating.sql',import.meta.url),'utf8');
  await db.exec(sql);await db.exec(sql);
  async function rpc(user,body){await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify(user?{sub:user,is_anonymous:false}:{})]);return (await db.query('select wakppu_api($1::jsonb) as data',[JSON.stringify(body)])).rows[0].data;}
  const itemSql=await readFile(new URL('../supabase/migrations/20261012_items_inventory.sql',import.meta.url),'utf8');
  await db.exec(itemSql);await db.exec(itemSql);
  const get=()=>rpc(player,{action:'items'});
  const send=async(action,args={})=>rpc(player,{action,...args,request_id:crypto.randomUUID(),item_revision:(await get()).revision});
  await get();
  await db.exec("update game_states set gold=100000000000000000001 where user_id='"+player+"';update wakppu_items set pity=99 where user_id='"+player+"'");
  const request={action:'item_draw',count:5,request_id:crypto.randomUUID(),item_revision:0};
  const drawn=await rpc(player,request);assert.equal(drawn.results.length,5);assert.equal(drawn.results[0],'transcendent_wax_heart');assert.equal(drawn.gold,'78000000000000000001');
  assert.deepEqual(await rpc(player,request),drawn);
  assert.equal(Object.values(drawn.inventory).reduce((a,b)=>a+b,0),5);
  await assert.rejects(rpc(player,{action:'save_progress',item_revision:0,gold:'100000000000000000001',admin_revision:0,rebirths:0,unlocked_ball_ids:['yellow'],selected_ball_id:'yellow'}));
  await assert.rejects(rpc(null,{action:'items'}));
  await assert.rejects(send('item_draw',{count:2}));
  await db.exec("update wakppu_items set inventory=inventory||'{\"hero_golden_honey\":3,\"common_crack_piece\":2,\"legendary_golden_coating\":2}'::jsonb where user_id='"+player+"'");
  let used=await send('item_use',{item_id:'hero_golden_honey'});const expiry=used.effects.hero_golden_honey.expires_at;
  used=await send('item_use',{item_id:'hero_golden_honey'});assert.equal(used.effects.hero_golden_honey.expires_at,expiry+900000);
  await send('item_use',{item_id:'common_crack_piece'});await send('item_use',{item_id:'legendary_golden_coating'});
  const hit=await send('item_hit');assert.equal(hit.clicks,3);assert.equal(hit.effects.common_crack_piece.remaining,29);assert.equal(hit.reward,'0');
  const end=await send('item_hit');assert.equal(end.reward,'8');assert.equal(end.effects.legendary_golden_coating.remaining,19);
  const useRequest={action:'item_use',item_id:'common_crack_piece',request_id:crypto.randomUUID(),item_revision:end.revision};
  const charged=await rpc(player,useRequest);assert.equal(charged.effects.common_crack_piece.remaining,58);assert.deepEqual(await rpc(player,useRequest),charged);
  await rpc(player,{action:'save_progress',item_revision:charged.revision,gold:end.gold,admin_revision:0,rebirths:1,unlocked_ball_ids:['yellow'],selected_ball_id:'yellow'});
  const reborn=await get();assert.deepEqual(reborn.effects,{});assert.equal(reborn.pity,charged.pity);assert.deepEqual(reborn.inventory,charged.inventory);
  const defs=(await import('./items-service.mjs')).itemData;
  for(const d of defs.list){const row=(await db.query('select * from wakppu_item_defs where item_id=$1',[d.id])).rows[0];assert.equal(row.value,d.value);assert.equal(row.seconds,d.seconds);assert.equal(row.charges,d.count);}
  await db.exec("update game_states set gold=0 where user_id='"+player+"'");await assert.rejects(send('item_draw',{count:1}));
  await db.exec("update game_states set hammer_owned=true,hammer_level=30,honey_expires_at=now()+interval '1 minute' where user_id='"+player+"';update wakppu_items set effects=jsonb_build_object('transcendent_wax_heart',jsonb_build_object('expires_at',floor(extract(epoch from clock_timestamp())*1000)+60000)) where user_id='"+player+"'");
  const event=(await rpc(admin,{action:'admin_ball_event',mode:'start',duration_seconds:60,delay_seconds:0})).admin_ball_event;
  const eventRequest={action:'item_hit',event_id:event.id,request_id:crypto.randomUUID(),item_revision:(await get()).revision};
  const eventHit=await rpc(player,eventRequest);assert.equal(eventHit.reward,'120');assert.deepEqual(await rpc(player,eventRequest),eventHit);
  await assert.rejects(send('item_hit',{event_id:'nonexistent'}));
  await db.exec('set role authenticated');await assert.rejects(db.exec("update wakppu_items set pity=99"));await db.exec('reset role');
 }finally{await db.close();}
});
