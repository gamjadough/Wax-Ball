'use strict';
(() => {
  const STORAGE_KEY = 'wax-ball-arena.progress.v1';
  const WIN_REWARD = 50;
  const HISTORY_LIMIT = 100;
  const empty = () => ({ version: 1, gold: 0, wins: 0, losses: 0, history: [] });
  const count = value => Number.isSafeInteger(value) && value >= 0;
  function valid(state) {
    return state && state.version === 1 && count(state.gold) && count(state.wins) && count(state.losses)
      && Array.isArray(state.history) && state.history.length <= HISTORY_LIMIT
      && state.history.every(match => match && typeof match.id === 'string' && match.id.length > 0 && match.id.length <= 128
        && ['victory', 'defeat'].includes(match.result) && Object.hasOwn(window.WaxArena.AI_DIFFICULTIES, match.difficulty)
        && count(match.reward) && match.reward <= WIN_REWARD && (match.result !== 'defeat' || match.reward === 0)
        && Number.isFinite(match.durationMs) && match.durationMs >= 0 && count(match.completedAt))
      && new Set(state.history.map(match => match.id)).size === state.history.length;
  }
  class ProgressStore {
    constructor(storage) {
      this.state = empty();
      this.issue = '';
      this.dirty = false;
      this.completed = new Set();
      try { this.storage = storage === undefined ? window.localStorage : storage; }
      catch { this.storage = null; }
      this.refresh();
    }
    refresh() {
      if (this.dirty) return;
      try {
        if (!this.storage) throw new Error('Storage unavailable');
        const raw = this.storage.getItem(STORAGE_KEY);
        const state = raw === null ? empty() : JSON.parse(raw);
        if (!valid(state)) throw new SyntaxError('Invalid progress');
        // Only copy known fields from saved JSON.
        this.state = { version: 1, gold: state.gold, wins: state.wins, losses: state.losses,
          history: state.history.map(({ id, result, difficulty, reward, durationMs, completedAt }) => ({ id, result, difficulty, reward, durationMs, completedAt })) };
        for (const match of this.state.history) this.completed.add(match.id);
        this.issue = '';
      } catch (error) { this.issue = error instanceof SyntaxError ? 'corrupt' : 'unavailable'; }
    }
    getSnapshot() {
      return { ...this.state, history: this.state.history.map(match => ({ ...match })), issue: this.issue };
    }
    recordResult(id, result, difficulty, durationMs) {
      if (typeof id !== 'string' || !id || id.length > 128 || !['victory', 'defeat'].includes(result)
        || !Object.hasOwn(window.WaxArena.AI_DIFFICULTIES, difficulty) || !Number.isFinite(durationMs) || durationMs < 0) throw new RangeError('Invalid match result');
      this.refresh();
      if (this.completed.has(id)) return null;
      const reward = result === 'victory' ? Math.min(WIN_REWARD, Number.MAX_SAFE_INTEGER - this.state.gold) : 0;
      const match = { id, result, difficulty, reward, durationMs, completedAt: Date.now() };
      this.state.gold += reward;
      const counter = result === 'victory' ? 'wins' : 'losses';
      this.state[counter] = Math.min(Number.MAX_SAFE_INTEGER, this.state[counter] + 1);
      this.state.history = [...this.state.history, match].slice(-HISTORY_LIMIT);
      this.completed.add(id);
      this.dirty = true;
      try {
        if (!this.storage) throw new Error('Storage unavailable');
        this.storage.setItem(STORAGE_KEY, JSON.stringify(this.state));
        this.dirty = false;
        this.issue = '';
      } catch { this.issue = 'unavailable'; }
      return { ...match };
    }
  }
  window.WaxArena.ProgressStore = ProgressStore;
  window.WaxArena.PROGRESS_STORAGE_KEY = STORAGE_KEY;
  window.WaxArena.WIN_REWARD = WIN_REWARD;
})();
