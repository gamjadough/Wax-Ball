import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {hammers,hammerDamage} from './hammer-catalog.mjs';
test('30 levels preserve old prices and damage, use exact increasing prices',()=>{
 assert.equal(hammers.length,30);
 assert.deepEqual(Array.from(hammers.slice(0,10),h=>h.cracks),[3,5,8,12,18,27,40,60,90,135]);
 assert.deepEqual(Array.from(hammers.slice(0,10),h=>h.cost),[100n,500n,2000n,10000n,50000n,250000n,1000000n,5000000n,25000000n,100000000n]);
 for(let i=10;i<30;i++){assert.equal(hammers[i].cost,hammers[i-1].cost*4n);assert.equal(hammers[i].cracks,Math.ceil(hammers[i-1].cracks*1.5));}
 assert.ok(hammers[29].cost>BigInt(Number.MAX_SAFE_INTEGER));
 assert.equal(hammerDamage(false,30),1);assert.equal(hammerDamage(true,31),1);
});
test('PostgreSQL accepts Lv30, rejects Lv31, preserves wrappers and matches damage for every level',async()=>{
 const require=createRequire(new URL('./test-results/sql-check/package.json',import.meta.url));
 const {PGlite}=require('@electric-sql/pglite');const db=new PGlite();
 const id='00000000-0000-0000-0000-000000000001';
 try{
  await db.exec(`create role anon;create role authenticated;create schema auth;
   create function auth.jwt() returns jsonb language sql stable as $$select jsonb_build_object('sub','${id}','is_anonymous',false)$$;
   create function auth.uid() returns uuid language sql stable as $$select '${id}'::uuid$$;
   create table players(user_id uuid primary key,nickname text,role text,updated_at timestamptz default now());
   create table game_states(user_id uuid primary key,gold bigint default 0,rebirths smallint default 0,unlocked_ball_ids jsonb default '["yellow"]',discovered_ball_ids jsonb default '["yellow"]',selected_ball_id text default 'yellow',honey_expires_at timestamptz,updated_at timestamptz default now());
   create table moderation_cases(user_id uuid primary key,status text default 'active',suspicion_score integer default 0,strikes integer default 0,suspended_until timestamptz,last_reason text,updated_at timestamptz default now());
   create table admin_audit_logs(id bigint generated always as identity primary key,admin_user_id uuid,target_user_id uuid,action text,reason text,details jsonb,created_at timestamptz default now());
   insert into players values('${id}','테스트','player',now());insert into game_states(user_id) values('${id}');`);
  for(const name of ['20261004_accounts_and_rankings.sql','20261004_admin_exact_gold.sql','20261005_ranking_visibility_bans.sql','20261005_z_gold_event.sql','20261006_rebirth_100_big_gold.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));
  const wrapper=(await db.query("select pg_get_functiondef('wakppu_api(jsonb)'::regprocedure) as source")).rows[0].source;
  await db.exec('alter table game_states add constraint game_states_hammer_level_check check(hammer_level between 0 and 10)');
  const migration=await readFile(new URL('../supabase/migrations/20261007_hammer_level_30.sql',import.meta.url),'utf8');
  await db.exec(migration);await db.exec(migration);
  assert.equal((await db.query("select pg_get_functiondef('wakppu_api(jsonb)'::regprocedure) as source")).rows[0].source,wrapper);
  for(let level=1;level<=30;level++)assert.equal((await db.query('select wakppu_hammer_damage(true,$1) as damage',[level])).rows[0].damage,hammers[level-1].cracks);
  const payload={action:'save_progress',gold:hammers[29].cost.toString(),admin_revision:0,rebirths:0,hammer_owned:true,hammer_level:30,unlocked_ball_ids:['yellow'],selected_ball_id:'yellow',discovered_ball_ids:['yellow']};
  await db.query('select wakppu_api_before_events($1::jsonb)',[JSON.stringify(payload)]);
  assert.equal((await db.query('select hammer_level,gold::text as gold from game_states')).rows[0].hammer_level,30);
  await assert.rejects(db.query('select wakppu_api_before_events($1::jsonb)',[JSON.stringify({...payload,hammer_level:31})]));
  await assert.rejects(db.exec('update game_states set hammer_level=31'));
  assert.equal((await db.query('select hammer_level from game_states')).rows[0].hammer_level,30);
 }finally{await db.close();}
});
