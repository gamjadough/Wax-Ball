import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {sleepHours} from './sleep-hours.mjs';
import {createStore,execute} from './admin-service.mjs';
import {itemData} from './items-service.mjs';
const cases=[['2026-10-07T22:59:59+09:00',false],['2026-10-07T23:00:00+09:00',true],['2026-10-08T00:00:00+09:00',true],['2026-10-08T05:59:59+09:00',true],['2026-10-08T06:00:00+09:00',false],['2026-12-31T23:00:00+09:00',true],['2027-01-01T06:00:00+09:00',false]];
test('KST boundaries, regular/anonymous visitors, admin exemption and item expiry',()=>{
 const store=createStore(),[admin,player]=store.players;
 for(const [time,active] of cases){store.sleep_now_ms=Date.parse(time);assert.equal(sleepHours(store.sleep_now_ms).active,active);assert.equal(execute(store,null,{action:'status'}).sleep_hours.active,active);assert.equal(execute(store,player,{action:'status'}).sleep_hours.active,active);assert.doesNotThrow(()=>execute(store,admin,{action:'bootstrap'}));if(active)for(const action of ['bootstrap','save_progress','item_draw','item_use','item_hit','event_ball_hit','items'])assert.throws(()=>execute(store,player,{action}),e=>e.status===503);else assert.doesNotThrow(()=>execute(store,player,{action:'bootstrap'}));}
 store.sleep_now_ms=Date.parse('2026-10-07T23:00:00+09:00');assert.throws(()=>execute(store,{...admin,is_anonymous:true},{action:'bootstrap'}),e=>e.status===503);
 const effects={hero_golden_honey:{expires_at:Date.parse('2026-10-07T23:05:00+09:00')}};
 assert.equal(itemData.effective(effects,0,0,Date.parse('2026-10-08T06:00:00+09:00')).honey.value,100);
 store.maintenance=true;store.sleep_now_ms=Date.parse('2026-10-08T06:00:00+09:00');assert.throws(()=>execute(store,player,{action:'bootstrap'}),e=>e.status===503);
});
test('real SQL wrapper: repeat install, KST boundaries, bypass resistance and retained data',async()=>{
 const require=createRequire(process.env.WAKPPU_TEST_NODE_PACKAGE||new URL('./test-results/sql-check/package.json',import.meta.url));const {PGlite}=require('@electric-sql/pglite');const db=new PGlite();
 const admin='00000000-0000-0000-0000-000000000001',player='00000000-0000-0000-0000-000000000002';
 try{
  // Reuse the existing real-migration fixture; no production connection or account data.
  const fixture=await readFile(new URL('./items-sql.test.mjs',import.meta.url),'utf8');
  await db.exec(fixture.match(/await db\.exec\(`([\s\S]*?)`\);/)[1].replaceAll('${admin}',admin).replaceAll('${player}',player));
  for(const name of ['20261004_accounts_and_rankings.sql','20261004_admin_exact_gold.sql','20261005_ranking_visibility_bans.sql','20261005_z_gold_event.sql','20261006_rebirth_100_big_gold.sql','20261007_hammer_level_30.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));
  await db.exec("create or replace function public.wakppu_api(b jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$begin if b->>'action'='mark_first_play' then return '{}'::jsonb;end if;return public.wakppu_api_before_events(b);end$$;");
  for(const name of ['20261007_admin_ball_event.sql','20261006_z_whitehole.sql','20261009_transcendent_balls.sql','20261008_gem_coating.sql','20261012_items_inventory.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));
  const sql=await readFile(new URL('../supabase/migrations/20261014_sleep_hours.sql',import.meta.url),'utf8');await db.exec(sql);await db.exec(sql);
  for(const [time,active] of cases){const result=(await db.query('select wakppu_sleep_hours($1::timestamptz) as data',[time])).rows[0].data;assert.equal(result.active,active);assert.equal(Date.parse(result.next_open_at),Date.parse(sleepHours(Date.parse(time)).next_open_at));}
  // Test-only clock injection in this disposable DB. The shipped wrapper uses clock_timestamp().
  await db.exec("alter function wakppu_sleep_hours(timestamptz) rename to sleep_hours_real;create function wakppu_sleep_hours(instant timestamptz) returns jsonb language sql as $$select sleep_hours_real(coalesce(nullif(current_setting('test.sleep_time',true),'')::timestamptz,instant))$$;");
  async function rpc(user,body,anonymous=false){await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify(user?{sub:user,is_anonymous:anonymous}:{})]);return (await db.query('select wakppu_api($1::jsonb) as data',[JSON.stringify(body)])).rows[0].data;}
  const clock=time=>db.query("select set_config('test.sleep_time',$1,false)",[time]);
  await clock('2026-10-07T22:59:59+09:00');await rpc(player,{action:'items'});
  await db.exec(`update game_states set gold=12345 where user_id='${player}';update wakppu_items set inventory='{"common_mini_hammer":3}',pity=77,effects='{"hero_golden_honey":{"expires_at":1791381900000}}' where user_id='${player}';`);
  const before=(await db.query('select * from wakppu_items')).rows;
  await clock('2026-10-07T23:00:00+09:00');assert.equal((await rpc(player,{action:'status'})).sleep_hours.active,true);
  for(const action of ['bootstrap','save_progress','items','item_draw','item_use','item_hit','event_ball_hit'])await assert.rejects(rpc(player,{action}),e=>e.code==='PT503');
  await assert.rejects(rpc(admin,{action:'items'},true),e=>e.code==='PT503');assert.ok(await rpc(admin,{action:'items'}));
  await db.exec('set role anon');assert.equal((await rpc(null,{action:'status'})).sleep_hours.active,true);await assert.rejects(rpc(null,{action:'items'}),e=>e.code==='PT401');await assert.rejects(db.query("select wakppu_api_before_sleep('{\"action\":\"status\"}')"));await db.exec('reset role');
  await clock('2026-10-08T06:00:00+09:00');assert.equal((await rpc(player,{action:'status'})).sleep_hours.active,false);const restored=await rpc(player,{action:'items'});assert.equal(restored.gold,'12345');assert.equal(restored.pity,77);assert.deepEqual((await db.query("select * from wakppu_items where user_id=$1",[player])).rows,before.filter(r=>r.user_id===player));
  await db.exec('update server_settings set maintenance=true');assert.equal((await rpc(player,{action:'status'})).maintenance,true);await assert.rejects(rpc(player,{action:'bootstrap'}),e=>e.code==='PT503');
 }finally{await db.close();}
});
