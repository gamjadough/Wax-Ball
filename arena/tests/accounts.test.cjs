const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const data = new Map(), sessions = new Map();
const storage = map => ({ getItem: key => map.get(key) ?? null, setItem: (key,value) => map.set(key,value), removeItem: key => map.delete(key) });
const context = { window: { localStorage: storage(data), sessionStorage: storage(sessions) }, URLSearchParams, AbortSignal, Date, Set, Map, Error, Number, JSON };
vm.createContext(context);
for (const file of ['config.js','progress.js','account-config.js','firebase-account.js']) vm.runInContext(fs.readFileSync(path.join(__dirname,'..','js',file),'utf8'),context);
const { AccountClient, CloudProgressStore } = context.window.WaxArena;
const settings = { apiKey:'public-test-key', projectId:'arena-test', databaseURL:'https://arena-test-default-rtdb.firebaseio.com' };
const id = '11111111-1111-4111-8111-111111111111';
const match = { id, result:'victory', difficulty:'entry', durationMs:10, completedAt:Date.now() };
let checks = 0;
async function test(name, run) { await run(); checks++; console.log('PASS '+name); }
const respond = (body, status = 200) => ({ ok:status < 400, status, json:async () => body });
(async () => {
  await test('unconfigured account service makes no network requests', async () => {
    const client = new AccountClient({}); assert.equal(client.configured,false);
    await assert.rejects(client.signIn('a@example.test','password123'), /준비 중/);
  });
  await test('signup sends verification without keeping a logged in session or password', async () => {
    const requests=[]; const client = new AccountClient(settings);
    context.fetch=async (url,options) => { requests.push({ url, body:JSON.parse(options.body) }); return respond({ idToken:'signup-token', refreshToken:'refresh', localId:'alice' }); };
    assert.equal(await client.signUp('a@example.test','password123','민트'),false);
    assert.equal(client.session,null); assert.equal(requests[2].body.requestType,'VERIFY_EMAIL');
    assert.equal(JSON.stringify([...sessions]).includes('password123'),false);
  });
  await test('unverified login is rejected and verified profile is taken from server', async () => {
    const client = new AccountClient(settings); let verified=false;
    context.fetch=async url => respond(url.includes(':lookup') ? { users:[{ localId:'alice', emailVerified:verified, displayName:'민트' }] } : { idToken:'login',refreshToken:'refresh',localId:'alice' });
    await assert.rejects(client.signIn('a@example.test','password123'), /인증 링크/); assert.equal(client.session,null);
    verified=true; await client.signIn('a@example.test','password123'); assert.equal(client.session.user.user_metadata.nickname,'민트');
  });
  await test('concurrent refresh uses one form-encoded request and does not save password', async () => {
    const client = new AccountClient(settings); client.saveSession({ idToken:'expired',refreshToken:'refresh',localId:'alice',expiresIn:-1 }); let requests=0;
    context.fetch=async (url,options) => { requests++; assert.equal(options.headers['Content-Type'],'application/x-www-form-urlencoded'); assert.match(options.body,/grant_type=refresh_token/); return respond({ id_token:'renewed',refresh_token:'new-refresh',expires_in:'3600' }); };
    await Promise.all([client.accessToken(),client.accessToken()]); assert.equal(requests,1); assert.equal(client.session.access_token,'renewed');
    assert.equal(JSON.stringify([...sessions]).includes('password123'),false);
  });
  await test('cloud reward remains pending on network failure and is saved once after retry', async () => {
    data.clear(); let offline=true; const matches=new Map(); let writes=0;
    const client={ session:{user:{id:'alice'}}, recordMatch:async row => { if(offline) throw Error('offline'); if(!matches.has(row.id)) { matches.set(row.id,row); writes++; } }, fetchProgress:async () => { if(offline) throw Error('offline'); return { gold:matches.size*50,wins:matches.size,losses:0,history:[...matches.values()] }; } };
    const store=new CloudProgressStore(client); store.recordResult(id,'victory','entry',10); await store.refresh();
    assert.equal(store.getSnapshot().gold,0); assert.equal(store.getSnapshot().pending,1); assert.equal(store.getSnapshot().issue,'pending');
    assert.equal(store.recordResult(id,'victory','entry',10),null);
    const restored=new CloudProgressStore(client); assert.equal(restored.getSnapshot().pending,1);
    offline=false; await restored.refresh(); await restored.refresh(); assert.equal(restored.getSnapshot().gold,50); assert.equal(restored.getSnapshot().pending,0); assert.equal(writes,1);
  });
  await test('failed cache writes remain visibly volatile while offline', async () => {
    const previous=context.window.localStorage;
    context.window.localStorage={getItem:()=>null,setItem:()=>{throw Error('quota');}};
    const store=new CloudProgressStore({session:{user:{id:'quota'}},recordMatch:async()=>{throw Error('offline');},fetchProgress:async()=>{throw Error('offline');}});
    store.recordResult(id,'victory','entry',10); await store.refresh(); assert.equal(store.getSnapshot().issue,'volatile');
    context.window.localStorage=previous;
  });
  await test('account queues are isolated and a changed session cannot upload another player record', async () => {
    const client={ session:{user:{id:'bob'}}, recordMatch:async()=>{throw Error('offline');}, fetchProgress:async()=>{throw Error('offline');} };
    const store=new CloudProgressStore(client); assert.equal(store.getSnapshot().gold,0); assert.equal(store.getSnapshot().pending,0);
    client.session.user.id='alice'; await store.refresh(); assert.equal(store.getSnapshot().issue,'offline');
  });
  await test('logout removes session credentials', async () => {
    const client=new AccountClient(settings); client.saveSession({idToken:'access',refreshToken:'refresh',localId:'alice'}); await client.signOut();
    assert.equal(client.session,null); assert.equal(sessions.size,0);
  });
  console.log(`${checks} account checks passed (simulated backend).`);
})().catch(error=>{ console.error(error); process.exitCode=1; });
