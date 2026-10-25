import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import vm from 'node:vm';import {createRequire} from 'node:module';
import {createStore,execute} from './admin-service.mjs';import {decorAction,decorState,ids} from './halloween-decor-service.mjs';import {itemState,itemData} from './items-service.mjs';import {supporterReward} from './supporter-service.mjs';import {equippedPet,petTiming} from './halloween-pet-service.mjs';
const file=n=>readFile(new URL('../supabase/migrations/'+n,import.meta.url),'utf8');
test('ember auto replaces animation bonus; bat keeps exact 10% reduction and one permanent selection',async()=>{
 const api=vm.runInNewContext(await readFile(new URL('../wakppuball/js/halloween-decor-data.js',import.meta.url),'utf8')+';WakppuHalloweenDecorData',{});
 assert.equal(api.list.length,3);assert.ok(api.list.every(d=>d.kind==='equip'));
 const base=itemData.timing(itemData.effective({transcendent_wax_heart:{expires_at:Date.now()+10000}}));assert.equal(base.animation,2.5);assert.equal(base.respawn,4);
 for(const id of ids){const t=api.timing(base,id);assert.ok(Math.abs(900/t.animation-(900/base.animation))<1e-8);assert.ok(Math.abs(1000/t.respawn-(1000/base.respawn)*(id==='bat_swarm'?.9:1))<1e-8);}
 const store=createStore(),p=store.players[1],c=decorState(p);c.owned=Object.fromEntries(ids.map(id=>[id,true]));
 for(const id of [...ids,null]){const s=decorAction(store,p,{action:'halloween_cosmetics'});decorAction(store,p,{action:'halloween_decor_equip',item_id:id,item_revision:s.revision,decor_revision:s.decor_revision,request_id:crypto.randomUUID()});assert.equal(equippedPet(p),id);}
});
test('local gold stacking, fractional carry, normal/event paths, replay and revoked developer access',()=>{
 const store=createStore(),p=store.players[1],c=decorState(p);store.sleep_now_ms=Date.parse('2026-10-22T12:00:00+09:00');c.owned.little_ghost=true;c.equipped='little_ghost';p.premiumSupporterPack=true;
 assert.equal(supporterReward(p,100n),143n);p.premiumSupporterPack=false;
 c.petGoldRemainder=0;let total=0n;for(let i=0;i<10;i++)total+=supporterReward(p,1n);assert.equal(total,11n);
 p.state.honey_expires_at=new Date(Date.now()+100000).toISOString();p.state.coating_expires_at=new Date(Date.now()+100000).toISOString();p.state.rebirths=2;p.state.current_clicks=9;
 itemState(p).effects.hero_destruction_crystal={remaining:10};p.premiumSupporterPack=true;
 const req={action:'item_hit',item_revision:itemState(p).revision,request_id:crypto.randomUUID()},r=execute(store,p,req);assert.equal(r.reward,'102');const gold=p.state.gold;assert.deepEqual(execute(store,p,req),r);assert.equal(p.state.gold,gold);
 c.owned={};p.role='admin';p.is_anonymous=false;assert.equal(supporterReward(p,100n),143n);p.is_anonymous=true;assert.equal(supporterReward(p,100n),130n);p.is_anonymous=false;p.role='player';assert.equal(equippedPet(p),null);assert.equal(petTiming(p).respawn,1);
});
test('actual SQL pets: saved bat selection, stacking/carry, authoritative timing, ownership and private functions',async()=>{
 const require=createRequire(process.env.WAKPPU_TEST_NODE_PACKAGE),{PGlite}=require('@electric-sql/pglite'),db=new PGlite(),u='00000000-0000-0000-0000-000000000001',v='00000000-0000-0000-0000-000000000002';
 try{
  const src=await readFile(new URL('./skins-sql.test.mjs',import.meta.url),'utf8');await db.exec(src.match(/await db.exec\(`([\s\S]*?)`\);/)[1].replaceAll('${u}',u).replaceAll('${v}',v));
  await db.exec("alter table game_states add column supporter_gold_remainder smallint default 0;create table wakppu_purchase_entitlements(user_id uuid,product_id text);create table wakppu_limited_players(user_id uuid primary key references players,tokens bigint default 1000);create table wakppu_limited_settings(id boolean primary key,starts_at timestamptz,ends_at timestamptz);insert into wakppu_limited_settings values(true,now()-interval '1 day',now()+interval '1 day');");
  const premium=await file('20261020100009_premium_supporter_pack.sql');await db.exec(premium.slice(premium.indexOf('create or replace function public.wakppu_supporter_percent'),premium.indexOf('do $patch$')));
  await db.exec(await file('20261022093644_halloween_decoration_box.sql'));await db.exec(await file('20261022095516_halloween_decor_admin_access.sql'));
  const patch=await file('20261022102841_halloween_pet_traits.sql');await db.exec(patch);await db.exec(patch);
  const rpc=async(user,b)=>{await db.query("select set_config('test.uid',$1,false)",[user||'']);return (await db.query('select wakppu_api($1::jsonb) data',[JSON.stringify(b)])).rows[0].data;};
  const get=()=>rpc(u,{action:'halloween_cosmetics'}),send=async(id)=>{const s=await get();return rpc(u,{action:'halloween_decor_equip',item_id:id,item_revision:s.revision,decor_revision:s.decor_revision,request_id:crypto.randomUUID()});};
  await get();await assert.rejects(send('bat_swarm'),{code:'PT403'});await db.query(`update wakppu_halloween_cosmetics set owned='{"little_ghost":true,"pumpkin_ember":true,"bat_swarm":true}' where user_id=$1`,[u]);
  for(const id of ids){assert.equal((await send(id)).equipped,id);const t=(await rpc(u,{action:'item_hit',pet_timing:{equipped:'forged'}})).pet_timing;assert.equal(t.equipped,id);assert.equal(t.animation,id==='pumpkin_ember'?.9:1);assert.equal(t.respawn,id==='bat_swarm'?.9:1);}
  await send('little_ghost');await db.query("insert into wakppu_purchase_entitlements values($1,'premium_supporter_pack')",[u]);
  assert.equal((await db.query('select wakppu_supporter_reward($1,100) r',[u])).rows[0].r,'143');
  await db.exec('delete from wakppu_purchase_entitlements');let total=0;for(let i=0;i<10;i++)total+=Number((await db.query('select wakppu_supporter_reward($1,1) r',[u])).rows[0].r);assert.equal(total,11);
  await send(null);assert.equal((await db.query('select wakppu_supporter_reward($1,100) r',[u])).rows[0].r,'100');
  await db.query("update players set role='admin' where user_id=$1",[v]);let s=await rpc(v,{action:'halloween_cosmetics'});assert.equal(Object.keys(s.owned).length,3);s=await rpc(v,{action:'halloween_decor_equip',item_id:'bat_swarm',item_revision:s.revision,decor_revision:s.decor_revision,request_id:crypto.randomUUID()});assert.equal(s.equipped,'bat_swarm');
  await db.query('update game_states set rebirths=rebirths+1,gold=0 where user_id=$1',[v]);assert.equal((await rpc(v,{action:'items'})).pet_timing.respawn,.9);
  await db.exec("select set_config('test.anonymous','true',false)");assert.equal((await rpc(v,{action:'items'})).pet_timing.equipped,null);await db.exec("select set_config('test.anonymous','false',false)");await db.query("update players set role='player' where user_id=$1",[v]);assert.equal((await rpc(v,{action:'items'})).pet_timing.equipped,null);
  await db.exec('set role authenticated');for(const name of ['wakppu_equipped_pet(uuid)','wakppu_supporter_reward(uuid,numeric)','wakppu_supporter_reward_before_pets(uuid,numeric)','wakppu_halloween_cosmetic_snapshot_before_pets(uuid)'])assert.equal((await db.query("select has_function_privilege('authenticated',$1,'execute') allowed",[name])).rows[0].allowed,false);await db.exec('reset role');
 }finally{await db.close();}
});
