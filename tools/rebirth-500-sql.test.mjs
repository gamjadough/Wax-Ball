import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(new URL('./test-results/sql-check/package.json',import.meta.url));
const {PGlite}=require('@electric-sql/pglite');
const admin='00000000-0000-0000-0000-000000000001',player='00000000-0000-0000-0000-000000000002';
test('PostgreSQL: 1000 rebirths, 4096-digit Gold, exact ranking, validation and wrappers',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon; create role authenticated; create schema auth;
   create table auth.users(id uuid primary key,is_anonymous boolean default false,email text,raw_user_meta_data jsonb default '{}',created_at timestamptz default now());
   create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
   create function auth.uid() returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;
   create table players(user_id uuid primary key references auth.users on delete cascade,nickname text unique,role text,updated_at timestamptz default now());
   create table game_states(user_id uuid primary key references players on delete cascade,gold bigint default 0 check(gold>=0),rebirths smallint default 0 check(rebirths between 0 and 25),unlocked_ball_ids jsonb default '["yellow"]',discovered_ball_ids jsonb default '["yellow"]',selected_ball_id text default 'yellow',honey_expires_at timestamptz,updated_at timestamptz default now());
   create table moderation_cases(user_id uuid primary key references players,status text default 'active',suspicion_score integer default 0,strikes integer default 0,suspended_until timestamptz,last_reason text,updated_at timestamptz default now());
   create table admin_audit_logs(id bigint generated always as identity primary key,admin_user_id uuid references players,target_user_id uuid references players,action text,reason text,details jsonb,created_at timestamptz default now());
   insert into auth.users(id) values('${admin}'),('${player}');
   insert into players values('${admin}','관리자','admin',now()),('${player}','플레이어','player',now());
   insert into game_states(user_id) values('${admin}'),('${player}');`);
  const names=['20261004_accounts_and_rankings.sql','20261004_admin_exact_gold.sql','20261005_ranking_visibility_bans.sql','20261005_z_gold_event.sql','20261006_guest_lifecycle.sql','20261006_rebirth_100_big_gold.sql','20261006_rebirth_constraint_100.sql','20261006_zz_custom_gold_event.sql','20261011_rebirth_500_big_gold.sql'];
  for(const name of names)await db.exec(await readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../supabase/migrations/20261012_rebirth_1000.sql',import.meta.url),'utf8'));
  // Reapplying must preserve the wrapper stack and limits.
  await db.exec(await readFile(new URL('../supabase/migrations/20261012_rebirth_1000.sql',import.meta.url),'utf8'));
  async function rpc(user,body,anonymous=false){await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify(user?{sub:user,is_anonymous:anonymous}:{})]);return (await db.query('select public.wakppu_api($1::jsonb) as data',[JSON.stringify(body)])).rows[0].data;}
  const gold='9'.repeat(4096);
  const save={action:'save_progress',gold,rebirths:1000,admin_revision:0,unlocked_ball_ids:['yellow'],selected_ball_id:'yellow',hammer_level:0};
  await rpc(player,save);
  assert.equal((await rpc(player,{action:'bootstrap'})).state.gold,gold);
  await assert.rejects(rpc(player,{...save,rebirths:1001}));
  await assert.rejects(rpc(player,{...save,gold:'1'+'0'.repeat(4096)}));
  await assert.rejects(db.query('update game_states set rebirths=1001 where user_id=$1',[player]),{code:'23514'});
  await assert.rejects(db.query('update game_states set gold=1.5 where user_id=$1',[player]),{code:'23514'});
  const edit={action:'admin_rebirths',user_id:player,mode:'set',value:999};
  await assert.rejects(rpc(player,edit),{code:'PT403'});
  await assert.rejects(rpc(admin,edit,true),{code:'PT403'});
  await rpc(admin,edit);await rpc(admin,{...edit,mode:'add',value:1});
  await assert.rejects(rpc(admin,{...edit,mode:'add',value:1}));
  await rpc(admin,{...edit,mode:'subtract',value:1});
  assert.equal((await rpc(player,{action:'bootstrap'})).state.rebirths,999);
  await assert.rejects(rpc(player,save),{code:'PT409'});
  await rpc(admin,{action:'admin_gold',user_id:player,mode:'set',value:gold});
  await assert.rejects(rpc(admin,{action:'admin_gold',user_id:player,mode:'add',value:1}));
  await rpc(admin,{action:'admin_gold',user_id:admin,mode:'set',value:(BigInt(gold)-1n).toString()});
  await rpc(admin,{...edit,user_id:admin,value:999});
  assert.equal((await rpc(admin,{action:'rankings'}))[0].nickname,'플레이어');
  await rpc(admin,{action:'admin_gold_event',mode:'start',multiplier:7,duration_seconds:125,delay_seconds:0});
  assert.equal((await rpc(player,{action:'status'})).gold_event.multiplier,7);
  const grants=(await db.query("select has_function_privilege('authenticated','public.wakppu_api_before_events(jsonb)','execute') as exposed")).rows[0];
  assert.equal(grants.exposed,false);
 }finally{await db.close();}
});
