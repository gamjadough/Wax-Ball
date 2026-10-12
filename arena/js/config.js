'use strict';
window.WaxArena = window.WaxArena || {};
// Future rarities can be added here without changing the battle rules.
window.WaxArena.BALL_TYPES = Object.freeze({
  common: Object.freeze({ name: '일반 왁뿌볼', hitsToBreak: 5, damage: 10 })
});
window.WaxArena.AI_DIFFICULTIES = Object.freeze({
  entry: Object.freeze({ name: '입문', aiHitIntervalMs: 1500 }),
  beginner: Object.freeze({ name: '초급', aiHitIntervalMs: 850 }),
  intermediate: Object.freeze({ name: '중급', aiHitIntervalMs: 450 }),
  advanced: Object.freeze({ name: '고급', aiHitIntervalMs: 200 })
});
window.WaxArena.CONFIG = Object.freeze({
  maxHealth: 1000,
  ballType: 'common',
  defaultDifficulty: 'beginner',
  destructionMs: 160,
  projectileMs: 520,
  maxLogEntries: 40
});
