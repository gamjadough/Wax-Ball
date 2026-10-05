import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../wakppuball/js/account.js', import.meta.url), 'utf8');
function setup(initial = null) {
  let session = initial, creates = 0, signouts = 0, sessionError = null, updateError = null;
  const updates = [];
  const auth = {
    getSession: async () => ({data: {session}, error: sessionError}),
    getUser: async () => ({data: {user: session?.user}, error: sessionError}),
    refreshSession: async () => ({data: {session}, error: sessionError}),
    updateUser: async (attributes, options) => {
      if(updateError) return {error: updateError};
      updates.push({attributes, options});
      if(attributes.email) session.user.new_email = attributes.email;
      session.user.user_metadata = {...session.user.user_metadata, ...attributes.data};
      return {data: {user: session.user}, error: null};
    },
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
  return {api: window.WakppuAuth, updates, counts: () => ({creates, signouts}),
    confirmEmail: () => {session.user.email = session.user.new_email; session.user.email_confirmed_at='2026-10-05'; session.user.is_anonymous=false;},
    failUpdate: () => {updateError=new Error('email already exists');},
    failSession: () => {sessionError = new Error('session unavailable');}};
}
test('email verification and password setup preserve guest ID before allowing logout', async () => {
  const s=setup({user: {id:'same-guest',is_anonymous:true}});
  assert.equal((await s.api.linkEmail('new@example.test')).data.user.id,'same-guest');
  assert.ok((await s.api.completeEmailLink('sample-password')).error);
  assert.equal(s.updates.length,1);
  s.confirmEmail();
  assert.ok((await s.api.signOut()).error);
  assert.equal((await s.api.completeEmailLink('sample-password')).data.user.id,'same-guest');
  assert.equal((await s.api.signOut()).error,null);
  assert.equal(s.counts().creates,0);assert.equal(s.counts().signouts,1);
  assert.equal(s.updates[0].attributes.data.wakppu_email_link_pending,true);
  assert.equal(s.updates[1].attributes.data.wakppu_email_link_pending,false);
  assert.equal(s.updates[0].options.emailRedirectTo,'https://gamjadough.github.io/Wax-Ball/wakppuball/');
});
test('existing email conflict leaves original guest session unchanged',async()=>{
  const s=setup({user:{id:'original-guest',is_anonymous:true}});s.failUpdate();
  assert.ok((await s.api.linkEmail('used@example.test')).error);
  assert.equal((await s.api.session()).data.session.user.id,'original-guest');
  assert.equal(s.updates.length,0);assert.equal(s.counts().creates,0);
});
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
