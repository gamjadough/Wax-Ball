'use strict';
(() => {
  const { CONFIG, BALL_TYPES } = window.WaxArena;
  const STATES = Object.freeze({ WAITING: 'waiting', RUNNING: 'running', VICTORY: 'victory', DEFEAT: 'defeat' });
  // Pure local simulation. A server adapter can later provide authoritative events
  // to the renderer without mixing DOM effects into the combat rules.
  class Battle {
    constructor(config = CONFIG, ballTypes = BALL_TYPES) {
      this.config = config;
      this.ballTypes = ballTypes;
      this.reset(false);
    }
    reset(start = true) {
      this.round = (this.round || 0) + 1;
      this.status = start ? STATES.RUNNING : STATES.WAITING;
      this.time = 0;
      this.nextAiHit = this.config.aiHitIntervalMs;
      this.sequence = 0;
      this.pending = [];
      this.events = [];
      this.fighters = {};
      for (const side of ['player', 'ai']) this.fighters[side] = { health: this.config.maxHealth, hits: 0, breaking: false, ballId: 1 };
      this.emit('reset', { status: this.status });
    }
    emit(type, detail = {}) { this.events.push({ type, round: this.round, time: this.time, ...detail }); }
    drainEvents() { const events = this.events; this.events = []; return events; }
    hit(side) {
      const fighter = this.fighters[side];
      if (this.status !== STATES.RUNNING || !fighter || fighter.breaking) return false;
      const ball = this.ballTypes[this.config.ballType];
      fighter.hits = Math.min(fighter.hits + 1, ball.hitsToBreak);
      this.emit('hit', { side, hits: fighter.hits });
      if (fighter.hits === ball.hitsToBreak) {
        fighter.breaking = true;
        this.pending.push({ at: this.time + this.config.destructionMs, order: this.sequence++, side, ballId: fighter.ballId });
        this.emit('breaking', { side });
      }
      return true;
    }
    completeDestruction(task) {
      const fighter = this.fighters[task.side];
      if (this.status !== STATES.RUNNING || !fighter.breaking || fighter.ballId !== task.ballId) return;
      const target = task.side === 'player' ? 'ai' : 'player';
      const ball = this.ballTypes[this.config.ballType];
      fighter.ballId++;
      fighter.hits = 0;
      fighter.breaking = false;
      this.emit('destroyed', { side: task.side, ballId: task.ballId, target });
      // Exactly one damage calculation, owned by the completed destruction.
      // Projectiles are presentation only and cannot apply a second hit.
      const previous = this.fighters[target].health;
      this.fighters[target].health = Math.max(0, previous - ball.damage);
      this.emit('damage', { side: task.side, target, damage: previous - this.fighters[target].health, health: this.fighters[target].health });
      if (this.fighters[target].health === 0) {
        this.status = target === 'ai' ? STATES.VICTORY : STATES.DEFEAT;
        this.pending = [];
        this.nextAiHit = Infinity;
        this.emit('ended', { status: this.status });
      }
    }
    advance(deltaMs) {
      if (this.status !== STATES.RUNNING || !Number.isFinite(deltaMs) || deltaMs < 0) return;
      const end = this.time + deltaMs;
      while (this.status === STATES.RUNNING) {
        this.pending.sort((a, b) => a.at - b.at || a.order - b.order);
        const task = this.pending[0];
        const taskTime = task ? task.at : Infinity;
        const next = Math.min(taskTime, this.nextAiHit);
        if (next > end) break;
        this.time = next;
        if (taskTime <= this.nextAiHit) {
          this.pending.shift();
          this.completeDestruction(task);
        } else {
          this.nextAiHit += this.config.aiHitIntervalMs;
          this.hit('ai');
        }
      }
      if (this.status === STATES.RUNNING) this.time = end;
    }
  }
  window.WaxArena.Battle = Battle;
  window.WaxArena.STATES = STATES;
})();
