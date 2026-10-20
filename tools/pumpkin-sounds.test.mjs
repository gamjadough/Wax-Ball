import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import {createHash} from 'node:crypto';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('pumpkin has dedicated staged CC0 sounds, unchanged gameplay and startup preload',()=>{
 const c={window:{},DEFAULT_SOUNDS:{early:['tap1'],mid:['crack1'],late:['crack2'],final:['break'],pitch:1,pitchRandom:.06,volume:.9},SoundManager:{init(names){c.loaded=names;}}};
 vm.createContext(c);vm.runInContext(read('wakppuball/js/limited-data.js'),c);c.WakppuLimitedData=c.window.WakppuLimitedData;
 const config=read('wakppuball/js/sound.js').split('const SoundManager =')[0];vm.runInContext(config,c);c.ball=c.WakppuLimitedData.ball;
 const cfg=vm.runInContext('getSoundConfig(ball)',c);assert.equal(c.ball.clicks,100);assert.equal(c.ball.reward,1500000000);
 const names=['early','mid','late','final'].flatMap(k=>cfg[k]);assert.equal(new Set(names).size,5);assert.equal(cfg.final[0],'pumpkin/break');assert.equal(cfg.pitch,1);assert.ok(cfg.volume<.8);
 const game=read('wakppuball/js/game.js');c.WAKPPU_BALLS=[{id:'yellow'}];const start=game.indexOf('const soundNames = new Set();'),end=game.indexOf('SoundManager.init(Array.from(soundNames));',start)+'SoundManager.init(Array.from(soundNames));'.length;
 vm.runInContext(game.slice(start,end),c);for(const n of names)assert.ok(c.loaded.includes(n));assert.ok(c.loaded.includes('jackolantern-sting.wav'));
 const manifest=JSON.parse(read('wakppuball/sounds/pumpkin/sources.json'));assert.equal(manifest.license,'CC0-1.0');assert.equal(manifest.outputs.length,5);
 for(const output of manifest.outputs){const bytes=fs.readFileSync(new URL('../wakppuball/sounds/pumpkin/'+output.file,import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),output.sha256);assert.ok(bytes.length>1000&&bytes.length<15000);assert.ok(output.peak<=.620001);assert.ok(output.duration<=1.05);}
 const html=read('wakppuball/index.html');for(const [n,version] of [['game','20261020-inputguard1'],['limited-data','20261019-pumpkin-audio1']])assert.ok(html.includes('js/'+n+'.js?v='+version));
});
