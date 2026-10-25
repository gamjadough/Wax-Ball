import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {createRequire} from 'node:module';
import {createStore} from './admin-service.mjs';import {execute} from './blue-gems-service.mjs';import {gemState,gemBuy,gemSnapshot,gemProducts} from './blue-gem-data.mjs';
const require=createRequire(process.env.WAKPPU_TEST_NODE_PACKAGE||new URL('./test-results/sql-check/package.json',import.meta.url)),{PGlite}=require('@electric-sql/pglite');
const admin='00000000-0000-0000-0000-000000000001',player='00000000-0000-0000-0000-000000000002';
const sql=n=>readFile(new URL('../supabase/migrations/'+n,import.meta.url),'utf8');
test('local gems: one per completed ball, replay, permanent nonstacking purchases and exact huge prices',()=>{
 const store=createStore(),a=store.players[1];store.sleep_now_ms=Date.parse('2026-10-25T03:00:00Z');a.state.hammer_owned=true;a.state.hammer_level=30;
 const req={action:'item_hit',request_id:crypto.randomUUID(),item_revision:0},hit=execute(store,a,req);assert.equal(hit.blue_gems.balance,'1');execute(store,a,req);assert.equal(gemState(a).balance,1n);
 const g=gemState(a);g.balance=20000n;const buy={request_id:crypto.randomUUID(),level:1,gem_revision:g.revision};gemBuy(a,buy);assert.equal(g.balance,19000n);gemBuy(a,buy);assert.equal(g.balance,19000n);
 gemBuy(a,{request_id:crypto.randomUUID(),level:2,gem_revision:g.revision});assert.equal(gemSnapshot(a).multiplier,'5');assert.equal(g.balance,9000n);
 a.state.rebirths=1;assert.equal(gemSnapshot(a).multiplier,'5');
 assert.throws(()=>gemBuy(a,{request_id:crypto.randomUUID(),level:3,gem_revision:0}),{status:409});
 assert.throws(()=>gemBuy(a,{request_id:crypto.randomUUID(),level:3,gem_revision:g.revision,price:'0'}),{status:403});
 assert.equal(gemProducts[6].price,'1'+'0'.repeat(39));
 const boss=store.players[0];gemBuy(boss,{request_id:crypto.randomUUID(),level:7,gem_revision:0});assert.equal(gemSnapshot(boss).multiplier,'1000000000');assert.equal(gemState(boss).balance,0n);boss.is_anonymous=true;assert.equal(gemSnapshot(boss).multiplier,'1');
});
test('real SQL gems: final reward hook, all three ball paths, idempotency, transactions, admin access, guards and private storage',async()=>{
 const db=new PGlite();try{
 const fixture=await readFile(new URL('./items-sql.test.mjs',import.meta.url),'utf8');await db.exec(fixture.match(/await db\.exec\(`([\s\S]*?)`\);/)[1].replaceAll('${admin}',admin).replaceAll('${player}',player));
 await db.exec(`create table auth.users(id uuid primary key,is_anonymous boolean default false,email text,email_confirmed_at timestamptz,created_at timestamptz default now(),raw_user_meta_data jsonb default '{}');insert into auth.users(id,is_anonymous,email,email_confirmed_at) values('${admin}',false,'admin@local.test',now()),('${player}',false,'player@local.test',now());`);
 for(const n of ['20261004_accounts_and_rankings.sql','20261004_admin_exact_gold.sql','20261005_ranking_visibility_bans.sql','20261005_z_gold_event.sql','20261006_guest_lifecycle.sql','20261006_rebirth_100_big_gold.sql','20261007_hammer_level_30.sql','20261007_admin_ball_event.sql','20261006_z_whitehole.sql','20261009_transcendent_balls.sql','20261008_gem_coating.sql','20261012_items_inventory.sql','20261016_halloween_reward.sql','20261019_items_remake.sql','20261019084353_manual_bank_orders.sql','20261020010000_supporter_gold_bonus.sql','20261020010100_supporter_gold_paths.sql'])await db.exec(await sql(n));
 await db.exec(`create function public.wakppu_admin_content_access() returns boolean language sql stable security definer set search_path=public,pg_temp as $$select exists(select 1 from players where user_id=auth.uid() and role='admin') and not coalesce((auth.jwt()->>'is_anonymous')::boolean,false)$$;revoke all on function wakppu_admin_content_access() from public,anon,authenticated;`);
 await db.exec(await sql('20261025054917_blue_gems.sql'));
 async function rpc(b,user=player,anonymous=false){await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify(user?{sub:user,is_anonymous:anonymous}:{})]);return (await db.query('select wakppu_api($1::jsonb) as data',[JSON.stringify(b)])).rows[0].data;}
 async function send(action,more={}){return rpc({action,request_id:crypto.randomUUID(),item_revision:(await rpc({action:'items'})).revision,...more});}
 const balance=async()=>await rpc({action:'blue_gems'});
 assert.equal((await balance()).balance,'0');assert.deepEqual((await balance()).catalog,gemProducts);
 await send('item_hit');assert.equal((await balance()).balance,'0');
 await db.exec(`update game_states set hammer_owned=true,hammer_level=30 where user_id='${player}'`);
 let req={action:'item_hit',request_id:crypto.randomUUID(),item_revision:(await rpc({action:'items'})).revision},hit=await rpc(req);
 assert.equal(hit.reward,'1');assert.equal((await balance()).balance,'1');await rpc(req);assert.equal((await balance()).balance,'1');
 const originalGold=(await rpc({action:'items'})).gold;
 await db.exec(`update wakppu_blue_gems set balance=20000 where user_id='${player}'`);
 let g=await balance(),buy={action:'blue_gem_buy',level:1,gem_revision:g.revision,request_id:crypto.randomUUID()};
 let result=await rpc(buy);assert.equal(result.balance,'19000');assert.deepEqual(await rpc(buy),result);
 await assert.rejects(rpc({...buy,level:2}),{code:'PT409'});
 await assert.rejects(rpc({...buy,request_id:crypto.randomUUID()}),{code:'PT409'});
 g=await balance();result=await rpc({action:'blue_gem_buy',level:2,gem_revision:g.revision,request_id:crypto.randomUUID()});assert.equal(result.multiplier,'5');assert.equal(result.balance,'9000');
 assert.equal((await rpc({action:'items'})).gold,originalGold);
 assert.equal((await send('item_hit')).reward,'5');
 const event=(await rpc({action:'admin_ball_event',mode:'start',duration_seconds:300,delay_seconds:0},admin)).admin_ball_event;
 for(const action of ['item_hit','event_ball_hit']){const before=BigInt((await balance()).balance);let r;for(let i=0;i<10;i++){r=await send(action,{event_id:event.id});if(BigInt(r.reward)>0n)break;}assert.ok(BigInt(r.reward)>0n);assert.equal(BigInt((await balance()).balance),before+1n);}
 await rpc({action:'limited'});await db.exec(`update wakppu_limited_settings set starts_at=now()-interval '1 day',ends_at=now()+interval '1 day';update wakppu_limited_players set tokens=100 where user_id='${player}';`);
 await send('limited_buy');await send('limited_select',{ball_id:'halloween-pumpkin-2026'});g=await balance();hit=await send('limited_hit');assert.equal(hit.reward,'7500000000');assert.equal(BigInt((await balance()).balance),BigInt(g.balance)+1n);
 await db.exec("insert into wakppu_blue_gem_exclusions values('halloween-pumpkin-2026')");g=await balance();await send('limited_hit');assert.equal((await balance()).balance,g.balance);
 await assert.rejects(rpc({action:'blue_gems'},null),{code:'PT401'});
 await assert.rejects(rpc({action:'blue_gem_buy',level:7,gem_revision:(await balance()).revision,request_id:crypto.randomUUID()}),{code:'PT400'});
 await assert.rejects(rpc({action:'blue_gem_buy',level:3,gem_revision:(await balance()).revision,request_id:crypto.randomUUID(),price:'0'}),{code:'PT403'});
 await db.exec(`update wakppu_blue_gems set balance=1e39 where user_id='${player}'`);
 result=await rpc({action:'blue_gem_buy',level:7,gem_revision:(await balance()).revision,request_id:crypto.randomUUID()});assert.equal(result.balance,'0');assert.equal(result.multiplier,'1000000000');
 const adminBuy={action:'blue_gem_buy',level:7,gem_revision:0,request_id:crypto.randomUUID()};assert.equal((await rpc(adminBuy,admin)).balance,'0');assert.equal((await rpc({action:'blue_gems'},admin,true)).multiplier,'1');
 await db.exec("update server_settings set maintenance=true");await assert.rejects(balance(),{code:'PT503'});await db.exec("update server_settings set maintenance=false");
 await db.exec('set role authenticated');for(const name of ['wakppu_blue_gems','wakppu_blue_gem_products','wakppu_blue_gem_requests','wakppu_blue_gem_exclusions'])await assert.rejects(db.query('select * from '+name),{code:'42501'});
 await assert.rejects(db.query("select wakppu_api_before_blue_gems('{}')"),{code:'42501'});
 }finally{await db.close();}
});
