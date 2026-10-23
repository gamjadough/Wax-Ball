import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createStore} from './admin-service.mjs';
import {createProfileService} from './profile-service.mjs';
const require=createRequire(process.env.WAKPPU_TEST_DEPS||new URL('./test-results/sql-check/package.json',import.meta.url));
const {PGlite}=require('@electric-sql/pglite');
test('normal local profiles contain no sample players and selection preserves progression',()=>{
 const store=createStore(),actor=store.players[1],service=createProfileService(store),before=structuredClone(actor.state);
 assert.equal(service.execute(actor,{action:'profile_status'}).equipped,'wax_beginning');
 service.execute(actor,{action:'profile_equip',card_id:null});
 assert.equal(service.execute(actor,{action:'player_profile',nickname:actor.nickname}).card,null);
 assert.deepEqual(actor.state,before);assert.ok(!store.players.some(p=>p.profileDemo));
});
test('SQL profiles: privacy, huge Gold, default/free persistent cards, server gates, private grants and admin catalog access',async()=>{
 const db=new PGlite(),a='00000000-0000-0000-0000-000000000001',p='00000000-0000-0000-0000-000000000002';
 try{
  await db.exec(`create role anon;create role authenticated;create schema auth;
   create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
   create function auth.uid() returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;
   create table players(user_id uuid primary key,nickname text unique,role text,ranking_hidden boolean default false);
   create table game_states(user_id uuid primary key references players,gold numeric,rebirths integer,discovered_ball_ids jsonb);
   create table wakppu_item_balls(ball_id text primary key);
   create table profile_test_gate(blocked boolean default false);insert into profile_test_gate values(false);
   insert into players values('${a}','admin','admin',false),('${p}','player','player',false);
   insert into game_states values('${a}',1,2,'["yellow"]'),('${p}',1e2469,1000,'["yellow","yellow","fake","blue"]');
   insert into wakppu_item_balls values('yellow'),('blue');
   create function wakppu_admin_content_access() returns boolean language sql stable security definer set search_path=public,pg_temp as $$
    select exists(select 1 from players where user_id=auth.uid() and role='admin') and not coalesce((auth.jwt()->>'is_anonymous')::boolean,false)$$;
   revoke all on function wakppu_admin_content_access() from public,anon,authenticated;
   create function wakppu_api(b jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
   begin
    if b->>'action'='bootstrap' then
     if not exists(select 1 from players where user_id=auth.uid()) then raise sqlstate 'PT401';end if;
     if (select blocked from profile_test_gate) then raise sqlstate 'PT503';end if;
     return '{"ok":true}';
    end if;
    if b->>'action'='rankings' then
     return (select coalesce(jsonb_agg(jsonb_build_object('nickname',p.nickname,'gold',g.gold::text,'rebirths',g.rebirths,'online',p.nickname='player','supporter',true,'premium_supporter',true,'supporter_title_visible',false) order by g.rebirths desc),'[]')
      from game_states g join players p using(user_id) where not p.ranking_hidden);
    end if;
    return '{"legacy":true}';
   end$$;
   revoke all on function wakppu_api(jsonb) from public;grant execute on function wakppu_api(jsonb) to anon,authenticated;`);
  const before=(await db.query("select pg_get_functiondef('wakppu_api(jsonb)'::regprocedure) as s")).rows[0].s;
  await db.exec(await readFile(new URL('../supabase/migrations/20261023100846_player_profiles.sql',import.meta.url),'utf8'));
  const after=(await db.query("select pg_get_functiondef('wakppu_api_before_profiles(jsonb)'::regprocedure) as s")).rows[0].s;
  assert.equal(after.replace('wakppu_api_before_profiles','wakppu_api'),before);
  async function rpc(id,b,anon=false){await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify(id?{sub:id,is_anonymous:anon}:{})]);return (await db.query('select wakppu_api($1::jsonb) as data',[JSON.stringify(b)])).rows[0].data;}
  await assert.rejects(rpc(null,{action:'profile_status'}),{code:'PT401'});
  assert.deepEqual(await rpc(null,{action:'legacy'}),{legacy:true});
  let status=await rpc(p,{action:'profile_status'});assert.equal(status.equipped,'wax_beginning');assert.deepEqual(status.owned,['wax_beginning']);
  const stateBefore=(await db.query('select * from game_states order by user_id')).rows;
  let profile=await rpc(a,{action:'player_profile',nickname:'player'});
  assert.deepEqual(Object.keys(profile).sort(),['nickname','rank','gold','rebirths','online','title','card','discovered_count','discovery_total'].sort());
  assert.equal(profile.gold.length,2470);assert.equal(profile.rank,1);assert.equal(profile.online,true);assert.equal(profile.title,null);assert.equal(profile.discovered_count,2);assert.equal(profile.discovery_total,2);
  for(let i=0;i<2;i++)assert.equal((await rpc(p,{action:'profile_equip',card_id:null})).equipped,null);
  assert.equal((await rpc(a,{action:'player_profile',nickname:'player'})).card,null);
  await assert.rejects(rpc(p,{action:'profile_equip',card_id:'missing'}),{code:'PT400'});
  await assert.rejects(rpc(p,{action:'profile_equip',card_id:null,user_id:a}),{code:'PT403'});
  await assert.rejects(rpc(p,{action:'profile_equip'}),{code:'PT400'});
  await assert.rejects(rpc(p,{action:'player_profile',nickname:123}),{code:'PT400'});
  await db.exec("update players set ranking_hidden=true where nickname='player'");
  await assert.rejects(rpc(a,{action:'player_profile',nickname:'player'}),{code:'PT404'});
  assert.equal((await rpc(p,{action:'player_profile',nickname:'player'})).rank,null);
  await db.exec("insert into wakppu_profile_card_defs values('future','추가 카드','전설',false,'images/profile-cards/future.png')");
  assert.ok((await rpc(a,{action:'profile_status'})).owned.includes('future'));
  assert.equal((await rpc(a,{action:'profile_equip',card_id:'future'})).equipped,'future');
  await assert.rejects(rpc(p,{action:'profile_equip',card_id:'future'}),{code:'PT400'});
  await assert.rejects(rpc(a,{action:'profile_equip',card_id:'future'},true),{code:'PT400'});
  await db.exec("update players set role='player' where nickname='admin'");
  await assert.rejects(rpc(a,{action:'profile_equip',card_id:'future'}),{code:'PT400'});
  await rpc(p,{action:'profile_equip',card_id:'wax_beginning'});
  assert.deepEqual((await db.query('select * from game_states order by user_id')).rows,stateBefore);
  await db.exec('update profile_test_gate set blocked=true');
  await assert.rejects(rpc(p,{action:'profile_status'}),{code:'PT503'});
  await assert.rejects(rpc(p,{action:'player_profile',nickname:'player'}),{code:'PT503'});
  await db.exec('set role authenticated');
  for(const table of ['wakppu_profile_cards','wakppu_profile_card_defs'])await assert.rejects(db.exec('select * from '+table),{code:'42501'});
  await assert.rejects(db.exec("select wakppu_api_before_profiles('{}')"),{code:'42501'});
 }finally{await db.close();}
});
