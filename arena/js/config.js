'use strict';
window.WaxArena = window.WaxArena || {};
// Future rarities can be added here without changing the battle rules.
window.WaxArena.BALL_TYPES = Object.freeze({
  common: Object.freeze({ name: '일반 왁뿌볼', hitsToBreak: 5, damage: 10 })
});
window.WaxArena.CONFIG = Object.freeze({
  maxHealth: 1000,
  ballType: 'common',
  aiHitIntervalMs: 850,
  destructionMs: 160,
  projectileMs: 520,
  maxLogEntries: 40
});
