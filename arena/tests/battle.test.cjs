const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const context = { window: {} };
vm.createContext(context);
for (const file of ['config.js', 'battle.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', file), 'utf8'), context);
const { Battle, CONFIG, STATES, AI_DIFFICULTIES } = context.window.WaxArena;
const defaultInterval = AI_DIFFICULTIES[CONFIG.defaultDifficulty].aiHitIntervalMs;
let checks = 0;
function test(name, run) { run(); checks++; console.log('PASS ' + name); }
function smash(battle, side = 'player') { for (let i = 0; i < 5; i++) battle.hit(side); }
test('waiting blocks all hits and AI progression', () => {
  const battle = new Battle();
  assert.equal(battle.hit('player'), false);
  battle.advance(10000);
  assert.equal(battle.fighters.player.health, 1000);
  assert.equal(battle.time, 0);
});
test('five hits, completion-only damage, clamp and duplicate protection', () => {
  const battle = new Battle(); battle.reset(); battle.drainEvents();
  for (let i = 1; i <= 4; i++) {
    assert.equal(battle.hit('player'), true);
    assert.equal(battle.fighters.player.hits, i);
    assert.equal(battle.fighters.ai.health, 1000);
  }
  battle.hit('player');
  for (let i = 0; i < 100; i++) assert.equal(battle.hit('player'), false);
  assert.equal(battle.pending.length, 1);
  battle.advance(159); assert.equal(battle.fighters.ai.health, 1000);
  battle.advance(1); assert.equal(battle.fighters.ai.health, 990);
  assert.equal(battle.fighters.player.hits, 0);
  assert.equal(battle.fighters.player.ballId, 2);
  assert.equal(battle.drainEvents().filter(e => e.type === 'damage').length, 1);
  assert.equal(battle.hit('player'), true); // next ball during projectile flight
});
test('AI uses five progress updates then one destruction event', () => {
  const battle = new Battle(); battle.reset(); battle.drainEvents();
  battle.advance(defaultInterval * 4);
  assert.equal(battle.fighters.ai.hits, 4);
  assert.equal(battle.fighters.player.health, 1000);
  battle.advance(defaultInterval);
  assert.equal(battle.fighters.ai.breaking, true);
  assert.equal(battle.fighters.player.health, 1000);
  battle.advance(CONFIG.destructionMs);
  assert.equal(battle.fighters.player.health, 990);
  assert.equal(battle.drainEvents().filter(e => e.type === 'damage').length, 1);
});
test('concurrent attacks are independent', () => {
  const battle = new Battle(); battle.reset();
  smash(battle, 'player'); smash(battle, 'ai'); battle.advance(160);
  assert.equal(battle.fighters.player.health, 990);
  assert.equal(battle.fighters.ai.health, 990);
});
test('full 1000-health victory and no post-match changes', () => {
  const battle = new Battle(); battle.reset();
  for (let i = 0; i < 100; i++) { smash(battle); battle.advance(160); }
  assert.equal(battle.status, STATES.VICTORY);
  assert.equal(battle.fighters.ai.health, 0);
  assert.equal(battle.pending.length, 0);
  const before = JSON.stringify(battle.fighters);
  for (let i = 0; i < 100; i++) { battle.hit('player'); battle.hit('ai'); battle.advance(10000); }
  assert.equal(JSON.stringify(battle.fighters), before);
});
test('full AI defeat stops AI and clears scheduled work', () => {
  const battle = new Battle(); battle.reset();
  battle.advance(defaultInterval * 5 * 100 + CONFIG.destructionMs);
  assert.equal(battle.status, STATES.DEFEAT);
  assert.equal(battle.fighters.player.health, 0);
  assert.equal(battle.nextAiHit, Infinity);
  assert.equal(battle.pending.length, 0);
});
test('simultaneous lethal attacks respect first completion, HP never negative', () => {
  const battle = new Battle(); battle.reset();
  battle.fighters.ai.health = 7; battle.fighters.player.health = 7;
  smash(battle); smash(battle, 'ai'); battle.advance(160);
  assert.equal(battle.status, STATES.VICTORY);
  assert.equal(battle.fighters.ai.health, 0);
  assert.equal(battle.fighters.player.health, 7);
  assert.equal(battle.pending.length, 0);
});
test('restart invalidates pending destruction, clears progress and event queue', () => {
  const battle = new Battle(); battle.reset(); smash(battle);
  for (let i = 0; i < 50; i++) battle.reset();
  battle.advance(160);
  assert.equal(battle.fighters.ai.health, 1000);
  assert.equal(battle.fighters.player.hits, 0);
  assert.equal(battle.fighters.ai.hits, 0);
  assert.equal(battle.pending.length, 0);
  assert.ok(battle.drainEvents().every(e => e.round === battle.round));
  battle.advance(850 - 160);
  assert.equal(battle.fighters.ai.hits, 1);
});
test('invalid inputs cannot corrupt progress or health', () => {
  const battle = new Battle(); battle.reset();
  assert.equal(battle.hit('invalid'), false);
  for (const delta of [NaN, Infinity, -1]) battle.advance(delta);
  assert.equal(battle.time, 0);
  assert.equal(battle.fighters.player.health, 1000);
});
test('four difficulty levels increase actual click speed and preserve damage rules', () => {
  let previousInterval = Infinity;
  let previousDamageTime = Infinity;
  for (const [difficulty, settings] of Object.entries(AI_DIFFICULTIES)) {
    const battle = new Battle(); battle.reset(true, difficulty); battle.drainEvents();
    assert.ok(settings.aiHitIntervalMs < previousInterval);
    battle.advance(settings.aiHitIntervalMs - 1);
    assert.equal(battle.fighters.ai.hits, 0);
    battle.advance(1);
    assert.equal(battle.fighters.ai.hits, 1);
    battle.advance(settings.aiHitIntervalMs * 4);
    assert.equal(battle.fighters.ai.breaking, true);
    assert.equal(battle.fighters.player.health, 1000);
    battle.advance(CONFIG.destructionMs);
    assert.equal(battle.fighters.player.health, 990);
    assert.equal(battle.drainEvents().filter(e => e.type === 'hit').length, 5);
    assert.ok(battle.time < previousDamageTime);
    previousInterval = settings.aiHitIntervalMs;
    previousDamageTime = battle.time;
    battle.reset();
    assert.equal(battle.difficulty, difficulty);
    assert.equal(battle.nextAiHit, settings.aiHitIntervalMs);
  }
});
test('changing difficulty clears previous scheduled attacks and invalid difficulty is rejected', () => {
  const battle = new Battle(); battle.reset(true, 'advanced'); battle.advance(1000);
  assert.equal(battle.pending.length, 1);
  battle.reset(false); battle.reset(true, 'entry'); battle.advance(1499);
  assert.equal(battle.pending.length, 0);
  assert.equal(battle.fighters.ai.hits, 0);
  assert.equal(battle.fighters.player.health, 1000);
  battle.advance(1); assert.equal(battle.fighters.ai.hits, 1);
  for (const difficulty of ['invalid', '__proto__', 'constructor']) {
    assert.throws(() => battle.reset(true, difficulty), /Unknown AI difficulty/);
    assert.equal(battle.difficulty, 'entry');
  }
});
test('all difficulties reach defeat once and stop after the match', () => {
  for (const [difficulty, settings] of Object.entries(AI_DIFFICULTIES)) {
    const battle = new Battle(); battle.reset(true, difficulty);
    battle.advance(settings.aiHitIntervalMs * 500 + CONFIG.destructionMs);
    assert.equal(battle.status, STATES.DEFEAT);
    assert.equal(battle.fighters.player.health, 0);
    assert.equal(battle.pending.length, 0);
    assert.equal(battle.drainEvents().filter(e => e.type === 'ended').length, 1);
    const before = JSON.stringify(battle.fighters);
    battle.advance(10000);
    assert.equal(JSON.stringify(battle.fighters), before);
  }
});
console.log(`${checks} battle checks passed.`);
