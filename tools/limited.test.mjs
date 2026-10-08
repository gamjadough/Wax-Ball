import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {createRequire} from 'node:module';
import {createStore,execute} from './admin-service.mjs';import {limitedAction,limitedDrop,limitedData,limitedState} from './limited-service.mjs';import {itemState} from './items-service.mjs';import {ballCatalog} from './event-ball-catalog.mjs';
const catalog=await ballCatalog(),id=limitedData.ball.id;
test('10% drop boundaries, no repeats/events, purchase, expiry, reward and retained ownership',()=>{
 const store=createStore(),p=store.players[1];store.limited_preview='active';const s=limitedState(p);
 const result={reward:'10'},req=()=>({request_id:crypto.randomUUID()});
 assert.equal(limitedDrop(store,p,req(),result,()=>.099999).candy_drop,true);assert.equal(limitedDrop(store,p,req(),result,()=>.1).candy_drop,false);assert.equal(s.tokens,1);
 const r=req();limitedDrop(store,p,r,result,()=>0);limitedDrop(store,p,r,result,()=>0);assert.equal(s.tokens,2);
 assert.equal(limitedDrop(store,p,{...req(),event_id:'admin-event'},result,()=>0).candy_drop,false);assert.equal(limitedDrop(store,p,req(),{reward:'0'},()=>0).candy_drop,false);
 const send=(action,extra={})=>execute(store,p,{action,request_id:crypto.randomUUID(),item_revision:itemState(p).revision,...extra});
 assert.throws(()=>send('limited_buy'));s.tokens=100;p.state.unlocked_ball_ids=['yellow','green'];
 const buy={action:'limited_buy',request_id:crypto.randomUUID(),item_revision:0};const got=execute(store,p,buy);assert.equal(got.limited.tokens,0);assert.equal(got.limited.owned[id].reward,'1500000000');assert.deepEqual(execute(store,p,buy),got);assert.throws(()=>send('limited_buy'));
 store.limited_preview='ended';send('limited_select',{ball_id:id});p.state.hammer_owned=true;p.state.hammer_level=30;const hit=send('limited_hit');assert.equal(hit.reward,'1500000000');assert.equal(s.tokens,0);assert.equal(s.clicks,0);p.state.rebirths=1;p.state.honey_expires_at=new Date(Date.now()+60000).toISOString();p.state.coating_expires_at=new Date(Date.now()+60000).toISOString();store.gold_event={multiplier:4,starts_at:new Date(Date.now()-1000).toISOString(),ends_at:new Date(Date.now()+60000).toISOString()};let boosted;do{boosted=send('limited_hit');}while(boosted.reward==='0');assert.equal(boosted.reward,'72000000000');
 assert.throws(()=>send('limited_select',{ball_id:'unowned'}));store.maintenance=true;assert.throws(()=>send('limited_hit'),e=>e.status===503);
});
test('limited SQL: real item wrapper, purchase transaction, separate progress, expiry and protected tables',async()=>{
 const require=createRequire(process.env.WAKPPU_TEST_NODE_PACKAGE||new URL('./test-results/sql-check/package.json',import.meta.url));const {PGlite}=require('@electric-sql/pglite'),db=new PGlite();const admin='00000000-0000-0000-0000-000000000001',player='00000000-0000-0000-0000-000000000002';
 try{const fixture=await readFile(new URL('./items-sql.test.mjs',import.meta.url),'utf8');await db.exec(fixture.match(/await db\.exec\(`([\s\S]*?)`\);/)[1].replaceAll('${admin}',admin).replaceAll('${player}',player));
 for(const name of ['20261004_accounts_and_rankings.sql','20261004_admin_exact_gold.sql','20261005_ranking_visibility_bans.sql','20261005_z_gold_event.sql','20261006_rebirth_100_big_gold.sql','20261007_hammer_level_30.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));
 await db.exec("create or replace function public.wakppu_api(b jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$begin if b->>'action'='mark_first_play' then return '{}'::jsonb;end if;return public.wakppu_api_before_events(b);end$$;");
 for(const name of ['20261007_admin_ball_event.sql','20261006_z_whitehole.sql','20261009_transcendent_balls.sql','20261008_gem_coating.sql','20261012_items_inventory.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));
 const sql=await readFile(new URL('../supabase/migrations/20261016_halloween_reward.sql',import.meta.url),'utf8');await db.exec(sql);await db.exec(sql);
 async function rpc(body,user=player){await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify(user?{sub:user,is_anonymous:false}:{})]);return (await db.query('select wakppu_api($1::jsonb) as data',[JSON.stringify(body)])).rows[0].data;}
 const get=()=>rpc({action:'limited'}),items=()=>rpc({action:'items'}),send=async(action,extra={})=>rpc({action,request_id:crypto.randomUUID(),item_revision:(await items()).revision,...extra});
 await get();assert.equal((await get()).season.active,false);await assert.rejects(send('limited_buy'));
 await db.exec(`update wakppu_limited_settings set starts_at=now()-interval '1 day',ends_at=now()+interval '1 day';update wakppu_limited_players set tokens=100 where user_id='${player}';update game_states set unlocked_ball_ids='["yellow","green"]',gold=12345,hammer_owned=true,hammer_level=30,item_current_clicks=2 where user_id='${player}';`);
 const buy={action:'limited_buy',request_id:crypto.randomUUID(),item_revision:(await items()).revision};const bought=await rpc(buy);assert.equal(bought.limited.tokens,0);assert.equal(bought.limited.owned[id].reward,'1500000000');assert.equal(bought.gold,'12345');await db.exec("update wakppu_limited_players set owned=jsonb_set(owned,array['halloween-pumpkin-2026','reward'],to_jsonb('10'::text));");await db.exec(sql);assert.equal((await get()).owned[id].reward,'1500000000');assert.deepEqual(await rpc(buy),bought);await assert.rejects(send('limited_buy'));
 await send('limited_select',{ball_id:id});let hit=await send('limited_hit');assert.equal(hit.reward,'1500000000');assert.equal(hit.gold,'1500012345');assert.equal((await db.query('select item_current_clicks from game_states where user_id=$1',[player])).rows[0].item_current_clicks,2);
 await db.exec('update wakppu_limited_settings set ends_at=now()-interval \'1 second\',starts_at=now()-interval \'2 days\'');assert.equal((await get()).season.active,false);await send('limited_select',{ball_id:null});await send('limited_select',{ball_id:id});await send('limited_hit');
 await assert.rejects(send('limited_select',{ball_id:'unowned'}));await assert.rejects(rpc({action:'limited'},null));
 await db.exec('update server_settings set maintenance=true');await assert.rejects(send('limited_hit'),e=>e.code==='PT503');await db.exec('update server_settings set maintenance=false');
 const ordinary=await send('item_hit');assert.equal(ordinary.candy_drop,false);assert.equal(ordinary.limited.tokens,0);
 await db.exec('set role authenticated');await assert.rejects(db.exec('update wakppu_limited_players set tokens=999'));await assert.rejects(db.exec('select * from wakppu_limited_settings'));await db.exec('reset role');
 }finally{await db.close();}
});
