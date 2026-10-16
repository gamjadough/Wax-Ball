import {test} from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync,existsSync} from 'node:fs';
const read=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8');
function context(){const c={window:{},DEFAULT_SOUNDS:{early:['tap1'],final:['break'],pitch:1,volume:.9}};vm.createContext(c);vm.runInContext(read('wakppuball/js/skin-sounds.js'),c);vm.runInContext(read('wakppuball/js/sound.js'),c);return c;}
test('five cosmetic profiles each resolve four real MP3s and do not change stats',()=>{
 const c=context(),profiles=c.window.WakppuSkinSounds.profiles;assert.equal(profiles.length,5);
 for(const p of profiles){const ball={id:'eternity',skinId:p.id,clicks:184320,reward:1000000000};c.ball=ball;
  const cfg=vm.runInContext('getSoundConfig(ball)',c);
  for(const stage of ['early','mid','late','final'])assert.ok(existsSync(new URL('../wakppuball/sounds/'+cfg[stage][0]+'.mp3',import.meta.url)));
  assert.equal(ball.clicks,184320);assert.equal(ball.reward,1000000000);
 }
});
test('unknown skins and other balls retain existing sound config',()=>{
 const c=context();for(const ball of [{id:'eternity',skinId:'unknown',sound:{pitch:.675}},{id:'yellow',skinId:'rare',sound:{pitch:.8}}]){
 c.ball=ball;const cfg=vm.runInContext('getSoundConfig(ball)',c);assert.equal(cfg.early[0],'tap1');assert.equal(cfg.final[0],'break');assert.equal(cfg.pitch,ball.sound.pitch);
 }
});
test('five distinct SVG appearances preserve original ball stats/design',()=>{
 const c=context();vm.runInContext(read('wakppuball/js/ball-art.js'),c);
 const base={id:'eternity',clicks:184320,reward:1000000000,design:{art:'transcendent',motif:'eternity',shape:'circle',colors:{light:'#fff',mid:'#aaa',dark:'#000'},crack:{light:'#fff',dark:'#000'},chip:['#fff']}};
 const original=JSON.stringify(base),art=new Set();
 for(const p of c.window.WakppuSkinSounds.profiles){c.ball=c.window.WakppuSkinSounds.appearance({...base,skinId:p.id});assert.equal(c.ball.clicks,base.clicks);assert.equal(c.ball.reward,base.reward);assert.equal(c.ball.design.motif,'eternity');const svg=vm.runInContext("buildBallSvgInner(ball,'test')",c);assert.ok(svg.includes('data-eternity-skin="'+p.id+'"'));art.add(svg);}
 assert.equal(art.size,5);assert.equal(JSON.stringify(base),original);assert.equal(c.window.WakppuSkinSounds.appearance(base),base);
});
