const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const context = { window: {}, Date, Set, SyntaxError, Error, Number, JSON };
vm.createContext(context);
for (const file of ['config.js', 'progress.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', file), 'utf8'), context);
const { ProgressStore, PROGRESS_STORAGE_KEY } = context.window.WaxArena;
const makeStorage = () => { const data = new Map(); return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) }; };
let checks = 0;
function test(name, run) { run(); checks++; console.log('PASS ' + name); }
test('new player starts with zero balance and record', () => {
  const store = new ProgressStore(makeStorage());
  assert.equal(store.getSnapshot().gold, 0); assert.equal(store.getSnapshot().wins, 0); assert.equal(store.getSnapshot().losses, 0);
});
test('victory awards 50 once, survives reload and rejects duplicate result', () => {
  const storage = makeStorage(); const store = new ProgressStore(storage);
  assert.equal(store.recordResult('match-1', 'victory', 'entry', 1000).reward, 50);
  assert.equal(store.recordResult('match-1', 'victory', 'entry', 1000), null);
  const loaded = new ProgressStore(storage);
  assert.equal(loaded.getSnapshot().gold, 50); assert.equal(loaded.getSnapshot().wins, 1);
  assert.equal(loaded.recordResult('match-1', 'victory', 'entry', 1000), null);
});
test('defeat counts once without granting or removing gold', () => {
  const store = new ProgressStore(makeStorage()); store.recordResult('win', 'victory', 'advanced', 1000);
  assert.equal(store.recordResult('loss', 'defeat', 'advanced', 1000).reward, 0);
  assert.equal(store.recordResult('loss', 'defeat', 'advanced', 1000), null);
  assert.equal(store.getSnapshot().gold, 50); assert.equal(store.getSnapshot().wins, 1); assert.equal(store.getSnapshot().losses, 1);
});
test('corrupted, unsupported or invalid saved data recover without throwing', () => {
  for (const source of ['bad json', 'null', '{"version":2}', JSON.stringify({ version: 1, gold: -1, wins: 0, losses: 0, history: [] }), JSON.stringify({ version: 1, gold: 0, wins: 0, losses: 0, history: [{}] })]) {
    const storage = makeStorage(); storage.setItem(PROGRESS_STORAGE_KEY, source); const store = new ProgressStore(storage);
    assert.equal(store.getSnapshot().issue, 'corrupt'); assert.equal(store.getSnapshot().gold, 0);
    store.recordResult('new', 'victory', 'beginner', 10);
    assert.equal(new ProgressStore(storage).getSnapshot().gold, 50);
  }
});
test('unavailable storage retains session results and still prevents duplicates', () => {
  const storage = { getItem() { throw new Error('Denied'); }, setItem() { throw new Error('Denied'); } };
  const store = new ProgressStore(storage);
  store.recordResult('one', 'victory', 'beginner', 1000); store.recordResult('two', 'victory', 'beginner', 1000);
  assert.equal(store.getSnapshot().gold, 100); assert.equal(store.getSnapshot().issue, 'unavailable');
  assert.equal(store.recordResult('one', 'victory', 'beginner', 1000), null);
});
test('write failure keeps reward in memory instead of silently losing it', () => {
  const storage = { getItem: () => null, setItem() { throw new Error('Quota'); } };
  const store = new ProgressStore(storage);
  store.recordResult('one', 'victory', 'beginner', 1000); store.recordResult('two', 'defeat', 'beginner', 1000);
  assert.equal(store.getSnapshot().gold, 50); assert.equal(store.getSnapshot().wins, 1); assert.equal(store.getSnapshot().losses, 1);
  assert.equal(store.getSnapshot().issue, 'unavailable');
});
test('another store reads the latest saved balance before recording its match', () => {
  const storage = makeStorage(); const a = new ProgressStore(storage); const b = new ProgressStore(storage);
  a.recordResult('one', 'victory', 'entry', 1000); b.recordResult('two', 'victory', 'advanced', 1000); a.refresh();
  assert.equal(a.getSnapshot().gold, 100); assert.equal(a.getSnapshot().wins, 2);
});
test('history stays bounded and snapshot mutations cannot alter saved progress', () => {
  const store = new ProgressStore(makeStorage());
  for (let i = 0; i < 150; i++) store.recordResult('match-' + i, 'victory', 'entry', 10);
  assert.equal(store.getSnapshot().history.length, 100); assert.equal(store.getSnapshot().wins, 150);
  const copy = store.getSnapshot(); copy.gold = 0; copy.history[0].id = 'changed';
  assert.equal(store.getSnapshot().gold, 7500); assert.notEqual(store.getSnapshot().history[0].id, 'changed');
  assert.equal(store.recordResult('match-0', 'victory', 'entry', 10), null);
});
test('invalid match input cannot change counters or savings', () => {
  const store = new ProgressStore(makeStorage());
  for (const args of [['', 'victory', 'entry', 1], ['id', 'running', 'entry', 1], ['id', 'victory', '__proto__', 1], ['id', 'victory', 'entry', NaN]]) {
    assert.throws(() => store.recordResult(...args), /Invalid match result/);
  }
  assert.equal(store.getSnapshot().gold, 0); assert.equal(store.getSnapshot().history.length, 0);
});
console.log(`${checks} progress checks passed.`);
