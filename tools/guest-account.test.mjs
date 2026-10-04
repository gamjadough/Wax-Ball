import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../wakppuball/js/account.js', import.meta.url), 'utf8');
function setup(initial = null) {
  let session = initial, creates = 0, signouts = 0, sessionError = null;
  const auth = {
    getSession: async () => ({data: {session}, error: sessionError}),
    signInAnonymously: async () => {
      creates++;
      session = {user: {id: `guest-${creates}`, is_anonymous: true}};
      return {data: {session}, error: null};
    },
    signOut: async () => {signouts++; session = null; return {error: null};},
    onAuthStateChange() {},
  };
  const window = {WAKPPU_SERVER: {url: 'https://example.test', anonKey: 'public'}, supabase: {createClient: () => ({auth})}};
  vm.runInNewContext(source, {window});
  return {api: window.WakppuAuth, counts: () => ({creates, signouts}), failSession: () => {sessionError = new Error('session unavailable');}};
}
test('existing guest and email sessions reuse the same ID without creating a guest', async () => {
  for (const is_anonymous of [true, false]) {
    const s = setup({user: {id: 'existing-id', is_anonymous}});
    assert.equal((await s.api.signInAnonymously()).data.session.user.id, 'existing-id');
    assert.equal(s.counts().creates, 0);
  }
});
test('simultaneous and repeated quick starts create only one guest', async () => {
  const s = setup();
  const results = await Promise.all([s.api.signInAnonymously(), s.api.signInAnonymously()]);
  assert.equal(results[0].data.session.user.id, results[1].data.session.user.id);
  assert.equal((await s.api.signInAnonymously()).data.session.user.id, 'guest-1');
  assert.equal(s.counts().creates, 1);
});
test('guest logout preserves identity; email logout remains available', async () => {
  const guest = setup({user: {id: 'guest-existing', is_anonymous: true}});
  assert.ok((await guest.api.signOut()).error);
  assert.equal(guest.counts().signouts, 0);
  assert.equal((await guest.api.session()).data.session.user.id, 'guest-existing');
  const email = setup({user: {id: 'email-existing', is_anonymous: false}});
  assert.equal((await email.api.signOut()).error, null);
  assert.equal(email.counts().signouts, 1);
});
test('session lookup failure never creates a replacement account', async () => {
  const s = setup(); s.failSession();
  assert.ok((await s.api.signInAnonymously()).error);
  assert.equal(s.counts().creates, 0);
});
