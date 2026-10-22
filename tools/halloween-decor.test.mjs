import vm from 'node:vm';import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {createRequire} from 'node:module';
import {createStore,execute} from './admin-service.mjs';import {decorAction,decorState,ids} from './halloween-decor-service.mjs';import {limitedState} from './limited-service.mjs';
const migration=new URL('../supabase/migrations/20261022093644_halloween_decoration_box.sql',import.meta.url);
test('local equal thirds, fixed candy price, duplicate shards, choice, repeat use and request replay',()=>{
 for(const [roll,id] of [[0,ids[0]],[1/3-.00001,ids[0]],[1/3,ids[1]],[2/3-.00001,ids[1]],[2/3,ids[2]],[.99999,ids[2]]]){
  const store=createStore(),actor=store.players[1];store.limited_preview='active';limitedState(actor).tokens=1000;
  const send=(a,id=null)=>{const s=decorAction(store,actor,{action:'halloween_cosmetics'});return decorAction(store,actor,{action:a,item_id:id,item_revision:s.revision,decor_revision:s.decor_revision,request_id:crypto.randomUUID()},()=>roll);};
  const before=actor.state.gold,first=send('halloween_decor_open');assert.equal(first.result.item_id,id);assert.equal(first.tokens,'900');assert.equal(first.owned[id],true);
  for(let i=0;i<3;i++)send('halloween_decor_open');assert.equal(decorState(actor).shards,3);
  const other=ids.find(x=>x!==id);send('halloween_decor_exchange',other);assert.equal(decorState(actor).shards,0);assert.equal(actor.state.gold,before);
  const s=decorAction(store,actor,{action:'halloween_cosmetics'}),req={action:'halloween_decor_open',request_id:crypto.randomUUID(),item_revision:s.revision,decor_revision:s.decor_revision};
  const r=decorAction(store,actor,req,()=>roll);assert.deepEqual(decorAction(store,actor,req),r);assert.throws(()=>decorAction(store,actor,{...req,action:'halloween_decor_equip',item_id:id}));
 }
});
test('actual SQL: authoritative equal catalog, atomic charges, replay, shards, ownership, lifecycle, guards and RLS',async()=>{
 const require=createRequire(process.env.WAKPPU_TEST_NODE_PACKAGE||new URL('./test-results/sql-check/package.json',import.meta.url)),{PGlite}=require('@electric-sql/pglite');const db=new PGlite(),u='00000000-0000-0000-0000-000000000001',v='00000000-0000-0000-0000-000000000002';
 try{
  const source=await readFile(new URL('./skins-sql.test.mjs',import.meta.url),'utf8');await db.exec(source.match(/await db.exec\(`([\s\S]*?)`\);/)[1].replaceAll('${u}',u).replaceAll('${v}',v));
  await db.exec(`create table wakppu_limited_players(user_id uuid primary key references players,tokens bigint default 100000);create table wakppu_limited_settings(id boolean primary key,starts_at timestamptz,ends_at timestamptz);insert into wakppu_limited_settings values(true,now()-interval '1 day',now()+interval '1 day');`);
  const visual=vm.runInNewContext(await readFile(new URL('../wakppuball/js/halloween-decor-data.js',import.meta.url),'utf8')+';WakppuHalloweenDecorData',{});assert.deepEqual(Array.from(visual.list,d=>d.id),ids);assert.equal(visual.price,100);assert.equal(visual.exchange,3);
  const sql=await readFile(migration,'utf8');await db.exec(sql);await db.exec(sql);const patch=await readFile(new URL('../supabase/migrations/20261022095516_halloween_decor_admin_access.sql',import.meta.url),'utf8');await db.exec(patch);await db.exec(patch);
  const rpc=async(user,b)=>{await db.query("select set_config('test.uid',$1,false)",[user||'']);return (await db.query('select wakppu_api($1::jsonb) data',[JSON.stringify(b)])).rows[0].data;};
  const get=(user=u)=>rpc(user,{action:'halloween_cosmetics'}),request=async(action,item_id=null)=>{const s=await get();return {action,item_id,request_id:crypto.randomUUID(),item_revision:s.revision,decor_revision:s.decor_revision};},send=async(a,id=null)=>rpc(u,await request(a,id));
  const initial=(await db.query('select to_jsonb(g)-\'item_revision\' as data from game_states g where user_id=$1',[u])).rows[0].data;
  await assert.rejects(get(null),{code:'PT401'});const s=await get();assert.equal(s.price,'100');assert.equal(s.exchange_cost,'3');assert.deepEqual(s.catalog.map(x=>x.id),ids);assert.deepEqual(s.catalog.map(x=>x.weight),[1,1,1]);
  const req=await request('halloween_decor_open');await assert.rejects(rpc(u,{...req,request_id:'invalid'}),{code:'PT400'});await assert.rejects(rpc(u,{...req,item_revision:999}),{code:'PT409'});
  await db.query('update wakppu_limited_players set tokens=99 where user_id=$1',[u]);await assert.rejects(rpc(u,req),{code:'PT409'});assert.equal((await get()).tokens,'99');
  await db.query('update wakppu_limited_players set tokens=100000 where user_id=$1',[u]);await db.exec('select setseed(.43)');
  const first=await rpc(u,{...req,price:0,weight:10000,user_id:v});assert.equal(first.tokens,'99900');assert.equal(Object.keys((await get(v)).owned).length,0);
  const counts=Object.fromEntries(ids.map(id=>[id,0]));counts[first.result.item_id]++;
  for(let i=1;i<120;i++){const r=await send('halloween_decor_open');counts[r.result.item_id]++;}
  const full=await get();assert.equal(full.tokens,'88000');assert.equal(full.opened,'120');assert.equal(full.shards,'117');assert.equal(Object.keys(full.owned).length,3);for(const n of Object.values(counts))assert.ok(n>=20&&n<=60,JSON.stringify(counts));
  const replay=await rpc(u,req);assert.equal(replay.tokens,full.tokens);assert.equal(replay.revision,full.revision);assert.deepEqual(replay.result,first.result);await assert.rejects(rpc(u,{...req,action:'halloween_decor_use',item_id:'bat_swarm'}),{code:'PT409'});
  await db.query(`update wakppu_halloween_cosmetics set owned='{"little_ghost":true}',shards=3 where user_id=$1`,[u]);
  await send('halloween_decor_exchange','pumpkin_ember');assert.equal((await get()).shards,'0');await assert.rejects(send('halloween_decor_exchange','pumpkin_ember'),{code:'PT409'});await assert.rejects(send('halloween_decor_use','bat_swarm'),{code:'PT403'});
  await send('halloween_decor_equip','little_ghost');assert.equal((await get()).equipped,'little_ghost');await send('halloween_decor_equip','pumpkin_ember');assert.equal((await get()).equipped,'pumpkin_ember');await send('halloween_decor_equip');assert.equal((await get()).equipped,null);
  await db.exec("update wakppu_limited_settings set ends_at=now()-interval '1 second'");await assert.rejects(send('halloween_decor_open'),{code:'PT409'});
  await db.query('update wakppu_halloween_cosmetics set shards=3 where user_id=$1',[u]);await send('halloween_decor_exchange','bat_swarm');for(let i=0;i<3;i++)assert.equal((await send('halloween_decor_use','bat_swarm')).owned.bat_swarm,true);
  assert.equal((await get()).tokens,'88000');assert.deepEqual((await db.query('select to_jsonb(g)-\'item_revision\' as data from game_states g where user_id=$1',[u])).rows[0].data,initial);
  await db.exec('update test_settings set maintenance=true');await assert.rejects(get(),{code:'PT503'});await db.exec('update test_settings set maintenance=false');await db.query('update players set banned=true where user_id=$1',[u]);await assert.rejects(get(),{code:'PT403'});
  await db.query("update players set role='admin' where user_id=$1",[v]);
  let admin=await get(v);assert.equal(admin.admin_content_access,true);assert.equal(Object.keys(admin.owned).length,3);const tokens=admin.tokens;await db.query('update game_states set rebirths=rebirths+1,gold=0 where user_id=$1',[v]);assert.equal(Object.keys((await get(v)).owned).length,3);
  const adminSend=async(a,id=null)=>{const s=await get(v);return rpc(v,{action:a,item_id:id,request_id:crypto.randomUUID(),item_revision:s.revision,decor_revision:s.decor_revision});};
  await adminSend('halloween_decor_equip','little_ghost');assert.equal((await get(v)).equipped,'little_ghost');await adminSend('halloween_decor_equip','pumpkin_ember');await adminSend('halloween_decor_use','bat_swarm');assert.equal((await get(v)).tokens,tokens);
  await adminSend('halloween_decor_equip');assert.equal((await get(v)).equipped,null);await adminSend('halloween_decor_equip','little_ghost');
  await db.exec("select set_config('test.anonymous','true',false)");assert.deepEqual((await get(v)).owned,{});assert.equal((await get(v)).equipped,null);await assert.rejects(adminSend('halloween_decor_use','bat_swarm'),{code:'PT403'});
  await db.exec("select set_config('test.anonymous','false',false)");await db.query("update players set role='player' where user_id=$1",[v]);assert.deepEqual((await get(v)).owned,{});assert.equal((await get(v)).equipped,null);await assert.rejects(adminSend('halloween_decor_equip','little_ghost'),{code:'PT403'});
  await db.exec('set role authenticated');for(const name of ['wakppu_halloween_cosmetics','wakppu_halloween_cosmetic_requests'])await assert.rejects(db.query('select * from '+name),{code:'42501'});await assert.rejects(db.query('select wakppu_halloween_cosmetic_snapshot($1)',[v]),{code:'42501'});await db.exec('reset role');
 }finally{await db.close();}
});

test('local admin automatic access, free equip/use, unequip and revocation',()=>{
 const store=createStore(),actor=store.players[1];actor.role='admin';actor.is_anonymous=false;
 const get=()=>decorAction(store,actor,{action:'halloween_cosmetics'}),send=(action,item_id=null)=>{const s=get();return decorAction(store,actor,{action,item_id,request_id:crypto.randomUUID(),item_revision:s.revision,decor_revision:s.decor_revision});};
 const before=get();actor.state.rebirths++;assert.equal(Object.keys(get().owned).length,3);assert.equal(Object.keys(before.owned).length,3);assert.deepEqual(decorState(actor).owned,{});
 send('halloween_decor_equip','little_ghost');send('halloween_decor_use','bat_swarm');assert.equal(get().tokens,before.tokens);assert.equal(get().gold,before.gold);send('halloween_decor_equip');assert.equal(get().equipped,null);
 send('halloween_decor_equip','pumpkin_ember');actor.is_anonymous=true;assert.deepEqual(get().owned,{});assert.equal(get().equipped,null);assert.throws(()=>send('halloween_decor_use','bat_swarm'));
 actor.is_anonymous=false;actor.role='player';assert.deepEqual(get().owned,{});assert.throws(()=>send('halloween_decor_equip','little_ghost'));
});
