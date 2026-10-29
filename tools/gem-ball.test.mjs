import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';import vm from 'node:vm';
import {gemBallFixture,a,p} from './gem-ball-fixture.mjs';import {createStore} from './admin-service.mjs';import {execute} from './gem-ball-service.mjs';import {gemState} from './blue-gem-data.mjs';import {itemState} from './items-service.mjs';
test('local gem ball: permanent buy, no Gold/extra one gem, hammer cap, replay, anonymous admin and real stock preservation',()=>{
 const s=createStore(),user=s.players[1],admin=s.players[0];s.sleep_now_ms=Date.parse('2026-10-29T03:00:00Z');gemState(user).balance=5000n;
 const send=(actor,action,b={})=>execute(s,actor,{action,item_revision:itemState(actor).revision,request_id:crypto.randomUUID(),...b});
 const buy={action:'gem_ball_buy',ball_id:'blue-crystal-wax',request_id:crypto.randomUUID(),item_revision:0};
 execute(s,user,buy);execute(s,user,buy);assert.equal(gemState(user).balance,0n);send(user,'gem_ball_select',{ball_id:'blue-crystal-wax'});
 user.state.hammer_owned=true;user.state.hammer_level=30;const before=user.state.gold;
 const hit={action:'item_hit',item_revision:itemState(user).revision,request_id:crypto.randomUUID()},r=execute(s,user,hit);
 assert.equal(r.clicks,100);assert.equal(r.broken,true);assert.equal(r.reward,'0');assert.equal(r.gem_reward,'5');assert.equal(gemState(user).balance,5n);assert.equal(user.state.gold,before);
 execute(s,user,hit);assert.equal(gemState(user).balance,5n);user.state.rebirths=1;assert.ok(execute(s,user,{action:'gem_balls'}).owned.includes('blue-crystal-wax'));
 send(admin,'gem_ball_select',{ball_id:'blue-crystal-wax'});assert.equal(gemState(admin).balance,0n);admin.is_anonymous=true;assert.equal(execute(s,admin,{action:'gem_balls'}).selected,null);
});
test('real SQL gem ball: shared input guard/ember path, CAS buy, manual ownership, fixed five gems/zero Gold, effects, replay, switches and permissions',async()=>{
 const {db,rpc,send}=await gemBallFixture();try{
 await assert.rejects(send('gem_ball_select',{ball_id:'blue-crystal-wax'}),{code:'PT403'});
 await assert.rejects(send('gem_ball_buy',{ball_id:'blue-crystal-wax'}),{code:'PT400'});
 const before=(await rpc('items')).gold;await db.query('insert into wakppu_blue_gems(user_id,balance) values($1,5000)',[p]);
 let req={ball_id:'blue-crystal-wax',request_id:crypto.randomUUID(),item_revision:(await rpc('items')).revision};
 let r=await rpc('gem_ball_buy',req);assert.equal(r.blue_gems.balance,'0');assert.deepEqual(await rpc('gem_ball_buy',req),r);
 await send('gem_ball_select',{ball_id:'blue-crystal-wax'});
 r=await send('item_hit');assert.equal(r.clicks,1);assert.equal(r.gem_reward,'0');assert.equal(r.gold,before);
 await db.query("update game_states set hammer_owned=true,hammer_level=30,hammer_selected_level=30,rebirths=5,honey_expires_at=now()+interval '1 hour',coating_expires_at=now()+interval '1 hour' where user_id=$1",[p]);
 await db.query("update wakppu_items set effects='{\"rare_wax_coating\":{\"remaining\":5},\"common_crack_piece\":{\"remaining\":5}}' where user_id=$1",[p]);
 await db.query('update wakppu_blue_gems set level=7 where user_id=$1',[p]);
 req={request_id:crypto.randomUUID(),item_revision:(await rpc('items')).revision};r=await rpc('item_hit',req);
 assert.equal(r.broken,true);assert.equal(r.clicks,100);assert.equal(r.required_clicks,100);assert.equal(r.gold,before);assert.equal(r.reward,'0');assert.equal(r.blue_gems.balance,'5');
 assert.equal(r.effects.rare_wax_coating.remaining,5);assert.equal(r.effects.common_crack_piece.remaining,4);assert.deepEqual(await rpc('item_hit',req),r);assert.equal((await rpc('blue_gems')).balance,'5');
 await db.query("update wakppu_input_guard set tokens=0,token_at=clock_timestamp()+interval '1 day' where user_id=$1",[p]);await assert.rejects(send('item_hit'),{code:'PT429'});
 await db.query("update wakppu_input_guard set tokens=100,token_at=clock_timestamp()-interval '1 day' where user_id=$1",[p]);
 await rpc('halloween_cosmetics');await db.query("update wakppu_halloween_cosmetics set owned='{\"pumpkin_ember\":true}',equipped='pumpkin_ember' where user_id=$1",[p]);
 req={hit_action:'item_hit',request_id:crypto.randomUUID(),item_revision:(await rpc('items')).revision};r=await rpc('ember_auto_hit',req);assert.equal(r.gem_reward,'5');assert.equal(r.gold,before);assert.equal(r.gem_balls.selected,'blue-crystal-wax');
 assert.deepEqual(await rpc('ember_auto_hit',req),r);await assert.rejects(send('ember_auto_hit',{hit_action:'item_hit'}),{code:'PT429'});
 r=await send('gem_ball_select',{ball_id:null});assert.equal(r.gem_balls.selected,null);assert.equal((await send('item_hit')).gem_reward,undefined);
 await send('gem_ball_select',{ball_id:'blue-crystal-wax'},a);assert.deepEqual((await rpc('gem_balls',{},a)).owned,[]);assert.equal((await rpc('gem_balls',{},a,true)).selected,null);
 await db.query("update players set role='player' where user_id=$1",[a]);assert.equal((await rpc('gem_balls',{},a)).selected,null);
 await assert.rejects(rpc('gem_balls',{},null),{code:'PT401'});
 await assert.rejects(send('gem_ball_buy',{ball_id:'blue-crystal-wax',price:0}),{code:'PT403'});
 await db.exec('update server_settings set maintenance=true');await assert.rejects(rpc('gem_balls'),{code:'PT503'});await db.exec('update server_settings set maintenance=false');
 await db.query("insert into moderation_cases(user_id,status) values($1,'banned') on conflict(user_id) do update set status='banned'",[p]);await assert.rejects(rpc('gem_balls'),{code:'PT403'});
 await db.exec('set role authenticated');for(const t of ['wakppu_gem_ball_defs','wakppu_gem_ball_players','wakppu_gem_ball_requests'])await assert.rejects(db.exec('select * from '+t),{code:'42501'});
 await assert.rejects(db.exec("select wakppu_gem_ball_hit('{}')"),{code:'42501'});
 }finally{await db.close();}
});
test('crystal theme: original bounded CC0 audio, zero Gold data, dedicated SVG and exact eternity motion timings',async()=>{
 const code=await readFile(new URL('../wakppuball/js/gem-ball-data.js',import.meta.url),'utf8'),ctx={window:{}};vm.runInNewContext(code,ctx);const ball=ctx.window.WakppuGemBallData.ball;
 assert.equal(ball.reward,0);assert.equal(ball.clicks,100);assert.match(ctx.window.WakppuGemBallArt('test').art,/data-gem-wax="blue-crystal"/);
 assert.equal(ball.design.motif,'blue_crystal');
 const fx={window:{}};vm.runInNewContext(await readFile(new URL('../wakppuball/js/transcendent-effects.js',import.meta.url),'utf8'),fx);
 assert.equal(fx.window.WakppuTranscendent.profiles.blue_crystal.duration,fx.window.WakppuTranscendent.profiles.eternity.duration);
 assert.equal(fx.window.WakppuTranscendent.profiles.blue_crystal.kind,'crystals');
 const meta=JSON.parse(await readFile(new URL('../wakppuball/sounds/blue-crystal/sources.json',import.meta.url),'utf8'));assert.equal(meta.license,'CC0-1.0');
 for(const file of meta.outputs){const bytes=await readFile(new URL('../wakppuball/sounds/blue-crystal/'+file.file,import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),file.sha256);assert.ok(file.duration<=1&&file.peak<.5);assert.ok(bytes.length<45000);}
 assert.equal(new Set(meta.outputs.map(f=>f.sha256)).size,4);
});
test('crystal and eternity share actual reward/respawn deadlines, speed modifiers, reduced motion and cancellation cleanup',async()=>{
 const code=await readFile(new URL('../wakppuball/js/transcendent-effects.js',import.meta.url),'utf8');
 for(const reduced of [false,true])for(const [speed,respawnSpeed] of [[1,1],[3,5]]){
  const run=motif=>{
   let clock=0,paid=0,spawned=0;const timers=new Map(),nodes=[],events=[];let next=0;
   const el=()=>({style:{setProperty(){}},dataset:{},setAttribute(){},remove(){this.removed=true;},animate(){return {cancel(){}};}});
   const c={window:{WakppuSettings:{reduced:()=>reduced}},document:{createElement:()=>{const n=el();nodes.push(n);return n;}},CustomEvent:class{constructor(type,o){this.detail=o.detail;}},matchMedia:()=>({matches:false}),setTimeout:(f,t)=>{timers.set(++next,{f,t});return next;},clearTimeout:id=>timers.delete(id)};
   vm.runInNewContext(code,c);const wrap=el();wrap.dispatchEvent=e=>events.push(e.detail.phase);
   const fx=c.window.WakppuTranscendent.play({ball:{id:motif,design:{motif}},wrap,svg:el(),effects:{append(){}},center:{x:100,y:100},radius:80,valid:()=>true,reward:()=>paid=clock,respawn:()=>spawned=clock,speed,respawnSpeed});
   while(timers.size){const [id,t]=[...timers].sort((a,b)=>a[1].t-b[1].t)[0];timers.delete(id);clock=t.t;t.f();}
   assert.ok(nodes.every(n=>n.removed));assert.deepEqual(events,['charge','release','reward','complete']);
   fx.cancel();assert.equal(timers.size,0);return {paid,spawned};
  };
  const crystal=run('blue_crystal');assert.deepEqual(crystal,run('eternity'));
  assert.equal(crystal.paid,(reduced?650:2100)/speed*.62);assert.equal(crystal.spawned,(reduced?650:2100)/speed+1000/respawnSpeed);
 }
});
