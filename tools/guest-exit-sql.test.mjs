import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {createRequire} from 'node:module';
const require=createRequire(process.env.WAKPPU_TEST_NODE_PACKAGE||new URL('./test-results/sql-check/package.json',import.meta.url)),{PGlite}=require('@electric-sql/pglite');
test('guest self deletion SQL: actual anon only, consent, atomic cascade, audit preservation, replay, stale JWT denial and rollback',async()=>{
 const db=new PGlite(),u='00000000-0000-0000-0000-000000000001',v='00000000-0000-0000-0000-000000000002',w='00000000-0000-0000-0000-000000000003';
 try{
  await db.exec(`create role anon;create role authenticated;create schema auth;
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
   create function auth.jwt() returns jsonb language sql stable as $$select jsonb_build_object('session_id',current_setting('test.sid',true))$$;
   create table auth.users(id uuid primary key,is_anonymous boolean,raw_user_meta_data jsonb default '{}');
   create table auth.sessions(id uuid primary key,user_id uuid references auth.users on delete cascade);
   create table players(user_id uuid primary key references auth.users on delete cascade,role text default 'player');
   create table game_states(user_id uuid primary key references players on delete cascade,gold numeric default 100,item_revision bigint default 0);
   create table wakppu_skins(user_id uuid primary key references players on delete cascade,owned jsonb default '{}');
   create table wakppu_purchase_orders(id integer primary key,user_id uuid not null references players,amount int default 0);
   create table wakppu_purchase_entitlements(user_id uuid primary key references players);
   create table wakppu_purchase_cosmetics(user_id uuid primary key references players);
   create table wakppu_first_steps_grants(user_id uuid primary key references players);
   create table admin_audit_logs(id integer primary key,admin_user_id uuid references players,target_user_id uuid references players,details jsonb default '{}');
   insert into auth.users(id,is_anonymous) values('${u}',true),('${v}',false),('${w}',true);
   insert into players(user_id) select id from auth.users;insert into game_states(user_id) select id from auth.users;
   insert into auth.sessions values('10000000-0000-0000-0000-000000000001','${u}');insert into wakppu_skins values('${u}','{"pumpkin_eclipse":true}');
   insert into wakppu_purchase_orders values(1,'${u}',0),(2,'${v}',1100);
   insert into wakppu_purchase_entitlements values('${u}');insert into wakppu_purchase_cosmetics values('${u}');insert into wakppu_first_steps_grants values('${u}');
   insert into admin_audit_logs values(1,'${v}','${u}','{"reason":"test"}');
   create function wakppu_api(b jsonb) returns jsonb language sql security definer set search_path=public,pg_temp as $$select jsonb_build_object('ok',true)$$;`);
  const sql=await readFile(new URL('../supabase/migrations/20261021123758_guest_exit_switch.sql',import.meta.url),'utf8');await db.exec(sql);await db.exec(sql);
  await db.exec(await readFile(new URL('../supabase/migrations/20261021131355_developer_keepsake.sql',import.meta.url),'utf8'));
  await db.query('insert into wakppu_developer_keepsakes(user_id,granted_by,request_id,reason) values($1,$2,$3,$4)',[u,v,crypto.randomUUID(),'소장품 삭제 호환 검사']);
  const rpc=async(user,b)=>{await db.query("select set_config('test.uid',$1,false)",[user||'']);return (await db.query('select wakppu_api($1::jsonb) data',[JSON.stringify(b)])).rows[0].data;};
  const req=id=>({action:'guest_discard',expected_user_id:id,confirmation:'DELETE_GUEST'});
  await db.exec("select set_config('test.sid','10000000-0000-0000-0000-000000000009',false)");await assert.rejects(rpc(u,req(u)));
  await db.exec("select set_config('test.sid','10000000-0000-0000-0000-000000000001',false)");
  assert.deepEqual(await rpc(null,{action:'status'}),{ok:true});await assert.rejects(rpc(null,req(u)));
  for(const b of [{action:'guest_discard'},req(v),{...req(u),user_id:v},{...req(u),target_user_id:v}])await assert.rejects(rpc(u,b));
  await db.query(`update auth.users set raw_user_meta_data='{"is_anonymous":true}' where id=$1`,[v]);await assert.rejects(rpc(v,req(v)));
  await db.query("update players set role='admin' where user_id=$1",[w]);await assert.rejects(rpc(w,req(w)));await db.query("update players set role='player' where user_id=$1",[w]);
  // A new non-cascading relationship causes a full rollback, never partial progress loss.
  await db.exec(`create table blocker(user_id uuid references auth.users);insert into blocker values('${u}');`);
  await assert.rejects(rpc(u,req(u)));assert.equal((await db.query('select count(*)::int n from wakppu_purchase_entitlements')).rows[0].n,1);assert.equal((await db.query('select deleted_user_id from wakppu_purchase_orders where id=1')).rows[0].deleted_user_id,null);await db.exec('drop table blocker');
  assert.deepEqual(await rpc(u,req(u)),{deleted:true,user_id:u});assert.deepEqual(await rpc(u,req(u)),{deleted:true,user_id:u});
  for(const table of ['auth.users','players','game_states','auth.sessions','wakppu_skins','wakppu_purchase_entitlements','wakppu_purchase_cosmetics','wakppu_first_steps_grants','wakppu_developer_keepsakes']){
   const col=table==='auth.users'?'id':'user_id';assert.equal((await db.query(`select count(*)::int n from ${table} where ${col}=$1`,[u])).rows[0].n,0,table);
  }
  assert.deepEqual((await db.query('select user_id,deleted_user_id,amount from wakppu_purchase_orders where id=1')).rows[0],{user_id:null,deleted_user_id:u,amount:0});
  const log=(await db.query('select * from admin_audit_logs where id=1')).rows[0];assert.equal(log.target_user_id,null);assert.equal(log.admin_user_id,v);assert.equal(log.details.deleted_target_user_id,u);assert.equal(log.details.reason,'test');
  for(const action of ['bootstrap','save_progress','status','rankings','skins','pumpkin_skins'])await assert.rejects(rpc(u,{action}));
  assert.deepEqual(await rpc(v,{action:'bootstrap'}),{ok:true});assert.equal((await db.query('select gold::text gold from game_states where user_id=$1',[v])).rows[0].gold,'100');
  assert.equal((await db.query("select has_function_privilege('authenticated','wakppu_api_before_guest_exit(jsonb)','execute') exposed")).rows[0].exposed,false);
 }finally{await db.close();}
});
