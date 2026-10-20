import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes,scryptSync,timingSafeEqual} from 'node:crypto';
import {createStore} from './admin-service.mjs';
import {execute} from './input-guard-service.mjs';
import {itemData,itemState,snapshot} from './items-service.mjs';
import {limitedState,limitedSnapshot} from './limited-service.mjs';
import {skinAction,skinState} from './skins-service.mjs';
import {createDemoPayments} from './payment-demo-service.mjs';
const paymentsEnabled=process.env.WAKPPU_LOCAL_PAYMENTS==='1',demoPayments=createDemoPayments();
const bankPreview=process.env.WAKPPU_LOCAL_BANK_PREVIEW==='1'?await (await import('./manual-bank-preview.mjs')).createBankPreview():null;
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../wakppuball');
const store=createStore(),sessions=new Map();
// Opt-in, isolated onboarding preview. Never changes production or other previews.
if(process.env.WAKPPU_LOCAL_BEGINNER_PREVIEW==='1')for(const actor of store.players)if(actor.role!=='admin')actor.state.gold='0';
// Test clock is available only in this isolated loopback server.
if(process.env.WAKPPU_LOCAL_SLEEP_TIME){const time=Date.parse(process.env.WAKPPU_LOCAL_SLEEP_TIME);if(!Number.isFinite(time))throw new Error('Invalid local sleep test time');store.sleep_now_ms=time;}
const password=randomBytes(9).toString('base64url');
const passwordSalt=randomBytes(16);
const localUser=actor=>({id:actor.id,email:actor.email||null,is_anonymous:actor.role!=='admin'&&!actor.localAuth?.verified,
  email_confirmed_at:actor.localAuth?.verified||null,user_metadata:{wakppu_email_link_pending:!!actor.localAuth?.pending}});
const port=Number(process.env.WAKPPU_LOCAL_PORT||4173);
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.wav':'audio/wav','.mp3':'audio/mpeg'};
const server=http.createServer(async(req,res)=>{
  const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
  try {
    if(req.method==='POST'&&req.url.startsWith('/local/')) {
      if(req.headers.origin&&req.headers.origin!==`http://localhost:${port}`&&req.headers.origin!==`http://127.0.0.1:${port}`) return send(403,{error:'origin not allowed'});
      let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>20000)return send(413,{error:'request too large'});}const body=JSON.parse(raw);
      if(req.url==='/local/login') {
        const admin=body.email==='dodoonglee@gmail.com';if(admin&&body.password!==password)return send(401,{error:'로컬 테스트 비밀번호가 틀립니다.'});
        const actor=admin?store.players[0]:body.email==='guest'?store.players[1]:store.players.find(p=>p.localAuth?.verified&&p.email===body.email);
        if(!actor||(!admin&&body.email!=='guest'&&(!actor.localAuth?.passwordHash||!timingSafeEqual(actor.localAuth.passwordHash,scryptSync(String(body.password),passwordSalt,32)))))return send(401,{error:'이메일 또는 비밀번호가 틀립니다.'});
        if(body.email==='guest'&&!actor.lifecycle)actor.lifecycle={created_at:new Date().toISOString(),first_play_at:null};
        const token=randomBytes(24).toString('hex');sessions.set(token,actor);return send(200,{token,user:localUser(actor)});
      }
      const actor=sessions.get(req.headers.authorization?.replace(/^Bearer /,''));
      if(req.url==='/local/payments'||req.url==='/local/payments-demo-link'){
        if(!paymentsEnabled)return send(404,{error:'모의 결제 서버가 꺼져 있습니다.'});
        execute(store,actor,{action:'bootstrap'}); // Keep bans, maintenance and session checks.
        if(req.url==='/local/payments-demo-link'){
          actor.email||='demo@local.test';
          actor.localAuth={...actor.localAuth,email:actor.email,verified:new Date().toISOString(),pending:false};
          return send(200,{ok:true,user:localUser(actor)});
        }
        return send(200,demoPayments.execute(actor,body));
      }
      if(req.url==='/local/input-guard-demo'&&process.env.WAKPPU_LOCAL_INPUT_GUARD_PREVIEW==='1'){
        if(!actor)return send(401,{error:'로컬 샘플 로그인이 필요합니다.'});
        const {scenario}=await import('./input-guard-preview.mjs');return send(200,scenario(store,body.mode));
      }
      if(req.url==='/local/sleep-clock'&&process.env.WAKPPU_LOCAL_SLEEP_TIME){
        if(actor?.role!=='admin')return send(403,{error:'로컬 관리자 로그인 필요'});
        const time=Date.parse(body.time);if(!Number.isFinite(time))return send(400,{error:'잘못된 로컬 테스트 시각'});
        store.sleep_now_ms=time;return send(200,{server_time:new Date(time).toISOString()});
      }
      if(req.url==='/local/halloween-demo'){
        if(!actor)return send(401,{error:'로컬 로그인 필요'});
        store.limited_preview=body.mode==='ended'?'ended':'active';const limited=limitedState(actor);
        if(body.mode!=='ended'){limited.tokens=100;limited.owned={};limited.selected=null;limited.clicks=0;limited.requests.clear();actor.state.gold='100000000';actor.state.hammer_owned=true;actor.state.hammer_level=30;actor.state.rebirths=0;actor.state.unlocked_ball_ids=['yellow','green'];actor.state.selected_ball_id='green';actor.state.current_clicks=0;const inv=itemState(actor);inv.effects={};inv.revision++;actor.state.item_revision=inv.revision;}
        return send(200,limitedSnapshot(store,actor));
      }
      if(req.url==='/local/items-demo'){
        if(!actor)return send(401,{error:'로컬 로그인 필요'});
        actor.state.gold='100000000000000000000';const inv=itemState(actor);
        inv.inventory=Object.fromEntries(itemData.list.map(d=>[d.id,3]));inv.effects={};inv.pity=98;inv.total=98;inv.revision++;actor.state.item_revision=inv.revision;
        return send(200,snapshot(actor));
      }
      if(req.url==='/local/email-link'||req.url==='/local/verify-email'||req.url==='/local/complete-email-link'){
        if(!actor)return send(401,{error:'로그인이 필요합니다.'});
        if(req.url==='/local/email-link'){
          if(!localUser(actor).is_anonymous)return send(400,{error:'빠른 시작 계정에서 연결해주세요.'});
          if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email))return send(400,{error:'올바른 이메일 주소를 입력하세요.'});
          if(store.players.some(p=>p.email===body.email&&p.id!==actor.id))return send(409,{error:'이미 사용 중인 이메일입니다.'});
          actor.localAuth={email:body.email,pending:true,verified:null};
        }else if(req.url==='/local/verify-email'){
          if(!actor.localAuth?.pending)return send(400,{error:'이메일 연결을 먼저 시작해주세요.'});
          actor.email=actor.localAuth.email;actor.localAuth.verified=new Date().toISOString();
        }else{
          if(!actor.localAuth?.verified||!actor.localAuth?.pending)return send(400,{error:'이메일 인증을 먼저 완료해주세요.'});
          if(String(body.password||'').length<6)return send(400,{error:'비밀번호는 6자 이상입니다.'});
          actor.localAuth.passwordHash=scryptSync(body.password,passwordSalt,32);actor.localAuth.pending=false;
        }
        return send(200,{user:localUser(actor)});
      }
      if(req.url==='/local/skins-demo'){
        if(!actor)return send(401,{error:'로컬 로그인 필요'});
        actor.state.gold='100000000000000000000000';actor.state.unlocked_ball_ids.push('eternity');
        actor.state.selected_ball_id='yellow';actor.state.current_clicks=0;
        actor.skins=null;
        const skins=skinState(actor);skins.pity=99;skins.shards=1000n;
        return send(200,{ok:true});
      }
      if(['skins','skin_draw','skin_exchange','skin_equip'].includes(body.action)){
        execute(store,actor,{action:'bootstrap'});return send(200,skinAction(actor,body));
      }
      if(body.action?.startsWith('purchase_')||body.action?.startsWith('admin_purchase_')){
        if(!bankPreview)return send(404,{error:'수동 계좌이체 로컬 미리보기를 실행해주세요.'});
        execute(store,actor,{action:'bootstrap'});
        try{return send(200,await bankPreview.execute(actor,body));}catch(error){if(/^PT\d{3}$/.test(error.code))error.status=Number(error.code.slice(2));throw error;}
      }
      if(body.action==='rankings'&&bankPreview){const result=execute(store,actor,body),supporters=await bankPreview.supporters();return send(200,result.map(row=>({...row,supporter:supporters.includes(row.nickname)})));}
      if(bankPreview)actor.supporterPack=await bankPreview.ownsSupporter(actor);
      return send(200,execute(store,actor,body));
    }
    const url=new URL(req.url,'http://localhost');let name=decodeURIComponent(url.pathname);
    if(name==='/local-pumpkin-skins'||name.startsWith('/local-pumpkin-skins/')){
      const asset=name.replace(/^\/local-pumpkin-skins\/?/,'')||'index.html';
      if(!['index.html','preview.css','preview.js'].includes(asset))return send(404,{error:'not found'});
      const data=await readFile(new URL('./pumpkin-skins-preview/'+asset,import.meta.url));
      res.writeHead(200,{'Content-Type':types[path.extname(asset)]||'application/octet-stream','Cache-Control':'no-store'});return res.end(data);
    }
    if(name.startsWith('/local-payments/')){
      const asset=name.slice('/local-payments/'.length);
      if(!paymentsEnabled||!['store.js','store.css','checkout.html','checkout.js','client.js'].includes(asset))return send(404,{error:'not found'});
      const data=await readFile(new URL('./payment-demo/'+asset,import.meta.url));
      res.writeHead(200,{'Content-Type':types[path.extname(asset)]||'application/octet-stream','Cache-Control':'no-store'});return res.end(data);
    }
    if(name==='/'||name==='/wakppuball/')name='/index.html';name=name.replace(/^\/wakppuball\//,'/');
    const file=path.resolve(root,'.'+name);if(!file.startsWith(root+path.sep))return send(403,{error:'forbidden'});
    let data=await readFile(file);
    if(name==='/index.html') data=Buffer.from(data.toString().replace(/<script src="js\/account.js[^\"]*"><\/script>/,'<script src="js/local-account.js"></script>'));
    if(name==='/index.html'&&paymentsEnabled&&url.searchParams.get('preview')==='payments')data=Buffer.from(data.toString().replace('</body>','<link rel="stylesheet" href="/local-payments/store.css"><script type="module" src="/local-payments/store.js"></script></body>'));
    if(name==='/index.html'&&bankPreview&&url.searchParams.get('preview')==='bank')data=Buffer.from(data.toString().replace('</body>',`<script src="js/local-bank-preview.js"></script><script>WakppuLocalBankPreview(${JSON.stringify(password)});</script></body>`));
    if(name==='/index.html'&&url.searchParams.get('preview')==='inputguard'&&process.env.WAKPPU_LOCAL_INPUT_GUARD_PREVIEW==='1')data=Buffer.from(data.toString().replace('</body>',`<script src="js/local-input-guard-preview.js"></script><script>WakppuLocalInputGuardPreview(${JSON.stringify(password)});</script></body>`));
    if(name==='/index.html'&&url.searchParams.get('preview')==='whitehole')data=Buffer.from(data.toString().replace('</body>','<script src="js/local-whitehole-preview.js"></script></body>'));
    if(name==='/index.html'&&url.searchParams.get('preview')==='transcendent')data=Buffer.from(data.toString().replace('</body>','<script src="js/local-transcendent-preview.js"></script></body>'));
    if(name==='/index.html'&&url.searchParams.get('preview')==='skin-sounds')data=Buffer.from(data.toString().replace('</body>','<script src="js/local-skin-inventory-preview.js"></script></body>'));
    if(name==='/index.html'&&url.searchParams.get('preview')==='items')data=Buffer.from(data.toString().replace('</body>','<script src="js/local-items-preview.js"></script></body>'));
    if(name==='/index.html'&&url.searchParams.get('preview')==='halloween')data=Buffer.from(data.toString().replace('</body>','<script src="js/local-halloween-preview.js"></script></body>'));
    if(name==='/index.html'&&url.searchParams.get('preview')==='adminball')data=Buffer.from(data.toString().replace('</body>',`<script src="js/local-admin-ball-preview.js"></script><script>WakppuLocalAdminBallPreview(${JSON.stringify(password)});</script></body>`));
    if(name==='/index.html'&&url.searchParams.get('preview')==='rebirth500')data=Buffer.from(data.toString().replace('</body>',`<script src="js/local-rebirth-preview.js"></script><script>WakppuLocalRebirthPreview(${JSON.stringify(password)});</script></body>`));
    res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);
  }catch(e){send(e.status|| (e.code==='ENOENT'?404:400),{error:e.message});}
});
server.listen(port,'127.0.0.1',()=>{console.log(`Local preview: http://127.0.0.1:${port}\nAdmin: dodoonglee@gmail.com\nLocal test password: ${password}\nProduction data is not connected. Sample data resets when this server restarts.`);});
