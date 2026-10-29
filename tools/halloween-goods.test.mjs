import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {monthlyFixture,player,admin} from './monthly-fixture.mjs';
const migration=new URL('../supabase/migrations/20261029092541_halloween_limited_potions_cards.sql',import.meta.url);
async function fixture(){const f=await monthlyFixture();
// The legacy fixture loads the premium migration after gems; restore the deployed reward wrapper.
const gems=await readFile(new URL('../supabase/migrations/20261025054917_blue_gems.sql',import.meta.url),'utf8');await f.db.exec(gems.match(/create function public\.wakppu_supporter_reward\(u uuid,base numeric\)[\s\S]*?end \$r\$;/)[0].replace('create function','create or replace function'));
await f.db.exec(await readFile(migration,'utf8'));await f.rpc(player,{action:'limited'});await f.db.exec("update wakppu_limited_settings set starts_at=now()-interval '1 day',ends_at=now()+interval '1 day'");await f.db.query('update wakppu_limited_players set tokens=5000 where user_id=$1',[player]);return f;}
const request=(action,id,revision)=>({action,id,goods_revision:revision,request_id:crypto.randomUUID()});
test('limited goods SQL: exact prices, stock, replay, expiry extension, permanent card/title entitlement, ended season and ownership guards',async()=>{
 const {db,rpc}=await fixture();try{
  const get=()=>rpc(player,{action:'halloween_goods'});let s=await get();assert.equal(s.catalog.length,9);assert.ok(s.catalog.filter(d=>d.kind==='potion').every(d=>d.price===50));
  const send=async(a,id)=>rpc(player,request(a,id,(await get()).revision));
  const buy=request('halloween_goods_buy','witch_potion',s.revision);s=await rpc(player,buy);assert.equal(s.tokens,'4950');assert.equal(s.stock.witch_potion,1);assert.equal((await rpc(player,buy)).tokens,'4950');
  await assert.rejects(rpc(player,{...buy,id:'ghost_potion'}),{code:'PT409'});
  await assert.rejects(rpc(player,request('halloween_goods_use','witch_potion',0)),{code:'PT409'});
  const use=request('halloween_goods_use','witch_potion',s.revision);s=await rpc(player,use);assert.equal(s.stock.witch_potion,0);const until=s.expires.witch_potion;assert.equal(until-s.server_time,1800000);
  assert.equal((await rpc(player,use)).expires.witch_potion,until);await assert.rejects(send('halloween_goods_use','witch_potion'),{code:'PT403'});
  await send('halloween_goods_buy','witch_potion');s=await send('halloween_goods_use','witch_potion');assert.equal(s.expires.witch_potion,until+1800000);
  for(const id of ['ghost_potion','pumpkin_potion']){await send('halloween_goods_buy',id);s=await send('halloween_goods_use',id);}
  assert.deepEqual(s.timing,{animation:2,respawn:2});
  await send('halloween_goods_buy','halloween_witch');let p=await rpc(player,{action:'profile_equip',card_id:'halloween_witch'});assert.equal(p.equipped,'halloween_witch');assert.ok(p.catalog.find(c=>c.id==='halloween_witch'));
  await assert.rejects(send('halloween_goods_buy','halloween_witch'),{code:'PT409'});
  await assert.rejects(rpc(player,{action:'profile_equip',card_id:'halloween_ghost'}));
  await assert.rejects(rpc(player,{action:'profile_title',title_id:'halloween_ghost_title'}),{code:'PT403'});
  await send('halloween_goods_buy','halloween_ghost_title');p=await rpc(player,{action:'profile_title',title_id:'halloween_ghost_title'});assert.equal(p.title,'유령의 친구');assert.equal(p.title_equipped,'halloween_ghost_title');
  const nickname=(await db.query('select nickname from players where user_id=$1',[player])).rows[0].nickname;
  p=await rpc(player,{action:'player_profile',nickname});assert.equal(p.card.id,'halloween_witch');assert.equal(p.title,'유령의 친구');
  await rpc(player,{action:'profile_equip',card_id:null});await rpc(player,{action:'profile_title',title_id:'none'});
  const beforeRebirth=await get(),items=await rpc(player,{action:'items'});await rpc(player,{action:'save_progress',item_revision:items.revision,gold:items.gold,admin_revision:0,rebirths:1,unlocked_ball_ids:['yellow'],selected_ball_id:'yellow'});assert.deepEqual((await get()).stock,beforeRebirth.stock);assert.deepEqual((await get()).expires,beforeRebirth.expires);
  await send('halloween_goods_buy','ghost_potion');await db.exec("update wakppu_limited_settings set ends_at=now()-interval '1 second'");
  await assert.rejects(send('halloween_goods_buy','ghost_potion'),{code:'PT409'});assert.equal((await send('halloween_goods_use','ghost_potion')).stock.ghost_potion,0);
  await assert.rejects(rpc(null,{action:'halloween_goods'}),{code:'PT401'});await assert.rejects(rpc(player,{action:'halloween_goods',user_id:admin}),{code:'PT403'});
  await db.query("update wakppu_halloween_goods set expires=jsonb_build_object('witch_potion',floor(extract(epoch from now())*1000)+604800000),stock=stock||'{\"witch_potion\":1}' where user_id=$1",[player]);
  await assert.rejects(send('halloween_goods_use','witch_potion'),{code:'PT400'});
 }finally{await db.close();}
});
test('limited goods SQL: real break rewards stack, fractional carry, no extra gems, timing expires, admin stock preserved and revoked/anonymous admin excluded',async()=>{
 const {db,rpc}=await fixture();try{
  const get=()=>rpc(player,{action:'halloween_goods'}),send=async(a,id)=>rpc(player,request(a,id,(await get()).revision));
  await send('halloween_goods_buy','witch_potion');await send('halloween_goods_use','witch_potion');
  await db.query('update game_states set hammer_owned=true,hammer_level=30,hammer_selected_level=30 where user_id=$1',[player]);
  const hit=async()=>rpc(player,{action:'item_hit',request_id:crypto.randomUUID(),item_revision:(await rpc(player,{action:'items'})).revision});
  const first=await hit(),second=await hit();assert.equal(first.reward,'1');assert.equal(second.reward,'2');assert.equal(second.blue_gems.balance,'2');assert.equal(second.halloween_goods.timing.animation,1);
  await db.query("insert into wakppu_blue_gems(user_id,balance,level) values($1,0,1) on conflict(user_id) do update set level=1",[player]);
  await rpc(player,{action:'halloween_cosmetics'});await db.query("update wakppu_halloween_cosmetics set owned='{\"little_ghost\":true}',equipped='little_ghost' where user_id=$1",[player]);
  const reward=(await db.query('select wakppu_supporter_reward($1,100) n',[player])).rows[0].n;assert.equal(Number(reward),330);
  await send('halloween_goods_buy','ghost_potion');await send('halloween_goods_use','ghost_potion');assert.equal((await get()).timing.animation,2);
  await db.query("update wakppu_halloween_goods set expires='{}' where user_id=$1",[player]);assert.equal((await get()).timing.animation,1);assert.equal(Number((await db.query('select wakppu_supporter_reward($1,100) n',[player])).rows[0].n),220);
  // Existing purchased stock remains when administrator access is granted.
  await send('halloween_goods_buy','witch_potion');const stock=(await get()).stock.witch_potion;
  await db.query("update players set role='admin' where user_id=$1",[player]);await send('halloween_goods_use','witch_potion');assert.equal((await get()).stock.witch_potion,stock);
  assert.ok((await rpc(player,{action:'profile_status'})).catalog.some(c=>c.id==='halloween_pumpkin'));
  await rpc(player,{action:'profile_title',title_id:'halloween_pumpkin_title'});
  await db.query("update players set role='player' where user_id=$1",[player]);let s=await get();assert.equal(s.expires.witch_potion,0);assert.equal((await rpc(player,{action:'profile_status'})).title,null);
  await db.query("update players set role='admin' where user_id=$1",[player]);await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:player,is_anonymous:true})]);
  s=(await db.query("select wakppu_api('{\"action\":\"halloween_goods\"}') r")).rows[0].r;assert.equal(s.admin_access,false);assert.equal(s.expires.witch_potion,0);
  const acl=(await db.query("select has_table_privilege('authenticated','wakppu_halloween_goods','UPDATE') a,has_function_privilege('authenticated','wakppu_halloween_goods_expiry(uuid)','EXECUTE') b")).rows[0];assert.deepEqual(acl,{a:false,b:false});
 }finally{await db.close();}
});
