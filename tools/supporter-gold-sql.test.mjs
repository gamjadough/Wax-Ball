import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {createRequire} from 'node:module';
const require=createRequire(process.env.WAKPPU_TEST_NODE_PACKAGE||new URL('./test-results/sql-check/package.json',import.meta.url));const {PGlite}=require('@electric-sql/pglite');
const admin='00000000-0000-0000-0000-000000000001',player='00000000-0000-0000-0000-000000000002';
const sql=n=>readFile(new URL('../supabase/migrations/'+n,import.meta.url),'utf8');
test('actual SQL: supporter final reward, fractional carry, replay, all ball paths, refund and protected helper',async()=>{
 const db=new PGlite();try{
 const fixture=await readFile(new URL('./items-sql.test.mjs',import.meta.url),'utf8');await db.exec(fixture.match(/await db\.exec\(`([\s\S]*?)`\);/)[1].replaceAll('${admin}',admin).replaceAll('${player}',player));
 await db.exec(`create table auth.users(id uuid primary key,is_anonymous boolean default false,email text,email_confirmed_at timestamptz,created_at timestamptz default now(),raw_user_meta_data jsonb default '{}');insert into auth.users(id,is_anonymous,email,email_confirmed_at) values('${admin}',false,'admin@local.test',now()),('${player}',false,'player@local.test',now());`);
 for(const n of ['20261004_accounts_and_rankings.sql','20261004_admin_exact_gold.sql','20261005_ranking_visibility_bans.sql','20261005_z_gold_event.sql','20261006_guest_lifecycle.sql','20261006_rebirth_100_big_gold.sql','20261007_hammer_level_30.sql'])await db.exec(await sql(n));
 for(const n of ['20261007_admin_ball_event.sql','20261006_z_whitehole.sql','20261009_transcendent_balls.sql','20261008_gem_coating.sql','20261012_items_inventory.sql','20261016_halloween_reward.sql','20261019_items_remake.sql','20261019084353_manual_bank_orders.sql','20261020010000_supporter_gold_bonus.sql','20261020010100_supporter_gold_paths.sql'])await db.exec(await sql(n));
 // Reapplying cannot wrap rewards twice or reset an existing carry.
 await db.exec(await sql('20261020010100_supporter_gold_paths.sql'));
 async function rpc(body,user=player){await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify(user?{sub:user,is_anonymous:false}:{})]);return (await db.query('select wakppu_api($1::jsonb) as data',[JSON.stringify(body)])).rows[0].data;}
 const items=()=>rpc({action:'items'}),requests=[];
 async function send(action,more={}){const b={action,request_id:crypto.randomUUID(),item_revision:(await items()).revision,...more};requests.push(b);return rpc(b);}
 async function finish(action,more={}){for(let i=0;i<30;i++){const r=await send(action,more);if(BigInt(r.reward)>0n)return r;}throw Error('No break');}
 const carry=async()=>(await db.query('select supporter_gold_remainder as carry from game_states where user_id=$1',[player])).rows[0].carry;
 await db.exec(`update game_states set gold=0,hammer_owned=true,hammer_level=30 where user_id='${player}'`);
 assert.equal((await finish('item_hit')).reward,'1');assert.equal(await carry(),0);
 const cfg=await rpc({action:'admin_purchase_config'},admin);
 await rpc({action:'admin_purchase_config',mode:'set',revision:cfg.revision,enabled:true,bank_name:'테스트은행',account_number:'000-00000',account_holder:'테스트',support_contact:'실제 송금 금지'},admin);
 const order=(await rpc({action:'purchase_order',product_id:'supporter_pack',depositor:'테스트',request_id:crypto.randomUUID()})).order;
 const goldBefore=(await items()).gold;
 await rpc({action:'admin_purchase_approve',order_id:order.id,confirmed_amount:1100,deposit_reference:'local-receipt'},admin);
 assert.equal((await items()).gold,goldBefore);assert.equal(await carry(),0);
 let earned=0n;for(let i=0;i<20;i++)earned+=BigInt((await finish('item_hit')).reward);
 assert.equal(earned,21n);assert.equal(await carry(),0);
 const replay=requests.at(-1),beforeReplay=await items();await rpc(replay);await rpc(replay);assert.equal((await items()).gold,beforeReplay.gold);assert.equal(await carry(),0);
 await finish('item_hit');assert.equal(await carry(),5);await db.exec(await sql('20261020010000_supporter_gold_bonus.sql'));assert.equal(await carry(),5);
 await db.exec(`update game_states set gold=0,rebirths=1 where user_id='${player}'`);assert.equal(await carry(),5);assert.equal((await finish('item_hit')).reward,'2');assert.equal(await carry(),15);
 // Rebirth 2 × honey 2 × coating 3 × event 7 × item reward 2 = 336; then +5%.
 await db.exec(`update game_states set supporter_gold_remainder=0,rebirths=2,honey_expires_at=now()+interval '1 minute',coating_expires_at=now()+interval '1 minute' where user_id='${player}';update wakppu_items set effects='{"rare_wax_coating":{"remaining":5}}' where user_id='${player}';update server_settings set gold_event=jsonb_build_object('multiplier',7,'starts_at',now()-interval '1 second','ends_at',now()+interval '1 minute') where id=true;`);
 assert.equal((await finish('item_hit')).reward,'352');assert.equal(await carry(),80);
 await db.exec(`update game_states set supporter_gold_remainder=0,rebirths=0,honey_expires_at=null,coating_expires_at=null where user_id='${player}';update wakppu_items set effects='{}' where user_id='${player}';update server_settings set gold_event=null where id=true;`);
 const event=(await rpc({action:'admin_ball_event',mode:'start',duration_seconds:300,delay_seconds:0},admin)).admin_ball_event;
 const eventItem=await finish('item_hit',{event_id:event.id});assert.equal(eventItem.reward,'10');assert.equal(await carry(),50);
 const legacy=await finish('event_ball_hit',{event_id:event.id});assert.equal(legacy.reward,'11');assert.equal(await carry(),0);const legacyRequest=requests.at(-1);const legacyGold=(await items()).gold;await rpc(legacyRequest);assert.equal((await items()).gold,legacyGold);
 await rpc({action:'limited'});await db.exec(`update wakppu_limited_settings set starts_at=now()-interval '1 day',ends_at=now()+interval '1 day';update wakppu_limited_players set tokens=100 where user_id='${player}';`);
 await send('limited_buy');await send('limited_select',{ball_id:'halloween-pumpkin-2026'});assert.equal((await finish('limited_hit')).reward,'1575000000');
 const limitedRequest=requests.at(-1),limitedGold=(await items()).gold;await rpc(limitedRequest);assert.equal((await items()).gold,limitedGold);
 await rpc({action:'admin_gold',user_id:player,mode:'add',value:'100',reason:'test'},admin);assert.equal((await items()).gold,String(BigInt(limitedGold)+100n));
 await rpc({action:'admin_purchase_refund',order_id:order.id,refund_reference:'local-refund'},admin);
 await send('limited_select',{ball_id:null});assert.equal((await finish('item_hit')).reward,'1');assert.equal(await carry(),0);
 await db.exec('set role authenticated');await assert.rejects(db.query('select wakppu_supporter_reward($1,100)',[player]),{code:'42501'});await db.exec('reset role');
 await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:admin})]);await assert.rejects(db.query('select wakppu_supporter_reward($1,100)',[player]),{code:'PT403'});
 await assert.rejects(rpc({action:'items'},null),{code:'PT401'});
 }finally{await db.close();}
});
