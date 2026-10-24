import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createStore} from './admin-service.mjs';
import {createProfileService} from './profile-service.mjs';
const require=createRequire(process.env.WAKPPU_TEST_DEPS||new URL('./test-results/sql-check/package.json',import.meta.url));
const {PGlite}=require('@electric-sql/pglite');
export const championMigration=new URL('../supabase/migrations/20261024042843_champion_profile_card.sql',import.meta.url);
const a='00000000-0000-0000-0000-000000000001',p='00000000-0000-0000-0000-000000000002',q='00000000-0000-0000-0000-000000000003';

test('local champion reward is permanent, not auto-equipped, and does not change progression',()=>{
 const store=createStore(),admin=store.players[0],player=store.players[1],service=createProfileService(store);
 player.state.rebirths=5;const before=structuredClone(player.state);
 assert.ok(service.execute(player,{action:'profile_status'}).owned.includes('golden_champion'));
 assert.equal(service.execute(player,{action:'profile_status'}).equipped,'wax_beginning');
 admin.state.rebirths=10;service.execute(player,{action:'profile_equip',card_id:'golden_champion'});
 assert.equal(service.execute(admin,{action:'player_profile',nickname:player.nickname}).card.id,'golden_champion');
 assert.deepEqual(player.state,before);
});

test('SQL champion: current first backfill, exact ranking, permanent/idempotent grants, gates, titles, privacy and atomic boundaries',async()=>{
 const db=new PGlite();try{
  const source=await readFile(new URL('./player-profiles.test.mjs',import.meta.url),'utf8');
  const fixture=source.match(/await db\.exec\(`([\s\S]*?)`\);/)[1].replaceAll('${a}',a).replaceAll('${p}',p);
  await db.exec(fixture);
  await db.exec(`create table auth.users(id uuid primary key,is_anonymous boolean default false);
   insert into auth.users values('${a}',false),('${p}',false),('${q}',false);
   create table moderation_cases(user_id uuid primary key,status text,suspended_until timestamptz);
   create table champion_guest_fixture(id uuid primary key,eligible boolean,hide_at timestamptz);
   create function wakppu_guest_accounts() returns table(id uuid,eligible boolean,hide_at timestamptz) language sql as $$select * from champion_guest_fixture$$;
   create table wakppu_purchase_cosmetics(user_id uuid primary key,title_visible boolean default true);
   create function wakppu_supporter_percent(u uuid) returns integer language sql stable as $$select 30$$;
   insert into players values('${q}','challenger','player',false);
   insert into game_states values('${q}',1e2468,1000,'["yellow"]');
   create or replace function wakppu_api(b jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
   begin
    if b->>'action'='rankings' then return (select coalesce(jsonb_agg(x),'[]') from
     (select p.nickname,g.gold::text as gold,g.rebirths from game_states g join players p using(user_id)
     where not p.ranking_hidden and not exists(select 1 from moderation_cases m where m.user_id=p.user_id and (m.status='banned' or (m.status='suspended' and (m.suspended_until is null or m.suspended_until>clock_timestamp()))))
     and not exists(select 1 from wakppu_guest_accounts() c where c.id=p.user_id and c.eligible and c.hide_at<=clock_timestamp())
     order by g.rebirths desc,g.gold desc,g.user_id limit 100) x);end if;
    if auth.uid() is null then raise sqlstate 'PT401';end if;
    if (select blocked from profile_test_gate) then raise sqlstate 'PT503';end if;
    if exists(select 1 from moderation_cases where user_id=auth.uid() and status='banned') then raise sqlstate 'PT403';end if;
    if b->>'action'='save_progress' then update game_states set gold=(b->>'gold')::numeric where user_id=auth.uid();end if;
    if b->>'action'='auto_rebirth_run' then
     perform public.wakppu_api('{"action":"save_progress","gold":"1e3000"}');
     update game_states set gold=0 where user_id=auth.uid();
    end if;return '{}'::jsonb;
   end$$;`);
  for(const name of ['20261023100846_player_profiles.sql','20261023102333_profile_inventory_titles.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));
  await db.exec(await readFile(championMigration,'utf8'));
  async function rpc(id,b,anon=false){await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify(id?{sub:id,is_anonymous:anon}:{})]);return (await db.query('select wakppu_api($1::jsonb) as r',[JSON.stringify(b)])).rows[0].r;}
  const owns=async id=>(await db.query('select count(*)::int as n from wakppu_profile_card_grants where user_id=$1',[id])).rows[0].n;
  assert.equal(await owns(p),1);assert.equal(await owns(q),0);
  let s=await rpc(p,{action:'profile_status'});assert.ok(s.owned.includes('golden_champion'));assert.equal(s.equipped,'wax_beginning');
  const before=(await db.query('select * from game_states order by user_id')).rows;
  await rpc(p,{action:'profile_title',title_id:'premium'});
  for(let i=0;i<3;i++)assert.equal((await rpc(p,{action:'profile_equip',card_id:'golden_champion'})).equipped,'golden_champion');
  assert.equal(await owns(p),1);
  let profile=await rpc(q,{action:'player_profile',nickname:'player'});assert.equal(profile.card.id,'golden_champion');assert.equal(profile.title,'프리미엄 후원자');
  assert.deepEqual(Object.keys(profile).sort(),['nickname','rank','gold','rebirths','online','title','card','discovered_count','discovery_total'].sort());
  assert.deepEqual((await db.query('select * from game_states order by user_id')).rows,before);
  await assert.rejects(rpc(q,{action:'profile_equip',card_id:'golden_champion'}),{code:'PT400'});
  await assert.rejects(rpc(q,{action:'profile_equip',card_id:'golden_champion',user_id:p}),{code:'PT403'});
  // A nested save may briefly lead, but the final auto-rebirth state must decide awards.
  await rpc(q,{action:'auto_rebirth_run'});assert.equal(await owns(q),0);
  await db.query('update game_states set gold=1e3000 where user_id=$1',[q]);
  await db.query("insert into moderation_cases values($1,'banned',null)",[q]);await rpc(p,{action:'rankings'});assert.equal(await owns(q),0);
  await db.query('delete from moderation_cases where user_id=$1',[q]);await db.query('update players set ranking_hidden=true where user_id=$1',[q]);await rpc(p,{action:'rankings'});assert.equal(await owns(q),0);
  await db.query('update players set ranking_hidden=false where user_id=$1',[q]);await db.query("insert into champion_guest_fixture values($1,true,now()-interval '1 day')",[q]);await rpc(p,{action:'rankings'});assert.equal(await owns(q),0);
  await db.exec('delete from champion_guest_fixture');assert.equal((await rpc(null,{action:'rankings'}))[0].nickname,'challenger');assert.equal(await owns(q),1);
  await rpc(q,{action:'profile_equip',card_id:'golden_champion'});
  assert.equal((await rpc(p,{action:'profile_status'})).equipped,'golden_champion');
  // Same gold/rebirths uses UUID, exactly as public rankings.
  await db.query('delete from wakppu_profile_card_grants where user_id=$1',[q]);await db.query('update game_states set gold=1e2469 where user_id=$1',[q]);
  assert.equal((await rpc(null,{action:'rankings'}))[0].nickname,'player');assert.equal(await owns(q),0);
  await rpc(a,{action:'profile_equip',card_id:'golden_champion'});
  await assert.rejects(rpc(a,{action:'profile_equip',card_id:'golden_champion'},true),{code:'PT400'});
  await db.exec("update players set role='player' where nickname='admin'");await assert.rejects(rpc(a,{action:'profile_equip',card_id:'golden_champion'}),{code:'PT400'});
  await db.exec('update profile_test_gate set blocked=true');await assert.rejects(rpc(p,{action:'profile_status'}),{code:'PT503'});await db.exec('update profile_test_gate set blocked=false');
  await assert.rejects(rpc(null,{action:'profile_equip',card_id:'golden_champion'}),{code:'PT401'});
  await db.exec('set role authenticated');
  await assert.rejects(db.exec('select * from wakppu_profile_card_grants'),{code:'42501'});
  await assert.rejects(db.exec('select wakppu_award_champion()'),{code:'42501'});
  await assert.rejects(db.exec("select wakppu_api_before_champion_cards('{}')"),{code:'42501'});
 }finally{await db.close();}
});
